/* =========================================================================
   2048 · ads.js — REWARDED ADS: UNDO / SHUFFLE / REVIVE + INTERSTITIAL
   -------------------------------------------------------------------------
   Механика rewarded НЕ ТРОНУТА в ревизии 2 — дословный перенос аудited-кода
   (фиксы A1–A3: единый колбэк adRewardCb, никаких обёрток).
   Реальный SDK: window.REWARDED_ADS = { show(onReward,onCancel,place){...} }
   Ревизия 8:
   • showRewardedAd(onReward, place) — place: undo|shuffle|revide (для
     аналитики ad_*), трекается ad_request здесь, исходы — в platform.js
     (нативные SDK) или здесь же (демо-плеер).
   • showInterstitialAd(place, onDone) — [новое] полноэкранный блок для
     публикации: подключается платформами через window.INTERSTITIAL_ADS
     (Яндекс showFullscreenAdv / VK VKWebAppShowNativeAds). Вне площадок
     (file://, обычный веб) interstitial НЕ показывается — игра просто
     продолжает работу (демо-заглушки здесь нет: это пауза, не награда).
     Местный откат 60 с — сверху частоту всё равно контролирует площадка
     (правила Яндекс Игр: реклама на логических паузах — после проигрыша,
     при рестарте; не во время игрового процесса).
   • Аналитика: za() из util.js (безопасна, если модуля нет).
   ========================================================================= */
'use strict';
const AD_SECONDS=5;
let adTimer=null, adRewardCb=null, adPlace='undo';

function showRewardedAd(onReward,place){
  adPlace=place||'undo';
  za('ad_request',{type:'rewarded',place:adPlace});                  /* [ревизия 8] */
  if(window.REWARDED_ADS&&typeof window.REWARDED_ADS.show==='function'){
    window.REWARDED_ADS.show(function(){ adRewardCb=null; onReward&&onReward(); },
                             function(){ adRewardCb=null; },adPlace);
    return;
  }
  adRewardCb=onReward||null;
  const ov=$('#ov-ad'),claim=$('#ad-claim'),close=$('#ad-close'),
        tm=$('#ad-timer'),bar=$('#ad-bar'),cap=$('#ad-caption');
  claim.disabled=true;close.disabled=true;
  bar.style.width='0%';tm.textContent=AD_SECONDS;cap.textContent=t('adRewardIn');
  ov.classList.add('show');za('ad_shown',{type:'rewarded',place:adPlace});   /* [ревизия 8] */
  syncControls();Sound.click();
  if(adTimer)clearInterval(adTimer);
  const start=performance.now();
  adTimer=setInterval(()=>{
    const el=(performance.now()-start)/1000,p=clamp(el/AD_SECONDS,0,1);
    bar.style.width=(p*100)+'%';
    tm.textContent=Math.max(0,Math.ceil(AD_SECONDS-el));
    if(p>=1){
      clearInterval(adTimer);adTimer=null;
      claim.disabled=false;close.disabled=false;
      tm.textContent='✓';cap.textContent=t('adReady');Sound.click();
    }
  },90);
  claim.onclick=()=>closeAd(true);
  close.onclick=()=>closeAd(false);
}
function closeAd(granted){
  if(adTimer){clearInterval(adTimer);adTimer=null;}
  $('#ov-ad').classList.remove('show');
  const cb=adRewardCb;adRewardCb=null;
  syncControls();
  if(granted){ za('ad_reward',{type:'rewarded',place:adPlace});       /* [ревизия 8] */
    Sound.reward(); toast(t('tAd'),'★'); if(cb)cb(); }
}
function adVisible(){return $('#ov-ad').classList.contains('show');}

/* [ревизия 8] interstitial — только нативные блоки площадок */
const INTERSTITIAL_CD=60000;        /* местный откат между показами, мс */
let interLast=0;
function showInterstitialAd(place,onDone){
  const cb=onDone||function(){};
  if(!(window.INTERSTITIAL_ADS&&typeof window.INTERSTITIAL_ADS.show==='function')){cb(false);return;}
  if(Date.now()-interLast<INTERSTITIAL_CD){cb(false);return;}        /* слишком рано — играем дальше */
  interLast=Date.now();
  za('ad_request',{type:'interstitial',place:place||'restart'});
  try{ window.INTERSTITIAL_ADS.show(function(shown){cb(!!shown);},place||'restart'); }
  catch(e){ za('ad_fail',{type:'interstitial',place:place||'restart'});cb(false); }
}

/* [C1] общий блок ввода, пока открыта любая модалка */
function uiBlocked(){return !!document.querySelector('.overlay.show');}
