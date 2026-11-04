/* =========================================================================
   2048 · i18n.js — строки RU/EN
   Ревизия 5: удалены logoFontTip/fontDefault/fontMissing (превью шрифтов
   лго демонтировано — шрифт зафиксирован: Kabyta Italicexpanded).
   undoTip обновлён: 3 бесплатные отмены, далее реклама.
   ========================================================================= */
'use strict';
const STR={
 ru:{
  tagline:'Соединяйте плитки и достигните 2048',
  score:'Счёт',best:'Рекорд',undo:'Отменить',shuffle:'Перемешать',new:'Заново',
  hint:'Свайп или стрелки ← ↑ → ↓',
  undoTip:'Отменить последний ход (3 бесплатно, далее реклама)',
  shuffleTip:'Перемешать плитки (reward-реклама)',
  newTip:'Начать новую игру',
  themeTip:'Тема оформления',langTip:'Язык',soundTip:'Звук',
  over:'Игра окончена',overSub:'Свободных клеток не осталось',
  win:'Победа!',winSub:'Вы собрали плитку 2048. Дальше — больше!',
  continueAd:'Продолжить за рекламу',keepGoing:'Играть дальше',playAgain:'Новая игра',
  adSponsor:'Реклама · демо-плеер',adRewardIn:'Награда через 5 с',adReady:'Награда готова!',
  adClaim:'Забрать награду',adClose:'Закрыть',
  adNote:'Это заглушка rewarded-ролика. Подключите AdMob / Unity Ads / AppLovin в функции showRewardedAd().',
  tAd:'Награда получена',tUndoNone:'Отменять нечего',tUndo:'Ход отменён',tShuffle:'Поле перемешано',
  tRevive:'Убрали 2 плитки — играем дальше',tNew:'Новая игра',
  tSoundOn:'Звук включён',tSoundOff:'Звук выключен',
  themes:{jade:'Нефрит · светлая',amber:'Янтарь · тёплая',velvet:'Бархат · тёмная',neon:'Лагуна · неон'}
 },
 en:{
  tagline:'Merge the tiles and reach 2048',
  score:'Score',best:'Best',undo:'Undo',shuffle:'Shuffle',new:'Restart',
  hint:'Swipe or use arrow keys ← ↑ → ↓',
  undoTip:'Undo the last move (3 free, then ads)',
  shuffleTip:'Shuffle the board (rewarded ad)',
  newTip:'Start a new game',
  themeTip:'Color theme',langTip:'Language',soundTip:'Sound',
  over:'Game Over',overSub:'No moves left on the board',
  win:'You Win!',winSub:'You built the 2048 tile. Keep going!',
  continueAd:'Continue with an ad',keepGoing:'Keep going',playAgain:'New game',
  adSponsor:'Advertisement · demo player',adRewardIn:'Reward in 5 s',adReady:'Reward ready!',
  adClaim:'Claim reward',adClose:'Close',
  adNote:'This is a rewarded-ad placeholder. Plug AdMob / Unity Ads / AppLovin into showRewardedAd().',
  tAd:'Reward granted',tUndoNone:'Nothing to undo',tUndo:'Move undone',tShuffle:'Board shuffled',
  tRevive:'Two tiles removed — keep playing',tNew:'New game',
  tSoundOn:'Sound on',tSoundOff:'Sound off',
  themes:{jade:'Jade · light',amber:'Amber · warm',velvet:'Velvet · dark',neon:'Lagoon · neon'}
 }
};
let lang=store.get('lang','ru')==='en'?'en':'ru';
const t=k=>(STR[lang]&&STR[lang][k]!==undefined)?STR[lang][k]:(STR.en[k]!==undefined?STR.en[k]:k);
