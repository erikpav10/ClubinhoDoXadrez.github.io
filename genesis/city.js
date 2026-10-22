(function(root){
const Core=root.Genesis.Core, Art=root.Genesis.Art;
/* =====================================================================
   CHESS GENESIS — CIDADE E ANDAR PELO CENÁRIO
   Arquivo: genesis/city.js

   Town = o "motor" de andar (setas/WASD, colisão, portas, NPCs) usado
   tanto na Cidade quanto na Fazenda. A Cidade é desenhada aqui; a Fazenda
   (farm.js) só registra o cenário dela com Town.register('farm', ...).
   ===================================================================== */
const Town=(function(){
"use strict";
const W=Art.W,H=Art.H,R=Art.R,hash=Art.hash,fl=Math.floor;
let cv,g,getS,els,hooks={};
let scene=null,sceneId='',t=0,lastDust=0;
const hero={x:128,y:124,dir:1,moving:false,anim:0};
const keys={};
const parts=[];
const npcs=[];
let near=null;
const registry={};

/* ---------- registro e troca de cenário ---------- */
function register(id,factory){ registry[id]=factory; }
function init(canvas,elements,h){ cv=canvas; g=cv.getContext('2d'); g.imageSmoothingEnabled=false; els=elements||{}; hooks=h||{}; getS=hooks.getState; }
function setScene(id,opts){
  const f=registry[id]; if(!f) return;
  sceneId=id; scene=f(opts||{});
  hero.x=scene.start.x; hero.y=scene.start.y; hero.dir=1; hero.moving=false;
  for(const k in keys) keys[k]=false;
  near=null; parts.length=0;
  npcs.length=0; (scene.npcs||[]).forEach(n=>npcs.push(Object.assign({x:n.x0,dir:1,wait:0,ph:Math.random()*5},n)));
  buildLabels();
}
function buildLabels(){
  if(!els.labels) return;
  els.labels.innerHTML='';
  (scene.labels||[]).forEach(l=>{
    const d=document.createElement('div'); d.className='cg-place'+(l.locked?' cg-locked':''); d.textContent=l.text;
    d.style.left=(l.x/W*100)+'%'; d.style.top=(l.y/H*100)+'%'; d.dataset.zone=l.zone||'';
    els.labels.appendChild(d);
  });
}
function refreshLabels(){ buildLabels(); }

/* ---------- entrada do teclado ---------- */
const MAP={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowUp:'u',KeyW:'u',ArrowDown:'d',KeyS:'d'};
function keydown(e){
  const m=MAP[e.code];
  if(m){ keys[m]=true; return true; }
  if(e.code==='KeyE'||e.code==='Enter'||e.code==='Space'){ if(!e.repeat&&near&&hooks.onEnter) hooks.onEnter(near); return true; }
  return false;
}
function keyup(e){ const m=MAP[e.code]; if(m){ keys[m]=false; return true; } return false; }
function clearKeys(){ for(const k in keys) keys[k]=false; }
function pressing(){ return keys.l||keys.r||keys.u||keys.d; }

/* ---------- colisão ---------- */
function blocked(x,y){
  const b=scene.bounds; if(x<b.x0||x>b.x1||y<b.y0||y>b.y1) return true;
  const L=x-4,Rr=x+4,T=y-3,B=y;
  for(const o of scene.obstacles){ if(Rr>o[0]&&L<o[0]+o[2]&&B>o[1]&&T<o[1]+o[3]) return true; }
  return false;
}
function stepHero(dt){
  let dx=(keys.r?1:0)-(keys.l?1:0), dy=(keys.d?1:0)-(keys.u?1:0);
  hero.moving=false;
  if(dx||dy){
    const len=Math.hypot(dx,dy), sp=46*dt; dx=dx/len*sp; dy=dy/len*sp;
    if(dx){ if(!blocked(hero.x+dx,hero.y)){ hero.x+=dx; hero.moving=true; } hero.dir=dx>0?1:-1; }
    if(dy){ if(!blocked(hero.x,hero.y+dy)){ hero.y+=dy; hero.moving=true; } }
  }
  if(hero.moving){ hero.anim+=dt; lastDust+=dt; if(lastDust>.14){ lastDust=0; parts.push({x:hero.x-hero.dir*4+(Math.random()-.5)*3,y:hero.y-1,vx:-hero.dir*(6+Math.random()*8),vy:-5-Math.random()*6,life:.35,c:'rgba(225,212,180,.8)',sz:2}); } }
  near=null;
  for(const z of scene.zones){ if(hero.x>=z.x&&hero.x<=z.x+z.w&&hero.y>=z.y&&hero.y<=z.y+z.h){ near=z; break; } }
}

/* ---------- NPCs (peões que passeiam) ---------- */
function stepNpcs(dt){
  npcs.forEach(n=>{
    if(n.wait>0){ n.wait-=dt; return; }
    n.x+=n.dir*n.sp*dt;
    if(n.x>n.x1){ n.x=n.x1; n.dir=-1; n.wait=1+Math.random()*3; }
    if(n.x<n.x0){ n.x=n.x0; n.dir=1; n.wait=1+Math.random()*3; }
  });
}
function drawNpc(n){
  const sp=Art.buildPiece('pawn',n.pal,n.size||15);
  const img=n.dir>0?sp.cv:Art.variant(sp,'flip');
  const moving=n.wait<=0, bob=moving?((Math.floor(t*8+n.ph)%2)?-1:0):0;
  shadow(n.x,n.y,sp.w);
  g.drawImage(img,Math.round(n.x-sp.w/2),Math.round(n.y-sp.h+bob));
}
function shadow(x,y,w){ g.fillStyle='rgba(0,0,0,.28)'; g.fillRect(Math.round(x-w*.45),Math.round(y-1),Math.round(w*.9),2); }

/* ---------- herói ---------- */
function drawHero(S){
  const fi=Core.formIndex(S.level);
  const N=19+Math.round(fi*1.2);
  const sp=Art.buildPiece(Art.FORM_IDS[fi],'h_'+Art.FORM_IDS[fi],N);
  const img=hero.dir>0?sp.cv:Art.variant(sp,'flip');
  const bob=hero.moving?((Math.floor(hero.anim*9)%2)?-1:0):((Math.floor(t*2)%2)?-1:0);
  shadow(hero.x,hero.y,sp.w);
  g.drawImage(img,Math.round(hero.x-sp.w/2),Math.round(hero.y-sp.h+bob));
  if(fi>=4&&Math.floor(t*3)%2===0){ g.fillStyle='rgba(255,226,120,.9)'; g.fillRect(Math.round(hero.x-sp.w/2+2+((Math.floor(t*5))%3)*3),Math.round(hero.y-sp.h+2+((Math.floor(t*7))%4)*3),1,1); }
  return {top:hero.y-sp.h,h:sp.h};
}

/* ---------- quadro ---------- */
function frame(dt){
  const S=getS&&getS(); if(!S||!cv||!scene) return;
  t+=dt;
  stepHero(dt); stepNpcs(dt);
  parts.forEach(p=>{ p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=10*dt; });
  for(let i=parts.length-1;i>=0;i--) if(parts[i].life<=0) parts.splice(i,1);

  g.setTransform(1,0,0,1,0,0);
  scene.draw(g,t);
  /* tudo que tem "profundidade" é desenhado do fundo para a frente */
  const list=[];
  (scene.props?scene.props(t):[]).forEach(p=>list.push(p));
  npcs.forEach(n=>list.push({y:n.y,draw:()=>drawNpc(n)}));
  let hb=null;
  list.push({y:hero.y,draw:()=>{ hb=drawHero(S); }});
  list.sort((a,b)=>a.y-b.y);
  list.forEach(p=>p.draw(g,t));
  parts.forEach(p=>{ g.globalAlpha=Math.min(1,p.life*3); g.fillStyle=p.c; g.fillRect(Math.round(p.x),Math.round(p.y),p.sz,p.sz); });
  g.globalAlpha=1;
  if(scene.front) scene.front(g,t);

  /* aviso "E · Entrar" em cima do herói */
  if(els.prompt){
    if(near&&hb){ els.prompt.style.display='block'; els.prompt.style.left=(hero.x/W*100)+'%'; els.prompt.style.top=((hb.top-4)/H*100)+'%'; const txt='E · '+near.prompt; if(els.prompt.textContent!==txt) els.prompt.textContent=txt; }
    else els.prompt.style.display='none';
  }
}
function hidePrompt(){ if(els.prompt) els.prompt.style.display='none'; }
function nearZone(){ return near; }
function flo(txt,cls){
  if(!els.floats) return;
  const d=document.createElement('div'); d.className='cg-fl'+(cls?' cg-fl-'+cls:''); d.textContent=txt;
  d.style.left=(hero.x/W*100)+'%'; d.style.top=((hero.y-34)/H*100)+'%';
  els.floats.appendChild(d); setTimeout(()=>d.remove(),950);
  while(els.floats.children.length>12) els.floats.firstChild.remove();
}
function sparkle(n,cols){ for(let i=0;i<n&&parts.length<200;i++){ const a=Math.random()*6.283,s=20+Math.random()*40; parts.push({x:hero.x,y:hero.y-12,vx:Math.cos(a)*s,vy:Math.sin(a)*s-25,life:.5+Math.random()*.4,c:cols[(Math.random()*cols.length)|0],sz:Math.random()<.3?2:1}); } }

/* =====================================================================
   CENÁRIO: A CIDADE
   ===================================================================== */
function rows(g,cols,y0,y1){ const n=cols.length,h=(y1-y0)/n; for(let i=0;i<n;i++) R(g,cols[i],0,y0+i*h,W,Math.ceil(h)+1); }
function roofShape(g,x,base,w,h,c1,c2,c3){
  const top=Math.round(w*.42);
  for(let r=0;r<h;r++){
    const ww=Math.round(top+(w-top)*r/(h-1)), xx=x+Math.round((w-ww)/2);
    R(g,(r%4<2)?c1:c2,xx,base-h+r,ww,1);
    R(g,c3,xx,base-h+r,2,1);
  }
  R(g,'rgba(0,0,0,.28)',x,base,w,2);
}
function planks(g,x,y,w,h,c,line,step){ R(g,c,x,y,w,h); for(let i=step;i<w;i+=step) R(g,line,x+i,y,1,h); }
function bricks(g,x,y,w,h,c,line){ R(g,c,x,y,w,h); for(let r=0;r<h;r+=4){ R(g,line,x,y+r,w,1); for(let b=((r/4)&1)?3:0;b<w;b+=7) R(g,line,x+b,y+r,1,4); } }
function smoke(g,t,cx,cy,seed,col){ for(let i=0;i<4;i++){ const q=(t*.35+i*.25+seed)%1, sz=2+Math.round(q*3); R(g,'rgba('+(col||'236,236,236')+','+(.65-q*.65)+')',cx+Math.sin(t*1.6+i*2+seed)*2.5+q*5,cy-q*22,sz,sz); } }
function windowBox(g,x,y,w,h,glow,t){ R(g,'#3a2616',x-1,y-1,w+2,h+2); R(g,glow?'#ffd36a':'#7fa8c8',x,y,w,h); if(glow){ R(g,'#fff0b0',x+1,y+1,w-2,2); } R(g,'#3a2616',x+Math.floor(w/2),y,1,h); R(g,'#3a2616',x,y+Math.floor(h/2),w,1); }
function door(g,x,base,w,h,c,arch){ R(g,'#2a1a10',x-1,base-h-1,w+2,h+1); R(g,c,x,base-h,w,h); if(arch){ R(g,'#2a1a10',x-1,base-h-1,2,2); R(g,'#2a1a10',x+w-1,base-h-1,2,2); } R(g,'rgba(0,0,0,.18)',x+Math.floor(w/2),base-h,1,h); R(g,'#e0b84a',x+w-3,base-Math.floor(h/2),2,2); }
function step3(g,x,base,w){ R(g,'#9a9488',x-2,base,w+4,2); R(g,'#b8b2a4',x-2,base,w+4,1); }

function bar(g,t,x,B){
  planks(g,x,B-26,52,26,'#9a6a3c','#7e5230',4);
  R(g,'#5c3a1e',x,B-26,52,2); R(g,'#5c3a1e',x,B-2,52,2); R(g,'#5c3a1e',x,B-26,2,26); R(g,'#5c3a1e',x+50,B-26,2,26); R(g,'#6a4424',x+25,B-26,2,26);
  roofShape(g,x-4,B-26,60,16,'#b0452e','#9a3a26','#d8654a');
  R(g,'#7a5a3a',x+36,B-48,8,12); R(g,'#5c3a1e',x+36,B-48,8,2); smoke(g,t,x+40,B-48,0);
  windowBox(g,x+5,B-20,9,8,true,t); windowBox(g,x+38,B-20,9,8,true,t);
  door(g,x+20,B,12,20,'#5a3820',true); step3(g,x+20,B,12);
  /* placa com caneca */
  R(g,'#2a1a10',x+33,B-33,1,5); R(g,'#2a1a10',x+33,B-33,11,1);
  R(g,'#caa24a',x+34,B-31,10,9); R(g,'#8a6a22',x+34,B-31,10,1); R(g,'#8a6a22',x+34,B-23,10,1);
  R(g,'#fff6dc',x+36,B-30,5,2); R(g,'#9a5a1c',x+36,B-28,5,5); R(g,'#9a5a1c',x+41,B-27,2,3); R(g,'#c8802c',x+37,B-28,1,4);
  /* barris */
  [[x-5,B],[x+57,B]].forEach(b=>{ R(g,'#7a4a24',b[0],b[1]-10,8,10); R(g,'#4a2a12',b[0],b[1]-8,8,1); R(g,'#4a2a12',b[0],b[1]-3,8,1); R(g,'#a06a3a',b[0]+1,b[1]-10,2,10); });
}
function forge(g,t,x,B){
  bricks(g,x,B-26,52,26,'#8d8f99','#6c6f7c');
  R(g,'#585b68',x,B-26,52,2); R(g,'#585b68',x,B-2,52,2);
  roofShape(g,x-4,B-26,60,15,'#4b5163','#3e4455','#6a7288');
  /* chaminé grande de pedra */
  bricks(g,x+5,B-52,10,28,'#777a86','#585b68'); R(g,'#4a4d58',x+4,B-54,12,3);
  const fl2=2+((t*9)%3|0); R(g,'#ff8a2a',x+7,B-55-fl2+2,6,fl2); R(g,'#ffd060',x+9,B-55-fl2+3,2,fl2-1);
  smoke(g,t,x+10,B-55,.3,'90,90,98');
  /* janela da forja */
  R(g,'#2a2630',x+34,B-22,14,12); R(g,'#4a4650',x+33,B-23,16,2);
  const f=.5+.5*Math.sin(t*11)*Math.sin(t*5.3); R(g,'#ff6a1a',x+35,B-20,12,9); R(g,'#ffb040',x+37+((t*7)%3|0),B-18,6,6); R(g,'#fff0a0',x+39,B-16,3,3+(f>.5?1:0));
  door(g,x+18,B,12,20,'#3a2c24',false); R(g,'rgba(255,140,40,.35)',x+19,B-19,10,2); step3(g,x+18,B,12);
  /* espadas cruzadas */
  R(g,'#2a2630',x+19,B-45,10,10); R(g,'#cfd6e0',x+20,B-44,8,8);
  Art.pline(g,'#4a5060',x+21,B-43,x+27,B-37,1); Art.pline(g,'#4a5060',x+27,B-43,x+21,B-37,1); R(g,'#c8a040',x+23,B-41,2,2);
  /* bigorna */
  R(g,'#3a3a44',x+53,B-6,8,3); R(g,'#5a5a66',x+52,B-8,10,3); R(g,'#3a3a44',x+55,B-3,4,3); R(g,'#8a8a96',x+52,B-8,10,1);
}
function armory(g,t,x,B){
  planks(g,x,B-26,52,26,'#8a97b4','#6f7c9a',6);
  R(g,'#586685',x,B-26,52,2); R(g,'#586685',x,B-2,52,2);
  roofShape(g,x-4,B-26,60,16,'#35456b','#2a3858','#566a9a');
  /* brasão */
  R(g,'#e8c24a',x+21,B-40,12,13); R(g,'#2a4a9a',x+22,B-39,10,10); R(g,'#2a4a9a',x+23,B-29,8,2); R(g,'#2a4a9a',x+25,B-27,4,1);
  R(g,'#fff4d0',x+26,B-38,2,8); R(g,'#fff4d0',x+23,B-34,8,2);
  /* estandartes */
  [[x+3,'#c0392b'],[x+43,'#2a6ad0']].forEach((b,i)=>{ const w=Math.round(Math.sin(t*2.5+i*2)*1); R(g,'#3a2a1c',b[0]+3,B-26,1,2); R(g,b[1],b[0]+w,B-24,7,16); R(g,'rgba(0,0,0,.22)',b[0]+w+4,B-24,3,16); R(g,'#e8c24a',b[0]+w+2,B-21,3,3); for(let k=0;k<3;k++) R(g,b[1],b[0]+w+k*2+1,B-8+k,2,1); });
  door(g,x+20,B,12,20,'#4a3a2a',false); for(let k=0;k<3;k++){ R(g,'#aab0bc',x+22,B-16+k*5,1,1); R(g,'#aab0bc',x+28,B-16+k*5,1,1); } step3(g,x+20,B,12);
  /* manequim de armadura */
  const ax=x-4; R(g,'#4a4a52',ax+2,B-3,6,3); R(g,'#6a6a76',ax+4,B-12,2,9); R(g,'#9aa2b0',ax+1,B-18,8,8); R(g,'#c8cfda',ax+2,B-18,3,8); R(g,'#9aa2b0',ax+2,B-24,6,6); R(g,'#c8cfda',ax+3,B-24,2,5); R(g,'#2a2a30',ax+3,B-21,4,1);
}
function land(g,t,x,B){
  planks(g,x,B-26,52,26,'#e4d6ae','#cdbd90',9);
  for(let i=0;i<52;i+=13) R(g,'#7a5a34',x+i,B-26,2,26); R(g,'#7a5a34',x,B-26,52,2); R(g,'#7a5a34',x,B-14,52,1); R(g,'#7a5a34',x,B-2,52,2);
  roofShape(g,x-4,B-26,60,16,'#4d7d55','#3e6a47','#78b080');
  /* mastro e bandeira */
  R(g,'#5a4a3a',x+47,B-56,2,32); R(g,'#e8c24a',x+46,B-58,4,3);
  const w=Math.round(5+Math.sin(t*3)*1.5); R(g,'#e8c24a',x+49,B-55,w+4,7); R(g,'#4d7d55',x+49,B-53,w+4,2);
  windowBox(g,x+5,B-21,9,9,true,t); R(g,'#c0392b',x+5,B-21,3,9); R(g,'#c0392b',x+11,B-21,3,9);
  windowBox(g,x+38,B-21,9,9,true,t);
  door(g,x+20,B,12,20,'#6a4a2a',false); step3(g,x+20,B,12);
  /* placa "TERRENOS" (sem texto: pergaminho com mapa) */
  R(g,'#5a4a3a',x+19,B-37,14,1); R(g,'#e8d8a8',x+20,B-36,12,9); R(g,'#8a7a4a',x+20,B-36,12,1); R(g,'#8a7a4a',x+20,B-28,12,1);
  R(g,'#6a9a52',x+22,B-34,4,3); R(g,'#c8a050',x+27,B-34,3,3); R(g,'#c0392b',x+24,B-30,1,1); R(g,'#8a7a4a',x+26,B-31,4,1);
  /* estacas de terreno com corda */
  R(g,'#6a4a2a',x+58,B-8,2,8); R(g,'#6a4a2a',x+69,B-8,2,8); R(g,'#e8d8a8',x+60,B-6,9,1);
}
function fountain(g,t,cx,by){
  R(g,'rgba(0,0,0,.25)',cx-22,by-2,44,5);
  R(g,'#8e8e88',cx-20,by-7,40,7); R(g,'#b4b4ae',cx-20,by-7,40,2); R(g,'#6e6e68',cx-18,by-2,36,2);
  R(g,'#4f9ed6',cx-17,by-6,34,4); R(g,'#8ac8f0',cx-14,by-6,10,1); R(g,'#8ac8f0',cx+4+((t*3)%4|0),by-5,8,1);
  R(g,'#9a9a94',cx-3,by-17,6,12); R(g,'#b4b4ae',cx-3,by-17,2,12); R(g,'#8e8e88',cx-7,by-19,14,3); R(g,'#b4b4ae',cx-7,by-19,14,1);
  for(let i=0;i<10;i++){ const p=(t*1.5+i*.1)%1, side=(i%2?1:-1), sp=(1+(i%5))*.9; const x=cx+side*sp*p*5, y=by-20-(1-Math.pow(2*p-1,2))*(8+(i%3)*2)+p*p*8; R(g,(i%3)?'#cfeaff':'#ffffff',x,y,1,1); }
}
function tree(g,x,B,s){
  s=s||1; R(g,'rgba(0,0,0,.25)',x-9*s,B-1,18*s,3); R(g,'#6a4528',x-2*s,B-12*s,4*s,12*s); R(g,'#4a2f18',x+1*s,B-12*s,1*s,12*s);
  R(g,'#3f8a3a',x-9*s,B-24*s,18*s,14*s); R(g,'#4f9a3c',x-7*s,B-28*s,14*s,6*s); R(g,'#6fbc54',x-5*s,B-27*s,6*s,3*s); R(g,'#6fbc54',x-8*s,B-20*s,4*s,3*s); R(g,'#2f6e2e',x+2*s,B-17*s,6*s,6*s);
}
function lamp(g,t,x,B){
  R(g,'rgba(0,0,0,.25)',x-4,B-1,9,2); R(g,'#3a3a40',x,B-22,2,22); R(g,'#3a3a40',x-2,B-3,6,3); R(g,'#2a2a30',x-3,B-27,8,5); R(g,'#ffd36a',x-2,B-26,6,3); R(g,'#fff4b8',x-1,B-26,2,1);
  const a=.12+.04*Math.sin(t*4+x); R(g,'rgba(255,220,120,'+a+')',x-8,B-32,18,14);
}
function bench(g,x,B){ R(g,'rgba(0,0,0,.2)',x-1,B-1,20,2); R(g,'#7a5030',x,B-8,18,3); R(g,'#9a6a40',x,B-8,18,1); R(g,'#5a3a20',x+1,B-5,2,5); R(g,'#5a3a20',x+15,B-5,2,5); R(g,'#7a5030',x,B-12,18,2); }
function bush(g,x,B){ R(g,'#2f6e2e',x,B-6,12,6); R(g,'#4f9a3c',x+1,B-8,10,4); R(g,'#6fbc54',x+2,B-8,4,2); }
function flowers(g,x,B,n,seed){ for(let i=0;i<n;i++){ const fx=x+hash(i+seed)*40, c=['#e8505a','#f0d040','#f08ad0','#ffffff'][i%4]; R(g,'#3f8a3a',fx,B-3,1,3); R(g,c,fx-1,B-5,3,2); } }

function cityFactory(opts){
  const S=opts&&opts.state;
  const doorX=[34,96,158,220], BASE=76;
  const landOpen=S&&S.farm>0;
  return {
    bounds:{x0:8,x1:248,y0:80,y1:137},
    start:{x:128,y:128},
    obstacles:[[110,102,36,11],[8,BASE-4,52,8],[70,BASE-4,52,8],[132,BASE-4,52,8],[194,BASE-4,52,8],[6,124,18,14],[232,126,20,14],[62,92,6,6],[188,92,6,6]],
    zones:[
      {id:'bar',   x:doorX[0]-11,y:80,w:22,h:14,label:'Taverna',        prompt:'Entrar na Taverna'},
      {id:'forge', x:doorX[1]-11,y:80,w:22,h:14,label:'Ferraria',       prompt:'Entrar na Ferraria'},
      {id:'armory',x:doorX[2]-11,y:80,w:22,h:14,label:'Armaria',        prompt:'Entrar na Armaria'},
      {id:'land',  x:doorX[3]-11,y:80,w:22,h:14,label:'Corretor de Terras',prompt:'Falar com o Corretor'}
    ],
    labels:[
      {x:doorX[0],y:31,text:'🍺 Taverna',zone:'bar'},
      {x:doorX[1],y:29,text:'⚔ Ferraria',zone:'forge'},
      {x:doorX[2],y:31,text:'🛡 Armaria',zone:'armory'},
      {x:doorX[3],y:31,text:landOpen?'🏡 Terras':'📜 Terras',zone:'land'}
    ],
    npcs:[
      {x0:20,x1:236,y:92,sp:9,pal:'rust',size:15},
      {x0:30,x1:226,y:112,sp:7,pal:'pale',size:16},
      {x0:14,x1:240,y:131,sp:11,pal:'blue',size:15}
    ],
    draw(g,t){
      /* céu e colinas */
      rows(g,['#86c8ee','#9cd4f2','#b4def5','#cbe9f7'],0,36);
      R(g,'#fff6b0',34,10,10,10); R(g,'#fffbd8',36,12,6,6);
      [[20,8,18],[96,14,14],[170,6,20]].forEach((c,i)=>{ const cx=((c[0]+t*2.2+i*40)%300)-30; R(g,'#ffffff',cx+4,c[1],c[2],3); R(g,'#ffffff',cx,c[1]+2,c[2]+8,3); });
      for(let x=0;x<W;x++){ const y=30-Math.floor(5*(Math.sin(x/21)*.6+Math.sin(x/9+2)*.4+1)); R(g,'#8db98a',x,y,1,12); }
      /* castelo distante: o sonho da fazenda */
      R(g,'#a9b8cc',214,20,26,16); R(g,'#a9b8cc',211,14,6,22); R(g,'#a9b8cc',237,14,6,22); R(g,'#a9b8cc',223,12,8,10);
      R(g,'#8f9fb8',211,12,6,2); R(g,'#8f9fb8',237,12,6,2); R(g,'#8f9fb8',223,10,8,2); R(g,'#e8c24a',226,6,1,5); R(g,'#e04a4a',227,6,4,2);
      R(g,'#6f9a6a',0,32,W,8);
      R(g,'#6fae52',0,36,W,40);
      for(let i=0;i<46;i++) R(g,'#5a9a44',hash(i)*W,38+hash(i*3)*34,2,1);
      /* árvores no fundo, entre os prédios */
      [3,65,127,189,251].forEach((tx,i)=>{ tree(g,tx,BASE-2,.8+((i*3)%2)*.2); });
      /* rua de pedras */
      R(g,'#c2b08a',0,BASE,W,H-BASE);
      for(let r=0;r<18;r++){ const y=BASE+r*4; for(let c=0;c<26;c++){ const h=hash(r*31+c*7), x=c*10+(r%2?5:0)-(h*3|0); R(g,h<.33?'#b09e78':h<.66?'#cdbb94':'#c6b48c',x,y,9,3); } }
      R(g,'#a89868',0,BASE,W,2); R(g,'rgba(0,0,0,.12)',0,BASE+2,W,2);
      /* tapete de passagem na frente das portas */
      doorX.forEach(dx=>{ R(g,'#b8a57e',dx-9,BASE+2,18,14); R(g,'#cfbd96',dx-9,BASE+2,18,1); });
      /* grama de baixo */
      R(g,'#6fae52',0,138,W,6); for(let i=0;i<30;i++) R(g,'#4f9a3c',hash(i+9)*W,139+hash(i*4)*4,2,1);
      /* prédios */
      bar(g,t,8,BASE); forge(g,t,70,BASE); armory(g,t,132,BASE); land(g,t,194,BASE);
      flowers(g,10,BASE+6,6,1); flowers(g,196,BASE+6,5,7);
    },
    props(t){
      return [
        {y:113,draw:g=>fountain(g,t,128,113)},
        {y:138,draw:g=>tree(g,15,138,1)},
        {y:140,draw:g=>tree(g,242,140,1)},
        {y:98,draw:g=>lamp(g,t,65,98)},
        {y:98,draw:g=>lamp(g,t,191,98)},
        {y:96,draw:g=>bench(g,84,98)},
        {y:96,draw:g=>bench(g,154,98)},
        {y:140,draw:g=>bush(g,44,140)},{y:140,draw:g=>bush(g,196,140)}
      ];
    }
  };
}
register('city',cityFactory);

return {init,register,setScene,frame,keydown,keyup,clearKeys,pressing,hidePrompt,nearZone,flo,sparkle,refreshLabels,
  get sceneId(){return sceneId;},get hero(){return hero;},get scene(){return scene;},helpers:{rows,roofShape,planks,bricks,smoke,windowBox,door,tree,bush,flowers,lamp,bench,shadow}};
})();
root.Genesis.Town=Town;
})(typeof window!=='undefined'?window:globalThis);
