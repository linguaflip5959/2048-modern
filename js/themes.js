/* =========================================================================
   2048 · themes.js — темы оформления (Design Style.txt)
   Ревизия 4, [F5]: (1) jade.cell #C7E1D3 → #C3E8D4 — старый цвет пустой
   ячейки стоял вплотную к плиткам 4/8 (ΔE 5.0–6.7), мятный сдвиг даёт
   minΔE 9.9 до любой плитки при гармонии с доской; (2) velvet рампа
   расширена tileA #4A2F63→#3D2354, tileB #E3CDF3→#EFD9F7 (та же гамма,
   minΔE соседних плиток 5.1→7.6). Остальные темы без изменений.
   ========================================================================= */
'use strict';
/* [ревизия 7] f3 — параметры 3D-лица плиток (ссылка: amber-300→orange-500 +
   толстая тень-грань + глянцевый блик): hi/lo/edge — ΔL сдвиги в Lab для
   верха лица / низа лица / жёсткой грани, gloss — альфа блика. Цвета для
   каждой темы выводятся из её же рампы tileA→tileB, распознаваемость
   соседних значений [F5] сохраняется (градиент одинаков у всех плиток). */
const THEMES=[
 {id:'jade',ph:{board:'#DDEEE5',boardLine:'rgba(20,50,38,.12)',cell:'#C3E8D4',
   tileA:'#F6FCF8',tileB:'#1F5C4A',max:'#F0B429',dark:'#14261E',light:'#F8FFFB',
   glow:'#71A897',orbA:'#71A897',orbB:'#336B5C',dust:'#2E7D62',shadow:.16,blendAdd:false,
   f3:{hi:14,lo:20,edge:40,gloss:.50}}},
 {id:'amber',ph:{board:'#F0E2C6',boardLine:'rgba(90,50,20,.13)',cell:'#E2CEA8',
   tileA:'#FDF7EA',tileB:'#8E3411',max:'#E9A93C',dark:'#33200F',light:'#FFF8EC',
   glow:'#D9A46E',orbA:'#D9A46E',orbB:'#AA3C1A',dust:'#9C5C1E',shadow:.18,blendAdd:false,
   f3:{hi:12,lo:21,edge:40,gloss:.50}}},
 {id:'velvet',ph:{board:'#2A1B3D',boardLine:'rgba(232,214,246,.12)',cell:'#1C1129',
   tileA:'#3D2354',tileB:'#EFD9F7',max:'#FBB02D',dark:'#1B1026',light:'#F8F1FD',
   glow:'#A87AB6',orbA:'#6B3F7C',orbB:'#A87AB6',dust:'#D8C8E6',shadow:.55,blendAdd:true,
   f3:{hi:14,lo:20,edge:46,gloss:.42}}},
 {id:'neon',ph:{board:'#0A2048',boardLine:'rgba(180,240,255,.14)',cell:'#061531',
   tileA:'#123A7A',tileB:'#40FFD0',max:'#00D8F8',dark:'#03131F',light:'#ECFFFE',
   glow:'#00D8F8',orbA:'#1040E0',orbB:'#00D8F8',dust:'#40FFD0',shadow:.6,blendAdd:true,
   f3:{hi:16,lo:20,edge:48,gloss:.46}}}
];
/* [D2][D3] валидация сохранённого значения до использования */
let themeIdx=THEMES.findIndex(x=>x.id===store.get('theme','jade'));
if(themeIdx<0)themeIdx=0;
const TH=()=>THEMES[themeIdx].ph;
