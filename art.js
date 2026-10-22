(function(root){
/* ===== CHESS GENESIS — ARTE PIXELADA =====
   Sprites gerados a partir das silhuetas das peças do Clubinho (sombreamento em bandas + contorno),
   e cenários desenhados em baixa resolução (256x144) para ampliar com escala inteira.            */
const Art=(function(){
"use strict";
const W=256,H=144,HOR=84,FY=120;

/* ---------- silhuetas (mesmas do site) ---------- */
const E=(cx,cy,rx,ry)=>({t:'e',cx,cy,rx,ry}), PA=(d)=>({t:'p',d}), CI=(cx,cy,r)=>({t:'c',cx,cy,r}), RE=(x,y,w,h,rx)=>({t:'r',x,y,w,h,rx:rx||0}), ST=(d,w)=>({t:'p',d,stroke:w});
const SHAPES={
 pawn:{eye:{x:50,y:26,sp:9},accent:[],shapes:[E(50,88,27,6.5),PA('M27 88 L31 76 Q50 82 69 76 L73 88 Z'),E(50,76,17,5),PA('M36 75 Q33 60 41 50 Q35 46 37 39 Q33 34 38 28 L62 28 Q67 34 63 39 Q65 46 59 50 Q67 60 64 75 Q50 80 36 75 Z'),CI(50,26,13.5)]},
 rook:{eye:{x:50,y:32,sp:11},accent:[4],shapes:[E(50,88,28,6.5),PA('M26 88 L30 78 Q50 83 70 78 L74 88 Z'),PA('M31 78 L34 40 L66 40 L69 78 Q50 82 31 78 Z'),PA('M30 40 L30 17 L39 17 L39 24 L46 24 L46 17 L54 17 L54 24 L61 24 L61 17 L70 17 L70 40 Z'),RE(35,42,30,6,1)]},
 bishop:{eye:{x:50,y:36,sp:9},accent:[4,5],shapes:[E(50,88,26,6.5),PA('M28 88 L32 78 Q50 83 68 78 L72 88 Z'),PA('M33 78 Q28 60 38 48 Q30 40 38 30 Q44 20 50 14 Q56 20 62 30 Q70 40 62 48 Q72 60 67 78 Q50 83 33 78 Z'),ST('M40 46 L60 46',3),CI(50,15,6),ST('M46 6 L54 6 M50 2 L50 10',2.4)]},
 knight:{eye:{x:62,y:21,sp:0},accent:[4],shapes:[E(50,88,27,6.5),PA('M26 88 L30 77 Q50 82 70 77 L74 88 Z'),PA('M30 77 Q26 62 33 52 Q30 44 36 38 Q34 30 42 24 Q40 18 46 13 Q54 8 64 12 Q70 15 68 21 Q74 23 73 29 Q78 32 74 37 Q76 42 70 43 Q73 48 66 49 L58 45 Q62 52 58 58 Q64 62 61 68 Q66 72 62 77 Q56 82 46 80 Q37 80 30 77 Z'),CI(63,20,2.6),ST('M46 15 Q50 20 47 26',2)]},
 queen:{eye:{x:50,y:61,sp:11},accent:[3,4,5,6,7,8],shapes:[E(50,88,28,6.5),PA('M26 88 L30 76 Q50 82 70 76 L74 88 Z'),PA('M32 76 Q28 60 36 50 L64 50 Q72 60 68 76 Q50 81 32 76 Z'),PA('M30 50 L26 27 L36 40 L40 22 L50 38 L60 22 L64 40 L74 27 L70 50 Z'),CI(26,24,4.2),CI(40,19,4.2),CI(50,15,4.6),CI(60,19,4.2),CI(74,24,4.2)]},
 king:{eye:{x:50,y:60,sp:11},accent:[3,4,5],shapes:[E(50,88,28,6.5),PA('M25 88 L29 76 Q50 82 71 76 L75 88 Z'),PA('M31 76 Q27 58 37 48 L63 48 Q73 58 69 76 Q50 81 31 76 Z'),PA('M30 48 L27 32 L38 40 L50 26 L62 40 L73 32 L70 48 Z'),RE(46,10,8,18,1.5),RE(40,15,20,8,1.5)]}
};

/* ---------- paletas [realce, claro, médio, escuro] ---------- */
function P(body,ac,o,inner,eye){ return {body,ac,o,inner,eye}; }
const PAL={
 /* heróis: corpo marfim; o acento muda a cada forma */
 h_pawn:  P(['#fffaf0','#efe6cc','#cdbd91','#9d8a5c'],['#e0b080','#c08a52','#94622f','#633d1a'],'#2a2113','#6f5f3a','#3a2a14'),
 h_knight:P(['#fffaf0','#efe6cc','#cdbd91','#9d8a5c'],['#ffe9a0','#f0c850','#c89a24','#8a6410'],'#2a2113','#6f5f3a','#3a2a14'),
 h_rook:  P(['#fffaf0','#efe6cc','#c9c3b0','#908a78'],['#bcd8f2','#7fb0de','#4a82b8','#2c5483'],'#232a33','#5d6672','#1c2a3a'),
 h_bishop:P(['#fffaf0','#ece2d8','#c8b8cf','#9a82a8'],['#f1d8ff','#c79af0','#9462cc','#5f3a92'],'#2a1d3a','#6d5580','#3a1f5a'),
 h_queen: P(['#fffaf0','#f3e8cc','#d8c392','#a98d52'],['#fff2b8','#ffd24d','#d9a21c','#9a6a0a'],'#33260f','#7a5f2a','#5a1a1a'),
 h_king:  P(['#fffaf0','#f5e8c8','#dcc088','#aa8a4a'],['#ffeaa0','#ffc933','#e09a10','#a05f00'],'#3a1c0c','#80571c','#7a1010'),
 /* inimigos */
 dark:    P(['#6a5f54','#4a4038','#352d27','#221c18'],['#9a8a76','#7a6a58','#574b3d','#382f26'],'#0d0907','#16110e','#ff4a3a'),
 rust:    P(['#cf7f4c','#a65e32','#7a4326','#4e2a17'],['#f0c080','#d9a066','#a8743a','#6b4520'],'#1a0c05','#321a0c','#ffd24a'),
 pale:    P(['#ece6da','#c4bdb0','#938c80','#625c52'],['#cfe4fb','#8fb0d6','#5f82ae','#3a5578'],'#1f1c18','#45403a','#ff4a3a'),
 blue:    P(['#82aee6','#5a86c4','#3d629a','#26406a'],['#f2f8ff','#cfe0f5','#98b6dc','#6a88b4'],'#0c1830','#1d3358','#ffef7a'),
 crimson: P(['#e0605a','#b8423e','#862b2c','#571a1c'],['#ffe7a0','#e8c15a','#b99028','#7d5f10'],'#2a0808','#3d1012','#ffe14a'),
 shadow:  P(['#9577c4','#6f549e','#4c3a78','#2f2050'],['#d7bcff','#b99cf0','#8466c8','#533a92'],'#10081e','#1c1030','#ff5ad0'),
 bronze:  P(['#f0b068','#c98a40','#965f26','#613c16'],['#ffe6a0','#f0cf7a','#c9a040','#8a6a1c'],'#2a1708','#442a10','#ff4a3a'),
 steel:   P(['#dbe4ee','#aab6c6','#7a889c','#4f5b6e'],['#ffffff','#e8f0ff','#b9c8e0','#8a9bb8'],'#10161e','#2a3342','#4af0ff'),
 stone:   P(['#bdb9ae','#96928a','#6d6a63','#46443f'],['#a8e6b0','#6fae7a','#468556','#2a5636'],'#14130f','#2a2824','#ffb44a'),
 teal:    P(['#86e4d8','#4fb8aa','#318a80','#1c5a54'],['#e8fffb','#c9fff6','#8fe8da','#5cbcae'],'#06201d','#0e3834','#ffffff'),
 obsidian:P(['#5c4a80','#3a2c5a','#271c3d','#150e24'],['#e0b8ff','#c58bff','#9560d6','#5f3a96'],'#07040f','#0f0a1a','#ff5ad0'),
 violet:  P(['#a468e0','#7e45b4','#5a3086','#391a56'],['#f4dcff','#e7c5ff','#bd90e8','#8a5cb8'],'#14081f','#24103a','#ffef7a'),
 ember:   P(['#ffa24e','#e06a22','#aa4214','#6a260a'],['#fff0a0','#ffd36b','#f0a020','#b06a08'],'#2a0f04','#481a08','#fff48a'),
 blood:   P(['#cf3a5a','#a02444','#6e1630','#430a1c'],['#ffeaa0','#ffd26a','#d6a024','#946a0c'],'#1a0309','#2e0613','#ffe14a'),
 void:    P(['#6a6a96','#464670','#2c2c4a','#171728'],['#ff9ae0','#ff59c8','#c42a98','#7a1660'],'#05050d','#0b0b18','#ff59c8')
};

/* ---------- gerador de sprites ---------- */
function hex(c){ return c; }
function makeShapePath(s,sc,ox){
  const p=new Path2D();
  if(s.t==='e'){ p.ellipse((s.cx)*sc+ox,s.cy*sc,s.rx*sc,s.ry*sc,0,0,6.2832); }
  else if(s.t==='c'){ p.arc(s.cx*sc+ox,s.cy*sc,s.r*sc,0,6.2832); }
  else if(s.t==='r'){ if(p.roundRect) p.roundRect(s.x*sc+ox,s.y*sc,s.w*sc,s.h*sc,s.rx*sc); else p.rect(s.x*sc+ox,s.y*sc,s.w*sc,s.h*sc); }
  else { const m=new Path2D(s.d); const t=new DOMMatrix([sc,0,0,sc,ox,0]); p.addPath(m,t); }
  return p;
}
const cache={};
function buildPiece(piece,palKey,N,outlineOverride,eyeOverride){
  const key=[piece,palKey,N,outlineOverride||'',eyeOverride||''].join('|');
  if(cache[key]) return cache[key];
  const def=SHAPES[piece], pal=PAL[palKey];
  const sc=N/96, SW=Math.round(68*sc), ox=-16*sc;
  const cv=document.createElement('canvas'); cv.width=SW; cv.height=N; const g=cv.getContext('2d',{willReadFrequently:true});
  const owner=new Int16Array(SW*N).fill(-1);
  def.shapes.forEach((s,i)=>{
    g.clearRect(0,0,SW,N); const p=makeShapePath(s,sc,ox);
    if(s.stroke){ g.lineWidth=Math.max(1.1,s.stroke*sc); g.lineCap='round'; g.lineJoin='round'; g.strokeStyle='#000'; g.stroke(p); }
    else{ g.fillStyle='#000'; g.fill(p); }
    const d=g.getImageData(0,0,SW,N).data;
    for(let k=0;k<SW*N;k++) if(d[k*4+3]>105) owner[k]=i;
  });
  const inside=(x,y)=>x>=0&&y>=0&&x<SW&&y<N&&owner[y*SW+x]>=0;
  const px=[]; const col=new Array(SW*N).fill(null);
  const acc=new Set(def.accent), outline=outlineOverride||pal.o;
  for(let y=0;y<N;y++){
    let x=0;
    while(x<SW){
      if(!inside(x,y)){ x++; continue; }
      let x2=x; while(x2+1<SW&&inside(x2+1,y)) x2++;
      const len=x2-x+1;
      for(let xx=x;xx<=x2;xx++){
        const o=owner[y*SW+xx]; const u=len<=1?0.5:(xx-x)/(len-1);
        const band=u<0.2?0:u<0.5?1:u<0.8?2:3;
        let c=(acc.has(o)?pal.ac:pal.body)[band];
        const edge=!inside(xx-1,y)||!inside(xx+1,y)||!inside(xx,y-1)||!inside(xx,y+1);
        if(edge) c=outline;
        else if(inside(xx,y+1)&&owner[(y+1)*SW+xx]!==o&&owner[(y+1)*SW+xx]>o) c=pal.inner;
        col[y*SW+xx]=c;
      }
      x=x2+1;
    }
  }
  // olhos
  const eye=eyeOverride||pal.eye, ey=Math.round(def.eye.y*sc), exm=Math.round((def.eye.x-16)*sc);
  const half=Math.max(1,Math.round(def.eye.sp*sc/2)), eh=N>=40?3:2, ew=N>=46?2:1;
  const eyes=def.eye.sp===0?[exm]:[exm-half,exm+half-ew+1];
  eyes.forEach(ex=>{ for(let dy=0;dy<eh;dy++) for(let dx=0;dx<ew;dx++){ const xx=ex+dx, yy=ey+dy-1; if(inside(xx,yy)) col[yy*SW+xx]=eye; } });
  for(let y=0;y<N;y++) for(let x=0;x<SW;x++){ const c=col[y*SW+x]; if(c) px.push({x,y,c}); }
  const out={w:SW,h:N,px,cv:null,white:null,red:null,flip:null};
  const mk=(f)=>{ const c=document.createElement('canvas'); c.width=SW; c.height=N; const k=c.getContext('2d'); px.forEach(p=>{ k.fillStyle=f(p); k.fillRect(p.x,p.y,1,1); }); return c; };
  out.mk=mk;
  out.cv=mk(p=>p.c);
  cache[key]=out; return out;
}
function variant(sp,kind){
  if(sp[kind]) return sp[kind];
  if(kind==='white') sp.white=sp.mk(()=>'#ffffff');
  else if(kind==='red') sp.red=sp.mk(()=>'#ff3b2f');
  else if(kind==='gold') sp.gold=sp.mk(()=>'#ffe58a');
  else if(kind==='flip'){ const c=document.createElement('canvas'); c.width=sp.w; c.height=sp.h; const k=c.getContext('2d'); k.translate(sp.w,0); k.scale(-1,1); k.drawImage(sp.cv,0,0); sp.flip=c; }
  else if(kind==='flipWhite'){ const c=document.createElement('canvas'); c.width=sp.w; c.height=sp.h; const k=c.getContext('2d'); k.translate(sp.w,0); k.scale(-1,1); k.drawImage(variant(sp,'white'),0,0); sp.flipWhite=c; }
  else if(kind==='flipRed'){ const c=document.createElement('canvas'); c.width=sp.w; c.height=sp.h; const k=c.getContext('2d'); k.translate(sp.w,0); k.scale(-1,1); k.drawImage(variant(sp,'red'),0,0); sp.flipRed=c; }
  return sp[kind];
}
const FORM_IDS=['pawn','knight','rook','bishop','queen','king'];
function heroSprite(formIdx){ return buildPiece(FORM_IDS[formIdx],'h_'+FORM_IDS[formIdx],32+formIdx*2); }
function enemySprite(piece,pal,tier,elite){
  let N=Math.round(26+tier*3.4); if(elite) N=Math.round(N*1.2);
  return buildPiece(piece,pal,N,elite?'#e7b93f':null);
}

/* ---------- primitivas de desenho ---------- */
const fl=Math.floor;
function R(g,c,x,y,w,h){ g.fillStyle=c; g.fillRect(fl(x),fl(y),Math.round(w),Math.round(h)); }
function hash(i){ const x=Math.sin(i*127.1+311.7)*43758.5453; return x-Math.floor(x); }
function wrap(px,par,scroll,period,margin){ return (((px-scroll*par)%period)+period)%period-(margin||0); }
function bands(g,cols,y0,y1){ const n=cols.length,h=(y1-y0)/n; for(let i=0;i<n;i++) R(g,cols[i],0,y0+i*h,W,Math.ceil(h)+1); }
function hills(g,col,base,amp,len,speed,scroll,seed){
  for(let x=0;x<W;x++){
    const v=Math.sin((x+scroll*speed)/len)*.6+Math.sin((x+scroll*speed)/(len*.43)+seed)*.4;
    const y=base-fl(amp*(v+1)); R(g,col,x,y,1,HOR-y+2);
  }
}
function ground(g,c,tuftCol,scroll,tufts,seed){
  const ys=[HOR,HOR+5,HOR+12,HOR+22,HOR+36,HOR+52];
  ys.forEach((y,i)=>{ R(g,c[i%c.length],0,y,W,(ys[i+1]||H)-y+1); });
  for(let i=0;i<(tufts||50);i++){
    const tx=wrap(hash(i+seed)*W,1,scroll,W), ty=HOR+3+hash(i*3+seed)*(H-HOR-8), s=ty>HOR+30?2:1;
    R(g,tuftCol,tx,ty,2*s,s); R(g,tuftCol,tx+s,ty-s,s,s);
  }
}
function tree(g,x,y,leaf,leaf2,trunk,s){ s=s||1; R(g,trunk,x+3*s,y-8*s,2*s,8*s); R(g,leaf,x-1*s,y-16*s,10*s,9*s); R(g,leaf2,x+1*s,y-19*s,6*s,4*s); R(g,leaf2,x+1*s,y-14*s,3*s,3*s); }
function house(g,x,y,wall,roof,win,glow){
  R(g,wall,x,y-16,24,16); R(g,'rgba(0,0,0,.18)',x+16,y-16,8,16);
  for(let r=0;r<8;r++){ const half=2+r*2; R(g,roof,x+12-half,y-24+r,half*2,1); }
  R(g,'#2a1c12',x+3,y-12,6,6); R(g,glow?win:'#5a7a96',x+4,y-11,4,4);
  R(g,'#4a3020',x+14,y-9,6,9); R(g,'#d9b84a',x+18,y-5,1,1);
}
function tent(g,x,y,c1,c2,s){ s=s||1; for(let r=0;r<14*s;r++){ const half=1+Math.round(r*(1.1/s)*s*0.7+r*0.55); R(g,(r%6<3)?c1:c2,x+14*s-half,y-14*s+r,half*2,1); } R(g,'#1e1410',x+12*s,y-6*s,4*s,6*s); }
function banner(g,t,x,y,c){ R(g,'#3a2a1c',x,y-30,2,30); const w=Math.round(10+Math.sin(t*3+x)*2); R(g,c,x+2,y-30,w,8); R(g,'rgba(0,0,0,.2)',x+2,y-24,w,2); }
function fire(g,t,x,y){ R(g,'#3a2414',x-6,y-2,12,3); const f=3+((t*9)%3|0); R(g,'#e8552a',x-4,y-8-f,8,8+f-2); R(g,'#ffb040',x-2,y-10-f,4,8+f-3); R(g,'#fff0a0',x-1,y-6,2,3);
  for(let i=0;i<3;i++){ const q=(t*1.2+i*.33)%1; R(g,'rgba(255,200,120,'+(1-q)+')',x-3+i*3+Math.sin(t*6+i)*2,y-12-q*22,1,1); } }
function star(g,x,y,c){ R(g,c,x,y,1,1); }
function stars(g,t,n,seed,ymax,col){ for(let i=0;i<n;i++){ const tw=(Math.sin(t*2+i*1.7)>.4)?'#ffffff':col||'#c8c0ff'; R(g,tw,hash(i+seed)*W,hash(i*5+seed)*ymax,1,1); } }
function moon(g,x,y,r,c,c2){ for(let dy=-r;dy<=r;dy++){ const w=Math.round(Math.sqrt(r*r-dy*dy)); R(g,c,x-w,y+dy,w*2,1); } R(g,c2,x-r+3,y-2,3,3); R(g,c2,x+2,y+3,2,2); }
function cloud(g,x,y,c){ R(g,c,x+4,y,16,4); R(g,c,x,y+3,26,5); R(g,c,x+8,y-3,10,4); }
function clouds(g,t,scroll,c,y0){ [[10,0],[96,10],[170,-2],[230,12]].forEach((p,i)=>cloud(g,wrap(p[0]-t*3,1,0,300,30)-scroll*.08%300,y0+p[1],c)); }
function castleWall(g,x,y,c1,c2,c3){ R(g,c1,x,y-44,72,44); for(let r=0;r<7;r++){ R(g,c2,x,y-44+r*6+5,72,1); for(let b=0;b<6;b++) R(g,c2,x+((r&1)?6:0)+b*12,y-44+r*6,1,6); }
  for(let i=0;i<6;i++) R(g,c1,x+i*12+1,y-50,8,6); R(g,'rgba(0,0,0,.25)',x+54,y-44,18,44); R(g,c3,x+28,y-20,14,20); R(g,'#0d0d12',x+30,y-18,10,18); for(let i=0;i<5;i++) R(g,c2,x+30+i*2,y-18,1,18); }
function column(g,x,y,h,c,c2){ R(g,c,x,y-h,8,h); R(g,c2,x+5,y-h,3,h); R(g,c2,x-2,y-h-3,12,4); R(g,c2,x-2,y-3,12,4); }

/* ---------- cenários ---------- */
const SCENES={
 farm(g,t,s){
  bands(g,['#7fc4ec','#98d2f2','#b4def4','#d0ebf6'],0,HOR);
  R(g,'#fff6b0',206,16,14,14); R(g,'#fffbd8',208,18,10,10);
  clouds(g,t,s,'#ffffff',22);
  hills(g,'#8ec46a',HOR-14,8,38,.12,s,1); hills(g,'#6fae52',HOR-6,6,26,.22,s,4);
  [60,250,430].forEach(px=>{ const x=wrap(px,.4,s,512,60); const y=HOR+1;
    R(g,'#b13a2e',x,y-20,30,20); for(let r=0;r<8;r++){ const half=5+r*1.7|0; R(g,'#7a2219',x+15-half,y-27+r,half*2,1); } R(g,'#8a2a20',x+9,y-13,12,13); R(g,'#fff1e0',x+9,y-13,12,1); R(g,'#fff1e0',x+9,y-1,12,1); R(g,'#fff1e0',x+14,y-13,2,13); });
  [150,330].forEach(px=>{ const x=wrap(px,.4,s,512,20); tree(g,x,HOR+2,'#4f9a3c','#6fbc54','#6a4528',1.2); });
  ground(g,['#d9bc4c','#caa93e','#d9bc4c','#c8a53c','#d3b244','#c19e36'],'#8a6a1c',s,70,3);
  for(let i=0;i<26;i++){ const x=wrap(hash(i)*W,1,s,W), y=HOR+8+hash(i*7)*(H-HOR-12), sw=Math.sin(t*2+i)>0?1:0; R(g,'#f0d96a',x,y-4-(y>HOR+30?2:0),1,5+(y>HOR+30?2:0)); R(g,'#f0d96a',x+sw,y-7,2,2); }
 },
 village(g,t,s){
  bands(g,['#86c8ee','#a0d6f2','#bce2f5','#d6eef7'],0,HOR);
  clouds(g,t,s,'#ffffff',16);
  hills(g,'#7cb85c',HOR-12,7,34,.12,s,2);
  [[20,'#d6c8a4','#a8442e'],[140,'#e2d4b0','#4a6a90'],[260,'#cdbf9c','#8a3a2a'],[390,'#dccdaa','#6a4a2a']].forEach((h,i)=>{ const x=wrap(h[0],.45,s,512,30); house(g,x,HOR+4,h[1],h[2],'#ffe27a',true);
    const q=(t*.5+i*.3)%1; R(g,'rgba(230,230,230,'+(.7-q*.7)+')',x+18+Math.sin(t*2+i)*2,HOR-34-q*14,3,3); });
  [90,215,330,470].forEach(px=>tree(g,wrap(px,.45,s,512,20),HOR+3,'#4a9238','#6cb450','#6a4528',1));
  ground(g,['#7fb85a','#74ac52','#6ca04a','#8a6a44','#7c5e3c','#6e5234'],'#4f8a38',s,60,5);
  R(g,'#9a7a52',0,HOR+22,W,18); R(g,'#8a6a46',0,HOR+22,W,1); R(g,'#8a6a46',0,HOR+39,W,1);
 },
 road(g,t,s){
  bands(g,['#e87e5a','#f09a62','#f6b66e','#fad08a'],0,HOR);
  R(g,'#fff0b0',120,56,22,22); R(g,'#ffe08a',123,59,16,16);
  hills(g,'#6a5a7a',HOR-18,8,40,.1,s,3); hills(g,'#4f4a5f',HOR-8,6,28,.2,s,6);
  [80,360].forEach(px=>{ const x=wrap(px,.45,s,512,60);
    R(g,'#6a4428',x,HOR-30,56,34); for(let r=0;r<10;r++){ const half=4+r*3.2|0; R(g,'#4a2a1c',x+28-half,HOR-44+r,half*2,1); } R(g,'#f4d36b',x+6,HOR-22,8,8); R(g,'#f4d36b',x+38,HOR-22,8,8); R(g,'#3a2418',x+22,HOR-14,12,18);
    R(g,'#3a2418',x+58,HOR-34,2,14); R(g,'#c9a24b',x+58,HOR-34,12,8); R(g,'#3a2418',x+62,HOR-31,5,2); });
  [200,300,460].forEach(px=>{ const x=wrap(px,.45,s,512,20); tree(g,x,HOR+3,'#3a5a3a','#4a7448','#3a2a1c',1.1); });
  ground(g,['#8a6a46','#7e603e','#8a6a46','#76593a','#7e603e','#6c5134'],'#5a4228',s,50,7);
  R(g,'rgba(40,24,12,.35)',0,HOR+30,W,3); R(g,'rgba(40,24,12,.35)',0,HOR+44,W,3);
 },
 mansion(g,t,s){
  bands(g,['#141633','#1c2046','#262a58','#32386c'],0,HOR); stars(g,t,34,5,60); moon(g,206,26,12,'#f2eed8','#d4cfb4');
  hills(g,'#1a1c36',HOR-16,8,40,.1,s,1);
  [30,330].forEach(px=>{ const x=wrap(px,.45,s,512,80);
    R(g,'#2a2638',x,HOR-52,92,56); R(g,'#1e1a2a',x+28,HOR-72,36,22);
    for(let r=0;r<12;r++){ const half=2+r*3.4|0; R(g,'#171322',x+46-half,HOR-86+r,half*2,1); } for(let r=0;r<8;r++){ const half=2+r*7|0; R(g,'#171322',x+46-half,HOR-60+r,half*2,1); }
    [[8,-44],[24,-44],[60,-44],[76,-44],[8,-26],[24,-26],[60,-26],[76,-26],[38,-66],[50,-66]].forEach((w,i)=>{ const on=Math.sin(t*3+i*2.3+x)>-0.3; R(g,'#0f0c18',x+w[0],HOR+w[1],8,10); if(on||i%3===0) R(g,'#f4d06a',x+w[0]+1,HOR+w[1]+1,6,8); R(g,'#0f0c18',x+w[0]+3,HOR+w[1],1,10); });
    R(g,'#0f0c18',x+40,HOR-16,12,20); });
  [190,270,450].forEach(px=>{ const x=wrap(px,.45,s,512,20); R(g,'#171322',x+4,HOR-24,2,26); R(g,'#171322',x,HOR-20,4,2); R(g,'#171322',x+6,HOR-26,5,2); R(g,'#171322',x+8,HOR-14,4,2); });
  ground(g,['#26302e','#20292a','#1c2424','#2a3230','#222a2a','#1a2020'],'#3a4a46',s,55,9);
 },
 camp(g,t,s){
  bands(g,['#9a948a','#aaa496','#bab4a4','#cac4b2'],0,HOR); clouds(g,t,s,'#d8d2c4',18);
  hills(g,'#7a8a62',HOR-14,8,40,.1,s,2); hills(g,'#66764e',HOR-6,6,28,.2,s,5);
  [40,150,300,420].forEach((px,i)=>{ const x=wrap(px,.5,s,512,30); tent(g,x,HOR+6,i%2?'#d8d2c4':'#b84a3a',i%2?'#a8a290':'#8a2e22',1.2); });
  [110,380].forEach((px,i)=>banner(g,t,wrap(px,.5,s,512,10),HOR+8,i?'#2e4a8a':'#b84a3a'));
  fire(g,t,wrap(240,.9,s,512,20),HOR+30);
  ground(g,['#8a7a5a','#7e6e50','#8a7a5a','#756648','#7e6e50','#6a5c42'],'#5a4c34',s,60,11);
 },
 bridge(g,t,s){
  bands(g,['#3a5a9a','#4a70b0','#6a8ec8','#9ab4de'],0,HOR); clouds(g,t,s,'#e6ecf8',18);
  hills(g,'#5a6a8a',HOR-34,16,50,.06,s,1); hills(g,'#46567a',HOR-18,12,36,.12,s,3);
  R(g,'#3a64a8',0,HOR-8,W,12); for(let i=0;i<16;i++){ const x=wrap(hash(i)*W,.6,s,W), y=HOR-6+hash(i*3)*8; if(Math.sin(t*3+i)>0) R(g,'#cfe4ff',x,y,3,1); }
  [60,230,400].forEach(px=>{ const x=wrap(px,.5,s,512,50); R(g,'#8a8a92',x,HOR-30,22,34); R(g,'#6e6e78',x+14,HOR-30,8,34); for(let i=0;i<3;i++) R(g,'#8a8a92',x+i*8,HOR-36,6,6); R(g,'#2a2a32',x+8,HOR-20,6,8); });
  ground(g,['#9a9aa2','#8a8a92','#9a9aa2','#80808a','#8a8a92','#767680'],'#6a6a74',s,40,13);
  for(let i=-1;i<10;i++){ const x=wrap(i*32,1,s,320,32); R(g,'#6a6a74',x,HOR+3,1,H-HOR); }
  for(let i=0;i<9;i++){ const x=wrap(i*32+10,1,s,288,32); R(g,'#b0b0b8',x,HOR+14,6,18); R(g,'#8a8a92',x+4,HOR+14,2,18); }
 },
 wall(g,t,s){
  bands(g,['#5a6a82','#6a7a92','#7a8aa2','#8c9cb4'],0,HOR); clouds(g,t,s,'#aab8cc',16);
  [20,200,380].forEach((px,i)=>{ const x=wrap(px,.5,s,512,80); castleWall(g,x,HOR+4,'#7a7a84','#5e5e68','#6a5a48'); banner(g,t,x+30,HOR-44,i%2?'#b84a3a':'#2e4a8a'); });
  ground(g,['#8a8a92','#7a7a84','#8a8a92','#70707a','#7a7a84','#66666e'],'#5a5a64',s,30,15);
  for(let r=0;r<6;r++){ const y=HOR+[0,5,12,22,36,52][r], hh=[5,7,10,14,16,20][r]; for(let i=-1;i<22;i++){ const x=wrap(i*(10+r*3)+(r&1?5:0),1,s,(10+r*3)*22,10+r*3); R(g,'rgba(0,0,0,.22)',x,y,1,hh); } R(g,'rgba(0,0,0,.18)',0,y,W,1); }
 },
 ruins(g,t,s){
  bands(g,['#3a4a48','#4a5c58','#5c706a','#728880'],0,HOR); clouds(g,t,s,'#8aa098',20);
  hills(g,'#46564e',HOR-16,8,40,.1,s,1);
  [50,260,430].forEach((px,i)=>{ const x=wrap(px,.5,s,512,30); column(g,x,HOR+4,i%2?34:48,'#8a9088','#68706a'); R(g,'#8a9088',x-10,HOR-6,10,10); R(g,'#68706a',x-10,HOR-6,10,2); });
  { const x=wrap(150,.5,s,512,30); R(g,'#7a8078',x,HOR-60,24,64); for(let i=0;i<3;i++) R(g,'#7a8078',x+i*9,HOR-66,6,6); R(g,'#1e2220',x+9,HOR-44,6,10); R(g,'#5a6058',x+16,HOR-60,8,64); }
  [330,480].forEach(px=>tree(g,wrap(px,.5,s,512,20),HOR+3,'#2e4a34','#3e6044','#2a2018',1));
  ground(g,['#58705a','#506854','#486048','#5e6a58','#546050','#485a46'],'#8a9088',s,40,17);
  for(let i=0;i<5;i++){ const x=wrap(i*70+20,.9+i*.02,s,350,40), y=HOR+14+hash(i)*30; R(g,'#8a9088',x,y,10,6); R(g,'#68706a',x+6,y,4,6); }
  for(let i=0;i<3;i++){ const x=wrap(i*130,.3,s,400,100); R(g,'rgba(210,225,220,.14)',x,HOR-10+i*4,110,12); }
 },
 shrine(g,t,s){
  bands(g,['#0c0a28','#141048','#1e1664','#2a1e82'],0,HOR); stars(g,t,50,3,70,'#a8a0ff');
  [30,190,350].forEach((px,i)=>{ const x=wrap(px,.5,s,512,40);
    R(g,'#2a2450',x,HOR-10,26,14); R(g,'#2a2450',x+4,HOR-46,18,38); R(g,'#2a2450',x+8,HOR-62,10,18); R(g,'#2a2450',x+11,HOR-68,4,8);
    const a=.55+.35*Math.sin(t*2+i); for(let k=0;k<4;k++) R(g,'rgba(160,200,255,'+a+')',x+10,HOR-54+k*10,6,2); R(g,'rgba(120,160,255,.12)',x-6,HOR-72,38,76); });
  for(let i=0;i<24;i++){ const x=wrap(hash(i)*W,.7,s,W), y=20+hash(i*3)*80-((t*6+i*9)%30); R(g,'rgba(180,200,255,'+(.35+.4*Math.sin(t*2+i))+')',x,y<4?y+30:y,1,1); }
  ground(g,['#26244a','#201e40','#26244a','#1c1a38','#201e40','#181632'],'#3a3a78',s,40,19);
  const x=wrap(140,1,s,300,80); for(let k=0;k<3;k++){ const a=.4+.4*Math.sin(t*2+k); R(g,'rgba(140,190,255,'+a+')',x+k*2,HOR+34+k*2,60-k*4,1); R(g,'rgba(140,190,255,'+a+')',x+k*2,HOR+50-k*2,60-k*4,1); R(g,'rgba(140,190,255,'+a+')',x+k*2,HOR+34+k*2,1,16-k*4); R(g,'rgba(140,190,255,'+a+')',x+59-k*2,HOR+34+k*2,1,16-k*4); }
 },
 library(g,t,s){
  R(g,'#2a1a14',0,0,W,HOR); R(g,'#34221a',0,0,W,HOR/2);
  [-10,60,130,200,270,340,410].forEach((px,i)=>{ const x=wrap(px,.45,s,490,40);
    R(g,'#4a2e1e',x,6,50,HOR-4); R(g,'#2e1c12',x,6,50,2);
    for(let r=0;r<5;r++){ const y=10+r*14; R(g,'#2e1c12',x,y+11,50,3); for(let b=0;b<9;b++){ const h=hash(i*50+r*9+b), c=['#8a2a2a','#2a4a8a','#2a6a4a','#8a6a1a','#6a2a7a','#a8602a'][(h*6)|0]; R(g,c,x+2+b*5,y+(h>.5?1:3),4,h>.5?10:8); } } });
  [40,200,360].forEach((px,i)=>{ const x=wrap(px,.7,s,512,20); R(g,'#2a1810',x+9,0,1,16); R(g,'#d9b84a',x,16,20,3); const f=1+((t*8+i)%2|0); R(g,'#ffcf5a',x+3,12-f,2,4+f); R(g,'#ffcf5a',x+9,11-f,2,5+f); R(g,'#ffcf5a',x+15,12-f,2,4+f); R(g,'rgba(255,200,90,.1)',x-14,0,48,50); });
  ground(g,['#6a4428','#5e3c24','#6a4428','#563620','#5e3c24','#4e301c'],'#3e2616',s,20,21);
  for(let r=0;r<6;r++){ const y=HOR+[0,5,12,22,36,52][r]; R(g,'rgba(0,0,0,.28)',0,y,W,1); }
  for(let i=0;i<20;i++){ const x=wrap(hash(i)*W,.5,s,W), y=10+hash(i*4)*70; R(g,'rgba(255,230,170,'+(.2+.25*Math.sin(t*1.5+i))+')',x,y,1,1); }
 },
 throne(g,t,s){
  R(g,'#2a0c10',0,0,W,HOR); R(g,'#3a1016',0,HOR*.5,W,HOR*.5);
  [-10,90,190,290,390].forEach((px,i)=>{ const x=wrap(px,.5,s,500,40); column(g,x+14,HOR+4,76,'#d8ccb0','#a89a7c'); R(g,'#a8202c',x+24,0,34,HOR-8); R(g,'#7a1420',x+24,0,34,3); R(g,'#c9a24b',x+24,HOR-30,34,2); R(g,'#7a1420',x+38,6,3,HOR-14); });
  { const x=wrap(250,.9,s,520,60); R(g,'#c9a24b',x,HOR-36,24,40); R(g,'#e6c468',x+3,HOR-33,18,28); R(g,'#8a1a24',x+5,HOR-26,14,14); R(g,'#c9a24b',x-4,HOR-44,6,10); R(g,'#c9a24b',x+22,HOR-44,6,10); R(g,'#c9a24b',x+9,HOR-52,6,16); }
  ground(g,['#26181a','#1e1214','#26181a','#1a1012','#1e1214','#160e10'],'#3a2428',s,10,23);
  R(g,'#9a1a28',0,HOR+20,W,24); R(g,'#c9a24b',0,HOR+20,W,2); R(g,'#c9a24b',0,HOR+42,W,2); for(let i=0;i<12;i++){ R(g,'#7a1420',wrap(i*28,1,s,336,28),HOR+26,10,2); R(g,'#7a1420',wrap(i*28+14,1,s,336,28),HOR+34,10,2); }
  for(let i=0;i<16;i++){ const x=wrap(hash(i)*W,.4,s,W), y=hash(i*3)*HOR-((t*5+i*7)%24); R(g,'rgba(255,220,140,'+(.2+.3*Math.sin(t*2+i))+')',x,y<0?y+24:y,1,1); }
 },
 void(g,t,s){
  R(g,'#06020e',0,0,W,H); stars(g,t,70,8,H,'#ff8ae0');
  for(let i=0;i<4;i++){ const x=40+i*70, a=.12+.06*Math.sin(t+i); R(g,'rgba(255,90,200,'+a+')',x,10+i*4,70,40); R(g,'rgba(120,80,255,'+a+')',x+10,20+i*4,50,30); }
  for(let i=0;i<8;i++){ const x=wrap(hash(i)*W*2,.25,s,W*2,30), y=14+hash(i*3)*50+Math.sin(t*1.2+i)*3; R(g,'#1c1236',x,y,18,8); R(g,'#ff59c8',x,y,18,1); R(g,'#2a1c52',x+2,y+2,6,4); }
  R(g,'#100820',0,HOR,W,H-HOR);
  const rows=[0,6,14,26,42,62], hs=[6,8,12,16,20,24];
  for(let r=0;r<6;r++){ const y=HOR+rows[r], hh=(rows[r+1]||H-HOR)-rows[r], sw=8+r*5; for(let c=-1;c<W/sw+2;c++){ const cx=c*sw-(s*(0.6+r*.1))%(sw*2); const on=((c+r)&1); R(g,on?'#2a1850':'#1a0f36',cx,y,sw,hh); } R(g,'rgba(255,90,200,.35)',0,y,W,1); }
  R(g,'rgba(255,90,200,.1)',0,HOR-2,W,6);
 }
};
function drawScene(g,id,t,scroll){ (SCENES[id]||SCENES.farm)(g,t,scroll); }

/* ---------- efeitos em pixel ---------- */
function pline(g,c,x0,y0,x1,y1,th){ x0=fl(x0);y0=fl(y0);x1=fl(x1);y1=fl(y1); th=th||1; const dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1; let e=dx-dy,n=0; g.fillStyle=c; while(n++<400){ g.fillRect(x0,y0,th,th); if(x0===x1&&y0===y1) break; const e2=2*e; if(e2>-dy){e-=dy;x0+=sx;} if(e2<dx){e+=dx;y0+=sy;} } }
function pcircle(g,c,cx,cy,r,fill){ g.fillStyle=c; for(let y=-r;y<=r;y++) for(let x=-r;x<=r;x++){ const d=x*x+y*y; if(fill?d<=r*r:(d<=r*r&&d>(r-1.4)*(r-1.4))) g.fillRect(fl(cx)+x,fl(cy)+y,1,1); } }
function crownSprite(){
  if(cache.__crown) return cache.__crown;
  const c=document.createElement('canvas'); c.width=22; c.height=14; const g=c.getContext('2d');
  const R2=(col,x,y,w,h)=>{ g.fillStyle=col; g.fillRect(x,y,w,h); };
  R2('#6a4208',0,4,22,10); R2('#6a4208',0,0,4,5); R2('#6a4208',9,0,4,5); R2('#6a4208',18,0,4,5);
  R2('#ffd24d',1,5,20,8); R2('#ffd24d',1,1,2,5); R2('#ffd24d',10,1,2,5); R2('#ffd24d',19,1,2,5);
  R2('#fff2b8',2,6,18,2); R2('#d9a21c',1,11,20,2);
  R2('#e03a3a',4,8,3,3); R2('#3a8ae0',10,8,3,3); R2('#3ae08a',16,8,3,3);
  cache.__crown=c; return c;
}
return {W,H,HOR,FY,SHAPES,PAL,SCENES,FORM_IDS,buildPiece,variant,heroSprite,enemySprite,drawScene,pline,pcircle,crownSprite,hash,R};
})();
root.Genesis=root.Genesis||{}; root.Genesis.Art=Art;
})(typeof window!=='undefined'?window:globalThis);
