/* analytics.js — единое ядро аналитики · Game Analytics Standard v1.0
   ============================================================================
   ПРИСПОСОБЛЕН ДЛЯ «2048 · Modern Minimal» (ревизия 8) из модуля
   Судоку-дзен. Игра-агностичное ядро ведёт сессии, очередь, тех-ошибки
   и отправку; специфические события 2048 шлются вызовами za(...) из
   game-файлов (js/{scene,main,ads,platform}.js).

   Возможности (§12 стандарта):
   - инициализация и общие параметры (платформа, устройство, язык, экран)
   - регистрация игровых событий za(имя, параметры, категория) — обёртка
     над ZA.track в util.js (безопасна при отсутствующем модуле)
   - локальная очередь в localStorage при отсутствии транспорта/интернета
   - досылка накопленного (online / таймер / pagehide через sendBeacon)
   - защита от дублей (eid + окно дедупликации)
   - сбор JS-ошибок, ошибок ресурсов, долгих задач (longtask)
   - отключение отдельных категорий: ZA.disable('ads')  (game/ui/ads/tech/session)
   - расширение без правки ядра: ZA.setStateProvider(fn), ZA.CFG.*

   Инициализация (2048): по ПЕРВОМУ действию игрока (main.js) — игра без
   диалога согласия, поэтому транспорт стартует только с реальным игроком,
   а не с каждым открытием страницы.

   Транспорты:
   - Яндекс.Метрика: METRIKA_ID (ниже) — скрипт счётчика загружается сам.
     114075082 — отдельный счётчик 2048-modern. На file:// счётчик
     НЕ грузится (локальные прогоны не мусорят статистику) — события
     копятся в локальной очереди.
   - свой коллектор: впишите ENDPOINT (POST JSON: {env, events[]})

   СОБЫТИЯ 2048 (поверх стандартных session_* / tech / ad_*):
   ~ партия:  level_start{mode,size,cached}, game_restart, game_win{score,
              sec,max_tile,moves}, game_fail{...,filled_pct}, game_continue,
              undo_used{free}, shuffle_used{tiles}, revive_used{tiles}
   ~ реклама: ad_request/ad_shown/ad_reward/ad_fail/ad_unavailable
              {type: rewarded|interstitial, place: undo|shuffle|revive|
              restart|game_over}  (демо-плеер и нативные SDK)
   ~ ui:      ui_settings{setting: theme|lang|sound, value}

   Отладка: откройте игру с параметром ?za-debug — все события пишутся
   в консоль. Проверка вручную: ZA.state() (сводка), ZA.dump() (очередь).
   ============================================================================ */
window.ZA=(function(){
  'use strict';

  /* ------------------------- настройки ------------------------- */
  const CFG={
    GAME:'2048-modern',       /* название игры */
    VER:'8',                  /* версия игры (ревизия) */
    METRIKA_ID:114075082,     /* ← ID счётчика Яндекс.Метрики (число) или null.
                                 Отдельный счётчик 2048-modern (не общий с Судоку-дзен) */
    ENDPOINT:null,            /* ← URL своего коллектора (POST JSON) или null */
    QUEUE_KEY:'g2048_za_queue',
    UID_KEY:'g2048_za_uid',
    FIRST_KEY:'g2048_za_first',
    QUEUE_MAX:400,            /* локальная очередь — не более N событий (FIFO) */
    PENDING_MAX:60,           /* буфер до инициализации */
    FLUSH_MS:30000,           /* периодическая попытка досылки */
    FLUSH_MIN:8,              /* порог досылки без ожидания таймера */
    DEDUP_MS:400,             /* окно подавления точных дублей */
    ERR_MAX:30                /* потолок тех-ошибок за сессию */
  };
  const DEBUG=(function(){ try{ return /[?&]za-debug/.test(location.search); }catch(e){ return false; } })();

  /* категории событий; отключаются так: ZA.disable('ads') */
  const disabled={};

  /* ------------------------- состояние ------------------------- */
  let enabled=false, uid=null, sid='', sessStart=0, seq=0, env=null;
  let queue=[], pending=[], last={}, stateProvider=null;
  let errCount=0, pauseCount=0, resumeCount=0, longtaskCount=0, longtaskWorst=0;
  let flushing=false, flushTimer=0, persistTimer=0, hiddenAt=0, closed=false;
  let mkReady=false;                /* скрипт Метрики реально загружен */

  /* ------------------------- утилиты ------------------------- */
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function short(s,n){ s=String(s==null?'':s); return s.length>n?s.slice(0,n):s; }
  function uuid(){
    try{
      const b=new Uint8Array(16);
      (window.crypto||window.msCrypto).getRandomValues(b);
      b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80;
      let h=''; for(let i=0;i<16;i++) h+=('0'+b[i].toString(16)).slice(-2);
      return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
    }catch(e){
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){
        const r=Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16);
      });
    }
  }
  function dayKey(d){ d=d||new Date();
    return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function daysSince(dateStr){
    try{
      const p=dateStr.split('-').map(Number);
      const then=new Date(p[0],p[1]-1,p[2]).getTime();
      const t=new Date(); t.setHours(0,0,0,0);
      return Math.max(0, Math.round((t-then)/86400000));
    }catch(e){ return 0; }
  }
  /* краткая сводка браузера/ОС вместо полного UA (§7: без лишних данных) */
  function browserShort(){
    const ua=navigator.userAgent||''; let name='unknown',ver='',m;
    if((m=ua.match(/YaBrowser\/([\d.]+)/))){ name='Yandex'; ver=m[1]; }
    else if((m=ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/))){ name='Edge'; ver=m[1]; }
    else if((m=ua.match(/OPR\/([\d.]+)/))){ name='Opera'; ver=m[1]; }
    else if((m=ua.match(/SamsungBrowser\/([\d.]+)/))){ name='Samsung'; ver=m[1]; }
    else if((m=ua.match(/Firefox\/([\d.]+)/))){ name='Firefox'; ver=m[1]; }
    else if((m=ua.match(/Chrome\/([\d.]+)/))){ name='Chrome'; ver=m[1]; }
    else if((m=ua.match(/Version\/([\d.]+).*Safari/))){ name='Safari'; ver=m[1]; }
    let os='unknown';
    if((m=ua.match(/Android[ /]([\d.]+)/))) os='Android '+m[1];
    else if(/iPhone|iPad|iPod/.test(ua)){ m=ua.match(/OS (\d+_?\d*)/); os='iOS'+(m?' '+m[1].replace('_','.'):''); }
    else if(/Windows/.test(ua)) os='Windows';
    else if(/Mac OS X/.test(ua)) os='macOS';
    else if(/Linux/.test(ua)) os='Linux';
    return name+(ver?' '+ver.split('.')[0]:'')+' / '+os;
  }
  function detectEnv(){
    const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
    let platform='web';
    try{
      if(/(^|[?&])(api_id|viewer_id|vk_app_id|vk_user_id|vk_platform)=/.test(location.search)
         ||/vk\.com/.test(document.referrer||'')) platform='vk';
    }catch(e){}
    let loadMs=0, domMs=0;
    try{
      const nav=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
      if(nav){ domMs=Math.round(nav.domContentLoadedEventEnd||0); loadMs=Math.round(nav.loadEventEnd||performance.now()); }
      else if(performance.now) loadMs=Math.round(performance.now());
    }catch(e){}
    let tz='UTC';
    try{ const off=-new Date().getTimezoneOffset()/60; tz='UTC'+(off>=0?'+':'')+off; }catch(e){}
    return {
      platform:platform,
      device:isTouch?'mobile':'desktop',
      control:isTouch?'touch':'mouse',
      lang:(navigator.language||'ru'),
      screen:(screen?screen.width+'x'+screen.height:'')+'@'+(window.devicePixelRatio||1),
      tz:tz, browser:browserShort(), load_ms:loadMs, dom_ms:domMs
    };
  }

  /* ------------------------- очередь ------------------------- */
  function loadQueue(){
    try{
      const raw=lsGet(CFG.QUEUE_KEY);
      const q=raw?JSON.parse(raw):[];
      if(Array.isArray(q)) queue=q.filter(e=>e&&e.eid&&e.n);
    }catch(e){ queue=[]; }
  }
  function persist(){
    if(persistTimer){ clearTimeout(persistTimer); persistTimer=0; }
    try{ lsSet(CFG.QUEUE_KEY, JSON.stringify(queue)); }catch(e){}
  }
  function persistSoon(){
    if(persistTimer) return;
    persistTimer=setTimeout(function(){ persistTimer=0; persist(); },400);
  }

  /* ------------------------- события ------------------------- */
  function guessCat(n){
    if(/^ad_/.test(n)) return 'ads';
    if(/^ui_/.test(n)) return 'ui';
    if(/^(js_error|res_error|worker_error|save_error|connection_)/.test(n)) return 'tech';
    if(/^(session_|game_start$|consent_)/.test(n)) return 'session';
    return 'game';
  }
  function track(name, params, cat){
    try{
      cat=cat||guessCat(name);
      if(disabled[cat]) return;
      const p=params||{};
      const key=name+'|'+JSON.stringify(p);
      const t=Date.now();
      if(last[key]&&t-last[key]<CFG.DEDUP_MS) return;    /* защита от дублей */
      last[key]=t;
      const evt={eid:(sid||'pre')+'.'+(++seq)+'.'+t.toString(36), n:name, p:p, c:cat, t:t};
      if(!enabled){                                        /* до инициализации */
        if(pending.length<CFG.PENDING_MAX) pending.push(evt);
        return;
      }
      pushEvt(evt);
    }catch(e){}
  }
  function pushEvt(evt){
    queue.push(evt);
    if(queue.length>CFG.QUEUE_MAX) queue.splice(0,queue.length-CFG.QUEUE_MAX);
    if(DEBUG){ try{ console.log('[ZA]',evt.n,JSON.stringify(evt.p)); }catch(e){} }
    persistSoon();
    if(!flushTimer) flushTimer=setTimeout(function(){ flushTimer=0; flush('timer'); },4000);
    if(queue.length>=CFG.FLUSH_MIN) flush('threshold');
  }

  /* ------------------------- отправка ------------------------- */
  /* автозагрузка счётчика Метрики.
     file:// — не грузим: локальные прогоны не должны отправлять события
     в реальный счётчик (очередь копится локально, §11.6) */
  function loadMetrika(){
    if(!CFG.METRIKA_ID||mkReady||window.ym)return;
    try{ if(location.protocol==='file:')return; }catch(e){}
    try{
      /* заглушка-очередь: вызовы до загрузки скрипта проиграются потом */
      window.ym=window.ym||function(){ (window.ym.a=window.ym.a||[]).push(arguments); };
      window.ym.l=1*new Date();
      /* параметры — как в официальном сниппете счётчика 114075082 */
      window.ym(CFG.METRIKA_ID,'init',
        { ssr:true, clickmap:true, ecommerce:'dataLayer',
          referrer:document.referrer, url:location.href,
          accurateTrackBounce:true, trackLinks:true });
      const s=document.createElement('script');
      s.async=true;
      s.src='https://mc.yandex.ru/metrika/tag.js';
      s.onload=function(){ mkReady=true; flush('metrika'); };  /* домылка очереди */
      document.head.appendChild(s);   /* onerror: очередь остаётся локально */
    }catch(e){}
  }
  function transportsReady(){
    return !!( CFG.ENDPOINT || (CFG.METRIKA_ID&&mkReady&&typeof window.ym==='function') );
  }
  function mkEnvelope(){
    const e=env||{};
    /* платформа — динамически из platform.js (SDK площадок грузятся асинхронно
       и могли определиться уже после init) */
    let platform=e.platform;
    try{ if(window.Platform&&window.Platform.type&&window.Platform.type!=='none')platform=window.Platform.type; }catch(err){}
    return { game:CFG.GAME, ver:CFG.VER, uid:uid, sid:sid,
      platform:platform, device:e.device, control:e.control, lang:e.lang,
      screen:e.screen, tz:e.tz, browser:e.browser, day:dayKey() };
  }
  function drop(ids){
    const set=Object.create(null);
    for(let i=0;i<ids.length;i++) set[ids[i]]=1;
    queue=queue.filter(e=>!set[e.eid]);
    persist();
  }
  function flush(reason, beacon){
    try{
      if(!enabled||flushing||!queue.length) return;
      if(!transportsReady()){ persist(); return; }        /* транспорта нет — копим локально (§11.6) */
      if(!beacon&&navigator.onLine===false) return;       /* офлайн — дождёмся online (§11.7) */
      flushing=true;
      const batch=queue.slice(0,50);
      const ids=batch.map(e=>e.eid);
      const payload=JSON.stringify({env:mkEnvelope(),events:batch});
      let syncOk=false, asyncPending=false;

      if(CFG.ENDPOINT){
        if(beacon&&navigator.sendBeacon){
          try{
            const blob=new Blob([payload],{type:'application/json'});
            syncOk=navigator.sendBeacon(CFG.ENDPOINT,blob)||syncOk;
          }catch(e){}
        }else if(window.fetch){
          asyncPending=true;
          fetch(CFG.ENDPOINT,{method:'POST',keepalive:true,
              headers:{'Content-Type':'application/json'},body:payload})
            .then(function(){ drop(ids); flushing=false; })
            .catch(function(){ flushing=false; });
        }
      }
      if(CFG.METRIKA_ID&&mkReady&&typeof window.ym==='function'){
        for(let i=0;i<batch.length;i++){
          try{ window.ym(CFG.METRIKA_ID,'reachGoal',batch[i].n,batch[i].p); }catch(e){}
        }
        syncOk=true;
      }
      if(syncOk) drop(ids);
      if(!asyncPending) flushing=false;
      if(DEBUG){ try{ console.log('[ZA] flush('+reason+'):',batch.length,'событий, удалено:',syncOk); }catch(e){} }
    }catch(e){ flushing=false; }
  }

  /* ------------------------- инициализация ------------------------- */
  function init(){
    if(enabled) return;
    try{
      env=detectEnv();
      const first=lsGet(CFG.FIRST_KEY);
      const isNew=!first;
      if(isNew) lsSet(CFG.FIRST_KEY, dayKey());
      uid=lsGet(CFG.UID_KEY)||uuid();
      lsSet(CFG.UID_KEY,uid);                            /* один анонимный id на установку (§11.9) */
      sid=uuid().slice(0,8);
      sessStart=Date.now(); seq=0;
      loadQueue();
      enabled=true;
      for(let i=0;i<pending.length;i++) pushEvt(pending[i]);  /* буфер — в очередь */
      pending.length=0;
      loadMetrika();
      track('game_start',{ new_user:isNew?1:0, days:daysSince(first),
        load_ms:env.load_ms, dom_ms:env.dom_ms }, 'session');
      track('session_start',{},'session');
      setInterval(function(){ flush('interval'); },CFG.FLUSH_MS);
      if(DEBUG){ try{ console.log('[ZA] init',JSON.stringify(mkEnvelope())); }catch(e){} }
    }catch(e){}
  }

  /* ------------------------- состояние игры (инжектится) ------------------------- */
  function st(){ try{ return stateProvider?stateProvider():null; }catch(e){ return null; } }

  /* ------------------------- техника: ошибки, сеть, долгие задачи ------------------------- */
  function reportErr(n,p){
    if(errCount>=CFG.ERR_MAX) return;
    errCount++;
    track(n,p,'tech');
  }
  window.addEventListener('error',function(e){
    try{
      if(e&&e.target&&e.target!==window&&(e.target.tagName||e.target.srcElement)){
        const t=e.target;
        reportErr('res_error',{tag:String(t.tagName||'').toLowerCase(),url:short(t.src||t.href||'',90)});
      }
    }catch(err){}
  },true);
  window.addEventListener('error',function(e){
    try{
      if(e&&e.message) reportErr('js_error',{msg:short(e.message,140),src:short(e.filename||'',80),line:e.lineno||0});
    }catch(err){}
  });
  window.addEventListener('unhandledrejection',function(e){
    try{
      const r=e&&e.reason;
      reportErr('js_error',{msg:short(r&&r.message?r.message:r,140),src:'promise'});
    }catch(err){}
  });
  try{
    const po=new PerformanceObserver(function(l){
      const es=l.getEntries();
      for(let i=0;i<es.length;i++) if(es[i].duration>longtaskWorst) longtaskWorst=es[i].duration;
      longtaskCount+=es.length;
    });
    po.observe({entryTypes:['longtask']});
  }catch(e){}

  /* сеть: потеря/восстановление + досылка накопленного */
  window.addEventListener('online',function(){ track('connection_restored',{},'tech'); flush('online'); });
  window.addEventListener('offline',function(){ track('connection_lost',{},'tech'); });

  /* пауза/возобновление партии при сворачивании (§3) */
  document.addEventListener('visibilitychange',function(){
    try{
      if(closed) return; /* сессия уже закрыта — поздние события не пишем */
      const s=st();
      if(document.hidden){
        hiddenAt=Date.now();
        if(s&&s.playing){ track('game_pause',{},'game'); pauseCount++; }
        persist();
      }else if(hiddenAt&&Date.now()-hiddenAt>1500){
        if(s&&s.playing){ track('game_resume',{},'game'); resumeCount++; }
      }
    }catch(e){}
  });

  /* завершение сессии: досрочный выход, session_end, sendBeacon-досылка (§7) */
  window.addEventListener('pagehide',function(){
    try{
      if(closed) return;
      closed=true;
      const s=st();
      if(s&&s.playing) track('game_abandon',{mode:s.mode,difficulty:s.difficulty,sec:s.sec,filled_pct:s.filled},'game');
      if(enabled) track('session_end',{dur_sec:Math.round((Date.now()-sessStart)/1000),
        pauses:pauseCount,resumes:resumeCount,longtasks:longtaskCount,
        longtask_worst_ms:Math.round(longtaskWorst)},'session');
      persist();
      flush('pagehide',true);
    }catch(e){}
  });

  /* ------------------------- публичное API ------------------------- */
  return {
    init:init,
    track:track,
    flush:flush,
    disable:function(cat){ if(cat) disabled[cat]=true; },
    enable:function(cat){ if(cat) delete disabled[cat]; },
    setStateProvider:function(fn){ stateProvider=fn; },
    state:function(){
      return { enabled:enabled, uid:uid, sid:sid, queued:queue.length,
        buffered:pending.length, errors:errCount, longtasks:longtaskCount,
        transports:transportsReady() };
    },
    dump:function(){ return queue.slice(); },
    CFG:CFG
  };
})();
