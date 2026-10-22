/* =========================================================
   CHESS GENESIS — INTERFACE, SALVAMENTO E PONTE COM O SITE
   Arquivo: genesis/genesis.js
   Depende de: core.js, art.js, stage.js (carregados antes)

   O index.html só precisa chamar:
     Genesis.UI.mount(elemento, adaptador)   // uma vez
     Genesis.UI.setUser(usuario|null)        // quando o login muda
     Genesis.UI.setActive(true|false)        // quando a aba Campanha abre/fecha
     Genesis.UI.flush()                      // salvar já (ex.: antes de sair)

   adaptador = {
     load(uid)        -> Promise<objeto|null>   (lê users/{uid}/genesis)
     save(uid, dados) -> Promise                (grava users/{uid}/genesis)
     openLogin()      -> abre a tela de login do site
   }
   ========================================================= */
(function(root){
"use strict";
const G=root.Genesis, Core=G.Core, Art=G.Art, Stage=G.Stage;
const LS_PREFIX='chessGenesis_v2_';
const CLOUD_EVERY_MS=30000;
const DEV=/[?&]genesis=teste/.test(location.search)||(function(){ try{ return localStorage.getItem('cgDev')==='1'; }catch(e){ return false; } })();

let host=null, adapter=null, mounted=false;
let S=null, user=null, uid=null;
let active=false, speed=1, paused=false;
let lastTs=0, lastUi=0, lastLocal=0, lastCloud=0, dirty=false, lastAuto=0, pendingOff=null, loadToken=0;
let rafId=0, tickId=0, loadingUid=null, cloudBlocked=false;
const $=id=>document.getElementById('cg-'+id);
const fmt=Core.fmt;
const refs={hunts:[],upg:{},gear:{},forms:[]};

/* ---------- HTML do módulo ---------- */
const HTML=`
<div class="rank-head"><div>
  <h2>♞ <span style="color:var(--gold);">CHESS GENESIS</span></h2>
  <p>Faça sua peça evoluir de Peão a Rei. Ela luta sozinha, até quando você está fora. Volte todo dia para ver o progresso.</p>
</div></div>

<div class="cg-card cg-msg" id="cg-msg" style="display:none"></div>

<div id="cg-main" style="display:none">
  <div class="cg-stats">
    <div class="cg-card cg-stat"><div class="cg-lbl">Ouro</div><div class="cg-val" id="cg-sGold">0</div><div class="cg-sub" id="cg-sGoldRate"></div></div>
    <div class="cg-card cg-stat"><div class="cg-lbl">Nível</div><div class="cg-val" id="cg-sLevel">1</div><div class="cg-bar"><i id="cg-sXpBar"></i></div><div class="cg-sub" id="cg-sXp"></div></div>
    <div class="cg-card cg-stat"><div class="cg-lbl">Forma</div><div class="cg-val" id="cg-sForm">Peão</div><div class="cg-sub" id="cg-sNext"></div></div>
    <div class="cg-card cg-stat"><div class="cg-lbl">Abates</div><div class="cg-val" id="cg-sKills">0</div><div class="cg-sub" id="cg-sDeaths"></div></div>
  </div>

  <div class="cg-layout">
    <div>
      <div class="cg-card cg-stagecard" id="cg-stageCard">
        <div class="cg-stagewrap" id="cg-stageWrap">
          <canvas id="cg-stage" width="256" height="144"></canvas>
          <div class="cg-hud">
            <div class="cg-huntname" id="cg-huntName"></div>
            <div class="cg-ubar cg-hero" id="cg-hBar"><div class="cg-nm" id="cg-hName">Você</div><div class="cg-trk"><i id="cg-hFill"></i></div></div>
            <div class="cg-ubar cg-foe" id="cg-eBar"><div class="cg-nm" id="cg-eName"></div><div class="cg-trk"><i id="cg-eFill"></i></div></div>
            <div class="cg-floats" id="cg-floats"></div>
            <div class="cg-status" id="cg-status"></div>
          </div>
        </div>
        <div class="cg-herostats" id="cg-heroStats"></div>
        <div class="cg-passive" id="cg-passive"></div>
      </div>
    </div>

    <div>
      <div class="cg-tabs" id="cg-tabs">
        <button class="cg-tab cg-on" data-tab="hunt">Caçadas</button>
        <button class="cg-tab" data-tab="train">Treino</button>
        <button class="cg-tab" data-tab="gear">Equip.</button>
        <button class="cg-tab" data-tab="hero">Herói</button>
        ${DEV?'<button class="cg-tab" data-tab="test">Teste</button>':''}
      </div>
      <div class="cg-card">
        <div class="cg-panel cg-on" id="cg-p-hunt"></div>
        <div class="cg-panel" id="cg-p-train"></div>
        <div class="cg-panel" id="cg-p-gear"></div>
        <div class="cg-panel" id="cg-p-hero"></div>
        ${DEV?`<div class="cg-panel" id="cg-p-test">
          <div class="cg-nm2">Velocidade do jogo</div>
          <div class="cg-btnrow" id="cg-speedBtns"><button class="cg-btn cg-small cg-on" data-speed="1">×1</button><button class="cg-btn cg-small" data-speed="10">×10</button><button class="cg-btn cg-small" data-speed="50">×50</button></div>
          <div class="cg-nm2">Ver as evoluções</div>
          <div class="cg-btnrow" id="cg-evoBtns"></div>
          <div class="cg-nm2">Progresso offline</div>
          <div class="cg-btnrow"><button class="cg-btn cg-small" data-off="3600">Simular 1 hora</button><button class="cg-btn cg-small" data-off="28800">Simular 8 horas</button></div>
          <div class="cg-nm2">Outros</div>
          <div class="cg-btnrow"><button class="cg-btn cg-small" id="cg-btnGold">+100 mil ouro</button><button class="cg-btn cg-small" id="cg-btnLvl">+5 níveis</button><button class="cg-btn cg-small cg-danger" id="cg-btnReset">Reiniciar progresso</button></div>
          <p class="cg-hint">Ferramentas de teste (aparecem só com ?genesis=teste na URL). O que você fizer aqui também é salvo.</p>
        </div>`:''}
      </div>
    </div>
  </div>
</div>

<div class="cg-toasts" id="cg-toasts"></div>
<div class="cg-overlay" id="cg-offline"><div class="cg-modal">
  <h2>♞ Bem-vindo de volta!</h2>
  <div class="cg-line" id="cg-offTime"></div><div class="cg-line" id="cg-offKills"></div><div class="cg-line" id="cg-offGold"></div><div class="cg-line" id="cg-offLv"></div>
  <button class="cg-btn cg-on" style="margin-top:14px;width:100%" id="cg-offOk">Continuar</button>
</div></div>
<div class="cg-evo" id="cg-evo">
  <canvas id="cg-evoCv" width="192" height="108"></canvas>
  <div class="cg-evotxt"><h2 id="cg-evoTitle">EVOLUÇÃO!</h2><div class="cg-evosub" id="cg-evoSub"></div><div class="cg-evoskill" id="cg-evoSkill"></div><button class="cg-btn cg-on" id="cg-evoBtn" style="display:none;padding:9px 26px;font-size:15px">Continuar</button></div>
</div>`;

/* ---------- utilidades ---------- */
function toast(msg,bad){
  const box=$('toasts'); if(!box) return;
  const t=document.createElement('div'); t.className='cg-toast'+(bad?' cg-bad':''); t.innerHTML=msg; box.appendChild(t); setTimeout(()=>t.remove(),4200);
  while(box.children.length>3) box.firstChild.remove();
}
function showMsg(html){ const m=$('msg'); m.innerHTML=html; m.style.display='block'; $('main').style.display='none'; }
function hideMsg(){ $('msg').style.display='none'; $('main').style.display='block'; }
function fitStage(){
  const card=$('stageCard'); if(!card||!card.clientWidth) return;
  const avail=card.clientWidth-24; let sc=Math.floor(avail/256);
  let w=sc>=1?256*Math.min(sc,4):avail;
  $('stage').style.width=w+'px'; $('stage').style.height=(w*144/256)+'px';
  $('stageWrap').style.setProperty('--s',(w/512).toFixed(3));
}

/* ---------- salvar / carregar ---------- */
function serialize(){
  const o={v:2,level:S.level,xp:S.xp,gold:S.gold,upg:Object.assign({},S.upg),gear:{},hunt:S.hunt,autoHunt:!!S.autoHunt,kills:S.kills,deaths:S.deaths,lastSave:Date.now()};
  Core.SLOTS.forEach(s=>{ const it=S.gear[s]; if(it) o.gear[s]={slot:it.slot,tier:it.tier,rar:it.rar}; });
  if(S.pendingEvo) o.pendingEvo={from:S.pendingEvo.from,to:S.pendingEvo.to};
  return o;
}
const num=(v,d,min,max)=>{ v=Number(v); if(!isFinite(v)) return d; return Math.min(max,Math.max(min,v)); };
function hydrate(o){
  if(!o||o.v!==2||typeof o!=='object') return null;
  const s=Core.newState();
  s.level=Math.floor(num(o.level,1,1,Core.MAXLV));
  s.xp=num(o.xp,0,0,1e300); s.gold=num(o.gold,0,0,1e300);
  Core.UPGS.forEach(u=>{ s.upg[u.id]=Math.floor(num(o.upg&&o.upg[u.id],0,0,u.max)); });
  Core.SLOTS.forEach(sl=>{ const it=o.gear&&o.gear[sl]; if(it) s.gear[sl]={slot:sl,tier:Math.floor(num(it.tier,0,0,5)),rar:Math.floor(num(it.rar,0,0,3))}; });
  s.hunt=Math.floor(num(o.hunt,0,0,Core.HUNTS.length-1)); if(s.level<Core.HUNTS[s.hunt].min) s.hunt=0;
  s.autoHunt=o.autoHunt!==false;
  s.kills=Math.floor(num(o.kills,0,0,1e15)); s.deaths=Math.floor(num(o.deaths,0,0,1e15));
  s.lastSave=num(o.lastSave,Date.now(),0,Date.now()+60000);
  if(o.pendingEvo&&Core.FORMS[o.pendingEvo.to]) s.pendingEvo={from:Math.floor(num(o.pendingEvo.from,0,0,5)),to:Math.floor(num(o.pendingEvo.to,1,0,5))};
  s.phase='walk'; s.pt=0; Core.spawn(s);
  s.heroHp=Core.derive(s).maxHp;
  return s;
}
function saveLocal(){ if(!S||!uid) return; try{ localStorage.setItem(LS_PREFIX+uid,JSON.stringify(serialize())); }catch(e){} }
async function saveCloud(){
  if(!S||!uid||!adapter||cloudBlocked) return;
  const id=uid, data=JSON.parse(JSON.stringify(serialize()));
  try{ await adapter.save(id,data); dirty=false; lastCloud=Date.now(); }catch(e){ console.warn('Genesis: falha ao salvar na nuvem',e); }
}
async function flush(){ if(!S||!uid) return; saveLocal(); await saveCloud(); }

async function loadProgress(u){
  const token=++loadToken; const id=u.uid;
  showMsg('Carregando seu progresso…');
  let remote=null, local=null, readFailed=false;
  try{ remote=await adapter.load(id); }catch(e){ readFailed=true; console.warn('Genesis: falha ao ler da nuvem',e); }
  try{ local=JSON.parse(localStorage.getItem(LS_PREFIX+id)||'null'); }catch(e){}
  if(token!==loadToken) return; // outro login chegou no meio
  const rs=hydrate(remote), ls=hydrate(local);
  /* leitura falhou, ou existe dado na nuvem que não consegui entender:
     NUNCA começa do zero por cima de um progresso que não pude ver */
  const unsafe=readFailed || (remote!=null && !rs);
  if(unsafe && !ls){
    showMsg('<h3>Não consegui <span>ler seu progresso</span></h3><p class="cg-dim" style="margin:6px 0 12px">Verifique sua conexão. Seu progresso na nuvem não foi alterado.</p><button class="cg-btn cg-on" id="cg-retry">Tentar de novo</button>');
    const b=$('retry'); if(b) b.onclick=()=>{ if(token===loadToken) loadProgress(u); };
    return;
  }
  let pick=null;
  if(rs&&ls) pick=(ls.lastSave>rs.lastSave)?ls:rs; else pick=rs||ls;
  const fresh=!pick;
  cloudBlocked=unsafe; // sem leitura da nuvem, só salva neste navegador
  S=pick||Core.newState(); uid=id; user=u;
  hideMsg(); fitStage();
  if(!fresh){ const away=(Date.now()-S.lastSave)/1000; if(away>60){ const r=Core.applyOffline(S,away); if(r.gold>1) pendingOff=r; } }
  S.lastSave=Date.now(); lastTs=performance.now(); lastCloud=Date.now();
  buildGenerated(); update(true); saveLocal(); dirty=true;
  if(fresh) saveCloud();
  if(unsafe) toast('Sem conexão com a nuvem: o progresso está sendo salvo só neste navegador por enquanto.',true);
  if(active) afterShow();
}

/* ---------- construção da interface (uma vez) ---------- */
function spriteCanvas(i){ const s=Art.heroSprite(i); const c=document.createElement('canvas'); c.width=s.w; c.height=s.h; c.getContext('2d').drawImage(s.cv,0,0); return c; }
function buildStatic(){
  host.innerHTML=HTML;
  // caçadas
  const box=$('p-hunt'); let lastTier=-1;
  const au=document.createElement('label'); au.className='cg-auto';
  au.innerHTML='<input type="checkbox" id="cg-autoHunt"><span><b>Caça automática</b><br><span class="cg-dim">O herói vai sozinho para a melhor caçada que consegue vencer.</span></span>';
  box.appendChild(au);
  au.querySelector('input').onchange=e=>{ if(!S) return; S.autoHunt=e.target.checked; if(S.autoHunt){ const b=Core.bestHunt(S); if(b!==S.hunt) Core.selectHunt(S,b); } dirty=true; update(true); };
  Core.HUNTS.forEach((h,i)=>{
    if(h.tier!==lastTier){ lastTier=h.tier; const d=document.createElement('div'); d.className='cg-tier'; d.textContent=Core.TIERS[h.tier].icon+' Tier '+(h.tier+1)+' · '+Core.TIERS[h.tier].name; box.appendChild(d); }
    const r=document.createElement('div'); r.className='cg-row';
    const en=h.kinds.map(k=>Core.KINDS[k].name).join(', ');
    r.innerHTML='<div><div class="cg-nm">'+h.name+'<span class="cg-tag cg-lv"></span></div><div class="cg-ds">Nível '+h.lo+'–'+h.hi+' · '+en+'</div></div><div><button class="cg-btn cg-small cg-go">Caçar</button></div>';
    box.appendChild(r);
    const rf={root:r,lv:r.querySelector('.cg-lv'),go:r.querySelector('.cg-go')};
    rf.go.onclick=()=>{ if(S&&Core.selectHunt(S,i)){ S.autoHunt=false; dirty=true; toast('Seu herói parte para <b>'+h.name+'</b>. (caça automática desligada)'); update(true); } };
    refs.hunts.push(rf);
  });
  // treino
  const tb=$('p-train');
  Core.UPGS.forEach(u=>{
    const r=document.createElement('div'); r.className='cg-row';
    r.innerHTML='<div><div class="cg-nm">'+u.icon+' '+u.name+' <span class="cg-tag cg-lv"></span></div><div class="cg-ds">'+u.desc+'</div></div><div><button class="cg-btn cg-small cg-buy"></button></div>';
    tb.appendChild(r);
    const rf={lv:r.querySelector('.cg-lv'),buy:r.querySelector('.cg-buy')};
    rf.buy.onclick=()=>{ if(S&&Core.buyUpg(S,u.id)){ dirty=true; update(true); } };
    refs.upg[u.id]=rf;
  });
  const p1=document.createElement('p'); p1.className='cg-hint'; p1.textContent='O ouro vem dos abates. Cada melhoria deixa o herói mais forte em qualquer caçada.'; tb.appendChild(p1);
  // equipamentos
  const gb=$('p-gear');
  Core.SLOTS.forEach(s=>{
    const d=document.createElement('div'); d.className='cg-slot'; d.innerHTML='<div class="cg-t"></div><div class="cg-n"></div><div class="cg-b"></div>'; gb.appendChild(d);
    refs.gear[s]={t:d.querySelector('.cg-t'),n:d.querySelector('.cg-n'),b:d.querySelector('.cg-b')};
  });
  const p2=document.createElement('p'); p2.className='cg-hint'; p2.textContent='Inimigos podem largar equipamentos (elites largam mais). O melhor é equipado sozinho e o resto é vendido por ouro.'; gb.appendChild(p2);
  // herói / formas
  const hb=$('p-hero');
  Core.FORMS.forEach((f,i)=>{
    const r=document.createElement('div'); r.className='cg-form';
    r.appendChild(spriteCanvas(i));
    const d=document.createElement('div'); d.innerHTML='<div class="cg-nm">'+f.name+' <span class="cg-tag">nível '+f.lv+(i===5?'+':'')+'</span><span class="cg-tag cg-st"></span></div><div class="cg-ds"><b style="color:var(--gold)">'+f.skill+'</b> — '+f.sd+'</div>';
    r.appendChild(d); hb.appendChild(r); refs.forms.push({root:r,st:d.querySelector('.cg-st')});
  });
  // abas
  $('tabs').addEventListener('click',e=>{ const b=e.target.closest('.cg-tab'); if(!b) return;
    host.querySelectorAll('.cg-tab').forEach(x=>x.classList.toggle('cg-on',x===b));
    host.querySelectorAll('.cg-panel').forEach(p=>p.classList.toggle('cg-on',p.id==='cg-p-'+b.dataset.tab)); });
  $('offOk').onclick=()=>{ $('offline').classList.remove('cg-show'); saveLocal(); dirty=true; };
  if(DEV) buildDev();
  Stage.init($('stage'),()=>S,{huntName:$('huntName'),hBar:$('hBar'),hFill:$('hFill'),eBar:$('eBar'),eFill:$('eFill'),eName:$('eName'),floats:$('floats'),status:$('status')});
  Stage.Evo.init({root:$('evo'),canvas:$('evoCv'),title:$('evoTitle'),sub:$('evoSub'),skill:$('evoSkill'),btn:$('evoBtn')});
  addEventListener('resize',()=>{ if(active) fitStage(); });
}
function buildGenerated(){ /* nada a recriar por usuário; mantido para futuras extensões */ }
function buildDev(){
  const box=$('evoBtns'); [[1,19],[2,39],[3,59],[4,79],[5,89]].forEach(([i,l])=>{ const b=document.createElement('button'); b.className='cg-btn cg-small'; b.textContent='→ '+Core.FORMS[i].name; b.onclick=()=>{ if(!S) return; Core.setLevel(S,l); S.xp=Math.max(0,Core.xpToNext(l)-1); dirty=true; update(true); toast('Nível '+l+'. Falta 1 XP para a evolução!'); }; box.appendChild(b); });
  host.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{ speed=parseInt(b.dataset.speed,10); host.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('cg-on',x===b)); });
  host.querySelectorAll('[data-off]').forEach(b=>b.onclick=()=>{ if(!S) return; showOffline(Core.applyOffline(S,parseInt(b.dataset.off,10))); dirty=true; update(true); });
  $('btnGold').onclick=()=>{ S.gold+=100000; dirty=true; update(true); };
  $('btnLvl').onclick=()=>{ Core.setLevel(S,S.level+5); dirty=true; update(true); };
  $('btnReset').onclick=()=>{ if(confirm('Apagar todo o progresso do Chess Genesis?')){ S=Core.newState(); dirty=true; saveLocal(); saveCloud(); update(true); toast('Progresso reiniciado.'); } };
}
function showOffline(r){
  $('offTime').innerHTML='Você ficou fora por <b>'+Core.fmtTime(r.seconds)+'</b>.';
  $('offKills').innerHTML=r.kills?('Seu herói derrotou <b>'+fmt(r.kills)+'</b> inimigos.'):'Seu herói aguardou em posição.';
  $('offGold').innerHTML='Ouro coletado: <b>'+fmt(r.gold)+'</b>.';
  $('offLv').innerHTML=r.levels?('Subiu <b>'+r.levels+'</b> nível(is)'+(r.evolved?' e <b>evoluiu</b>!':'.')):'';
  $('offline').classList.add('cg-show');
}

/* ---------- atualização da interface ---------- */
function pct(x){ return (x*100).toFixed(x<.1?1:0)+'%'; }
function update(){
  if(!S||!mounted) return;
  const D=Core.derive(S), F=D.form, need=Core.xpToNext(S.level);
  $('sGold').textContent=fmt(S.gold);
  const ex=Core.expected(S); $('sGoldRate').textContent='≈ '+fmt(ex.kps*ex.gold*60)+' ouro/min';
  $('sLevel').textContent=S.level+(S.level>=Core.MAXLV?' (máx.)':'');
  $('sXpBar').style.width=(S.level>=Core.MAXLV?100:Math.min(100,S.xp/need*100))+'%';
  $('sXp').textContent=S.level>=Core.MAXLV?'Nível máximo':fmt(S.xp)+' / '+fmt(need)+' XP';
  $('sForm').textContent=F.name;
  const nf=Core.FORMS[D.formIdx+1]; $('sNext').textContent=nf?('Próxima: '+nf.name+' no nível '+nf.lv):'Forma suprema';
  $('sKills').textContent=fmt(S.kills); $('sDeaths').textContent=S.deaths?('derrotas: '+S.deaths):'sem derrotas';
  $('hName').textContent=F.name+' · Nv '+S.level;
  $('heroStats').innerHTML=[['Vida',fmt(D.maxHp)],['Ataque',fmt(D.atk)],['Defesa',fmt(D.def)+' ('+Math.round((1-D.dmgTaken)*100)+'%)'],['Golpes/s',(1/D.interval).toFixed(2)],['Crítico',pct(D.crit)+' ×'+D.cm],['Dano/s',fmt(D.dps)],['Ouro','+'+pct(D.goldMul-1)],['XP','+'+pct(D.xpMul-1)]].map(a=>'<div class="cg-hs"><span>'+a[0]+'</span><b>'+a[1]+'</b></div>').join('');
  $('passive').innerHTML='<b>'+F.skill+'</b> — '+F.sd;
  $('autoHunt').checked=!!S.autoHunt;
  Core.HUNTS.forEach((h,i)=>{ const r=refs.hunts[i], un=Core.isUnlocked(S,i), cur=S.hunt===i;
    r.root.classList.toggle('cg-locked',!un); r.root.classList.toggle('cg-cur',cur);
    r.lv.textContent=cur?'em caça':(un?'liberada':'nível '+h.min); r.lv.className='cg-tag cg-lv'+(cur?' cg-curtag':'');
    r.go.style.display=(un&&!cur)?'inline-block':'none'; });
  Core.UPGS.forEach(u=>{ const r=refs.upg[u.id], l=S.upg[u.id]; r.lv.textContent=l+'/'+u.max;
    if(l>=u.max){ r.buy.textContent='Máximo'; r.buy.disabled=true; } else{ const c=Core.upgCost(u,l); r.buy.textContent='Treinar · '+fmt(c); r.buy.disabled=c>S.gold; } });
  Core.SLOTS.forEach(s=>{ const it=S.gear[s], r=refs.gear[s]; r.t.textContent=Core.SLOT_NAME[s]+' · '+Core.SLOT_EFFECT[s];
    if(it){ const R=Core.RARITY[it.rar]; r.n.textContent=Core.itemName(it); r.n.style.color=R.c; r.b.textContent=R.n+' · Tier '+(it.tier+1)+' · +'+Math.round(Core.itemBonus(it)*100)+'%'; }
    else{ r.n.textContent='Vazio'; r.n.style.color='var(--text-dim)'; r.b.textContent='Nenhum item equipado'; } });
  refs.forms.forEach((r,i)=>{ r.root.classList.toggle('cg-cur',i===D.formIdx); r.root.classList.toggle('cg-locked',i>D.formIdx); r.st.textContent=i<D.formIdx?'✓':(i===D.formIdx?'atual':'🔒'); });
}

/* ---------- laço do jogo ---------- */
function handleEvents(ev){
  if(active) Stage.onEvents(ev);
  ev.forEach(e=>{
    if(e.t==='loot'){ dirty=true; if(!active) return; if(!e.equipped&&e.item.rar<2) return; const R=Core.RARITY[e.item.rar]; toast('<b style="color:'+R.c+'">'+R.n+'</b> · '+Core.itemName(e.item)+(e.equipped?' <span style="color:var(--success)">equipado!</span>':' <span style="color:var(--text-dim)">vendido por '+fmt(e.sold)+'</span>')); }
    else if(e.t==='down'&&e.streak>=3&&active){ toast('⚠ Seu herói caiu várias vezes. Tente uma caçada de nível menor ou treine mais.',true); }
    else if(e.t==='evolve'||e.t==='level'){ dirty=true; }
  });
}
function maybeEvolve(){
  if(!active||!S||!S.pendingEvo||Stage.Evo.active||$('offline').classList.contains('cg-show')) return;
  const pe=S.pendingEvo; Stage.Evo.start(pe.from,pe.to,()=>{ S.pendingEvo=null; saveLocal(); dirty=true; update(true); lastTs=performance.now(); });
}
function logicTick(){
  const now=performance.now(); let dt=(now-lastTs)/1000; lastTs=now;
  if(!S) return;
  const busy=Stage.Evo.active||$('offline').classList.contains('cg-show');
  if(!busy){
    if(dt>20){ const r=Core.applyOffline(S,dt); if(r.gold>1){ if(active) showOffline(r); else pendingOff=r; } dirty=true; dt=0; }
    dt=Math.min(dt,20)*speed;
    const ev=[]; const h=Math.max(.05,dt/400);
    while(dt>1e-6){ const st=Math.min(h,dt); Core.tick(S,st,ev); dt-=st; }
    if(ev.length) handleEvents(ev);
    if(S.autoHunt&&now-lastAuto>4000){ lastAuto=now; const b=Core.bestHunt(S); if(b!==S.hunt){ Core.selectHunt(S,b); dirty=true; if(active) toast('🗺 Caça automática: <b>'+Core.HUNTS[b].name+'</b>.'); } }
    if(active) maybeEvolve();
  }
  if(now-lastLocal>5000){ lastLocal=now; saveLocal(); }
  if(dirty&&now-lastCloud>CLOUD_EVERY_MS){ lastCloud=now; saveCloud(); }
  if(active&&now-lastUi>250){ lastUi=now; update(); }
}
function rafLoop(ts){
  if(!active){ rafId=0; return; }
  const real=Math.min(.05,Math.max(0,(ts-(rafLoop.last||ts))/1000)); rafLoop.last=ts;
  if(S) Stage.frame(real,Stage.Evo.active);
  rafId=requestAnimationFrame(rafLoop);
}
function afterShow(){
  fitStage(); update();
  if(pendingOff){ showOffline(pendingOff); pendingOff=null; }
  maybeEvolve();
}

/* ---------- API pública ---------- */
function mount(el,ad){
  if(mounted) return; host=el; adapter=ad; host.classList.add('cg');
  buildStatic(); mounted=true;
  tickId=setInterval(logicTick,50);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) flush(); else lastTs=performance.now(); });
  addEventListener('pagehide',()=>{ saveLocal(); });
  setUser(null);
}
function setUser(u){
  if(!mounted) return;
  if(u&&(uid===u.uid||loadingUid===u.uid)) return;
  if(S&&uid){ flush(); }
  S=null; uid=null; user=null; loadToken++; loadingUid=null; cloudBlocked=false;
  if(!u){
    showMsg('<h3>Entre para <span>jogar o Chess Genesis</span></h3><p class="cg-dim" style="margin:6px 0 12px">O seu progresso fica salvo na sua conta. Crie uma conta grátis ou entre para começar.</p><button class="cg-btn cg-on" id="cg-goLogin">Entrar / Registrar</button>');
    const b=$('goLogin'); if(b) b.onclick=()=>{ if(adapter&&adapter.openLogin) adapter.openLogin(); };
    return;
  }
  loadingUid=u.uid;
  loadProgress(u).finally(()=>{ if(loadingUid===u.uid) loadingUid=null; });
}
function setActive(a){
  if(!mounted) return;
  const was=active; active=!!a;
  if(active&&!was){ if(!rafId){ rafLoop.last=0; rafId=requestAnimationFrame(rafLoop); } if(S) afterShow(); }
  if(!active&&was){ if(S) flush(); }
}
G.UI={mount,setUser,setActive,flush,get state(){return S;},get dev(){return DEV;}};
})(typeof window!=='undefined'?window:globalThis);
