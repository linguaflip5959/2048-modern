/* =========================================================================
   2048 · hud.js — DOM-интерфейс: тосты, тема/язык/звук, оверлеи финала,
   синхронизация кнопок. Ревизия 2: удалены applyScale()/applyMotion().
   Ревизия 5: удалены вызовы refreshFontTag/лого-title (превью шрифтов
   демонтировано); syncControls обновляет бейдж бесплатных отмен «3/2/1».
   Ревизия 8: syncControls синхронизирует GameplayAPI Яндекс Игр
   (Platform.gameplaySync — старт/стоп геймплея для публикации).
   ========================================================================= */
'use strict';

/* ---------------- toasts ---------------- */
function toast(msg,ico){
  const w=$('#toasts'),el=document.createElement('div');
  el.className='toast';el.innerHTML='<span class="tico">'+(ico||'•')+'</span><span></span>';
  el.lastChild.textContent=msg;w.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),320);},2100);
  while(w.children.length>3)w.firstChild.remove();
}

/* ---------------- theme / lang / a11y ---------------- */
function applyTheme(silent){
  const id=THEMES[themeIdx].id;
  document.documentElement.setAttribute('data-theme',id);
  store.set('theme',id);
  const mt=document.querySelector('meta[name="theme-color"]');
  if(mt)mt.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  if(SCENE)SCENE.retheme();
  if(!silent)toast(t('themes')[id],'◐');
}
function applyLang(){
  document.documentElement.lang=lang;
  store.set('lang',lang);
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  $('#btn-lang').textContent=lang.toUpperCase();
  $('#btn-undo').title=t('undoTip');$('#btn-shuffle').title=t('shuffleTip');$('#btn-new').title=t('newTip');
  $('#btn-theme').title=t('themeTip');$('#btn-lang').title=t('langTip');$('#btn-sound').title=t('soundTip');
  if(adVisible()){$('#ad-caption').textContent=$('#ad-claim').disabled?t('adRewardIn'):t('adReady');}
  if(SCENE)SCENE.refreshOverlaysText();
}
function applySound(){
  store.set('sound',soundOn);
  $('#btn-sound').classList.toggle('off',!soundOn);
  $('#btn-sound').querySelector('.i-on').style.display=soundOn?'block':'none';
  $('#btn-sound').querySelector('.i-off').style.display=soundOn?'none':'block';
}

/* ---------------- end overlay ---------------- */
let endKind=null;
function fillEnd(){
  const s=SCENE?SCENE.score:0,mx=SCENE?SCENE.maxValue():2048;
  $('#end-title').textContent=endKind==='win'?t('win'):t('over');
  $('#end-sub').textContent=endKind==='win'?t('winSub'):t('overSub');
  $('#end-score').textContent=s;
  $('#end-best').textContent=Math.max(best,s);
  $('#end-badge').textContent=mx;
  $('#end-ad').style.display=endKind==='over'?'flex':'none';
  $('#end-keep').style.display=endKind==='win'?'flex':'none';
}
function showEnd(kind){endKind=kind;fillEnd();$('#ov-end').classList.add('show');syncControls();}
function hideEnd(){$('#ov-end').classList.remove('show');syncControls();}

/* ---------------- controls sync [C1] ---------------- */
function syncControls(){
  if(!SCENE)return;
  const canAct=!SCENE.busy&&!SCENE.over&&!uiBlocked();
  $('#btn-undo').disabled=!canAct||SCENE.history.length===0;
  $('#btn-shuffle').disabled=!canAct;
  /* [ревизия 5] бейдж «Отменить»: остаток бесплатных отмен, затем AD */
  const badge=$('#btn-undo .ad-badge');
  if(badge)badge.textContent=undoFree>0?String(undoFree):'AD';
  /* [ревизия 8] Яндекс GameplayAPI: старт/стоп геймплея по факту —
     оверлеи/реклама/поражение/свёрнутая вкладка = stop (см. platform.js) */
  if(window.Platform&&typeof window.Platform.gameplaySync==='function')window.Platform.gameplaySync();
}
