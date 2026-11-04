/* =========================================================================
   2048 · state.js — настройки и глобальные ссылки
   Ревизия 2: удалены motionOn / scaleIdx (кнопки «Анимации» и «Размер
   текста»). Остались soundOn, best + ссылки на сцену/игру.
   Ревизия 5: UNDO_FREE/undoFree — 3 бесплатные отмены за партию
   (далее неограниченно через rewarded-рекламу; сбрасывается в newGame).
   ========================================================================= */
'use strict';
let soundOn=store.get('sound',true)!==false;
let best=parseInt(store.get('best',0),10);
if(!isFinite(best)||best<0)best=0;                    /* [D3] */

let SCENE=null, GAME=null;

const UNDO_FREE=3;               /* [ревизия 5] бесплатные отмены за партию */
let undoFree=UNDO_FREE;
