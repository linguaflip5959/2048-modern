/* =========================================================================
   2048 · platform.js — SDK Яндекс Игр и VK Bridge (ревизия 8)
   -------------------------------------------------------------------------
   • Оба SDK подгружаются ДИНАМИЧЕСКИ и безопасно: на file:// и обычном
     хостинге (нет платформы / нет сети) игра работает как раньше —
     реклама показывается демо-плеером из js/ads.js.
   • [ревизия 6] SDK подключаются ТОЛЬКО на своей площадке — иначе не
     грузятся вовсе (раньше sdk.js качался на любом http-хостинге и
     печатал в консоль «SDK initialization outside of frame», а мост
     VK качался с unpkg даже без мини-приложения). Признаки площадки:
     VK — параметр vk_app_id в URL (мини-приложение всегда в iframe
     с ним), Яндекс — игра внутри iframe (self!==top); на верхнем
     уровне SDK Яндекс неработоспособен по определению.
   • VK Bridge: https://unpkg.com/@vkontakte/vk-bridge (фолбэк — jsdelivr).
     Проверка isEmbedded() / vk_app_id; VKWebAppInit при старте;
     нативная реклама VKWebAppShowNativeAds: rewarded И interstitial.
   • SDK Яндекс Игр: https://sdk.games.s3.yandex.net/sdk.js — YaGames.init()
     c таймаутом; LoadingAPI.ready() после загрузки игры (вызывает main.js
     по событию Phaser 'ready'); реклама: showRewardedVideo И
     showFullscreenAdv (interstitial).
   • РЕВИЗИЯ 8, [F10]: формат rewarded-рекламы VK — ad_format:'reward'
     (значение из официальной документации VK Bridge; раньше посылали
     несуществующее 'rewarded' — площадка отклоняла вызов, награда за
     просмотр НЕ выдавалась на VK).
   • РЕВИЗИЯ 8, GameplayAPI (Яндекс, обязателен к публикации): start()
     когда игрок играет, stop() на паузах/поражении/рекламе/сворачивании
     вкладки. Состояние вычисляет gpActive() (SCENE + оверлеи + видимость),
     дёргается из hud.syncControls() → Platform.gameplaySync().
   • Аналитика: za() из util.js — события ad_shown/ad_reward/ad_fail/
     ad_unavailable с type+place (ad_request трекается в ads.js).
   • Приоритет платформы: VK (если встроены) > Яндекс.
   ========================================================================= */
'use strict';
/* window.Platform (не const): к global объекту привязываем явно —
   const/let верхнего уровня не попадают в window, а main.js проверяет
   именно window.Platform */
window.Platform=(function(){
  const P={type:'none',ysdk:null,vk:null};
  const HTTP=(location.protocol==='https:'||location.protocol==='http:');  /* file:// — без платформы */

  function loadScript(src,timeout){
    return new Promise(resolve=>{
      const s=document.createElement('script');
      let done=false;
      const fin=ok=>{if(done)return;done=true;resolve(ok);};
      s.onload=()=>fin(true);
      s.onerror=()=>fin(false);
      window.setTimeout(()=>fin(false),timeout||6000);
      s.src=src;
      document.head.appendChild(s);
    });
  }
  const race=(p,ms)=>Promise.race([p,new Promise((_,rej)=>window.setTimeout(rej,ms))]);

  /* --- [ревизия 8] GameplayAPI (Яндекс): старт/стоп геймплея ---
     start — игрок играет; stop — пауза/поражение/реклама/свёрнутая вкладка.
     Повторные вызовы в том же состоянии подавлены (gpOn), чтобы
     syncControls() на каждом ходе не спамил событиями. */
  let gpOn=false;
  function gpActive(){
    try{ return !!(typeof SCENE!=='undefined'&&SCENE&&SCENE.ready&&!SCENE.over
      &&!uiBlocked()&&!document.hidden); }
    catch(e){ return false; }
  }
  function gameplay(on){
    if(on===gpOn)return; gpOn=on;
    try{
      if(P.ysdk&&P.ysdk.features&&P.ysdk.features.GameplayAPI)
        P.ysdk.features.GameplayAPI[on?'start':'stop']();
    }catch(e){}
  }
  function gameplaySync(){ gameplay(gpActive()); }

  /* --- VK Bridge --- */
  async function initVK(){
    if(!HTTP)return false;
    /* [ревизия 6] мост нужен только в мини-приложении VK — оно всегда
       открывается в iframe с vk_app_id в URL. Вне площадки не качаем. */
    if(!new URLSearchParams(location.search).has('vk_app_id'))return false;
    const urls=['https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js',
                'https://cdn.jsdelivr.net/npm/@vkontakte/vk-bridge/dist/browser.min.js'];
    let ok=false;
    for(const u of urls){ if(await loadScript(u,6000)){ok=true;break;} }
    const vb=window.vkBridge;
    if(!ok||!vb||typeof vb.send!=='function')return false;
    let embedded=false;
    if(typeof vb.isEmbedded==='function'){try{embedded=vb.isEmbedded();}catch(e){}}
    else embedded=new URLSearchParams(location.search).has('vk_app_id');
    if(!embedded)return false;
    P.vk=vb;P.type='vk';
    race(vb.send('VKWebAppInit'),3000).catch(()=>{});   /* стандартное событие старта */
    return true;
  }

  /* --- Yandex Games SDK --- */
  async function initYandex(){
    if(!HTTP)return false;
    /* [ревизия 6] SDK работоспособен только внутри iframe Яндекс Игр:
       на верхнем уровне (self===top) он лишь качается и печатает
       «SDK initialization outside of frame». Не грузим вовсе. */
    if(window.self===window.top)return false;
    if(!(await loadScript('https://sdk.games.s3.yandex.net/sdk.js',6000)))return false;
    if(!window.YaGames||typeof window.YaGames.init!=='function')return false;
    try{
      P.ysdk=await race(window.YaGames.init(),7000);
      if(P.ysdk&&P.type!=='vk')P.type='yandex';
      return !!P.ysdk;
    }catch(e){P.ysdk=null;return false;}
  }

  /* --- нативная реклама через штатные точки расширения ads.js --- */
  function installAds(){
    if(P.type==='yandex'&&P.ysdk&&P.ysdk.adv){
      /* rewarded: награда — только по onRewarded; исходы в аналитику */
      window.REWARDED_ADS={show(onReward,onCancel,place){
        place=place||'undo';
        let got=false,settled=false;
        const done=ok=>{if(settled)return;settled=true;gameplaySync();
          ok?(onReward&&onReward()):(onCancel&&onCancel());};
        gameplay(false);                          /* GameplayAPI.stop перед рекламой */
        try{
          P.ysdk.adv.showRewardedVideo({callbacks:{
            onOpen:()=>{za('ad_shown',{type:'rewarded',place:place});},
            onRewarded:()=>{got=true;za('ad_reward',{type:'rewarded',place:place});},
            onClose:()=>done(got),
            onError:()=>{za('ad_fail',{type:'rewarded',place:place});done(false);}
          }});
        }catch(e){za('ad_fail',{type:'rewarded',place:place});done(false);}
      }};
      /* interstitial [ревизия 8]: close(wasShown) вызывается ВСЕГДА,
         даже после onError (документация SDK) — errd не даёт двойных
         событий; таймаут-фолбэк страхует от зависшего колбэка */
      window.INTERSTITIAL_ADS={show(onDone,place){
        place=place||'restart';
        let settled=false,errd=false;
        const done=s=>{if(settled)return;settled=true;gameplaySync();onDone&&onDone(s);};
        gameplay(false);
        const to=window.setTimeout(()=>{za('ad_fail',{type:'interstitial',place:place});done(false);},45000);
        try{
          P.ysdk.adv.showFullscreenAdv({callbacks:{
            onClose:(wasShown)=>{
              window.clearTimeout(to);
              if(!errd)za(wasShown?'ad_shown':'ad_unavailable',{type:'interstitial',place:place});
              done(!!wasShown);
            },
            onError:()=>{errd=true;window.clearTimeout(to);za('ad_fail',{type:'interstitial',place:place});done(false);}
          }});
        }catch(e){window.clearTimeout(to);za('ad_fail',{type:'interstitial',place:place});done(false);}
      }};
    }else if(P.type==='vk'&&P.vk){
      /* на десктопе VK нативной рекламы может не быть — отклонение
         уходит в onCancel, игра продолжает работать */
      window.REWARDED_ADS={show(onReward,onCancel,place){
        place=place||'undo';
        let settled=false;
        const done=ok=>{if(settled)return;settled=true;gameplaySync();
          ok?(onReward&&onReward()):(onCancel&&onCancel());};
        gameplay(false);
        /* [F10] имя формата — 'reward' (не 'rewarded'): с 'rewarded'
           площадка отклоняет вызов (invalid ad_format) */
        P.vk.send('VKWebAppShowNativeAds',{ad_format:'reward'})
          .then(r=>{const ok=!!(r&&r.result);
            if(ok){za('ad_shown',{type:'rewarded',place:place});
                   za('ad_reward',{type:'rewarded',place:place});}
            else za('ad_unavailable',{type:'rewarded',place:place});
            done(ok);})
          .catch(()=>{za('ad_fail',{type:'rewarded',place:place});done(false);});
      }};
      window.INTERSTITIAL_ADS={show(onDone,place){
        place=place||'restart';
        gameplay(false);
        P.vk.send('VKWebAppShowNativeAds',{ad_format:'interstitial'})
          .then(r=>{const ok=!!(r&&r.result);
            za(ok?'ad_shown':'ad_unavailable',{type:'interstitial',place:place});
            onDone&&onDone(ok);gameplaySync();})
          .catch(()=>{za('ad_fail',{type:'interstitial',place:place});
            onDone&&onDone(false);gameplaySync();});
      }};
    }
  }

  /* --- автоинициализация (не блокирует загрузку игры) --- */
  (async function(){
    try{
      const vk=await initVK();
      await initYandex();
      if(vk||P.type==='yandex')installAds();
      flushReady();            /* платформа могла определиться ПОСЛЕ boot Phaser */
    }catch(e){/* платформа не определена — игра работает автономно */}
  })();

  /* LoadingAPI.ready(): событие 'ready' Phaser и инициализация SDK
     приходят в произвольном порядке — сигнал шлём, когда есть ОБА */
  let readyWanted=false,readySent=false;
  function flushReady(){
    if(readySent||!readyWanted)return;
    try{
      if(P.ysdk&&P.ysdk.features&&P.ysdk.features.LoadingAPI){
        P.ysdk.features.LoadingAPI.ready();
        readySent=true;
      }
    }catch(e){}
  }

  return {
    get type(){return P.type;},          /* 'vk' | 'yandex' | 'none' */
    gameReady(){                          /* вызывается из main.js после boot Phaser */
      readyWanted=true;
      flushReady();
    },
    gameplaySync:gameplaySync             /* [ревизия 8] Яндекс GameplayAPI start/stop */
  };
})();
