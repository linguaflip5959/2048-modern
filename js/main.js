/* =========================================================================
   2048 · main.js — сборка: кнопки [C2], геометрия поля, boot Phaser,
   готовность платформы.
   Ревизия 5: канвас растянут на весь вьюпорт (Scale.RESIZE, #stage-bg);
   поле центрируется по DOM-спейсеру #stage через scene.layout()
   (ScaleManager 'resize' + ResizeObserver + resize/orientationchange).
   Отмена: 3 бесплатные за партию, далее неограниченно через rewarded.
   initLogoFont() удалён — шрифт лого зафиксирован (css/fonts.css).
   Ревизия 8: аналитика (ZA.init по первому действию игрока + провайдер
   состояния партии), interstitial перед новой игрой (только на площадках,
   см. js/ads.js), ui_settings/undo_used события, GameplayAPI при
   сворачивании вкладки.
   ========================================================================= */
'use strict';

/* ---------------- wiring [C2] ---------------- */
function wire(){
  $('#best').textContent=best;                                       /* [D1] */
  try{localStorage.removeItem('g2048_logoFont');}catch(e){}          /* [ревизия 5] превью шрифтов удалено */

  $('#btn-theme').onclick=()=>{Sound.unlock();themeIdx=(themeIdx+1)%THEMES.length;applyTheme();Sound.click();
    za('ui_settings',{setting:'theme',value:THEMES[themeIdx].id});};           /* [ревизия 8] */
  $('#btn-lang').onclick=()=>{Sound.unlock();lang=lang==='ru'?'en':'ru';applyLang();Sound.click();
    za('ui_settings',{setting:'lang',value:lang});};                           /* [ревизия 8] */
  $('#btn-sound').onclick=()=>{soundOn=!soundOn;applySound();if(soundOn){Sound.unlock();Sound.click();}
    toast(soundOn?t('tSoundOn'):t('tSoundOff'),soundOn?'♪':'✕');
    za('ui_settings',{setting:'sound',value:soundOn?1:0});};                  /* [ревизия 8] */

  /* [ревизия 8] interstitial перед новой игрой — логическая пауза по
     правилам площадок (после проигрыша / рестарт): только на Яндекс/VK
     (нативные блоки), только если партия реально игралась (moves>0);
     частоту дополнительно ограничивают ads.js (60 с) и сама площадка */
  const startNewGame=()=>{ if(SCENE)SCENE.newGame(false); };
  const withInterstitial=place=>{
    if(!SCENE)return;
    if(SCENE.moves>0)showInterstitialAd(place,startNewGame);
    else startNewGame();
  };
  $('#btn-new').onclick=()=>{ Sound.unlock(); withInterstitial('restart'); };
  /* [ревизия 5] «Отменить»: 3 бесплатные отмены за партию (бейдж «3/2/1»
     обновляется в syncControls), далее — неограниченно через rewarded */
  $('#btn-undo').onclick=()=>{
    if(!SCENE)return; Sound.unlock();
    if(SCENE.busy||SCENE.over)return;
    if(!SCENE.history.length){toast(t('tUndoNone'),'!');return;}
    if(undoFree>0){ undoFree--; SCENE.doUndo(); syncControls(); za('undo_used',{free:1}); }
    else showRewardedAd(()=>{ if(SCENE)SCENE.doUndo(); za('undo_used',{free:0}); },'undo');
  };
  $('#btn-shuffle').onclick=()=>{
    if(!SCENE||SCENE.busy||SCENE.over)return; Sound.unlock();
    showRewardedAd(()=>{ if(SCENE)SCENE.doShuffle(); },'shuffle');
  };
  $('#end-ad').onclick=()=>{ if(!SCENE)return; showRewardedAd(()=>{ if(SCENE)SCENE.doRevive(); },'revive'); };
  $('#end-keep').onclick=()=>{
    if(!SCENE)return; Sound.click(); hideEnd();
    if(SCENE.over)showEnd('over');                                   /* [B4] */
    syncControls();
    za('game_continue',{});                                          /* [ревизия 8] «Играть дальше» */
  };
  $('#end-new').onclick=()=>{ withInterstitial('game_over'); };
  $('#ov-end').addEventListener('click',e=>{
    if(e.target.id!=='ov-end'||!SCENE)return;
    if(endKind==='win'){ hideEnd(); if(SCENE.over)showEnd('over'); }
  });
}

/* ---------------- геометрия поля [E2 → ревизия 5] ----------------
   Scale.RESIZE сам подгоняет канвас под окно; здесь ловим перекомпоновку
   HUD (переносы строк и т.п.), меняющую геометрию #stage: поле
   перецентрируется scene.layout(). */
let rafLayout=0;
function requestLayout(){
  if(rafLayout)return;
  rafLayout=requestAnimationFrame(()=>{rafLayout=0;doLayout();});
}
function doLayout(){ if(SCENE&&typeof SCENE.layout==='function')SCENE.layout(); }

/* ---------------- [ревизия 8] аналитика (js/analytics.js) ----------------
   init — по ПЕРВОМУ действию игрока (диалог согласия не вводим — новых
   функций нет; счётчик Метрики не грузится на file:// — очередь копится
   локально, локальные прогоны не мусорят статистику). Провайдер состояния
   партии — для game_pause/game_resume/game_abandon из ядра аналитики. */
let zaInited=false;
function zaInit(){
  if(zaInited)return; zaInited=true;
  try{ if(window.ZA)ZA.init(); }catch(e){}
}
['pointerdown','keydown','touchstart'].forEach(ev=>
  document.addEventListener(ev,zaInit,{once:true,capture:true}));
if(window.ZA)ZA.setStateProvider(function(){
  try{
    if(!SCENE||!SCENE.ready)return{playing:false};
    return{playing:!SCENE.over&&!uiBlocked(),mode:'classic',
      sec:SCENE.gameSec(),filled_pct:SCENE.filledPct(),score:SCENE.score,moves:SCENE.moves};
  }catch(e){ return{playing:false}; }
});

/* ---------------- boot ---------------- */
function boot(){
  GAME=new Phaser.Game({
    type:Phaser.AUTO,
    parent:'stage-bg',                       /* [ревизия 5] канвас на весь экран */
    width:Math.max(1,window.innerWidth),
    height:Math.max(1,window.innerHeight),
    transparent:true,
    backgroundColor:'rgba(0,0,0,0)',
    antialias:true,
    scale:{mode:Phaser.Scale.RESIZE},        /* канвас = вьюпорт, фон живёт везде */
    scene:[MainScene],
    input:{activePointers:2},
    audio:{noAudio:true},
    banner:false
  });
  /* [ревизия 5] сигнал «игра загружена» для платформы (Яндекс: LoadingAPI.ready).
     Phaser бутится синхронно ещё в конструкторе (readyState=interactive),
     поэтому события 'ready' можно и не застать — проверяем isBooted. */
  const platformReady=()=>requestAnimationFrame(()=>{
    if(window.Platform&&window.Platform.gameReady)window.Platform.gameReady();
  });
  if(GAME.isBooted)platformReady();
  else GAME.events.once('ready',platformReady);
  if(window.ResizeObserver){
    const ro=new ResizeObserver(()=>requestLayout());
    ro.observe($('#stage'));
  }
  window.addEventListener('orientationchange',()=>setTimeout(requestLayout,260));
  window.addEventListener('resize',requestLayout);
  /* [ревизия 8] Яндекс GameplayAPI: сворачивание/возврат вкладки =
     stop/start геймплея (состояние считает platform.js gpActive) */
  document.addEventListener('visibilitychange',()=>{
    if(window.Platform&&window.Platform.gameplaySync)window.Platform.gameplaySync();
  });
}

applySound();applyLang();applyTheme(true);wire();
if(document.fonts&&document.fonts.ready){
  Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2200))]).then(boot);
}else setTimeout(boot,200);
