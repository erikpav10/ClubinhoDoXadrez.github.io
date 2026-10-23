(function(root){
root.Genesis=root.Genesis||{};
const Core=root.Genesis.Core;
/* =====================================================================
   CHESS GENESIS — ARENA DO BOSS
   Arquivo: genesis/arena.js

   Um tabuleiro gigante com dois castelos. Ao iniciar, TODOS os heróis
   recrutados saem juntos do seu castelo e lutam sozinhos, em tempo real,
   contra as tropas do castelo inimigo e, no fim, contra o Rei Renegado.
   Recompensa: só ouro.

   Parte 1 (sem tela): a simulação. Dá para rodar no Node para balancear.
   Parte 2 (tela): o desenho da arena.
   ===================================================================== */
const Arena=(function(){
"use strict";
const BW=12, BH=8;                 /* tabuleiro: 12 colunas x 8 linhas (em "casas") */
const TIME_LIMIT=480;              /* 8 minutos */
const RESPAWN=8;
const DIFFS=[
 {id:'train', name:'Treino',   m:0.30, rw:0.3},
 {id:'easy',  name:'Fácil',    m:0.50, rw:0.6},
 {id:'normal',name:'Normal',   m:0.75, rw:1.0},
 {id:'hard',  name:'Difícil',  m:1.00, rw:1.8},
 {id:'legend',name:'Lendário', m:1.25, rw:3.0}
];
/* papéis dos heróis: alcance e velocidade em casas */
const ROLE={ pawn:{range:1.1,speed:1.5}, knight:{range:1.2,speed:2.4}, bishop:{range:4.2,speed:1.5}, rook:{range:1.2,speed:1.1}, queen:{range:5.0,speed:1.9}, king:{range:1.3,speed:1.5} };
const EKIND={
 pawn:  {name:'Peão',   piece:'pawn',  pal:'dark',   hp:1.0,atk:1.0,int:1.0, range:1.1,speed:1.4,size:15},
 knight:{name:'Cavalo', piece:'knight',pal:'shadow', hp:1.2,atk:1.1,int:.85, range:1.2,speed:2.1,size:16},
 rook:  {name:'Torre',  piece:'rook',  pal:'stone',  hp:2.2,atk:.8, int:1.2, range:1.2,speed:1.0,size:17},
 bishop:{name:'Bispo',  piece:'bishop',pal:'violet', hp:.9, atk:1.0,int:1.0, range:4.0,speed:1.4,size:16}
};
const TUNE={K_E:90,K_P:300,HP_EXP:0.75,ATK_EXP:0.75,CAST_EXP:1.0,BOSS_HP:3,BOSS_ATK:1.3,SHOT_E:.3,SHOT_P:.45,CAP:6,SQUAD:.35,ATKM:0.6};   /* balanceamento: castelos em "golpes do herói de referência" */

function rnd(){ return Math.random(); }
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }

/* ---------- criar a batalha ---------- */
function create(S,di){
  const diff=DIFFS[di]||DIFFS[2];
  const L=Core.bestLevel(S), ref=Core.refBase(L);
  /* força do time em relação a um herói de referência: o boss cresce junto, mas só em parte.
     D = dano total do time; T = resistência média por herói */
  let D=0, T=0, nh=0; const refEff=ref.hp/(1-Core.drOf(ref.def));
  S.heroes.forEach((h,i)=>{ if(!h.un) return; const d=Core.derive(S,i); D+=d.dps/ref.atk; T+=(d.maxHp/d.dmgTaken)/refEff; nh++; });
  D=Math.max(.7,D); T=Math.max(.7,T/Math.max(1,nh)); const pow=D, avgD=Math.max(.5,D/Math.max(1,nh));
  const B={t:0,phase:'idle',diff,di:DIFFS.indexOf(diff),L,ref,pow,nh,D,hpMul:Math.pow(avgD,TUNE.HP_EXP),bossMul:Math.pow(D,TUNE.CAST_EXP),atkMul:Math.pow(T,TUNE.ATK_EXP),units:[],fx:[],spawnT:3,bossOut:false,bossDead:false,
    deaths:0,kills:0,result:null,msgs:[],speed:1,
    eMax:TUNE.K_E*ref.atk*diff.m*Math.pow(D,TUNE.CAST_EXP), pMax:TUNE.K_P*ref.atk*Math.pow(D,TUNE.HP_EXP), shotE:1, shotP:1, ids:0, kingAlive:false, hurtE:0, hurtP:0};
  B.eHp=B.eMax; B.pHp=B.pMax;
  /* os heróis recrutados */
  let n=0; S.heroes.forEach((h,i)=>{ if(h.un) n++; });
  let k=0;
  S.heroes.forEach((h,i)=>{
    if(!h.un) return;
    const d=Core.derive(S,i), f=Core.FORMS[i], r=ROLE[f.id];
    const row=(k+.5)/n*BH; k++;
    B.units.push({id:B.ids++,team:0,hero:i,kind:f.id,name:f.name,x:-1.2,y:row,hp:d.maxHp,max:d.maxHp,atk:d.atk,int:d.interval,crit:d.crit,cm:d.cm,
      dmgTaken:d.dmgTaken,regen:d.regen,range:r.range,speed:r.speed,cd:0.5+k*0.1,tgt:-1,first:true,dead:false,rt:0,delay:k*0.35,home:row,dir:1,hit:0,atkAnim:0});
  });
  return B;
}

/* ---------- inimigos ---------- */
function mkEnemy(B,kind,elite,y){
  const K=EKIND[kind], st=Core.enemyStats(B.L,elite), m=B.diff.m;
  const hp=st.hp*K.hp*m*B.hpMul, atk=st.atk*K.atk*(1+(m-1)*TUNE.ATKM)*B.atkMul;
  return {id:B.ids++,team:1,kind,name:(elite?'Elite · ':'')+K.name,elite,x:BW+.6,y:y,hp:hp,max:hp,atk:atk,int:st.int*K.int,range:K.range,speed:K.speed*(elite?1.05:1),
    cd:1,tgt:-1,dead:false,piece:K.piece,pal:elite?'crimson':K.pal,size:K.size+(elite?1:0),hit:0,atkAnim:0,crit:0,cm:1,dmgTaken:1,dir:-1};
}
function mkBoss(B){
  const st=Core.enemyStats(B.L,true), m=B.diff.m;
  const hp=st.hp*TUNE.BOSS_HP*m*B.bossMul, atk=st.atk*TUNE.BOSS_ATK*(1+(m-1)*TUNE.ATKM)*B.atkMul;
  return {id:B.ids++,team:1,kind:'boss',boss:true,name:'Rei Renegado',x:BW+.8,y:BH/2,hp:hp,max:hp,atk:atk,int:1.35,range:1.7,speed:1.0,cd:1.2,tgt:-1,dead:false,
    piece:'king',pal:'void',size:34,hit:0,atkAnim:0,crit:.1,cm:2,dmgTaken:1,dir:-1};
}
function spawnWave(B){
  const wave=Math.floor(B.t/22);
  const cnt=Math.min(2+Math.ceil(B.nh/2),Math.round(B.nh*TUNE.SQUAD)+1+Math.floor(B.t/60));
  const alive=B.units.filter(u=>u.team===1&&!u.dead).length;
  for(let i=0;i<cnt&&alive+i<TUNE.CAP+B.nh*2;i++){
    let kind='pawn', r=rnd();
    if(wave>=4&&r<.18) kind='bishop'; else if(wave>=3&&r<.38) kind='rook'; else if(wave>=2&&r<.68) kind='knight';
    B.units.push(mkEnemy(B,kind,rnd()<Core.ELITE_CHANCE,(rnd()*(BH-1.2))+.6));
  }
  B.spawnT=Math.max(2.6,5.4-B.t*0.012);
}

/* ---------- efeitos (só para o desenho) ---------- */
function fx(B,o){ if(B.fx.length<120) B.fx.push(Object.assign({t:0,d:.3},o)); }

/* ---------- um passo da simulação ---------- */
function damage(B,src,dst,dmg,crit){
  if(dst.dead) return;
  dst.hp-=dmg; dst.hit=.12;
  if(dst.hp<=0){
    dst.dead=true; dst.hp=0;
    fx(B,{k:'death',x:dst.x,y:dst.y,d:.5,team:dst.team,boss:!!dst.boss});
    if(dst.team===1){ B.kills++; if(dst.boss) B.bossDead=true; }
    else{ B.deaths++; dst.rt=RESPAWN; }
  }
}
function pickTarget(B,u,enemies){
  let best=null,bd=1e9; const aggro=u.team===0?7:6;
  for(const e of enemies){ if(e.dead||e.x<-1.6||e.x>BW+1.6) continue; const d=dist(u,e); if(d<bd&&d<=aggro){ bd=d; best=e; } }
  return best;
}
function strike(B,u,tgt,castle){
  let dmg=u.atk*(0.92+rnd()*.16), crit=false;
  if(u.team===0){
    if(u.kind==='pawn'&&u.first){ dmg*=1.5; }
    u.first=false;
    if(rnd()<u.crit){ dmg*=u.cm; crit=true; }
    if(B.kingAlive&&u.kind!=='king') dmg*=1.15;
  }else{
    if(u.crit&&rnd()<u.crit){ dmg*=u.cm; crit=true; }
  }
  u.atkAnim=.28;
  if(castle){
    if(castle==='e'){ B.eHp-=dmg; B.hurtE=.12; fx(B,{k:'cast',x:BW,y:u.y,d:.25,from:u}); }
    else{ B.pHp-=dmg; B.hurtP=.12; fx(B,{k:'cast',x:0,y:u.y,d:.25,from:u}); }
    return;
  }
  const dm=tgt.team===0?tgt.dmgTaken:1;
  const ranged=u.range>2;
  if(ranged) fx(B,{k:'ray',x:u.x,y:u.y,x2:tgt.x,y2:tgt.y,d:.22,kind:u.kind,team:u.team});
  else fx(B,{k:'slash',x:tgt.x,y:tgt.y,d:.2,kind:u.kind,team:u.team,crit});
  damage(B,u,tgt,dmg*dm,crit);
  if(u.team===0&&u.kind==='knight'&&!tgt.dead&&rnd()<.2){ damage(B,u,tgt,dmg*.8*dm,false); fx(B,{k:'slash',x:tgt.x,y:tgt.y,d:.2,kind:'knight',team:0}); }
  if(u.team===0&&u.kind==='rook'){
    fx(B,{k:'wave',x:tgt.x,y:tgt.y,d:.35});
    B.units.forEach(e=>{ if(e.team===1&&!e.dead&&e!==tgt&&dist(e,tgt)<=1.4) damage(B,u,e,dmg*.5,false); });
  }
}
function step(B,dt){
  if(B.phase!=='run') return;
  B.t+=dt;
  if(B.hurtE>0) B.hurtE-=dt; if(B.hurtP>0) B.hurtP-=dt;
  const heroes=B.units.filter(u=>u.team===0), foes=B.units.filter(u=>u.team===1);
  B.kingAlive=heroes.some(h=>h.kind==='king'&&!h.dead&&h.delay<=0);
  /* spawns do castelo inimigo */
  if(B.eHp>0){
    B.spawnT-=dt; if(B.spawnT<=0) spawnWave(B);
  }
  if(!B.bossOut&&B.eHp<=B.eMax*.5){ B.bossOut=true; B.units.push(mkBoss(B)); B.msgs.push({t:B.t,text:'👑 O Rei Renegado saiu do castelo!'}); }
  if(!B.bossOut&&B.eHp<=0){ B.bossOut=true; B.units.push(mkBoss(B)); B.msgs.push({t:B.t,text:'👑 O Rei Renegado saiu do castelo!'}); }
  /* tiros dos castelos */
  B.shotE-=dt; B.shotP-=dt;
  if(B.eHp>0&&B.shotE<=0){ B.shotE=1.5; const h=heroes.filter(u=>!u.dead&&u.delay<=0&&BW-u.x<4.2).sort((a,b)=>b.x-a.x)[0]; if(h){ const dmg=B.ref.atk*TUNE.SHOT_E*B.diff.m*B.atkMul*h.dmgTaken; fx(B,{k:'ray',x:BW,y:BH/2,x2:h.x,y2:h.y,d:.2,kind:'cannon',team:1}); damage(B,null,h,dmg,false); } }
  if(B.pHp>0&&B.shotP<=0){ B.shotP=1.5; const e=foes.filter(u=>!u.dead&&u.x<3.8).sort((a,b)=>a.x-b.x)[0]; if(e){ fx(B,{k:'ray',x:0,y:BH/2,x2:e.x,y2:e.y,d:.2,kind:'cannon',team:0}); damage(B,null,e,B.ref.atk*TUNE.SHOT_P*B.atkMul,false); } }
  /* unidades */
  for(const u of B.units){
    if(u.hit>0) u.hit-=dt; if(u.atkAnim>0) u.atkAnim-=dt;
    if(u.team===0){
      if(u.dead){ u.rt-=dt; if(u.rt<=0){ u.dead=false; u.hp=u.max; u.x=-1.2; u.y=u.home; u.first=true; u.delay=0; fx(B,{k:'spark',x:0,y:u.y,d:.5}); } continue; }
      if(u.delay>0){ u.delay-=dt; continue; }
      u.hp=Math.min(u.max,u.hp+u.max*u.regen*dt);
      if(u.kind==='bishop'){ heroes.forEach(a=>{ if(!a.dead&&a.delay<=0&&a!==u&&dist(a,u)<=4.5) a.hp=Math.min(a.max,a.hp+a.max*.015*dt); }); }
    }else if(u.dead) continue;
    u.cd-=dt;
    const enemies=u.team===0?foes:heroes.filter(h=>!h.dead&&h.delay<=0);
    let tgt=pickTarget(B,u,enemies);
    const castle=u.team===0?(B.eHp>0?'e':null):(B.pHp>0?'p':null);
    const castleDist=u.team===0?(BW-u.x):(u.x);
    if(tgt){
      const d=dist(u,tgt); u.dir=tgt.x>=u.x?1:-1;
      if(d<=u.range){ if(u.cd<=0){ if(u.tgt!==tgt.id){ u.tgt=tgt.id; if(u.kind==='pawn') u.first=true; } strike(B,u,tgt,null); u.cd+=u.int; } }
      else{ const sp=u.speed*dt; u.x+=(tgt.x-u.x)/d*sp; u.y+=(tgt.y-u.y)/d*sp; }
    }else if(castle&&castleDist>u.range*.75){
      u.dir=u.team===0?1:-1; const sp=u.speed*dt; u.x+=u.dir*sp; u.y+=(u.home!=null?(u.home-u.y):0)*.02;
    }else if(castle){
      if(u.cd<=0){ strike(B,u,null,castle); u.cd+=u.int; }
    }else if(u.team===0&&u.x<BW+.2){ u.x+=u.speed*dt; }   /* castelo caiu: avança para o resto */
    u.y=Math.max(.35,Math.min(BH-.35,u.y));
    /* separação simples entre aliados */
    for(const o of B.units){ if(o===u||o.dead||o.team!==u.team||(o.team===0&&o.delay>0)) continue; const dx=u.x-o.x, dy=u.y-o.y, dd=Math.hypot(dx,dy); if(dd>0&&dd<.55){ const push=(.55-dd)*dt*2; u.x+=dx/dd*push; u.y+=dy/dd*push; } }
  }
  /* fim */
  if(B.pHp<=0){ end(B,false,'O seu castelo caiu.'); }
  else if(B.eHp<=0&&B.bossOut&&B.bossDead){ end(B,true,'O Rei Renegado foi derrotado!'); }
  else if(B.t>=TIME_LIMIT){ end(B,false,'O tempo acabou.'); }
  /* limpa efeitos e corpos */
  B.fx.forEach(f=>f.t+=dt); B.fx=B.fx.filter(f=>f.t<f.d);
  B.units=B.units.filter(u=>u.team===0||!u.dead||(u.dead&&B.t-(u.dieT||(u.dieT=B.t))<.5));
}
function end(B,win,text){
  B.phase=win?'win':'lose';
  B.result={win,text,time:B.t,deaths:B.deaths,kills:B.kills,gold:win?reward(B.S_,B):0};
}
function reward(S,B){
  if(!S) return 0;
  let best=0; S.heroes.forEach((h,i)=>{ if(h.un&&h.lv>=S.heroes[best].lv) best=i; });
  const d=Core.derive(S,best);
  return Math.round(70*Core.goldKill(B.L,false,d)*B.diff.rw);
}
function start(B,S){ B.S_=S; B.phase='run'; B.t=0; }

/* ---------- rodar sem tela (balanceamento) ---------- */
function headless(S,di,opts){
  const B=create(S,di); start(B,S); const dt=1/20;
  while(B.phase==='run') step(B,dt);
  return {win:B.result.win,pow:B.pow,time:B.t,deaths:B.deaths,kills:B.kills,eHp:Math.max(0,B.eHp/B.eMax),pHp:Math.max(0,B.pHp/B.pMax),text:B.result.text};
}


/* =====================================================================
   PARTE 2 — DESENHO DA ARENA (canvas 256x144, pixel art)
   ===================================================================== */
const CVW=256, CVH=144, X0=38, Y0=22, CW=15, CH=14;
let Art=null, cv=null, g=null, B=null, S_=null, speed=1, tt=0, acc=0, parts=[], onEnd=null, endFired=false;
const cache={};
function sprite(piece,pal,size,flip,flash){
  const k=piece+'|'+pal+'|'+size; let sp=cache[k]; if(!sp) sp=cache[k]=Art.buildPiece(piece,pal,size);
  const kind=flip?(flash?'flipWhite':'flip'):(flash?'white':null);
  return {sp,img:kind?Art.variant(sp,kind):sp.cv};
}
const HSIZE={pawn:15,knight:16,bishop:17,rook:17,queen:19,king:20};
function R(c,x,y,w,h){ g.fillStyle=c; g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
const px=x=>X0+x*CW, py=y=>Y0+y*CH;

function init(canvas,elements,cb){ Art=root.Genesis.Art; cv=canvas; g=cv.getContext('2d'); g.imageSmoothingEnabled=false; onEnd=cb; }
function reset(S,di){ S_=S; B=create(S,di); endFired=false; parts=[]; acc=0; B.speed=speed; }
function begin(S){ if(!B||B.phase!=='idle') return; start(B,S); B.msgs.push({t:0,text:'⚔ Todos os heróis saem do castelo!'}); }
function setSpeed(v){ speed=v; }
function info(){
  if(!B) return null;
  const boss=B.units.find(u=>u.boss&&!u.dead);
  return {phase:B.phase,t:B.t,limit:TIME_LIMIT,pHp:Math.max(0,B.pHp),pMax:B.pMax,eHp:Math.max(0,B.eHp),eMax:B.eMax,boss:boss?{hp:boss.hp,max:boss.max}:null,bossOut:B.bossOut,
    heroes:B.units.filter(u=>u.team===0).map(u=>({kind:u.kind,name:u.name,hp:u.hp,max:u.max,dead:u.dead,rt:u.rt})),msgs:B.msgs.slice(-3),result:B.result,diff:B.diff,L:B.L,kills:B.kills,deaths:B.deaths,foes:B.units.filter(u=>u.team===1&&!u.dead).length};
}
function frame(dt){
  if(!B||!cv) return;
  tt+=dt;
  if(B.phase==='run'){ acc+=dt*speed; let n=0; while(acc>=1/30&&n++<20){ step(B,1/30); acc-=1/30; } 
    B.fx.forEach(f=>{ if(!f._p){ f._p=1; fxParts(f); } }); }
  else acc=0;
  if((B.phase==='win'||B.phase==='lose')&&!endFired){ endFired=true; if(onEnd) onEnd(B.result,B); }
  parts.forEach(p=>{ p.life-=dt; p.vy+=p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; }); parts=parts.filter(p=>p.life>0);
  draw();
}
function fxParts(f){
  const x=px(f.x), y=py(f.y)-6;
  const burst=(n,cols,sp)=>{ for(let i=0;i<n&&parts.length<300;i++){ const a=Math.random()*6.283,s=(.3+Math.random()*.7)*sp; parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-14,g:90,life:.3+Math.random()*.3,c:cols[(Math.random()*cols.length)|0]}); } };
  if(f.k==='death'){ burst(f.boss?60:10,f.team===1?['#e8504a','#7a1c1c','#ffd24d']:['#6aa8e8','#cfe4ff','#ffffff'],f.boss?110:60); }
  else if(f.k==='slash'){ burst(f.crit?9:4,f.team===0?['#fff2c0','#ffd88a']:['#ffb0a0','#ff6a5a'],50); }
  else if(f.k==='cast'){ const cx=f.x>BW/2?218:36; for(let i=0;i<5&&parts.length<300;i++) parts.push({x:cx,y:py(f.y)-8,vx:(f.x>BW/2?1:-1)*(Math.random()*20),vy:-20-Math.random()*30,g:120,life:.4,c:['#b0b0b8','#8a8a92','#ffffff'][i%3]}); }
  else if(f.k==='spark'){ burst(14,['#cfe4ff','#ffffff','#9cc4ee'],60); }
}
function drawBoard(){
  /* chão do salão */
  R('#16131a',0,0,CVW,CVH);
  for(let i=0;i<60;i++){ R('rgba(255,255,255,.04)',Art.hash(i)*CVW,Art.hash(i*3)*CVH,2,1); }
  /* moldura */
  R('#3a2a1c',X0-4,Y0-4,CW*BW+8,CH*BH+8); R('#5a4026',X0-3,Y0-3,CW*BW+6,CH*BH+6); R('#2a1c10',X0-1,Y0-1,CW*BW+2,CH*BH+2);
  for(let r=0;r<BH;r++) for(let c=0;c<BW;c++){
    const dark=(r+c)%2; const x=X0+c*CW, y=Y0+r*CH;
    R(dark?'#7e5f3e':'#d6c79c',x,y,CW,CH);
    R(dark?'#8a6a46':'#e4d7b0',x,y,CW,1); R(dark?'#6a4e30':'#bfae82',x,y+CH-1,CW,1);
    R(dark?'rgba(0,0,0,.08)':'rgba(255,255,255,.06)',x+CW-3,y,3,CH);
  }
  /* faixa de cada lado (zona dos castelos) */
  R('rgba(60,110,200,.16)',X0,Y0,CW,CH*BH); R('rgba(200,50,50,.16)',X0+CW*(BW-1),Y0,CW,CH*BH);
}
function castle(side,hp,hurt,t){
  const left=side==='p'; const x=left?2:221, w=33, top=24, bot=136;
  const stone=left?'#a9b4c8':'#4a4452', stone2=left?'#8d99b0':'#352f3d', hi=left?'#c8d2e4':'#645c70', flag=left?'#2a6ad0':'#b02a2a', flag2=left?'#6aa4f0':'#e05a4a';
  R('rgba(0,0,0,.35)',x-1,bot,w+2,4);
  R(stone,x,top+14,w,bot-top-14); R(stone2,left?x+w-5:x,top+14,5,bot-top-14);
  for(let r=0;r<(bot-top-14);r+=8){ R(stone2,x,top+14+r,w,1); for(let b=((r/8)&1)?5:0;b<w;b+=10) R(stone2,x+b,top+14+r,1,8); }
  /* torres */
  [[x-1,top+2],[x+w-11,top+2]].forEach(tw=>{ R(stone,tw[0],tw[1]+8,12,bot-tw[1]-8); R(hi,tw[0],tw[1]+8,2,bot-tw[1]-8); R(stone2,tw[0]+9,tw[1]+8,3,bot-tw[1]-8);
    for(let i=0;i<12;i+=4){ R(stone,tw[0]+i,tw[1]+4,3,4); R(stone2,tw[0]+i+2,tw[1]+4,1,4); }
    R(flag,tw[0]+5,tw[1]-8,1,12); const wv=Math.round(Math.sin(t*4+x)*1.4); R(flag2,tw[0]+6,tw[1]-7+wv,8,4); R(flag,tw[0]+6,tw[1]-3+wv,8,1);
    R(left?'#ffd36a':'#ff6a3a',tw[0]+5,tw[1]+16,2,4); R(left?'#ffd36a':'#ff6a3a',tw[0]+5,tw[1]+34,2,4); });
  /* portão virado para o tabuleiro */
  const gx=left?x+w-9:x-1;
  R('#1c1410',gx,bot-26,10,26); R('#3a2a1c',gx+1,bot-25,8,25);
  for(let i=0;i<8;i+=2) R('#6a5a48',gx+1+i,bot-25,1,25);
  R(left?'#6aa4f0':'#ff6a3a',gx+3,bot-31,4,3);
  /* muralha entre as torres */
  for(let i=0;i<w;i+=6){ R(stone,x+i,top+10,4,4); R(stone2,x+i+3,top+10,1,4); }
  if(!left){ for(let i=0;i<4;i++){ R('#2a2530',x+4+i*8,top-2,2,10); R('#ff3a2a',x+4+i*8,top-3,2,2); } }
  if(hurt>0){ R('rgba(255,255,255,.35)',x,top,w,bot-top); }
  if(hp<=0){ R('rgba(0,0,0,.5)',x,top,w,bot-top); for(let i=0;i<6;i++){ R('#ff7a2a',x+3+(i*5)%28,top+20+((i*13)%60),2,3+(Math.floor(t*8+i)%3)); } }
  /* barra de vida */
}
function draw(){
  if(!B) return;
  g.setTransform(1,0,0,1,0,0);
  drawBoard();
  castle('p',B.pHp,B.hurtP,tt); castle('e',B.eHp,B.hurtE,tt);
  /* unidades por profundidade */
  const list=B.units.filter(u=>!(u.team===0&&u.delay>0&&B.phase==='run')||true).slice().sort((a,b)=>a.y-b.y);
  list.forEach(u=>{
    const wasDead=u.dead;
    if(u.team===0&&u.dead) return;
    let size,flip,piece,pal;
    if(u.team===0){ size=HSIZE[u.kind]; piece=u.kind; pal='h_'+u.kind; flip=false; }
    else{ size=u.size; piece=u.piece; pal=u.pal; flip=u.dir<0; }
    const sp=sprite(piece,pal,size,flip,u.hit>0&&(Math.floor(tt*30)%2));
    let x=px(u.x), y=py(u.y)+5;
    const bob=(B.phase==='run'&&!u.dead)?((Math.floor(tt*8+u.id)%2)?-1:0):((Math.floor(tt*2+u.id)%2)?-1:0);
    let lunge=0; if(u.atkAnim>0){ const p=Math.sin((1-u.atkAnim/.28)*Math.PI); lunge=Math.round(p*(u.range>2?0:5))*(u.dir||1); }
    R('rgba(0,0,0,.3)',x-sp.sp.w*.4,y-1,sp.sp.w*.8,2);
    if(wasDead) g.globalAlpha=Math.max(0,1-(B.t-(u.dieT||B.t))/.5);
    g.drawImage(sp.img,Math.round(x-sp.sp.w/2+lunge),Math.round(y-sp.sp.h+bob));
    g.globalAlpha=1;
    if(!wasDead){
      const bw=Math.max(10,Math.round(sp.sp.w*.8)), bx=Math.round(x-bw/2), by=Math.round(y-sp.sp.h+bob-4);
      R('#000',bx-1,by-1,bw+2,3); R(u.team===0?'#3a5a8a':'#6a2020',bx,by,bw,1); R(u.team===0?'#6fcf7a':'#e8504a',bx,by,Math.max(0,Math.round(bw*u.hp/u.max)),1);
      if(u.boss){ R('#ffd24d',Math.round(x-5),by-5,10,3); R('#ffd24d',Math.round(x-5),by-7,2,2); R('#ffd24d',Math.round(x-1),by-7,2,2); R('#ffd24d',Math.round(x+3),by-7,2,2); }
    }
  });
  /* efeitos */
  B.fx.forEach(f=>{
    const p=f.t/f.d, a=1-p;
    if(f.k==='slash'){ const x=px(f.x), y=py(f.y)-6; for(let i=0;i<3;i++){ const off=(i-1)*3; Art.pline(g,i%2?(f.team===0?'#ffffff':'#ffd0c8'):(f.team===0?'#ffe9a0':'#ff7a6a'),x-6+off,y-6,x-6+off+8*Math.min(1,p*3+.2),y-6+9*Math.min(1,p*3+.2),1); } }
    else if(f.k==='ray'){ const c1=f.kind==='cannon'?'#ffcf6a':f.team===0?(f.kind==='bishop'?'#e6c8ff':'#fff2a0'):'#ff9a8a'; Art.pline(g,c1,px(f.x),py(f.y)-10,px(f.x2),py(f.y2)-6,f.kind==='queen'?2:1); Art.pcircle(g,c1,px(f.x2),py(f.y2)-6,Math.round(2+a*3),true); }
    else if(f.k==='wave'){ const r=Math.round(3+p*20), x=px(f.x), y=py(f.y); g.fillStyle='rgba(180,210,240,'+a+')'; for(let i=-r;i<=r;i+=2){ const yy=Math.round(Math.sqrt(Math.max(0,r*r-i*i))*.35); g.fillRect(x+i,y-yy,1,1); g.fillRect(x+i,y+yy,1,1); } }
    else if(f.k==='cast'){ /* faíscas feitas nas partículas */ }
    else if(f.k==='death'){ const r=Math.round(2+p*(f.boss?26:10)); Art.pcircle(g,f.team===1?'rgba(255,200,120,'+a+')':'rgba(150,200,255,'+a+')',px(f.x),py(f.y)-6,r,false); }
  });
  parts.forEach(p=>{ g.globalAlpha=Math.min(1,p.life*4); g.fillStyle=p.c; g.fillRect(Math.round(p.x),Math.round(p.y),1,1); }); g.globalAlpha=1;
  /* heróis que estão renascendo: cronômetro */
  /* contagem do boss chegando */
}

return {TUNE,BW,BH,DIFFS,TIME_LIMIT,ROLE,EKIND,create,step,start,headless,reward,init,reset,begin,frame,info,setSpeed,get speed(){return speed;}};
})();
root.Genesis.Arena=Arena;
if(typeof module!=='undefined') module.exports=Arena;
})(typeof window!=='undefined'?window:globalThis);
