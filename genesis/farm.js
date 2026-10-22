(function(root){
const Core=root.Genesis.Core, Art=root.Genesis.Art, Town=root.Genesis.Town;
/* =====================================================================
   CHESS GENESIS — FAZENDA (10 níveis) E CERIMÔNIA DE CONSTRUÇÃO
   Arquivo: genesis/farm.js
   Nível 1 = terreno vazio ... nível 10 = castelo real.
   ===================================================================== */
const Farm=(function(){
"use strict";
const W=Art.W,H=Art.H,R=Art.R,hash=Art.hash,fl=Math.floor;
const HOR=48, BASE=94;

/* ---------- peças de desenho ---------- */
function rows(g,cols,y0,y1){ const n=cols.length,h=(y1-y0)/n; for(let i=0;i<n;i++) R(g,cols[i],0,y0+i*h,W,Math.ceil(h)+1); }
function shade(g,x,y,w,h){ R(g,'rgba(0,0,0,.17)',x+Math.round(w*.72),y,Math.round(w*.28),h); R(g,'rgba(255,255,255,.12)',x,y,Math.max(1,Math.round(w*.1)),h); }
function planks(g,x,y,w,h,c,line,step){ R(g,c,x,y,w,h); for(let i=step;i<w;i+=step) R(g,line,x+i,y,1,h); shade(g,x,y,w,h); }
function bricks(g,x,y,w,h,c,line){ R(g,c,x,y,w,h); for(let r=0;r<h;r+=4){ R(g,line,x,y+r,w,1); for(let b=((r/4)&1)?3:0;b<w;b+=7) R(g,line,x+b,y+r,1,4); } shade(g,x,y,w,h); }
function roofTri(g,cx,base,halfW,h,c1,c2,hi){
  for(let r=0;r<h;r++){ const half=Math.max(1,Math.round(halfW*(r+1)/h)); R(g,(r%3===2)?c2:c1,cx-half,base-h+r,half*2,1); R(g,hi,cx-half,base-h+r,1,1); R(g,'rgba(0,0,0,.18)',cx+Math.round(half*.55),base-h+r,Math.ceil(half*.45),1); }
  R(g,'rgba(0,0,0,.3)',cx-halfW,base,halfW*2,2);
}
function cone(g,cx,base,halfW,h,c1,c2,tip){
  for(let r=0;r<h;r++){ const half=Math.max(1,Math.round(halfW*(r+1)/h)); R(g,(r%4<2)?c1:c2,cx-half,base-h+r,half*2,1); R(g,'rgba(255,255,255,.14)',cx-half,base-h+r,Math.max(1,Math.round(half*.25)),1); R(g,'rgba(0,0,0,.2)',cx+Math.round(half*.5),base-h+r,Math.ceil(half*.5),1); }
  if(tip){ R(g,tip,cx,base-h-6,1,6); }
}
function crenel(g,x,y,w,c,dark){ for(let i=0;i<w-2;i+=6){ R(g,c,x+i,y-3,4,3); R(g,dark,x+i+3,y-3,1,3); } R(g,dark,x,y,w,1); }
function flag(g,t,x,y,c1,c2,len){ len=len||9; R(g,'#4a3a2a',x,y,1,12); R(g,'#e8c24a',x-1,y-1,3,2); for(let i=0;i<len;i++){ const wv=Math.round(Math.sin(t*4+i*.6)*1.4); R(g,(i<3)?c1:c2,x+1+i,y+1+wv,1,4-(i>len-4?1:0)); } }
function winLit(g,x,y,w,h,t,seed){ R(g,'#3a2616',x-1,y-1,w+2,h+2); const on=.5+.5*Math.sin(t*.7+seed); R(g,on>.12?'#ffd36a':'#c89a3a',x,y,w,h); R(g,'#fff0b0',x+1,y+1,Math.max(1,w-2),1); R(g,'#3a2616',x+fl(w/2),y,1,h); if(h>5) R(g,'#3a2616',x,y+fl(h/2),w,1); }
function slit(g,x,y,h){ R(g,'#1c1814',x,y,2,h); R(g,'#ffd36a',x,y+1,2,Math.max(1,h-4)); }
function doorRect(g,x,base,w,h,c){ R(g,'#2a1a10',x-1,base-h-1,w+2,h+1); R(g,c,x,base-h,w,h); R(g,'rgba(0,0,0,.2)',x+fl(w/2),base-h,1,h); R(g,'#e0b84a',x+w-3,base-fl(h/2),2,2); }
function archGate(g,t,cx,base,w,h,portcullis){
  R(g,'#1a1612',cx-w/2,base-h,w,h);
  R(g,'#0e0c0a',cx-w/2+1,base-h+1,w-2,h-1);
  if(portcullis){ for(let i=2;i<w-1;i+=3) R(g,'#7a6a42',cx-w/2+i,base-h+1,1,h-6); for(let j=0;j<h-5;j+=4) R(g,'#7a6a42',cx-w/2+1,base-h+2+j,w-2,1); R(g,'#a8924a',cx-w/2+1,base-h+1,w-2,1); }
  R(g,'#9a9a94',cx-w/2-2,base-h-2,w+4,2); R(g,'#c8c8c0',cx-w/2-2,base-h-2,w+4,1);
}
function torch(g,t,x,y){ R(g,'#3a2a1c',x,y,2,6); const f=2+((t*10+x)%3|0); R(g,'#e8552a',x-1,y-f-1,4,f+1); R(g,'#ffb040',x,y-f,2,f); R(g,'#fff0a0',x,y-1,1,1); R(g,'rgba(255,170,60,'+(.12+.05*Math.sin(t*9+x))+')',x-6,y-9,14,12); }
function smoke(g,t,cx,cy,seed,col){ for(let i=0;i<4;i++){ const q=(t*.35+i*.25+seed)%1, sz=2+Math.round(q*3); R(g,'rgba('+(col||'236,236,236')+','+(.65-q*.65)+')',cx+Math.sin(t*1.6+i*2+seed)*2.5+q*5,cy-q*22,sz,sz); } }
function tree(g,x,B,s,fruit){
  s=s||1; R(g,'rgba(0,0,0,.25)',x-9*s,B-1,18*s,3); R(g,'#6a4528',x-2*s,B-12*s,4*s,12*s); R(g,'#4a2f18',x+1*s,B-12*s,1*s,12*s);
  R(g,'#3f8a3a',x-9*s,B-24*s,18*s,14*s); R(g,'#4f9a3c',x-7*s,B-28*s,14*s,6*s); R(g,'#6fbc54',x-5*s,B-27*s,6*s,3*s); R(g,'#6fbc54',x-8*s,B-20*s,4*s,3*s); R(g,'#2f6e2e',x+2*s,B-17*s,6*s,6*s);
  if(fruit){ [[-5,-22],[2,-25],[5,-19],[-2,-16],[-7,-17]].forEach(p=>R(g,'#e04a3a',x+p[0]*s,B+p[1]*s,2,2)); }
}
function bush(g,x,B,c1,c2){ R(g,c1||'#2f6e2e',x,B-6,12,6); R(g,c2||'#4f9a3c',x+1,B-8,10,4); R(g,'#6fbc54',x+2,B-8,4,2); }
function hedge(g,x,B,w,h){ R(g,'#2a6a2e',x,B-h,w,h); R(g,'#3f8a3a',x,B-h,w,3); for(let i=0;i<w;i+=4) R(g,'#58a848',x+i,B-h+1,2,2); R(g,'rgba(0,0,0,.2)',x,B-3,w,3); }
function lampPost(g,t,x,B){ R(g,'rgba(0,0,0,.25)',x-4,B-1,9,2); R(g,'#3a3a40',x,B-20,2,20); R(g,'#3a3a40',x-2,B-3,6,3); R(g,'#2a2a30',x-3,B-25,8,5); R(g,'#ffd36a',x-2,B-24,6,3); R(g,'rgba(255,220,120,'+(.12+.04*Math.sin(t*4+x))+')',x-8,B-30,18,14); }
function fenceH(g,x,y,w,c){ c=c||'#a07a48'; R(g,c,x,y-4,w,1); R(g,c,x,y-7,w,1); for(let i=0;i<=w;i+=8){ R(g,'#6a4a28',x+i,y-9,2,10); R(g,'#c8a068',x+i,y-9,1,10); } }
function fenceV(g,x,y,h,c){ for(let j=0;j<=h;j+=8){ R(g,'#6a4a28',x,y+j-6,2,8); R(g,'#c8a068',x,y+j-6,1,8); } R(g,c||'#a07a48',x,y,1,h); R(g,c||'#a07a48',x+1,y+3,1,h-6); }
function crops(g,t,x,y,w,h,kind){
  R(g,'#6a4428',x,y,w,h); R(g,'#7a5034',x,y,w,1);
  for(let r=2;r<h;r+=4){ R(g,'#5a3820',x,y+r+1,w,1);
    for(let c=1;c<w-1;c+=4){ const sw=Math.round(Math.sin(t*2+c*.7+r)*.8), py=y+r;
      if(kind==='sprout'){ R(g,'#5ab048',c+x+sw,py-1,2,2); R(g,'#7ad060',c+x+sw,py-2,1,1); }
      else if(kind==='corn'){ R(g,'#4f9a3a',c+x,py-7,2,8); R(g,'#6cbc50',c+x+1+sw,py-5,2,1); R(g,'#e8d050',c+x+sw,py-8,2,2); }
      else if(kind==='wheat'){ R(g,'#c8a838',c+x+sw,py-6,1,7); R(g,'#f0d860',c+x+sw,py-8,2,3); R(g,'#c8a838',c+x+2,py-5,1,6); }
      else{ R(g,'#3f9a48',c+x,py-3,3,3); R(g,'#6cd070',c+x+1,py-4,2,2); }
    } }
}
function scarecrow(g,x,B){ R(g,'#6a4a2a',x,B-14,1,14); R(g,'#6a4a2a',x-5,B-11,11,1); R(g,'#c8a050',x-2,B-18,5,5); R(g,'#8a6a2a',x-3,B-19,7,2); R(g,'#3a8a48',x-2,B-10,5,6); R(g,'#2a1a10',x-1,B-16,1,1); R(g,'#2a1a10',x+1,B-16,1,1); }
function well(g,x,B){ R(g,'rgba(0,0,0,.25)',x-8,B-1,17,3); R(g,'#8a8d94',x-7,B-9,14,9); R(g,'#aaaeb6',x-7,B-9,14,2); R(g,'#6a6d74',x-7,B-3,14,1); R(g,'#1c2a36',x-5,B-10,10,2); R(g,'#6a4a2a',x-7,B-19,2,10); R(g,'#6a4a2a',x+5,B-19,2,10); R(g,'#8a4a30',x-9,B-23,18,4); R(g,'#a85a3a',x-8,B-24,16,2); R(g,'#4a3a2a',x,B-19,1,6); R(g,'#7a5a30',x-1,B-14,3,3); }
function hay(g,x,B){ R(g,'rgba(0,0,0,.22)',x-1,B-1,15,2); R(g,'#c8a838',x,B-9,14,9); R(g,'#e8c850',x,B-9,14,2); R(g,'#a88828',x,B-5,14,1); R(g,'#a88828',x+4,B-9,1,9); R(g,'#a88828',x+9,B-9,1,9); }
function chicken(g,t,x,B,seed){ const px=x+Math.round(Math.sin(t*.8+seed)*10), pk=(Math.floor(t*3+seed)%4===0)?1:0; R(g,'#fff6e8',px,B-4+pk,4,3); R(g,'#fff6e8',px+3,B-6+pk,2,3); R(g,'#e0463a',px+4,B-7+pk,1,1); R(g,'#f0a030',px+5,B-5+pk,1,1); R(g,'#c8a050',px+1,B-1,1,1); R(g,'#c8a050',px+3,B-1,1,1); }
function barn(g,x,B,w,h,roofH){
  const c='#b13a2e'; planks(g,x,B-h,w,h,c,'#8a2a20',5);
  R(g,'#fff1e0',x,B-h,w,1); R(g,'#fff1e0',x,B-1,w,1);
  roofTri(g,x+fl(w/2),B-h,fl(w/2)+3,roofH,'#5a2a1c','#4a2014','#7a4030');
  const dw=Math.round(w*.4), dx=x+fl((w-dw)/2), dh=Math.round(h*.7);
  R(g,'#7a2219',dx,B-dh,dw,dh); R(g,'#fff1e0',dx,B-dh,dw,1); R(g,'#fff1e0',dx,B-1,dw,1); R(g,'#fff1e0',dx,B-dh,1,dh); R(g,'#fff1e0',dx+dw-1,B-dh,1,dh);
  Art.pline(g,'#fff1e0',dx,B-dh,dx+dw-1,B-1,1); Art.pline(g,'#fff1e0',dx+dw-1,B-dh,dx,B-1,1);
  R(g,'#2a1a10',x+fl(w/2)-2,B-h-fl(roofH*.5),4,4);
}
function windmill(g,t,x,B){
  const hh=40;
  R(g,'rgba(0,0,0,.25)',x-11,B-1,22,3);
  for(let r=0;r<hh;r++){ const half=Math.round(10-r*.13); R(g,(r%4<2)?'#e6dcc0':'#d6caa8',x-half,B-r-1,half*2,1); R(g,'rgba(0,0,0,.2)',x+Math.round(half*.3),B-r-1,Math.ceil(half*.7),1); R(g,'rgba(255,255,255,.2)',x-half,B-r-1,2,1); }
  for(let r=0;r<6;r++) R(g,'#8a4a30',x-7+r,B-hh-6+r,14-r*2,1); R(g,'#6a3420',x-3,B-hh-8,6,3);
  doorRect(g,x-4,B,8,12,'#6a4a2a'); R(g,'#3a2616',x-2,B-26,5,6); R(g,'#ffd36a',x-1,B-25,3,4);
  const a=t*1.1, cx=x, cy=B-hh+4, L=30;
  for(let k=0;k<4;k++){ const ang=a+k*Math.PI/2, ex=cx+Math.cos(ang)*L, ey=cy+Math.sin(ang)*L; Art.pline(g,'#6a4a2a',cx,cy,ex,ey,2);
    const px=Math.cos(ang+Math.PI/2), py=Math.sin(ang+Math.PI/2); for(let s2=7;s2<L;s2+=2){ const bx=cx+Math.cos(ang)*s2, by=cy+Math.sin(ang)*s2; R(g,'#f4ecd8',bx+px*2,by+py*2,3,2); R(g,'#e0d6bc',bx+px*4,by+py*4,2,2); R(g,'#d6caa8',bx+px*5,by+py*5,1,1); } }
  R(g,'#8a4a30',cx-3,cy-3,7,7); R(g,'#c8a050',cx-1,cy-1,3,3);
}
function silhouetteHouses(g,seed){ for(let i=0;i<6;i++){ const hx=hash(i+seed)*W, hy=HOR+2+hash(i*3+seed)*4; R(g,'#b8a890',hx,hy-5,8,5); R(g,'#8a5a48',hx-1,hy-8,10,3); } }

/* ---------- fundo comum ---------- */
function backdrop(g,t,L){
  rows(g,['#86c8ee','#9cd4f2','#b4def5','#cbe9f7'],0,HOR);
  R(g,'#fff6b0',216,10,10,10); R(g,'#fffbd8',218,12,6,6);
  [[20,8,18],[96,14,14],[170,5,20]].forEach((c,i)=>{ const cx=((c[0]+t*2.2+i*40)%300)-30; R(g,'#ffffff',cx+4,c[1],c[2],3); R(g,'#ffffff',cx,c[1]+2,c[2]+8,3); });
  for(let x=0;x<W;x++){ const y=HOR-4-Math.floor(7*(Math.sin(x/23)*.6+Math.sin(x/10+2)*.4+1)); R(g,'#8db98a',x,y,1,12); }
  R(g,'#6fa860',0,HOR-3,W,6);
  if(L>=3) silhouetteHouses(g,4);
  R(g,'#7cbc58',0,HOR,W,H-HOR);
  for(let y=HOR;y<H;y+=6) R(g,(y/6&1)?'#76b652':'#7fbf5a',0,y,W,3);
  for(let i=0;i<70;i++){ const tx=hash(i)*W, ty=HOR+3+hash(i*3)*(H-HOR-4); R(g,'#5c9c42',tx,ty,2,1); R(g,'#5c9c42',tx+1,ty-1,1,1); }
  for(let i=0;i<18;i++){ const tx=hash(i+50)*W, ty=HOR+6+hash(i*7)*(H-HOR-10); R(g,['#f0d040','#ffffff','#f08ad0'][i%3],tx,ty,1,1); }
}
function path(g,x,y0,w0,w1){ for(let y=y0;y<H;y++){ const w=Math.round(w0+(w1-w0)*(y-y0)/(H-y0)); R(g,'#c8a672',x-w/2,y,w,1); R(g,'#a88858',x-w/2,y,1,1); R(g,'#a88858',x+w/2-1,y,1,1); if(hash(y*13)<.3) R(g,'#a88858',x-w/2+hash(y*7)*w,y,1,1); } }
function plot(g,t,L){
  const P={x:44,y:60,w:168,h:66};
  R(g,'#8a6038',P.x-2,P.y-2,P.w+4,P.h+4); R(g,'#9a7048',P.x,P.y,P.w,P.h);
  for(let i=0;i<200;i++){ const px=P.x+hash(i)*P.w, py=P.y+hash(i*3+1)*P.h; R(g,hash(i*5)<.5?'#b08858':'#7a5632',px,py,2,1); }
  for(let r=0;r<P.h;r+=6) R(g,'rgba(0,0,0,.05)',P.x,P.y+r,P.w,2);
  return P;
}
function stakesRope(g,P,L){
  const pts=[[P.x,P.y],[P.x+P.w,P.y],[P.x+P.w,P.y+P.h],[P.x,P.y+P.h]];
  [[0,1],[1,2],[2,3],[3,0]].forEach(([a,b])=>Art.pline(g,'#e0d4a8',pts[a][0],pts[a][1]-5,pts[b][0],pts[b][1]-5,1));
  pts.forEach(p=>{ R(g,'rgba(0,0,0,.25)',p[0]-2,p[1],6,2); R(g,'#6a4a2a',p[0],p[1]-9,2,10); R(g,'#c8a068',p[0],p[1]-9,1,10); R(g,'#c0392b',p[0]-1,p[1]-10,4,2); });
}
function noticeBoard(g,x,B,big){
  R(g,'rgba(0,0,0,.25)',x-8,B-1,17,3); R(g,'#5a3a20',x-6,B-14,2,14); R(g,'#5a3a20',x+4,B-14,2,14);
  R(g,'#a07a48',x-8,B-20,17,10); R(g,'#c8a068',x-8,B-20,17,1); R(g,'#6a4a28',x-8,B-11,17,1);
  R(g,'#e8d8a8',x-6,B-18,6,7); R(g,'#e8d8a8',x+1,B-18,6,7); R(g,'#5a8a4a',x-5,B-17,4,3); R(g,'#c0392b',x+2,B-17,4,1); R(g,'#8a7a4a',x+2,B-15,4,1); R(g,'#8a7a4a',x+2,B-13,3,1);
}
function weeds(g,P){ for(let i=0;i<9;i++){ const x=P.x+6+hash(i+30)*(P.w-12), y=P.y+6+hash(i*3+30)*(P.h-12); R(g,'#4f8a38',x,y-3,1,3); R(g,'#6aa848',x+1,y-4,1,4); R(g,'#4f8a38',x+2,y-2,1,2); }
  [[70,100],[150,76],[188,108],[60,78]].forEach(p=>{ R(g,'#7a7a80',p[0],p[1],5,3); R(g,'#a0a0a8',p[0],p[1],3,1); }); }

/* ---------- construções por nível ---------- */
function hut(g,t,cx,B){
  const w=44; planks(g,cx-w/2,B-18,w,18,'#a8774a','#8a5a30',5); R(g,'#6a4424',cx-w/2,B-18,w,2); R(g,'#6a4424',cx-w/2,B-2,w,2);
  roofTri(g,cx,B-18,w/2+4,15,'#8a5a30','#7a4a22','#b07a44');
  R(g,'#7a7a82',cx+10,B-38,6,10); R(g,'#5a5a62',cx+10,B-38,6,2); smoke(g,t,cx+13,B-38,.2);
  doorRect(g,cx-4,B,8,13,'#5a3820'); winLit(g,cx+11,B-13,6,6,t,1);
  R(g,'#3a8a48',cx-w/2+3,B-4,5,4); R(g,'#e8505a',cx-w/2+4,B-5,1,1);
}
function cottage(g,t,cx,B){
  const w=64; planks(g,cx-w/2,B-26,w,26,'#b0804c','#8a5e32',6); R(g,'#6a4424',cx-w/2,B-26,w,2); R(g,'#6a4424',cx-w/2,B-2,w,2); R(g,'#6a4424',cx-w/2,B-26,2,26); R(g,'#6a4424',cx+w/2-2,B-26,2,26);
  roofTri(g,cx,B-26,w/2+5,19,'#8a4a30','#7a3e28','#b06a48');
  bricks(g,cx+14,B-54,8,22,'#9a6a52','#6a4232'); R(g,'#5a3a2a',cx+13,B-55,10,2); smoke(g,t,cx+18,B-55,.1);
  winLit(g,cx-26,B-19,9,8,t,2); R(g,'#4a6a3a',cx-28,B-20,2,10); R(g,'#4a6a3a',cx-17,B-20,2,10);
  winLit(g,cx+17,B-19,9,8,t,3); R(g,'#4a6a3a',cx+15,B-20,2,10); R(g,'#4a6a3a',cx+26,B-20,2,10);
  doorRect(g,cx-5,B,10,17,'#5a3820'); R(g,'#9a9488',cx-8,B,16,2); R(g,'#b8b2a4',cx-8,B,16,1);
  R(g,'#a07a48',cx-12,B-22,24,1);
}
function farmhouse(g,t,cx,B,L){
  const w=L>=5?72:64, h=L>=5?36:30, sh=L>=5?16:12;
  bricks(g,cx-w/2,B-sh,w,sh,'#8a8d94','#6a6d74');
  planks(g,cx-w/2,B-h,w,h-sh,'#d8c49a','#b8a478',8); R(g,'#6a4a2a',cx-w/2,B-h,w,2);
  if(L>=5){ R(g,'#6a4a2a',cx-w/2,B-sh-1,w,1); }
  roofTri(g,cx,B-h,w/2+5,L>=5?22:19,'#a04838','#8a3a2c','#c86850');
  bricks(g,cx+16,B-h-26,8,22,'#9a6a52','#6a4232'); R(g,'#5a3a2a',cx+15,B-h-27,10,2); smoke(g,t,cx+20,B-h-27,.15);
  if(L>=5){ R(g,'#8a3a2c',cx-30,B-h-12,12,12); roofTri(g,cx-24,B-h-12,8,8,'#a04838','#8a3a2c','#c86850'); winLit(g,cx-27,B-h-8,6,5,t,5); winLit(g,cx-20,B-h+4,9,8,t,6); winLit(g,cx+14,B-h+4,9,8,t,7); }
  winLit(g,cx-28,B-sh-(h-sh)+(L>=5?14:6),8,7,t,2); winLit(g,cx+20,B-sh-(h-sh)+(L>=5?14:6),8,7,t,3);
  doorRect(g,cx-5,B,10,16,'#5a3820'); R(g,'#9a9488',cx-8,B,16,2);
}
function manor(g,t,cx,B,L){
  const w=L>=7?64:92, h=L>=7?44:38;
  planks(g,cx-w/2,B-h,w,h,'#e8dcc0','#d4c8a8',12); R(g,'#b8a888',cx-w/2,B-h,w,2); R(g,'#b8a888',cx-w/2,B-3,w,3); shade(g,cx-w/2,B-h,w,h);
  roofTri(g,cx,B-h,w/2+6,L>=7?26:23,L>=7?'#4a5468':'#a04838',L>=7?'#3a4458':'#8a3a2c',L>=7?'#6a7894':'#c86850');
  [-1,1].forEach(s=>{ bricks(g,cx+s*(w/2-14)-3,B-h-26,7,22,'#a07a60','#6a4a38'); R(g,'#5a3a2a',cx+s*(w/2-14)-4,B-h-27,9,2); smoke(g,t,cx+s*(w/2-14),B-h-27,s*.2); });
  const nWin=L>=7?2:3;
  for(let i=0;i<nWin;i++){ [-1,1].forEach(s=>{ const wx=cx+s*(12+i*(L>=7?18:15))-4; winLit(g,wx,B-h+6,8,10,t,i+s); winLit(g,wx,B-h+22,8,10,t,i+s+3); R(g,'#3a6a4a',wx-2,B-h+5,2,12); R(g,'#3a6a4a',wx+8,B-h+5,2,12); }); }
  [-1,1].forEach(s=>{ R(g,'#c8bc9c',cx+s*14-2,B-26,4,26); R(g,'#e8dcc0',cx+s*14-2,B-26,1,26); R(g,'#c8bc9c',cx+s*14-4,B-28,8,3); });
  R(g,'#c8bc9c',cx-16,B-30,32,3); roofTri(g,cx,B-30,18,9,'#c8bc9c','#b8ac8c','#e8dcc0');
  doorRect(g,cx-6,B,12,22,'#5a3820'); R(g,'#2a1a10',cx-6,B-22,12,1); R(g,'#9a9488',cx-14,B,28,3); R(g,'#b8b2a4',cx-14,B,28,1);
  if(L>=7){ wing(g,t,cx-w/2-24,B,48,30,-1,L); wing(g,t,cx+w/2+24,B,48,30,1,L); }
}
function wing(g,t,cx,B,w,h,s,L){
  planks(g,cx-w/2,B-h,w,h,'#e0d4b8','#ccc0a0',12); R(g,'#b8a888',cx-w/2,B-3,w,3);
  roofTri(g,cx,B-h,w/2+5,18,'#4a5468','#3a4458','#6a7894');
  winLit(g,cx-14,B-h+8,8,10,t,s); winLit(g,cx+6,B-h+8,8,10,t,s+2); bricks(g,cx+s*14-3,B-h-20,7,18,'#a07a60','#6a4a38');
}
function squareTower(g,t,x,B,w,h,top,flagc){
  bricks(g,x,B-h,w,h,'#9a9aa2','#74747c'); crenel(g,x-1,B-h,w+2,'#b0b0b8','#74747c');
  R(g,'#8a8a92',x-1,B-h+1,w+2,3);
  slit(g,x+fl(w/2)-1,B-h+10,9); if(h>34) slit(g,x+fl(w/2)-1,B-h+24,9);
  if(flagc) flag(g,t,x+fl(w/2),B-h-13,flagc[0],flagc[1],10);
}
function roundTower(g,t,x,B,w,h,roof,flagc,L){
  for(let r=0;r<h;r++){ R(g,(r%6<3)?'#a4a4ac':'#9898a0',x,B-r-1,w,1); }
  R(g,'rgba(255,255,255,.16)',x,B-h,Math.max(2,fl(w*.2)),h); R(g,'rgba(0,0,0,.2)',x+fl(w*.7),B-h,Math.ceil(w*.3),h);
  for(let r=0;r<h;r+=6){ R(g,'#74747c',x,B-r-1,w,1); }
  R(g,'#8a8a92',x-2,B-h,w+4,3); R(g,'#b0b0b8',x-2,B-h,w+4,1);
  slit(g,x+fl(w/2)-1,B-h+10,9); if(h>46) slit(g,x+fl(w/2)-1,B-h+26,9);
  cone(g,x+fl(w/2),B-h,fl(w/2)+4,roof.h,roof.c1,roof.c2,roof.tip);
  if(flagc) flag(g,t,x+fl(w/2),B-h-roof.h-12,flagc[0],flagc[1],10);
}
function curtain(g,x,B,w,h){ bricks(g,x,B-h,w,h,'#9a9aa2','#74747c'); crenel(g,x,B-h,w,'#b0b0b8','#74747c'); }

function drawFarmLevel(g,t,L){
  backdrop(g,t,L);
  if(L>=2&&L<=5) path(g,128,94,16,36);
  if(L>=6) path(g,128,94,22,50);
  if(L<=5){ const P=plot(g,t,L); if(L===1){ weeds(g,P); stakesRope(g,P,L); noticeBoard(g,128,104,false); } else stakesRope(g,P,L); }
  /* árvores do fundo */
  if(L>=2){ tree(g,22,HOR+30,.9); tree(g,238,HOR+34,1); }
  if(L>=3){ tree(g,40,HOR+18,.8); tree(g,222,HOR+16,.8); }
  switch(L){
   case 2:
    crops(g,t,54,76,42,20,'sprout'); crops(g,t,160,76,42,20,'sprout'); hut(g,t,128,BASE); noticeBoard(g,96,108); break;
   case 3:
    crops(g,t,50,72,38,24,'corn'); crops(g,t,168,72,38,24,'corn'); scarecrow(g,188,98); well(g,64,104); cottage(g,t,128,BASE);
    fenceH(g,44,62,168); fenceV(g,44,62,64); fenceV(g,210,62,64); break;
   case 4:
    crops(g,t,50,74,34,22,'corn'); hay(g,66,104); farmhouse(g,t,118,BASE,4); barn(g,176,BASE,40,30,16); hay(g,214,102); hay(g,198,104);
    tree(g,32,98,1,true); tree(g,226,70,.9,true); chicken(g,t,70,112,1); chicken(g,t,100,118,3); chicken(g,t,160,114,5);
    fenceH(g,44,62,168); fenceV(g,44,62,64); fenceV(g,210,62,64); break;
   case 5:
    windmill(g,t,40,BASE+8); farmhouse(g,t,128,BASE,5); barn(g,176,BASE,46,34,18); hay(g,224,102); hay(g,236,104);
    chicken(g,t,84,112,2); chicken(g,t,150,118,4); chicken(g,t,196,114,6);
    fenceH(g,44,62,168); fenceV(g,44,62,64); fenceV(g,210,62,64); break;
   case 6: manorLevel(g,t,6); break;
   case 7: manorLevel(g,t,7); break;
   case 8: fortLevel(g,t,8); break;
   case 9: fortLevel(g,t,9); break;
   case 10: castleLevel(g,t); break;
  }
}
function manorLevel(g,t,L){
  tree(g,18,HOR+28,1); tree(g,238,HOR+30,1.1); tree(g,36,HOR+16,.8); tree(g,222,HOR+14,.8);
  hedge(g,24,BASE+2,52,8); hedge(g,180,BASE+2,52,8);
  manor(g,t,128,BASE,L);
  const bx=L>=7?[[78,100],[168,100]]:[[88,100],[160,100]];
  R(g,'#6a4a2a',0,0,0,0);
  for(let i=0;i<8;i++){ const fx=70+i*14; R(g,'#3f8a3a',fx,BASE+4,1,3); R(g,['#e8505a','#f0d040','#f08ad0','#ffffff'][i%4],fx-1,BASE+2,3,2); }
  if(L>=7){ [[30,BASE+2],[218,BASE+2]].forEach(p=>{ R(g,'#7a7a82',p[0],p[1]-18,6,18); R(g,'#a0a0a8',p[0],p[1]-18,2,18); R(g,'#c8bc9c',p[0]-1,p[1]-20,8,3); R(g,'#e8c24a',p[0]+1,p[1]-24,4,4); }); topiary(g,60,BASE+8); topiary(g,196,BASE+8); }
}
function topiary(g,x,B){ R(g,'#6a4528',x-1,B-5,3,5); R(g,'#2a6a2e',x-4,B-12,9,8); R(g,'#3f8a3a',x-3,B-16,7,5); R(g,'#58a848',x-1,B-18,3,3); R(g,'#58a848',x-3,B-12,2,2); }
function fortLevel(g,t,L){
  tree(g,12,HOR+34,1.1); tree(g,244,HOR+34,1.1);
  if(L===8){
    /* solar fortificado: muralha, torres, gatehouse e o casarão ao fundo */
    manor(g,t,128,BASE-8,6);
    curtain(g,20,BASE+2,216,22);
    squareTower(g,t,18,BASE+2,28,56,['#c0392b','#e8c24a'],['#c0392b','#e8c24a']);
    squareTower(g,t,210,BASE+2,28,56,null,['#2a6ad0','#e8c24a']);
    squareTower(g,t,100,BASE+2,56,42,null,null);
    archGate(g,t,128,BASE+2,18,22,true); torch(g,t,112,BASE-16); torch(g,t,144,BASE-16);
    [[40,'#c0392b'],[78,'#2a6ad0'],[172,'#c0392b'],[198,'#2a6ad0']].forEach(b=>{ R(g,'#e8c24a',b[0],BASE-16,5,1); R(g,b[1],b[0],BASE-15,5,10); R(g,b[1],b[0]+1,BASE-5,3,2); });
    flag(g,t,128,BASE-54,'#c0392b','#e8c24a',10);
  }else{
    /* fortaleza: torre de menagem, torres redondas, fosso e ponte */
    R(g,'#5aa8dc',24,BASE+4,208,10); R(g,'#8ac8f0',24,BASE+4,208,1); for(let i=0;i<18;i++) R(g,'#cfeaff',30+((i*13+t*10)%196),BASE+6+(i%3)*2,3,1); R(g,'#6a6a70',24,BASE+14,208,2);
    curtain(g,34,BASE+2,188,26);
    squareTower(g,t,94,BASE+2,68,58,null,null); R(g,'#8a8a92',94,BASE-58,68,0);
    for(let i=0;i<3;i++) slit(g,104+i*22,BASE-50,10);
    for(let i=0;i<3;i++) slit(g,104+i*22,BASE-30,9);
    roundTower(g,t,50,BASE+2,28,54,{h:20,c1:'#3a5a9a',c2:'#2e4a82',tip:'#e8c24a'},['#2a6ad0','#e8c24a'],L);
    roundTower(g,t,178,BASE+2,28,54,{h:20,c1:'#3a5a9a',c2:'#2e4a82',tip:'#e8c24a'},['#c0392b','#e8c24a'],L);
    flag(g,t,128,BASE-72,'#c0392b','#e8c24a',12);
    archGate(g,t,128,BASE+2,20,24,false); torch(g,t,110,BASE-12); torch(g,t,148,BASE-12);
    /* ponte levadiça */
    R(g,'#5a3a20',116,BASE+3,24,13); for(let i=0;i<24;i+=4) R(g,'#7a5030',116+i,BASE+3,3,13); R(g,'#3a2a1c',116,BASE+3,24,1);
    R(g,'#6a6a70',116,BASE+15,24,2); R(g,'#8a8a92',112,BASE+14,4,5); R(g,'#8a8a92',140,BASE+14,4,5);
  }
}
function castleLevel(g,t){
  /* luz dourada ao fundo */
  for(let i=0;i<7;i++){ const a=-1.2+i*.4+Math.sin(t*.3)*.05; Art.pline(g,'rgba(255,230,140,.10)',128,6,128+Math.cos(a+1.57)*130,6+Math.sin(a+1.57)*130,3); }
  tree(g,10,HOR+34,1.2); tree(g,246,HOR+34,1.2);
  /* fosso */
  R(g,'#4a98d0',16,BASE+4,224,10); R(g,'#8ac8f0',16,BASE+4,224,1); for(let i=0;i<22;i++) R(g,'#e8f6ff',22+((i*11+t*9)%212),BASE+6+(i%3)*2,3,1); R(g,'#6a6a70',16,BASE+14,224,2);
  curtain(g,26,BASE+2,204,30);
  /* torres */
  const blue={h:20,c1:'#2e5ab0',c2:'#224a96',tip:'#e8c24a'};
  roundTower(g,t,26,BASE+2,26,50,blue,['#2a6ad0','#e8c24a'],10);
  roundTower(g,t,204,BASE+2,26,50,blue,['#c0392b','#e8c24a'],10);
  roundTower(g,t,64,BASE+2,24,60,blue,['#c0392b','#e8c24a'],10);
  roundTower(g,t,168,BASE+2,24,60,blue,['#2a6ad0','#e8c24a'],10);
  /* torre de menagem dourada */
  bricks(g,92,BASE-66,72,68,'#b8b4a8','#8a867a'); crenel(g,91,BASE-66,74,'#d8d4c8','#8a867a'); R(g,'#e8c24a',92,BASE-66,72,2);
  cone(g,128,BASE-68,22,20,'#2e5ab0','#224a96','#e8c24a'); R(g,'#e8c24a',104,BASE-68,48,2);
  flag(g,t,97,BASE-78,'#c0392b','#e8c24a',12); flag(g,t,159,BASE-78,'#2a6ad0','#e8c24a',12);
  for(let r=0;r<3;r++) for(let c=0;c<3;c++){ winLit(g,102+c*21,BASE-58+r*15,8,9,t,r*3+c); R(g,'#e8c24a',101+c*21,BASE-59+r*15,10,1); }
  R(g,'#e8c24a',92,BASE-26,72,1);
  /* portão dourado */
  archGate(g,t,128,BASE+2,24,28,true); R(g,'#e8c24a',114,BASE-30,28,2); torch(g,t,108,BASE-14); torch(g,t,148,BASE-14);
  /* estandartes */
  [[84,'#c0392b'],[160,'#2a6ad0'],[100,'#2a6ad0'],[144,'#c0392b']].forEach((b,i)=>{ const w=Math.round(Math.sin(t*2.5+i)*1); R(g,'#e8c24a',b[0]-1,BASE-22,7,1); R(g,b[1],b[0]+w,BASE-21,5,13); R(g,'#e8c24a',b[0]+w+1,BASE-17,3,3); });
  /* ponte de pedra */
  R(g,'#9a9a94',112,BASE+3,32,14); R(g,'#b8b8b2',112,BASE+3,32,2); for(let i=0;i<32;i+=8) R(g,'#7a7a74',112+i,BASE+5,1,10);
  R(g,'#7a7a74',108,BASE+3,4,14); R(g,'#7a7a74',144,BASE+3,4,14);
  /* jardim real */
  topiary(g,60,BASE+14); topiary(g,196,BASE+14); topiary(g,44,BASE+22); topiary(g,212,BASE+22);
  for(let i=0;i<14;i++){ const px=22+hash(i+90)*212, py=BASE+16+hash(i*3+90)*16; R(g,['#e8505a','#f0d040','#f08ad0','#ffffff'][i%4],px,py,2,2); }
  /* brilhos dourados e pássaros */
  for(let i=0;i<22;i++){ const sx=hash(i+5)*W, sy=((t*8+hash(i*5)*H)%H); if(Math.sin(t*3+i)>.2) R(g,'#fff2b0',sx,sy*0.7,1,1); }
  for(let i=0;i<3;i++){ const bx=((t*18+i*90)%320)-30, by=14+i*9+Math.sin(t*3+i)*2, f=(Math.floor(t*6+i)%2); R(g,'#2a2a30',bx,by,2,1); R(g,'#2a2a30',bx+2,by-f,2,1); R(g,'#2a2a30',bx-2,by-f,2,1); }
}

/* ---------- API de cenário (usado pelo Town) ---------- */
function labelFor(L){ return '🏡 '+Core.FARM[L-1].name+' · Nível '+L; }
function factory(opts){
  const L=Math.max(1,Math.min(10,(opts&&opts.level)||1));
  const obstacles=[];
  const props=t=>{ const out=[];
    if(L>=6) out.push({y:104,draw:g=>lampPost(g,t,98,104)},{y:104,draw:g=>lampPost(g,t,158,104)});
    out.push({y:140,draw:g=>tree(g,14,140,1.1,L>=4)},{y:140,draw:g=>tree(g,242,140,1.1,L>=4)});
    if(L>=3) out.push({y:138,draw:g=>bush(g,40,138)},{y:138,draw:g=>bush(g,206,138)});
    return out; };
  const doorY=(L===9||L===10)?106:98;
  return {
    level:L, bounds:{x0:8,x1:248,y0:L>=9?(L===9?108:110):98,y1:137}, start:{x:128,y:L>=9?120:118}, obstacles,
    zones:[{id:'house',x:112,y:L>=9?108:98,w:32,h:14,label:'Fazenda',prompt:L===1?'Ler o quadro de obras':(L===10?'Ver as obras':'Entregar materiais')}],
    labels:[{x:128,y:6,text:labelFor(L),zone:'house'}],
    npcs:[{x0:30,x1:226,y:128,sp:8,pal:'pale',size:15}],
    draw(g,t){ drawFarmLevel(g,t,L); },
    props
  };
}
Town.register('farm',factory);

/* =====================================================================
   CERIMÔNIA DE CONSTRUÇÃO (tela cheia) quando a fazenda sobe de nível
   ===================================================================== */
const Build=(function(){
  let root,cv,g,titleEl,subEl,descEl,btn,active=false,et=0,from=1,to=2,onDone=null,raf=0,lastTs=0,flash=0,shake=0,burstDone=false;
  let P=[],rockets=[],dust=[];
  const buf=document.createElement('canvas'); buf.width=W; buf.height=H; const bg=buf.getContext('2d');
  function init(el){ root=el.root; cv=el.canvas; g=cv.getContext('2d'); g.imageSmoothingEnabled=false; titleEl=el.title; subEl=el.sub; descEl=el.desc; btn=el.btn; btn.onclick=close; }
  function fit(){ const sc=Math.max(1,Math.min(innerWidth/W,(innerHeight-170)/H)); const s=sc>=2?Math.floor(sc):sc; cv.style.width=Math.round(W*s)+'px'; cv.style.height=Math.round(H*s)+'px'; }
  function start(f,tt,done){
    if(active) return; active=true; from=f; to=tt; onDone=done; et=0; flash=0; shake=0; burstDone=false; P=[]; rockets=[]; dust=[];
    root.classList.add('cg-show'); btn.style.display='none'; titleEl.style.opacity=0; subEl.style.opacity=0; descEl.style.opacity=0;
    const F=Core.FARM[to-1]; titleEl.textContent=to===10?'O CASTELO FICOU PRONTO!':'FAZENDA MELHORADA!'; subEl.textContent=F.name+' · Nível '+to; descEl.textContent=F.desc;
    fit(); addEventListener('resize',fit); lastTs=0; cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
  }
  function close(){ if(!active) return; active=false; root.classList.remove('cg-show'); removeEventListener('resize',fit); cancelAnimationFrame(raf); if(onDone) onDone(); }
  function loop(ts){ if(!active) return; const dt=Math.min(.05,lastTs?(ts-lastTs)/1000:.016); lastTs=ts; et+=dt; try{ draw(dt); }catch(e){ console.error('Build',e); } raf=requestAnimationFrame(loop); }
  const T1=1.6, T2=3.6; /* fase 1: preparação · fase 2: construção subindo · depois: celebração */
  function puff(x,y,n,col){ for(let i=0;i<n&&dust.length<240;i++) dust.push({x:x+(Math.random()-.5)*10,y,vx:(Math.random()-.5)*40,vy:-8-Math.random()*22,life:.7+Math.random()*.6,sz:3+((Math.random()*5)|0),c:col||'226,214,190'}); }
  function spark(x,y,n,cols,spd){ for(let i=0;i<n&&P.length<420;i++){ const a=Math.random()*6.283,s=(.4+Math.random()*.6)*spd; P.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,g:70,life:.8+Math.random()*.8,c:cols[(Math.random()*cols.length)|0],sz:Math.random()<.5?2:1}); } }
  function launch(){ rockets.push({x:30+Math.random()*196,y:H,vy:-95-Math.random()*40,fuse:.55+Math.random()*.4,c:[['#ffd24d','#fff2b0'],['#ff7a8a','#ffd0d8'],['#7ad0ff','#d8f0ff'],['#b6ff8a','#eaffd8']][(Math.random()*4)|0]}); }
  function draw(dt){
    const ox=shake>0?Math.round((Math.random()-.5)*3):0, oy=shake>0?Math.round((Math.random()-.5)*2):0; if(shake>0) shake-=dt;
    g.setTransform(1,0,0,1,0,0); g.fillStyle='#000'; g.fillRect(0,0,W,H);
    g.save(); g.translate(ox,oy);
    if(et<T1){
      /* preparação: a fazenda antiga treme e o céu escurece com luzes convergindo */
      drawFarmLevel(g,et,from);
      const k=et/T1; g.fillStyle='rgba(10,8,20,'+(.55*k)+')'; g.fillRect(-4,-4,W+8,H+8);
      for(let i=0;i<26;i++){ const a=hash(i)*6.283+et*1.5, r=(1-((et*.9+hash(i*7))%1))*110; g.fillStyle=i%2?'#ffe58a':'#ffffff'; g.fillRect(Math.round(128+Math.cos(a)*r),Math.round(70+Math.sin(a)*r*.6),1+(i%3===0),1+(i%3===0)); }
      if(Math.random()<.25+k*.4) puff(30+Math.random()*196,BASE+4,1);
      shake=Math.max(shake,k>.4?.05:0);
    }else if(et<T2){
      /* construção: o novo nível sobe do chão, com andaimes de luz e poeira */
      const k=(et-T1)/(T2-T1), e=1-Math.pow(1-k,2), cut=Math.round(H*(1-e));
      drawFarmLevel(g,et,from);
      bg.setTransform(1,0,0,1,0,0); bg.clearRect(0,0,W,H);
      drawFarmLevel(bg,et,to); g.drawImage(buf,0,cut,W,H-cut,0,cut,W,H-cut);
      g.fillStyle='#ffe58a'; g.fillRect(0,cut,W,1); g.fillStyle='rgba(255,226,138,.35)'; g.fillRect(0,cut-3,W,3);
      for(let x=4;x<W;x+=12){ g.fillStyle='rgba(255,226,138,.5)'; g.fillRect(x,cut,1,Math.min(26,H-cut)); }
      if(Math.random()<.9) puff(10+Math.random()*236,Math.min(H-4,cut+4),2,'240,226,180');
      if(Math.random()<.4) spark(10+Math.random()*236,cut,3,['#ffe58a','#fff6c8','#ffffff'],70);
      if(Math.floor(et*10)%3===0) shake=Math.max(shake,.04);
      /* martelo: faíscas pontuais */
      if(Math.floor(et*7)%2===0&&Math.random()<.5) spark(40+Math.random()*176,Math.min(H-6,cut+10),4,['#ffd24d','#ff9a3a'],60);
    }else{
      const rv=et-T2;
      drawFarmLevel(g,et,to);
      if(!burstDone){ burstDone=true; flash=1; shake=.35; for(let i=0;i<4;i++) puff(40+i*60,BASE+6,6,'255,240,200'); spark(128,70,70,['#ffe58a','#fff6c8','#ffd24d','#ffffff'],130); }
      /* anel de luz */
      if(rv<1.2){ const r=Math.round(rv*120); Art.pcircle(g,'rgba(255,229,138,'+(1-rv/1.2)+')',128,72,r,false); Art.pcircle(g,'rgba(255,255,255,'+(.8-rv/1.2)+')',128,72,Math.max(1,r-5),false); }
      /* fogos de artifício (mais no nível 10) */
      const rate=to===10?.16:.07; if(rv<(to===10?6:3.2) && Math.random()<rate) launch();
      if(rv>.4){ titleEl.style.opacity=1; } if(rv>1) subEl.style.opacity=1; if(rv>1.5) descEl.style.opacity=1; if(rv>2.1) btn.style.display='inline-block';
      if(to===10){ for(let i=0;i<40;i++){ const x=hash(i)*W+Math.sin(rv*2+i)*6, y=((rv*34+hash(i*7)*H)%H); g.fillStyle=['#e8c24a','#ffd24d','#fff6c8'][i%3]; g.fillRect(Math.round(x),Math.round(y),2,3); } }
    }
    /* foguetes */
    for(let i=rockets.length-1;i>=0;i--){ const r=rockets[i]; r.y+=r.vy*dt; r.fuse-=dt; g.fillStyle='#fff2b0'; g.fillRect(Math.round(r.x),Math.round(r.y),1,3); g.fillStyle='rgba(255,200,100,.5)'; g.fillRect(Math.round(r.x),Math.round(r.y)+3,1,4);
      if(r.fuse<=0){ spark(r.x,r.y,70,r.c,105); spark(r.x,r.y,22,['#ffffff'],55); rockets.splice(i,1); } }
    dust.forEach(d=>{ d.life-=dt; d.x+=d.vx*dt; d.y+=d.vy*dt; g.fillStyle='rgba('+d.c+','+Math.max(0,Math.min(.8,d.life))+')'; g.fillRect(Math.round(d.x),Math.round(d.y),d.sz,d.sz); });
    dust=dust.filter(d=>d.life>0);
    P.forEach(p=>{ p.life-=dt; p.vy+=p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; g.globalAlpha=Math.max(0,Math.min(1,p.life*2)); g.fillStyle=p.c; g.fillRect(Math.round(p.x),Math.round(p.y),p.sz,p.sz); });
    g.globalAlpha=1; P=P.filter(p=>p.life>0);
    g.restore();
    if(flash>0){ g.fillStyle='rgba(255,255,255,'+Math.min(1,flash)+')'; g.fillRect(0,0,W,H); flash-=dt*1.4; }
  }
  return {init,start,close,get active(){return active;}};
})();

return {drawLevel:drawFarmLevel,factory,Build,HOR,BASE};
})();
root.Genesis.Farm=Farm;
})(typeof window!=='undefined'?window:globalThis);
