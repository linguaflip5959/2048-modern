/* =========================================================================
   2048 · audio.js — звук на WebAudio, без ассетов
   ========================================================================= */
'use strict';
const Sound=(function(){
  let ctx=null;
  function ac(){ if(!ctx){ try{ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} }
    if(ctx&&ctx.state==='suspended')ctx.resume(); return ctx; }
  function tone(f,d,type,g,slide){
    if(!soundOn)return; const c=ac(); if(!c)return;
    const o=c.createOscillator(),v=c.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(f,c.currentTime);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,slide),c.currentTime+d);
    v.gain.setValueAtTime(0,c.currentTime);
    v.gain.linearRampToValueAtTime(g||.06,c.currentTime+.012);
    v.gain.exponentialRampToValueAtTime(.0001,c.currentTime+d);
    o.connect(v);v.connect(c.destination);o.start();o.stop(c.currentTime+d+.03);
  }
  return{
    unlock(){ac();},
    move(){tone(196,.07,'triangle',.045,150);},
    merge(i){const f=280*Math.pow(1.09,clamp(i,0,12));tone(f,.13,'triangle',.06);tone(f*1.5,.1,'sine',.03);},
    spawn(){tone(520,.05,'sine',.028);},
    bad(){tone(120,.14,'sawtooth',.035,80);},
    click(){tone(660,.05,'sine',.04);},
    reward(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.18,'triangle',.055),i*80));},
    win(){[523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>tone(f,.26,'sine',.06),i*110));},
    lose(){[392,330,262,196].forEach((f,i)=>setTimeout(()=>tone(f,.26,'triangle',.05),i*130));}
  };
})();
