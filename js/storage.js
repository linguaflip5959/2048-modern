/* =========================================================================
   2048 · storage.js — localStorage с валидацией [D3]
   ========================================================================= */
'use strict';
const store={
  get(k,d){try{const v=localStorage.getItem('g2048_'+k);return v===null?d:JSON.parse(v);}catch(e){return d}},
  set(k,v){try{localStorage.setItem('g2048_'+k,JSON.stringify(v));}catch(e){}}
};
