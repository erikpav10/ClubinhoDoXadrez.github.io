(function(root){
const Core=root.Genesis.Core, Art=root.Genesis.Art;
/* ===== CHESS GENESIS — PALCO (combate 1v1 animado) e CERIMÔNIA DE EVOLUÇÃO ===== */
const Stage=(function(){
"use strict";
const W=Art.W,H=Art.H,FY=Art.FY,HX=72,EX=186;
let cv,g,getS,els,t=0,scroll=0;
let hAtk=null,eAtk=null,hHurt=0,eHurt=0,knock=0,shake=0,flashW=0,ringT=0,lastHunt=-1,lastPhase='';
const later=[],parts=[],fxs=[];
let cur=null; // medidas do último quadro (para posicionar HUD)

function init(canvas,getState,elements){ cv=canvas; g=cv.getContext('2d'); g.imageSmoothingEnabled=false; getS=getState; els=elements; }
function after(d,fn){ later.push({at:t+d,fn}); }
function spark(x,y,n,cols,spd,life){ for(let i=0;i<n&&parts.length<260;i++){ const a=Math.random()*6.283,s=(.4+Math.random()*.6)*(spd||60); parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,g:140,life:(life||.4)*(.6+Math.random()*.6),c:cols[(Math.random()*cols.length)|0],sz:Math.random()<.3?2:1}); } }
function coins(x,y,n){ for(let i=0;i<n&&parts.length<260;i++) parts.push({x,y,vx:(Math.random()-.5)*50,vy:-60-Math.random()*50,g:260,life:.8+Math.random()*.3,c:'#ffd24d',sz:2,coin:1}); }
function dust(x,y,n){ for(let i=0;i<n&&parts.length<260;i++) parts.push({x:x+(Math.random()-.5)*6,y,vx:-10-Math.random()*14,vy:-4-Math.random()*8,g:-8,life:.35+Math.random()*.2,c:'rgba(210,200,170,.7)',sz:2}); }
function fx(o){ if(fxs.length<40) fxs.push(Object.assign({t:0},o)); }
function flo(txt,x,y,cls){
  if(!els||!els.floats) return;
  const d=document.createElement('div'); d.className='cg-fl'+(cls?' cg-fl-'+cls:''); d.textContent=txt; d.style.left=(x/W*100)+'%'; d.style.top=(y/H*100)+'%';
  els.floats.appendChild(d); setTimeout(()=>d.remove(),950);
  while(els.floats.children.length>16) els.floats.firstChild.remove();
}

/* ---------- eventos do núcleo ---------- */
function onEvents(ev){
  const S=getS(); if(!S) return;
  const D=Core.derive(S), form=Core.FORMS[D.formIdx].id;
  let hits=0;
  ev.forEach(e=>{
    if(e.t==='hit'){
      hits++; if(hits>2) return;
      if(!e.second){ hAtk={t:0,d:.3,form}; }
      after(e.second?.18:.1,()=>impact(e,form));
    }else if(e.t==='enemyHit'){
      eAtk={t:0,d:.36}; after(.14,()=>{ hHurt=.14; spark(HX+4,FY-18,5,['#ff6a5a','#ffd0c8'],60,.3); flo('-'+Core.fmt(e.dmg),HX+16,FY-26,'foe'); });
    }else if(e.t==='kill'){
      after(.05,()=>{ coins(EX,FY-16,e.elite?9:5); });
      flo('+'+Core.fmt(e.gold)+' ouro',EX,FY-52,'gold'); flo('+'+Core.fmt(e.xp)+' XP',EX,FY-40,'xp');
      if(e.elite){ flashW=.15; shake=.18; }
    }else if(e.t==='level'){
      ringT=.9; spark(HX,FY-20,24,['#ffe58a','#fff6c8','#ffd24d'],110,.7); flo('NÍVEL '+e.level+'!',HX,FY-60,'lvl');
    }else if(e.t==='mat'){
      const m=Core.MATS[e.tier]; flo('+1 '+m.icon,EX,FY-64,'lvl'); spark(EX,FY-24,18,['#ffd24d','#fff2b0','#ffffff'],70,.7); flashW=Math.max(flashW,.08);
    }else if(e.t==='potion'){
      flo('🧪 +50% vida',HX,FY-60,'xp'); spark(HX,FY-20,12,['#6fcf7a','#c8ffd0','#ffffff'],60,.5);
    }else if(e.t==='loot'){
      /* o aviso aparece na interface */
    }else if(e.t==='down'){
      hHurt=.3; shake=.2;
    }
  });
}
function enemyBox(){ const S=getS(); const h=Core.HUNTS[S.hunt], K=Core.KINDS[S.enemy.kind]; const sp=Art.enemySprite(K.piece,K.pal,h.tier,S.enemy.elite); return sp; }
function impact(e,form){
  const S=getS(); if(!S||!S.enemy||S.phase==='walk') {}
  const sp=S.enemy?enemyBox():null; const ex=EX-3, ey=FY-(sp?sp.h:30)*.55;
  eHurt=.11; knock=form==='rook'?5:3;
  if(e.crit){ flashW=.18; shake=.14; }
  flo((e.crit?'CRÍTICO ':'')+Core.fmt(e.dmg),ex+(Math.random()*10-5),ey-14-(sp?sp.h*.3:0),e.crit?'crit':'hit');
  switch(form){
   case 'pawn':   fx({k:'slash',x:ex,y:ey,d:.2,c1:'#ffffff',c2:'#ffe9a0'}); spark(ex,ey,5,['#fff2c0','#ffd88a'],70); break;
   case 'knight': fx({k:'slash',x:ex,y:ey,d:.22,c1:'#fff6c8',c2:'#ffcc3a',x2:true}); spark(ex,ey,8,['#ffe58a','#ffffff'],90); break;
   case 'rook':   fx({k:'wave',x:HX+22,y:FY,d:.4,c1:'#cfe4ff',c2:'#6fa4d8'}); fx({k:'slash',x:ex,y:ey,d:.2,c1:'#ffffff',c2:'#9cc4ee'}); dust(HX+24,FY-1,5); spark(ex,ey,6,['#cfe4ff','#ffffff'],80); shake=.1; break;
   case 'bishop': fx({k:'ray',x:HX+10,y:FY-30,x2:ex,y2:ey,d:.26,c1:'#ffffff',c2:'#c79af0'}); spark(ex,ey,8,['#f1d8ff','#c79af0','#ffffff'],80); break;
   case 'queen':  fx({k:'ray',x:HX+10,y:FY-34,x2:ex,y2:ey,d:.3,c1:'#fff6c8',c2:'#ffd24d',w:2}); fx({k:'slash',x:ex,y:ey,d:.24,c1:'#ffffff',c2:'#ffd24d',x2:true}); spark(ex,ey,12,['#ffe58a','#fff','#ff9ae0','#9ae8ff'],110); break;
   default:       fx({k:'slash',x:ex,y:ey,d:.26,c1:'#fff6c8',c2:'#ffb020',x2:true}); fx({k:'slash',x:ex+4,y:ey+4,d:.3,c1:'#ffffff',c2:'#ff7a3a'}); spark(ex,ey,14,['#ffe58a','#ff9a3a','#ffffff'],120);
  }
}

/* ---------- quadro ---------- */
function frame(dt,paused){
  const S=getS(); if(!S||!cv) return;
  t+=dt;
  for(let i=later.length-1;i>=0;i--) if(t>=later[i].at){ const f=later.splice(i,1)[0]; try{ f.fn(); }catch(e){} }
  const hunt=Core.HUNTS[S.hunt];
  if(S.hunt!==lastHunt){ lastHunt=S.hunt; if(els.huntName) els.huntName.textContent=Core.TIERS[hunt.tier].icon+' '+hunt.name+' · Nv '+hunt.lo+'–'+hunt.hi; }
  const D=Core.derive(S), fi=D.formIdx, fid=D.form.id;
  const walking=S.phase==='walk';
  if(walking) scroll+=34*dt;
  if(hAtk){ hAtk.t+=dt; if(hAtk.t>=hAtk.d) hAtk=null; }
  if(eAtk){ eAtk.t+=dt; if(eAtk.t>=eAtk.d) eAtk=null; }
  if(hHurt>0) hHurt-=dt; if(eHurt>0) eHurt-=dt; if(knock>0) knock=Math.max(0,knock-dt*14);
  if(shake>0) shake-=dt; if(flashW>0) flashW-=dt; if(ringT>0) ringT-=dt;
  parts.forEach(p=>{ p.life-=dt; p.vy+=p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; });
  for(let i=parts.length-1;i>=0;i--) if(parts[i].life<=0) parts.splice(i,1);
  fxs.forEach(f=>f.t+=dt); for(let i=fxs.length-1;i>=0;i--) if(fxs[i].t>=fxs[i].d) fxs.splice(i,1);
  if(walking && Math.floor(t*8)%3===0 && Math.random()<.5) dust(HX-6,FY,1);

  g.setTransform(1,0,0,1,0,0);
  g.save();
  if(shake>0) g.translate(Math.round((Math.random()-.5)*3),Math.round((Math.random()-.5)*2));
  Art.drawScene(g,hunt.scene,t,scroll);

  /* herói */
  const hs=Art.heroSprite(fi);
  let hx=HX,hy=FY;
  const bob=walking?((Math.floor(t*9)%2)?-1:0):((Math.floor(t*2.2)%2)?-1:0);
  hy+=bob;
  if(hAtk){ const p=hAtk.t/hAtk.d, s=Math.sin(Math.min(1,p)*Math.PI);
    if(fid==='knight'){ hx+=Math.round(s*30); hy-=Math.round(s*14); }
    else if(fid==='rook'){ hx+=Math.round(s*10); }
    else if(fid==='bishop'){ hy-=Math.round(s*4); }
    else if(fid==='queen'){ hx+=Math.round(s*12); hy-=Math.round(s*3); }
    else if(fid==='king'){ hx+=Math.round(s*16); }
    else { hx+=Math.round(s*20); }
  }
  const lowHp=false;
  shadow(hx,FY,hs.w);
  if(S.phase==='down'){ g.globalAlpha=.55; g.drawImage(Art.variant(hs,'red'),Math.round(hx-hs.w/2),hy-hs.h+4); g.globalAlpha=1; }
  else{
    g.drawImage(hHurt>0&&(Math.floor(t*30)%2)?Art.variant(hs,'red'):hs.cv,Math.round(hx-hs.w/2),Math.round(hy-hs.h));
    if(fi>=4){ const a=Math.sin(t*4)>0?1:0; g.fillStyle='rgba(255,226,120,.9)'; g.fillRect(Math.round(hx-hs.w/2+hs.w*.15+((Math.floor(t*5))%3)*6),Math.round(hy-hs.h+3+((Math.floor(t*7))%4)*5),1,1); }
  }
  if(ringT>0){ const r=Math.round((1-ringT/.9)*26)+4; Art.pcircle(g,'rgba(255,229,138,'+(ringT/.9)+')',HX,FY-14,r,false); }

  /* inimigo */
  cur={hx,hy:hy-hs.h,ex:EX,ey:FY,eh:0};
  if(S.enemy){
    const K=Core.KINDS[S.enemy.kind], es=Art.enemySprite(K.piece,K.pal,hunt.tier,S.enemy.elite);
    let ex=EX,ey=FY;
    if(S.phase==='walk'){ const p=Math.min(1,S.pt/Core.WALK_TIME); const e=1-Math.pow(1-p,2); ex=Math.round(W+30+(EX-(W+30))*e); ey+=(Math.floor(t*9)%2)?-1:0; }
    else{ ey+=((Math.floor(t*2.4+.5)%2)?-1:0); }
    if(eAtk){ const s=Math.sin(Math.min(1,eAtk.t/eAtk.d)*Math.PI); ex-=Math.round(s*14); }
    ex+=Math.round(knock);
    cur.ex=ex; cur.ey=ey; cur.eh=es.h;
    shadow(ex,FY,es.w);
    if(S.phase==='dead'){
      const p=Math.min(1,S.pt/Core.KILL_PAUSE);
      if(!es.rnd) es.rnd=es.px.map(()=>Math.random());
      const ox=Math.round(ex-es.w/2), oy=Math.round(ey-es.h);
      es.px.forEach((q,i)=>{ if(es.rnd[i]>p*1.15){ g.fillStyle=(p<.15)?'#ffffff':q.c; g.fillRect(ox+(es.w-1-q.x),oy+q.y-Math.round(p*6*es.rnd[i]),1,1); } });
    }else{
      const img=(eHurt>0)?Art.variant(es,'flipWhite'):Art.variant(es,'flip');
      g.drawImage(img,Math.round(ex-es.w/2),Math.round(ey-es.h));
    }
  }

  /* efeitos */
  fxs.forEach(f=>drawFx(f));
  parts.forEach(p=>{ g.globalAlpha=Math.min(1,p.life*3); g.fillStyle=p.c; if(p.coin){ const w=(Math.floor(t*12+p.x)%2)?2:1; g.fillRect(Math.round(p.x),Math.round(p.y),w,2); } else g.fillRect(Math.round(p.x),Math.round(p.y),p.sz,p.sz); });
  g.globalAlpha=1;
  if(flashW>0){ g.fillStyle='rgba(255,255,255,'+Math.min(.35,flashW*2)+')'; g.fillRect(0,0,W,H); }
  g.restore();
  updateHud(S,D);
}
function shadow(x,y,w){ g.fillStyle='rgba(0,0,0,.30)'; g.fillRect(Math.round(x-w*.45),y-1,Math.round(w*.9),2); g.fillRect(Math.round(x-w*.33),y+1,Math.round(w*.66),1); }
function drawFx(f){
  const p=f.t/f.d, a=1-p;
  if(f.k==='slash'){
    const n=f.x2?5:3; g.fillStyle=f.c2;
    for(let i=0;i<n;i++){ const off=(i-(n-1)/2)*3; const len=Math.round(14*Math.min(1,p*3+.2));
      Art.pline(g,i%2?f.c1:f.c2,f.x-9+off,f.y-10+off*.3,f.x-9+off+len*.8,f.y-10+off*.3+len,1+(a>.5?1:0)); }
  }else if(f.k==='ray'){
    const w=f.w||1; Art.pline(g,f.c2,f.x,f.y+1,f.x2,f.y2+1,w+1); Art.pline(g,f.c1,f.x,f.y,f.x2,f.y2,w);
    Art.pcircle(g,f.c1,f.x2,f.y2,Math.round(3+a*3),true);
  }else if(f.k==='wave'){
    const r=Math.round(4+p*30); g.fillStyle=f.c1; for(let i=-r;i<=r;i+=2){ const yy=Math.round(Math.sqrt(Math.max(0,r*r-i*i))*.28); g.fillRect(f.x+i,f.y-yy,1,1); g.fillRect(f.x+i,f.y+yy,1,1); }
  }
}
function updateHud(S,D){
  if(!els||!cur) return;
  const pct=(x,m)=>(x/m*100)+'%';
  if(els.hBar){ els.hBar.style.left=pct(HX,W); els.hBar.style.top=pct(cur.hy-12,H); els.hFill.style.width=Math.max(0,S.heroHp/D.maxHp*100)+'%'; }
  if(S.enemy&&els.eBar){
    els.eBar.style.display=(S.phase==='dead')?'none':'';
    els.eBar.style.left=pct(Math.min(cur.ex,W-30),W); els.eBar.style.top=pct(cur.ey-cur.eh-17,H);
    els.eFill.style.width=Math.max(0,S.enemy.hp/S.enemy.maxHp*100)+'%';
    els.eName.textContent=S.enemy.name+' · Nv '+S.enemy.lvl; els.eName.className='cg-nm'+(S.enemy.elite?' cg-elite':'');
  }
  if(els.status){
    if(S.phase==='down'){ els.status.style.display='block'; els.status.textContent='Derrotado! Recuperando… '+Math.max(0,Math.ceil(Core.DOWN_TIME-S.pt))+'s'; }
    else els.status.style.display='none';
  }
}

/* =====================================================================
   CERIMÔNIA DE EVOLUÇÃO (tela cheia) — um efeito diferente por forma
   ===================================================================== */
const Evo=(function(){
  const EW=192,EH=108,CX=96,FEET=99;
  let root,cv2,g2,titleEl,subEl,skillEl,btn,active=false,et=0,from=0,to=0,onDone=null,raf=0,lastTs=0,swapped=false,flash=0;
  let P=[],bolts=[],blocks=[],stars=[],crown=null,seedT=0;
  const THEMES={
    pawn:  {a:'#ffe58a',b:'#ffffff',bg:['#2a2008','#08060a']},
    knight:{a:'#ffe58a',b:'#ffffff',bg:['#2a2008','#08060a']},
    rook:  {a:'#9cc4ee',b:'#cfd8e6',bg:['#101826','#05070c']},
    bishop:{a:'#c79af0',b:'#f1d8ff',bg:['#1c1032','#06040c']},
    queen: {a:'#ff9ae0',b:'#9ae8ff',bg:['#1a0a2a','#030208']},
    king:  {a:'#ffd24d',b:'#ff7a5a',bg:['#2a1004','#060303']}};
  let tid='knight', THEME=null, kind=1;   /* kind: 1 cavalo, 2 torre, 3 bispo, 4 rainha, 5 rei */
  function init(el){ root=el.root; cv2=el.canvas; g2=cv2.getContext('2d'); g2.imageSmoothingEnabled=false; titleEl=el.title; subEl=el.sub; skillEl=el.skill; btn=el.btn; btn.onclick=close; }
  function fit(){ const sc=Math.max(1,Math.floor(Math.min(innerWidth/EW,(innerHeight-150)/EH))); cv2.style.width=EW*sc+'px'; cv2.style.height=EH*sc+'px'; }
  function start(f,tt,done,heading){
    if(active) return; active=true; from=f; to=tt; onDone=done; tid=Core.FORMS[tt].id; kind=({pawn:1,knight:1,rook:2,bishop:3,queen:4,king:5})[tid]; THEME=THEMES; et=0; swapped=false; flash=0; P=[]; bolts=[]; blocks=[]; stars=[]; crown=null;
    root.classList.add('cg-show'); btn.style.display='none'; titleEl.style.opacity=0; subEl.style.opacity=0; skillEl.style.opacity=0;
    titleEl.textContent=heading||'NOVO HERÓI!'; const F=Core.FORMS; subEl.textContent=F[to].name+' se junta ao seu time!'; skillEl.innerHTML='<b>'+F[to].skill+'</b> — '+F[to].sd;
    fit(); addEventListener('resize',fit);
    if(kind===2) for(let i=0;i<16;i++) blocks.push({a:Math.random()*6.283,r:70+Math.random()*30,y:Math.random()*40,s:3+((Math.random()*4)|0),rot:Math.random()});
    if(kind===3) for(let i=0;i<90;i++) P.push({a:Math.random()*6.283,r:70+Math.random()*40,h:Math.random()*60,w:.8+Math.random()*1.4,s:Math.random()<.2?2:1});
    if(kind>=4) for(let i=0;i<(kind===5?240:200);i++){ const a=Math.random()*6.283,s=20+Math.random()*(kind===5?150:130); stars.push({a,s,c:Math.random()}); }
    lastTs=0; cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
  }
  function close(){ if(!active) return; active=false; root.classList.remove('cg-show'); removeEventListener('resize',fit); cancelAnimationFrame(raf); if(onDone) onDone(); }
  function loop(ts){
    if(!active) return; const dt=Math.min(.05,lastTs?(ts-lastTs)/1000:.016); lastTs=ts; et+=dt;
    try{ draw(dt); }catch(e){ console.error('Evo',e); }
    raf=requestAnimationFrame(loop);
  }
  const REVEAL=1.7;
  function heroImg(idx,scale,x,feet,tint){
    const s=Art.heroSprite(idx); const w=s.w*scale,h=s.h*scale; g2.drawImage(tint?Art.variant(s,tint):s.cv,Math.round(x-w/2),Math.round(feet-h),w,h); return {w,h,top:feet-h};
  }
  function glowRings(col,n,k){ for(let i=0;i<n;i++){ const r=((et*40*k+i*(60/n))%60); Art.pcircle(g2,col,CX,FEET-24,Math.round(r),false); } }
  function draw(dt){
    const th=THEMES[tid], rv=et-REVEAL, T=th;
    // fundo
    const gr=g2.createLinearGradient(0,0,0,EH); gr.addColorStop(0,T.bg[0]); gr.addColorStop(1,T.bg[1]); g2.fillStyle=gr; g2.fillRect(0,0,EW,EH);
    // chão
    g2.fillStyle='rgba(255,255,255,.05)'; g2.fillRect(0,FEET,EW,EH-FEET); g2.fillStyle='rgba(255,255,255,.12)'; g2.fillRect(0,FEET,EW,1);
    for(let i=0;i<40;i++){ g2.fillStyle='rgba(255,255,255,'+(.15+.5*Math.abs(Math.sin(et*2+i)))+')'; g2.fillRect(Art.hash(i)*EW|0,Art.hash(i*3)*(FEET-6)|0,1,1); }
    if(et<REVEAL){
      // carga: energia converge no herói
      const k=et/REVEAL;
      const sh=Math.round(Math.sin(et*40)*k*1.5);
      for(let i=0;i<5;i++){ const rr=Math.round((1-((et*1.2+i*.2)%1))*(30+k*30)); Art.pcircle(g2,i%2?T.a:T.b,CX,FEET-24,rr,false); }
      for(let i=0;i<24;i++){ const a=Art.hash(i)*6.283+et*2, r=(1-((et*.8+Art.hash(i*7))%1))*70; g2.fillStyle=i%2?T.a:T.b; g2.fillRect(Math.round(CX+Math.cos(a)*r),Math.round(FEET-24+Math.sin(a)*r*.7),1+(i%3===0),1+(i%3===0)); }
      if(kind===1&&Math.random()<.2+k*.4){ addBolt(); }
      if(kind===2) blocks.forEach(b=>{ const r=b.r*(1-k*.8); const x=CX+Math.cos(b.a+et*1.2)*r, y=FEET-4-b.y*(1-k)-Math.sin(b.a+et*1.2)*r*.25-k*30; g2.fillStyle='#8a929c'; g2.fillRect(Math.round(x),Math.round(y),b.s,b.s); g2.fillStyle='#bcc4cc'; g2.fillRect(Math.round(x),Math.round(y),b.s,1); });
      if(kind===3) P.forEach(p=>{ const rr=p.r*(1-k*.85); const x=CX+Math.cos(p.a+et*3*p.w)*rr, y=FEET-4-p.h*(.4+k*.6)+Math.sin(p.a+et*3*p.w)*rr*.22; g2.fillStyle=(p.s===2)?T.b:T.a; g2.fillRect(Math.round(x),Math.round(y),p.s,p.s); });
      if(kind>=4) for(let i=0;i<14;i++){ const a=i/14*6.283+et*.8; Art.pline(g2,'rgba(255,255,255,'+(.25*k)+')',CX,FEET-24,CX+Math.cos(a)*120,FEET-24+Math.sin(a)*120,1); }
      heroImg(from,2,CX+sh,FEET,(Math.floor(et*14)%2&&k>.5)?'white':null);
      shadow2(Art.heroSprite(from).w*2);
    }else{
      if(!swapped){ swapped=true; flash=1; }
      shadow2(Art.heroSprite(to).w*2);
      revealFx(rv,dt);
      const hh=heroImg(to,2,CX,FEET,(rv<.25&&Math.floor(et*20)%2)?'gold':null);
      if(kind>=4){ if(!crown) crown={y:-24,v:0,b:0,done:false,t0:rv}; const topY=hh.top-4; if(rv>.5){ if(!crown.done){ crown.v+=260*dt; crown.y+=crown.v*dt; if(crown.y>=topY){ crown.y=topY; crown.v=-crown.v*.35; crown.b++; if(crown.b>2||Math.abs(crown.v)<20){ crown.done=true; crown.y=topY; flash=Math.max(flash,.6); for(let i=0;i<30;i++) P.push({sx:CX,sy:topY+6,a:Math.random()*6.283,s:20+Math.random()*60,t0:et,k:1}); } } } g2.drawImage(Art.crownSprite(),Math.round(CX-11),Math.round(crown.y-14),22,14); } }
      // textos
      if(rv>.5) titleEl.style.opacity=1; if(rv>1.0) subEl.style.opacity=1; if(rv>1.5) skillEl.style.opacity=1; if(rv>2.0) btn.style.display='inline-block';
    }
    if(flash>0){ g2.fillStyle='rgba(255,255,255,'+Math.min(1,flash)+')'; g2.fillRect(0,0,EW,EH); flash-=dt*1.6; }
    // bolts / partículas de estouro
    bolts.forEach(b=>{ b.life-=dt; Art.pline(g2,'rgba(255,240,150,'+Math.max(0,b.life*5)+')',b.pts[0][0],b.pts[0][1],b.pts[0][0],b.pts[0][1],1); for(let i=1;i<b.pts.length;i++){ Art.pline(g2,'rgba(255,230,120,'+Math.max(0,b.life*5)+')',b.pts[i-1][0]+1,b.pts[i-1][1],b.pts[i][0]+1,b.pts[i][1],1); Art.pline(g2,'rgba(255,255,255,'+Math.max(0,b.life*5)+')',b.pts[i-1][0],b.pts[i-1][1],b.pts[i][0],b.pts[i][1],1); } });
    bolts=bolts.filter(b=>b.life>0);
    P.forEach(p=>{ if(p.k===1){ const q=et-p.t0; g2.fillStyle=(Math.floor(q*20)%2)?'#ffe58a':'#ffffff'; g2.fillRect(Math.round(p.sx+Math.cos(p.a)*p.s*q),Math.round(p.sy+Math.sin(p.a)*p.s*q+q*q*30),2,2); } });
    P=P.filter(p=>p.k!==1||(et-p.t0)<1.2);
  }
  function shadow2(w){ g2.fillStyle='rgba(0,0,0,.4)'; g2.fillRect(Math.round(CX-w*.45),FEET-1,Math.round(w*.9),3); }
  function addBolt(){ const x0=CX+(Math.random()*70-35), pts=[[x0,0]]; const x1=CX+(Math.random()*10-5), y1=FEET-52; for(let i=1;i<=7;i++){ pts.push([x0+(x1-x0)*i/7+(i<7?(Math.random()*14-7):0),y1*i/7]); } bolts.push({pts,life:.2}); if(bolts.length>6) bolts.shift(); }
  function revealFx(rv,dt){
    const th=THEMES[tid];
    if(kind===1){
      if(Math.random()<.5&&rv<3.2) addBolt();
      for(let i=0;i<30;i++){ const x=Art.hash(i)*EW, y=((rv*40+Art.hash(i*5)*FEET)%FEET); g2.fillStyle=(i%2)?'#ffe58a':'#ffffff'; g2.fillRect(Math.round(x),Math.round(y),1,2); }
      glowRings('rgba(255,229,138,.5)',3,.6);
    }else if(kind===2){
      // ondas de choque no chão + pedras caindo
      for(let i=0;i<3;i++){ const r=((rv*30+i*18)%54); g2.fillStyle='rgba(180,210,240,'+(1-r/54)+')'; for(let a=-r;a<=r;a+=2){ const yy=Math.sqrt(Math.max(0,r*r-a*a))*.22; g2.fillRect(CX+a,Math.round(FEET+yy-2),1,1); } }
      for(let i=0;i<22;i++){ const x=Art.hash(i)*EW, y=((rv*50+Art.hash(i*9)*80)%90); g2.fillStyle='#8a929c'; g2.fillRect(Math.round(x),Math.round(y),2+(i%3),2+(i%2)); g2.fillStyle='#bcc4cc'; g2.fillRect(Math.round(x),Math.round(y),2+(i%3),1); }
      for(let i=0;i<8;i++){ const x=CX-34+i*10, h=Math.min(16,rv*30)*(.5+Art.hash(i)); g2.fillStyle='#6f7882'; g2.fillRect(x,Math.round(FEET-h),6,Math.round(h)); g2.fillStyle='#9aa4ae'; g2.fillRect(x,Math.round(FEET-h),6,1); }
    }else if(kind===3){
      const w=Math.round(14+Math.sin(rv*5)*3), a=Math.min(1,rv*1.5);
      const gr=g2.createLinearGradient(CX-w,0,CX+w,0); gr.addColorStop(0,'rgba(199,154,240,0)'); gr.addColorStop(.5,'rgba(255,255,255,'+(.55*a)+')'); gr.addColorStop(1,'rgba(199,154,240,0)'); g2.fillStyle=gr; g2.fillRect(CX-w,0,w*2,FEET);
      for(let i=0;i<3;i++){ const y=FEET-((rv*30+i*30)%80); const rr=14+((i*5+rv*8)%8); g2.fillStyle='rgba(241,216,255,.8)'; for(let a=0;a<6.283;a+=.35){ g2.fillRect(Math.round(CX+Math.cos(a+rv*3)*rr),Math.round(y+Math.sin(a+rv*3)*rr*.3),1,1); } }
      for(let i=0;i<40;i++){ const y=FEET-((rv*36+Art.hash(i)*FEET)%FEET); g2.fillStyle=(i%2)?'#c79af0':'#ffffff'; g2.fillRect(Math.round(CX+Math.sin(rv*2+i)*28*Art.hash(i*3)),Math.round(y),1,1+(i%3===0)); }
    }else{
      // Rainha / Rei: explosão cósmica
      const rays=kind===5?18:14;
      for(let i=0;i<rays;i++){ const a=i/rays*6.283+rv*(kind===5?.5:.8); const len=Math.min(140,rv*160); Art.pline(g2,(i%2)?'rgba(255,255,255,.18)':((kind===5)?'rgba(255,200,90,.22)':'rgba(255,154,224,.22)'),CX,FEET-24,CX+Math.cos(a)*len,FEET-24+Math.sin(a)*len,2); }
      stars.forEach(s=>{ const d=Math.min(rv,2.6)*s.s*(.5+s.c), x=CX+Math.cos(s.a)*d, y=FEET-24+Math.sin(s.a)*d*.8; if(x<0||x>EW||y<0||y>EH) return; const cols=kind===5?['#ffd24d','#ffffff','#ff7a5a','#ffe58a']:['#ff9ae0','#9ae8ff','#ffffff','#ffe58a']; g2.fillStyle=cols[(s.c*4)|0]; g2.fillRect(Math.round(x),Math.round(y),s.c>.8?2:1,s.c>.8?2:1); });
      glowRings(kind===5?'rgba(255,200,90,.5)':'rgba(255,154,224,.5)',4,.9);
      if(kind===5){ for(let i=0;i<30;i++){ const x=Art.hash(i)*EW, y=((rv*30+Art.hash(i*7)*EH)%EH); g2.fillStyle=['#e03a3a','#ffd24d','#fff'][i%3]; g2.fillRect(Math.round(x+Math.sin(rv*3+i)*4),Math.round(y),2,3); } }
    }
  }
  return {init,start,get active(){return active;},close};
})();

return {init,onEvents,frame,Evo};
})();
root.Genesis.Stage=Stage;
})(typeof window!=='undefined'?window:globalThis);
