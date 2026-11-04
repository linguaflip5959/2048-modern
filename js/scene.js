/* =========================================================================
   2048 · scene.js — Phaser-сцена (MinScene «main»)
   Ревизия 2: удалены SCALES/scaleIdx (размер текста), D()-обёртка и
   ветки motionOn (кнопка «Анимации»). Все аудited-фиксы B1–B7 сохранены;
   длительности твинов фиксированные и не нулевые (см. [B7]).
   Ревизия 3 (аудит F1–F4, только подтверждённые дефекты):
   [F1] КРИТИЧНО: снапшот для отмены писался ПОСЛЕ compute() — а compute
        мутирует поле на месте. Отмена восстанавливала искажённое
        промежуточное состояние: слияние «схлопывалось» в одну плитку
        (2+2 -> 4, отмена -> одна «2»: плитка терялась), чистые сдвиги
        не отменялись. Снапшот теперь берётся ДО compute().
   [F2] restore() не возвращал флаг won: отмена победного хода после
        «Играть дальше» навсегда отключала экран победы. Снапшот теперь
        хранит won, restore() восстанавливает его.
   [F3] Окно 300 мс после «Продолжить за рекламу» (doRevive) было
        открыто для ввода (busy=false): ход в этом окне давал ДВЕ новые
        плитки вместо одной (finish + отложенный спавн revive).
        На окно наложен busy.
   [F4] tweens.killAll() в Phaser 3.80 НЕ вызывает onComplete (проверено
        тестом): «Заново»/отмена посреди тряски от неверного хода
        оставляли поле смещённым до 7 px. hardStop() возвращает board.x.
   Ревизия 4 (по жалобе пользователя, только подтверждённое):
   [F5] ЦВЕТА: смешивание tileA→tileB шло в RGB с pow(k,.86) и лишь по 90%
        диапазона (k=i/10) — верхний конец воспринимался сжатым
        (256/512/1024 почти неотличимы, worst-case ΔE(CIE76): velvet 5.1,
        jade 6.1; в jade плитки 4/8 стояли вплотную к пустой ячейке, ΔE 5.0).
        Теперь: (1) интерполяция в CIE Lab (mixLab, util.js) — равные
        воспринимаемые шаги; (2) полный диапазон k=i/9 для 2..1024
        (последние 10% раньше не использовались никакой плиткой);
        (3) jade: cell → мята #C3E8D4 (minΔE до любой плитки 9.9);
        (4) velvet: рампа расширена #3D2354→#EFD9F7 (та же гамма,
        minΔE 7.6). Итог minΔE соседних плиток: jade 7.4, amber 8.5,
        velvet 7.6, neon 11.4.
   [F6] АРИФМЕТИКА/ОТОБРАЖЕНИЕ (наследие оригинала): styleTile() менял
        цвет и кегль, но НЕ число — после слияния плитка «2»+«2» так и
        показывала «2» (при значении 4), «Перемешать» оставляло цифры
        на местах при обмене значений. setText добавлен в styleTile,
        покрывает слияние, перемешивание, retheme.
   Ревизия 7 (по референсу «amber-300→orange-500 + толстая грань + блик»):
   • 3D-ПЛИТКИ: каждая плитка — «физический блок»: вертикальный
     градиент лица ( Lab ΔL: hi/lo из темы), жёсткая тёмная грань снизу
     (edge), глянцевый блик сверху (gloss). Текстуры генерируются на
     лету для текущей темы (buildTileTex) из её же рампы tileA→tileB —
     свои цвета у каждой темы, распознаваемость соседних значений [F5]
     сохраняется: градиент одинаков у всех плиток, различие — в базе.
     Параметры per-theme — в themes.js (f3); shadeLab() — в util.js.
   Ревизия 6 (по жалобе «слишком быстрая анимация частиц»):
   [F7] СКОРОСТЬ ПЫЛИ: при нормализации амбиента в 0..1 (ревизия 5)
        скорости v/wx остались в px/с поля 760, но умножались на h/L
        (w/L) вместо деления на L — пыль неслась в h раз быстрее
        оригинала (экран пересекался за ~0.06 с, выглядела мерцанием).
        Восстановлен темп оригинала: 5–18 px/с в масштабе поля,
        полный экран — за 42–152 с. Орбы не менялись (они и так
        медленные: период 17–32 с).
   Ревизия 5 (фон/HUD/платформа — по запросу):
   • АНИМАЦИЯ ФОНА: орбы и пыль из-под поля развёрнуты на весь экран —
     канвас растянут на вьюпорт (Scale.RESIZE в main.js, #stage-bg),
     координаты амбиента нормализованы (0..1), размеры — от min(w,h).
     Поле центрируется и масштабируется по фактической геометрии
     DOM-спейсера #stage: layout() (+ resize/ResizeObserver в main.js).
     this.mid заменён на this.bx (актуальный центр поля).
   • ОТМЕНА: 3 бесплатные отмены за партию (undoFree в state.js,
     бейдж «3/2/1» в hud.js), далее неограниченно через rewarded;
     newGame() восстанавливает счётчик.
   Ревизия 8 (аудит + аналитика + публикация):
   • [F9] «Перемешать» не закрывало ввод на время своей анимации (340 мс):
     ход в этом окне перехватывался compute() по уже обновлённой сетке,
     а ДОЕХАВШИЙ твин перемешивания перетаскивал плитки в устаревшие
     позиции — до 5 плиток застревали смещёнными на клетку (168 px,
     воспроизведено тестом). Теперь doShuffle ставит busy на окно
     анимации (снятие — delayedCall с тем же runId-токеном).
   • Аналитика (js/analytics.js): level_start/game_restart на newGame,
     game_win/game_fail в finish(), shuffle_used/revive_used; счётчик
     ходов this.moves и старт партии this.t0 для параметров событий.
   ========================================================================= */
'use strict';
const L=760, BOARD=700, PAD=24, GAP=18, CELL=(BOARD-PAD*2-GAP*3)/4;
const VEC={up:{dr:-1,dc:0},down:{dr:1,dc:0},left:{dr:0,dc:-1},right:{dr:0,dc:1}};
const VALUES=[2,4,8,16,32,64,128,256,512,1024,2048];

class MainScene extends Phaser.Scene{
  constructor(){super('main');}

  buildTextures(){
    const mk=(key,size,fn)=>{ if(this.textures.exists(key))this.textures.remove(key);
      const g=this.add.graphics();fn(g,size);g.generateTexture(key,size,size);g.destroy(); };
    mk('cell',128,(g,s)=>{g.fillStyle(0xffffff,1);g.fillRoundedRect(0,0,s,s,20);});
    mk('tile',128,(g,s)=>{g.fillStyle(0xffffff,1);g.fillRoundedRect(0,0,s,s,20);});   /* фолбэк [ревизия 7] */
    mk('glow',256,(g,s)=>{const c=s/2;for(let i=0;i<26;i++){const k=i/25;g.fillStyle(0xffffff,.055*(1-k*.35));g.fillCircle(c,c,c*(1-k*.9));}});
    mk('dot',32,(g,s)=>{const c=s/2;for(let i=0;i<8;i++){const k=i/7;g.fillStyle(0xffffff,.16*(1-k*.7));g.fillCircle(c,c,c*(1-k*.72));}});
  }

  /* ---------- [ревизия 7] 3D-текстуры плиток ----------
     Референс: <div bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500
     shadow-[0_4px_0_0_...]>(грань) + глянцевый блик сверху. В Phaser:
     подложка-грань (темнее, chroma×1.18 — как amber-700) выглядывает снизу
     на ~7% высоты, лицо — вертикальный градиент fillGradientStyle (верх hi/ΔL
     светлее, низ lo/ΔL темнее), сверху — белая пилюля-блик.
     Ключ t3<theme>_<idx>: 0..9 — значения 2..1024 по рампе [F5], _m — 2048+. */
  buildTileTex(){
    const th=TH(),f=th.f3||{hi:14,lo:20,edge:40,gloss:.5},tid=THEMES[themeIdx].id;
    if(this._texTheme!==tid){
      (this._texKeys||[]).forEach(k=>{if(this.textures.exists(k))this.textures.remove(k);});
      this._texKeys=[];this._texTheme=tid;
    }
    const CC=h=>Phaser.Display.Color.HexStringToColor(h).color;
    const mk=(key,base)=>{
      if(this.textures.exists(key))return;
      const top=shadeLab(base,f.hi,.92),bot=shadeLab(base,-f.lo,1.06),edge=shadeLab(base,-f.edge,1.18);
      const g=this.add.graphics();
      g.fillStyle(CC(edge),1);g.fillRoundedRect(4,11,120,113,20);   /* грань-подложка (снизу видна ~12px) */
      /* Лицо — послойный вертикальный градиент: fillGradientStyle на
         fillRoundedRect даёт искажённую интерполяцию (проверено пиксельным
         замером), поэтому N слоёв «сверху светлее и короче»: слой высотой h
         красится цветом grad(h) — наложение даёт плавный градиент с
         закруглёнными верхними углами; нижние углы — у самого нижнего слоя. */
      const N=26,H=108;
      for(let i=0;i<N;i++){
        const h=H-Math.round(H*i/(N-1));
        if(h<1)break;
        g.fillStyle(CC(mixLab(top,bot,h/H)),1);
        g.fillRoundedRect(4,4,120,h,i===0?20:{tl:20,tr:20,bl:0,br:0});
      }
      g.fillStyle(0xffffff,f.gloss);g.fillRoundedRect(16,10,96,30,15);  /* глянцевый блик сверху */
      g.generateTexture(key,128,128);g.destroy();
      this._texKeys.push(key);
    };
    for(let i=0;i<=VALUES.length-2;i++)                            /* 2..1024: k=i/9 [F5] */
      mk('t3'+tid+'_'+i,mixLab(th.tileA,th.tileB,i/(VALUES.length-2)));
    mk('t3'+tid+'_m',th.max);                                      /* 2048 и выше */
  }
  tileTexKey(v){const tid=THEMES[themeIdx].id;return v>=2048?'t3'+tid+'_m':'t3'+tid+'_'+this.tileIndex(v);}

  create(){
    SCENE=this;
    this.bx=L/2;this.by=L/2;this.bs=1;               /* [ревизия 5] актуальный центр задаёт layout() */
    this.buildTextures();
    this.buildTileTex();                             /* [ревизия 7] 3D-текстуры плиток текущей темы */
    this.buildAmbient();
    this.buildBoard();
    this.layout();
    this.scale.on('resize',()=>this.layout());       /* [ревизия 5] канвас = вьюпорт */
    this.bindInput();
    this.retheme();
    this.newGame(true);
    this.ready=true;
    syncControls();
  }

  /* ---------- ambient ---------- */
  /* [ревизия 5] амбиент нормализован (0..1) и живёт на всём канвасе-вьюпорте */
  buildAmbient(){
    const defs=[
      {x:.18,y:.20,r:330,k:'orbA',s:.055,a:.30},
      {x:.84,y:.26,r:270,k:'orbB',s:.041,a:.24},
      {x:.76,y:.86,r:360,k:'orbA',s:.033,a:.26},
      {x:.22,y:.82,r:240,k:'orbB',s:.062,a:.20}
    ];
    this.ambS=1;
    this.orbs=defs.map((d,i)=>{
      const img=this.add.image(0,0,'glow').setAlpha(d.a).setDepth(0);
      return {img,nx:d.x,ny:d.y,r:d.r,ax:26+i*9,ay:20+i*7,sp:d.s,ph:i*1.7,ba:d.a,k:d.k};
    });
    this.dots=[];
    for(let i=0;i<64;i++){                    /* [ревизия 5] пыль на весь экран */
      const s=6+Math.random()*16;
      const img=this.add.image(0,0,'dot').setAlpha(.25).setDepth(1);
      this.dots.push({img,x:Math.random(),y:Math.random(),s,v:5+Math.random()*13,wx:6+Math.random()*14,
        sw:.3+Math.random()*.8,ph:Math.random()*6.28,tw:.5+Math.random(),a:.10+Math.random()*.22});
    }
  }
  /* [ревизия 5] центр/масштаб поля по фактической геометрии #stage
     (DOM-спейсер между шапкой и низом); координаты канваса =
     CSS-пиксели вьюпорта (Scale.RESIZE, канвас в (0,0)) */
  layout(){
    if(!this.board)return;
    const st=$('#stage');if(!st)return;
    const r=st.getBoundingClientRect();
    if(r.width<20||r.height<20)return;
    this.bs=Math.min(r.width,r.height)/L;
    this.bx=r.left+r.width/2;
    this.by=r.top+r.height/2;
    this.board.setPosition(this.bx,this.by).setScale(this.bs);
    const m=Math.min(this.scale.width,this.scale.height);
    this.ambS=m/L;
    this.orbs.forEach(o=>o.img.setScale(o.r/256*this.ambS));
    this.dots.forEach(d=>d.img.setScale(d.s/32*this.ambS));
  }

  /* ---------- board ---------- */
  buildBoard(){
    this.runId=0;this.scoreTween=null;this.displayScore=0;      /* [B1][B5] */
    this.board=this.add.container(this.bx,this.by).setDepth(10);
    this.shadowImg=this.add.image(0,18,'glow').setScale(BOARD*1.25/256).setAlpha(.2).setDepth(9);
    this.board.add(this.shadowImg);
    this.panel=this.add.graphics();this.board.add(this.panel);
    this.cells=[];
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){
      const im=this.add.image(this.cx(c),this.cy(r),'cell').setDisplaySize(CELL,CELL).setDepth(1);
      this.board.add(im);this.cells.push(im);
    }
    this.tileLayer=this.add.container().setDepth(3);this.board.add(this.tileLayer);
    this.fxLayer=this.add.container().setDepth(5);this.board.add(this.fxLayer);
    this.drawPanel();
    this.grid=this.emptyGrid();
    this.history=[];this.score=0;this.over=false;this.won=false;this.busy=false;
    this.moves=0;this.t0=Date.now();                                   /* [ревизия 8] телеметрия */
  }
  emptyGrid(){return [[null,null,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]];}
  cx(c){return -BOARD/2+PAD+CELL/2+c*(CELL+GAP);}
  cy(r){return -BOARD/2+PAD+CELL/2+r*(CELL+GAP);}
  drawPanel(){
    const th=TH();this.panel.clear();
    this.panel.fillStyle(Phaser.Display.Color.HexStringToColor(th.board).color,1);
    this.panel.fillRoundedRect(-BOARD/2,-BOARD/2,BOARD,BOARD,30);
    this.shadowImg.setAlpha(th.shadow*.55);
  }

  /* ---------- tiles ---------- */
  tileIndex(v){const i=VALUES.indexOf(v);return i<0?VALUES.length-1+Math.max(1,Math.floor(Math.log2(v/2048))):i;}
  tileColors(v){
    const th=TH(),i=this.tileIndex(v);
    if(i>=VALUES.length-1&&v>=2048)return {bg:th.max,fg:lum(th.max)>.52?th.dark:th.light,glow:1};
    /* [F5] Lab-интерполяция равными воспринимаемыми шагами + полный
       диапазон k=i/9 для 2..1024 (2048+ — спец-ветка выше, tileB раньше
       не достигался ни одной плиткой — 10% диапазона пропадало) */
    const k=clamp(i/(VALUES.length-2),0,1),bg=mixLab(th.tileA,th.tileB,k);
    return {bg,fg:lum(bg)>.52?th.dark:th.light,glow:k>.55?(k-.55)*1.5:0};
  }
  createTile(v,r,c){
    const glow=this.add.image(0,0,'glow').setScale(CELL*1.5/256).setAlpha(0);
    const img=this.add.image(0,0,'tile').setDisplaySize(CELL,CELL);
    const txt=this.add.text(0,0,String(v),{
      fontFamily:'"Space Grotesk","Manrope",sans-serif',
      fontSize:this.fontSize(v)+'px',fontStyle:'700',color:'#000000',align:'center'}).setOrigin(.5,.453);  /* [ревизия 7] центр текста — центр лица (не грани) */
    const obj=this.add.container(this.cx(c),this.cy(r),[glow,img,txt]);
    this.tileLayer.add(obj);
    const tile={obj,glow,img,txt,value:v,r,c,merged:false};
    this.grid[r][c]=tile;this.styleTile(tile);
    return tile;
  }
  fontSize(v){
    const s=String(v).length;
    return s===1?72:s===2?64:s===3?53:s===4?44:36;
  }
  styleTile(tile){
    if(!tile.obj||!tile.obj.active)return;
    const c=this.tileColors(tile.value),th=TH();
    /* [ревизия 7] готовая 3D-текстура (градиент+грань+блик); tint не нужен —
       цвета уже в текстуре. Фолбэк — белый 'tile' + tint (как до ревизии 7). */
    const key=this.tileTexKey(tile.value);
    if(this.textures.exists(key)){tile.img.setTexture(key);tile.img.clearTint();}
    else{tile.img.setTexture('tile');tile.img.setTint(Phaser.Display.Color.HexStringToColor(c.bg).color);}
    tile.txt.setText(String(tile.value));               /* [F6] число не обновлялось после слияния/перемешивания */
    tile.txt.setColor(c.fg);tile.txt.setFontSize(this.fontSize(tile.value));
    tile.glow.setBlendMode(th.blendAdd?Phaser.BlendModes.ADD:Phaser.BlendModes.NORMAL)
      .setTint(Phaser.Display.Color.HexStringToColor(th.glow).color)
      .setAlpha(tile.value>=128?.16+c.glow*.3:0);
  }
  retheme(){
    if(!this.panel)return;const th=TH();
    this.buildTileTex();                               /* [ревизия 7] 3D-текстуры новой темы */
    this.drawPanel();
    const cc=Phaser.Display.Color.HexStringToColor(th.cell).color;
    this.cells.forEach(c=>c.setTint(cc));
    const blend=th.blendAdd?Phaser.BlendModes.ADD:Phaser.BlendModes.NORMAL;
    this.orbs.forEach(o=>{o.img.setTint(Phaser.Display.Color.HexStringToColor(th[o.k]).color);o.img.setBlendMode(blend);});
    this.dots.forEach(d=>{d.img.setTint(Phaser.Display.Color.HexStringToColor(th.dust).color);d.img.setBlendMode(blend);});
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){const tl=this.grid[r][c];if(tl)this.styleTile(tl);}
  }

  /* ---------- flow ---------- */
  invalidate(){ this.runId=(this.runId||0)+1; }        /* [B1] */
  hardStop(){
    this.invalidate();
    if(this.scoreTween){this.scoreTween.stop();this.scoreTween=null;}
    this.tweens.killAll();
    this.time.removeAllEvents();
    if(this.board&&this.bx!==undefined)this.board.x=this.bx;   /* [F4] killAll не зовёт onComplete — тряска оставляла смещение */
  }
  newGame(silent){
    this.hardStop();
    this.tileLayer.removeAll(true);
    this.fxLayer.removeAll(true);                        /* [B1] чистим «+N» */
    this.grid=this.emptyGrid();
    this.history=[];this.score=0;this.displayScore=0;this.over=false;this.won=false;this.busy=false;
    this.moves=0;this.t0=Date.now();                                 /* [ревизия 8] телеметрия */
    undoFree=UNDO_FREE;                                /* [ревизия 5] новой партии — 3 бесплатные отмены */
    $('#score').textContent='0';
    hideEnd();
    this.spawn(false);this.spawn(false);
    if(!silent){Sound.click();toast(t('tNew'),'↻');}
    syncControls();
    za('level_start',{mode:'classic',size:4,cached:0});               /* [ревизия 8] каждая партия */
    if(!silent)za('game_restart',{});                                 /* пользователь нажал «Заново»/«Новая игра» */
  }
  spawn(anim){
    const empty=[];
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(!this.grid[r][c])empty.push({r,c});
    if(!empty.length)return null;
    const p=empty[Math.floor(Math.random()*empty.length)];
    const tile=this.createTile(Math.random()<.9?2:4,p.r,p.c);
    if(anim){
      tile.obj.setScale(0);
      this.tweens.add({targets:tile.obj,scale:1,duration:200,ease:'Back.easeOut',delay:70});
      Sound.spawn();
    }
    return tile;
  }
  snapshot(){return {grid:this.grid.map(row=>row.map(x=>x?x.value:0)),score:this.score,won:this.won};}  /* [F2] */

  compute(dir){
    const v=VEC[dir],g=this.grid;
    const rows=[0,1,2,3],cols=[0,1,2,3];
    if(v.dr===1)rows.reverse();
    if(v.dc===1)cols.reverse();
    const moved=[],merges=[];let any=false;
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(g[r][c])g[r][c].merged=false;
    for(const r of rows)for(const c of cols){
      const tile=g[r][c];if(!tile)continue;
      let pr=r,pc=c,nr=r+v.dr,nc=c+v.dc;
      while(nr>=0&&nr<4&&nc>=0&&nc<4&&!g[nr][nc]){pr=nr;pc=nc;nr+=v.dr;nc+=v.dc;}
      const nxt=(nr>=0&&nr<4&&nc>=0&&nc<4)?g[nr][nc]:null;
      if(nxt&&nxt.value===tile.value&&!nxt.merged){
        g[r][c]=null;nxt.merged=true;
        merges.push({surv:nxt,abs:tile,r:nr,c:nc,value:nxt.value*2});
        any=true;
      }else if(pr!==r||pc!==c){
        g[r][c]=null;g[pr][pc]=tile;tile.r=pr;tile.c=pc;
        moved.push({tile,r:pr,c:pc});any=true;
      }
    }
    return {moved,merges,any};
  }

  tryMove(dir){
    if(!this.ready||this.busy||this.over||uiBlocked())return;    /* [C1] */
    const before=this.snapshot();                                /* [F1] ДО compute(): compute мутирует поле */
    const plan=this.compute(dir);
    if(!plan.any){this.invalid();return;}
    this.history.push(before);
    if(this.history.length>12)this.history.shift();
    this.moves++;                                                /* [ревизия 8] телеметрия: только ходы игрока */
    this.busy=true;Sound.move();
    const dur=125,token=this.runId;
    plan.moved.forEach(m=>this.tweens.add({targets:m.tile.obj,x:this.cx(m.c),y:this.cy(m.r),duration:dur,ease:'Sine.easeOut'}));
    plan.merges.forEach(m=>{
      this.tweens.add({targets:m.abs.obj,x:this.cx(m.c),y:this.cy(m.r),duration:dur,ease:'Sine.easeOut',
        onComplete:()=>{if(m.abs.obj&&m.abs.obj.active)m.abs.obj.destroy();}});
    });
    this.time.delayedCall(dur+16,()=>this.finish(plan,token));
    syncControls();
  }

  finish(plan,token){
    if(token!==this.runId)return;                                 /* [B1] партия сброшена */
    let gain=0;
    plan.merges.forEach((m,i)=>{
      if(!m.surv.obj||!m.surv.obj.active)return;
      m.surv.value=m.value;m.surv.merged=false;this.styleTile(m.surv);
      gain+=m.value;
      m.surv.obj.setScale(.82);
      this.tweens.add({targets:m.surv.obj,scale:1,duration:200,ease:'Back.easeOut',delay:i*18});
      this.floatText('+'+m.value,this.cx(m.r!==undefined?m.c:m.c),this.cy(m.r));
      Sound.merge(this.tileIndex(m.value));
    });
    if(gain)this.addScore(gain);
    this.spawn(true);
    this.busy=false;

    const maxv=this.maxValue(),dead=!this.canMove();
    const justWon=(maxv>=2048&&!this.won);
    if(justWon)this.won=true;
    if(dead)this.over=true;
    /* [B3] победа приоритетнее: экран поражения не перекрывает экран победы */
    if(justWon){ Sound.win(); showEnd('win');
      za('game_win',{score:this.score,sec:this.gameSec(),max_tile:maxv,moves:this.moves}); }
    else if(dead){ Sound.lose();
      za('game_fail',{score:this.score,sec:this.gameSec(),max_tile:maxv,moves:this.moves,filled_pct:this.filledPct()});
      this.time.delayedCall(420,()=>{ if(token===this.runId&&this.over)showEnd('over'); }); }
    syncControls();
  }

  /* [ревизия 8] данные для аналитики (ZA.setStateProvider в main.js) */
  gameSec(){ return this.t0?Math.max(0,Math.round((Date.now()-this.t0)/1000)):0; }
  filledPct(){ let n=0;for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(this.grid[r][c])n++;return Math.round(n/16*100); }

  floatText(str,x,y){
    const th=TH();
    const tx=this.add.text(x,y-14,str,{fontFamily:'"Space Grotesk",sans-serif',
      fontSize:'30px',fontStyle:'700',
      color:th.blendAdd?'#ffffff':th.dark}).setOrigin(.5).setAlpha(.95);
    this.fxLayer.add(tx);
    this.tweens.add({targets:tx,y:y-72,alpha:0,duration:760,ease:'Cubic.easeOut',
      onComplete:()=>{if(tx.active)tx.destroy();}});
  }

  addScore(v){                                                      /* [B5] */
    this.score+=v;
    if(this.score>best){best=this.score;store.set('best',best);$('#best').textContent=best;}
    if(this.scoreTween){this.scoreTween.stop();this.scoreTween=null;}
    const pill=$('#pill-score');
    this.scoreTween=this.tweens.addCounter({
      from:this.displayScore,to:this.score,duration:420,ease:'Cubic.easeOut',
      onUpdate:tw=>{this.displayScore=Math.round(tw.getValue());$('#score').textContent=this.displayScore;},
      onComplete:()=>{this.displayScore=this.score;$('#score').textContent=this.score;this.scoreTween=null;}
    });
    pill.classList.remove('bump');void pill.offsetWidth;pill.classList.add('bump');
  }
  maxValue(){let m=0;for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(this.grid[r][c])m=Math.max(m,this.grid[r][c].value);return m;}
  canMove(){
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){
      if(!this.grid[r][c])return true;
      const v=this.grid[r][c].value;
      if(c<3&&this.grid[r][c+1]&&this.grid[r][c+1].value===v)return true;
      if(r<3&&this.grid[r+1][c]&&this.grid[r+1][c].value===v)return true;
    }return false;
  }
  invalid(){                                                        /* [B6] */
    Sound.bad();
    this.tweens.killTweensOf(this.board);
    this.board.x=this.bx;
    this.tweens.add({targets:this.board,x:this.bx+7,duration:44,yoyo:true,repeat:3,ease:'Sine.inOut',
      onComplete:()=>{this.board.x=this.bx;}});
  }

  /* ---------- rewarded actions ---------- */
  doUndo(){
    if(!this.history.length){toast(t('tUndoNone'),'!');return;}
    this.restore(this.history.pop());
    toast(t('tUndo'),'↶');
  }
  restore(s){
    this.hardStop();
    this.tileLayer.removeAll(true);this.fxLayer.removeAll(true);
    this.grid=this.emptyGrid();
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){
      const v=s.grid[r][c];
      if(v){const tl=this.createTile(v,r,c);
        tl.obj.setAlpha(0);this.tweens.add({targets:tl.obj,alpha:1,duration:220});}
    }
    this.score=s.score;this.displayScore=s.score;$('#score').textContent=s.score;
    this.won=s.won===true;                                       /* [F2] */
    this.over=false;this.busy=false;
    hideEnd();syncControls();
  }
  doShuffle(){
    if(this.over||this.busy||uiBlocked())return;
    const tiles=[];
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(this.grid[r][c])tiles.push(this.grid[r][c]);
    if(tiles.length<2){toast(t('tShuffle'),'⤮');return;}
    const before=this.snapshot();                                    /* [B2] */
    const vals=tiles.map(x=>x.value);
    let attempt=0,ok=false,places=null,order=null;
    while(attempt++<40&&!ok){
      order=vals.slice();
      for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
      const all=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++)all.push({r,c});
      for(let i=all.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[all[i],all[j]]=[all[j],all[i]];}
      places=all.slice(0,tiles.length);
      const g=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
      places.forEach((p,i)=>g[p.r][p.c]=order[i]);
      let hasMove=false;
      for(let r=0;r<4;r++)for(let c=0;c<4;c++){
        if(!g[r][c])hasMove=true;
        if(g[r][c]){if(c<3&&g[r][c+1]===g[r][c])hasMove=true;if(r<3&&g[r+1][c]===g[r][c])hasMove=true;}
      }
      if(hasMove)ok=true;
    }
    this.grid=this.emptyGrid();
    this.busy=true;                                   /* [F9] окно анимации перемешивания закрыто для ввода */
    const token=this.runId;
    tiles.forEach((tl,i)=>{
      tl.value=order[i];this.styleTile(tl);
      const p=places[i];tl.r=p.r;tl.c=p.c;this.grid[p.r][p.c]=tl;
      this.tweens.add({targets:tl.obj,x:this.cx(p.c),y:this.cy(p.r),duration:340,ease:'Cubic.easeInOut'});
    });
    this.time.delayedCall(360,()=>{ if(token===this.runId)this.busy=false; syncControls(); });
    this.history.push(before);
    if(this.history.length>12)this.history.shift();
    Sound.click();toast(t('tShuffle'),'⤮');syncControls();
    za('shuffle_used',{tiles:tiles.length});             /* [ревизия 8] */
  }
  doRevive(){
    if(!this.over)return;
    const token=(this.runId=(this.runId||0)+1);
    const all=[];
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(this.grid[r][c])all.push(this.grid[r][c]);
    if(!all.length){this.over=false;hideEnd();syncControls();return;}
    all.sort((a,b)=>a.value-b.value);
    all.slice(0,2).forEach(v=>{
      this.grid[v.r][v.c]=null;
      this.tweens.add({targets:v.obj,scale:0,alpha:0,duration:280,ease:'Back.easeIn',
        onComplete:()=>{if(v.obj&&v.obj.active)v.obj.destroy();}});
    });
    this.over=false;this.busy=true;                              /* [F3] окно до спавна закрыто для ввода */
    hideEnd();syncControls();
    this.time.delayedCall(300,()=>{ if(token!==this.runId)return; this.busy=false; this.spawn(true); syncControls(); });
    toast(t('tRevive'),'♥');
    za('revive_used',{tiles:all.length});                /* [ревизия 8] */
  }

  refreshOverlaysText(){ if($('#ov-end').classList.contains('show'))fillEnd(); }

  /* ---------- input [C1][C3] ---------- */
  bindInput(){
    const kb=this.input.keyboard;
    kb.on('keydown',e=>{
      if(e.key==='Escape'){
        if(adVisible()){ if(!$('#ad-close').disabled) closeAd(false); }        /* [A3] */
        else if($('#ov-end').classList.contains('show')){
          if(endKind==='win'){ hideEnd(); if(this.over)showEnd('over'); }      /* [B4] */
        }
        return;
      }
      let d=null;
      if(e.code==='ArrowUp')d='up';
      else if(e.code==='ArrowDown')d='down';
      else if(e.code==='ArrowLeft')d='left';
      else if(e.code==='ArrowRight')d='right';
      else if(e.code==='KeyW')d='up';
      else if(e.code==='KeyS')d='down';
      else if(e.code==='KeyA')d='left';
      else if(e.code==='KeyD')d='right';
      if(d){
        e.preventDefault();
        if(uiBlocked())return;
        Sound.unlock();this.tryMove(d);
      }
    });
    let sx=0,sy=0,fired=false;
    const fire=(dx,dy)=>{
      if(Math.abs(dx)>Math.abs(dy))this.tryMove(dx>0?'right':'left');
      else this.tryMove(dy>0?'down':'up');
    };
    this.input.on('pointerdown',p=>{sx=p.x;sy=p.y;fired=uiBlocked();Sound.unlock();});
    this.input.on('pointermove',p=>{
      if(fired||!this.input.manager.activePointer.isDown)return;
      const dx=p.x-sx,dy=p.y-sy;
      if(Math.max(Math.abs(dx),Math.abs(dy))>34){fired=true;fire(dx,dy);}
    });
    this.input.on('pointerup',p=>{
      if(fired)return;
      const dx=p.x-sx,dy=p.y-sy;
      if(Math.max(Math.abs(dx),Math.abs(dy))>26)fire(dx,dy);
    });
  }

  update(time,delta){
    if(!this.ready)return;
    const dt=Math.min(delta,50)/1000,tt=time/1000,
          w=this.scale.width,h=this.scale.height,m=Math.min(w,h);
    for(let i=0;i<this.orbs.length;i++){
      const o=this.orbs[i];
      o.img.x=o.nx*w+Math.sin(tt*o.sp*6+o.ph)*o.ax*(m/L);
      o.img.y=o.ny*h+Math.cos(tt*o.sp*5+o.ph)*o.ay*(m/L);
      o.img.alpha=o.ba+Math.sin(tt*.5+o.ph)*.05;
    }
    for(let i=0;i<this.dots.length;i++){
      const d=this.dots[i];
      /* [F7] v/wx заданы в px/с поля L=760, а координаты нормализованы (0..1),
         поэтому делим на L — получаем долю экрана в секунду (темп оригинала:
         полный экран за 42–152 с). Умножение на h/L давало h-кратное
         ускорение — «слишком быстрая анимация частиц». */
      d.y-=d.v*dt/L;d.x+=Math.sin(tt*d.sw+d.ph)*d.wx*dt/L;
      if(d.y<-.04){d.y=1.04;d.x=Math.random();}
      if(d.x<-.04)d.x=1.04;else if(d.x>1.04)d.x=-.04;
      d.img.setPosition(d.x*w,d.y*h);
      d.img.setAlpha(d.a*(.55+.45*Math.sin(tt*d.tw+d.ph)));
    }
  }
}
