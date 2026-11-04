/* =========================================================================
   2048 · util.js — общие помощники (без зависимостей, грузится первым)
   ========================================================================= */
'use strict';
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function hex2rgb(h){h=String(h).replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function rgb2hex(r,g,b){return '#'+[r,g,b].map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');}
function mix(a,b,t){const A=hex2rgb(a),B=hex2rgb(b);return rgb2hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
function lum(h){const[r,g,b]=hex2rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b;}

/* [F5] CIE Lab (D65): интерполяция цвета равными воспринимаемыми шагами.
   RGB-смешивание сжимало верхний конец градиента плиток (256/512/1024 были
   почти неотличимы, worst-case ΔE 5.1). Концы диапазона точны. */
const _LF=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;
const _LI=t=>{const c=t*t*t;return c>.008856?c:(t-16/116)/7.787;};
function hex2lab(h){const[r,g,b]=hex2rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
  const X=(.4124564*r+.3575761*g+.1804375*b)/.95047,Y=.2126729*r+.7151522*g+.072175*b,
        Z=(.0193339*r+.119192*g+.9503041*b)/1.08883,fx=_LF(X),fy=_LF(Y),fz=_LF(Z);
  return [116*fy-16,500*(fx-fy),200*(fy-fz)];}
function lab2hex(L,a,b){const fy=(L+16)/116,fx=fy+a/500,fz=fy-b/200,
    X=.95047*_LI(fx),Y=_LI(fy),Z=1.08883*_LI(fz),
    R=clamp(3.2404542*X-1.5371385*Y-.4985314*Z,0,1),
    G=clamp(-.969266*X+1.8760108*Y+.041556*Z,0,1),
    B=clamp(.0556434*X-.2040259*Y+1.0572252*Z,0,1),
    q=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);
  return rgb2hex(q(R),q(G),q(B));}
function mixLab(a,b,t){const A=hex2lab(a),B=hex2lab(b);
  return lab2hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
/* [ревизия 7] 3D-плитки: сдвиг светлоты в Lab с масштабом хромы (a*,b*).
   dL>0 — светлее (верх лица/блик), dL<0 — темнее (низ лица, жёсткая грань);
   cs масштабирует хрому, чтобы тёмный конец оставался насыщенным, а не грязным
   (как amber-700 #B45309 в референсе: темнее И оранжевее). */
function shadeLab(h,dL,cs){const c=hex2lab(h);const k=cs==null?1:cs;
  return lab2hex(clamp(c[0]+dL,0,100),c[1]*k,c[2]*k);}

/* [ревизия 8] аналитика: безопасный вызов ZA.track — модуль может быть
   ещё не инициализирован или отключён; игра НИКОГДА не падает из-за телеметрии */
function za(n,p,c){ try{ if(window.ZA&&typeof window.ZA.track==='function')window.ZA.track(n,p,c); }catch(e){} }
