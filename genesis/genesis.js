/* =========================================================
   CHESS GENESIS — INTERFACE, SALVAMENTO E PONTE COM O SITE
   Arquivo: genesis/genesis.js
   Depende de: core.js, art.js, stage.js, city.js, farm.js (carregados antes)

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
const G=root.Genesis, Core=G.Core, Art=G.Art, Stage=G.Stage, Town=G.Town, Farm=G.Farm;
const LS_PREFIX='chessGenesis_v2_';
const CLOUD_EVERY_MS=30000;
const DEV=/[?&]genesis=teste/.test(location.search)||(function(){ try{ return localStorage.getItem('cgDev')==='1'; }catch(e){ return false; } })();

let host=null, adapter=null, mounted=false;
let S=null, user=null, uid=null;
let active=false, speed=1, paused=false;
let lastTs=0, lastUi=0, lastLocal=0, lastCloud=0, dirty=false, lastAuto=0, pendingOff=null, loadToken=0;
let rafId=0, tickId=0, loadingUid=null, cloudBlocked=false;
let mode='hunt', lastInput=0, shop=null, farmShown=-1, farmRows=[], curTab='hunt';
const $=id=>document.getElementById('cg-'+id);
const fmt=Core.fmt;
const refs={hunts:[],upg:{},gear:{},forms:[],bag:{mats:[]}};

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
        <div class="cg-scenebar" id="cg-sceneBar">
          <button class="cg-scn cg-on" data-scene="hunt">⚔ Caçada</button>
          <button class="cg-scn" data-scene="city">🏘 Cidade</button>
          <button class="cg-scn" data-scene="farm" id="cg-scnFarm" disabled title="Compre um terreno com o Corretor de Terras, na cidade.">🔒 Fazenda</button>
        </div>
        <div class="cg-stagewrap" id="cg-stageWrap">
          <canvas id="cg-stage" width="256" height="144"></canvas>
          <div class="cg-hud">
            <div class="cg-huntname" id="cg-huntName"></div>
            <div class="cg-ubar cg-hero" id="cg-hBar"><div class="cg-nm" id="cg-hName">Você</div><div class="cg-trk"><i id="cg-hFill"></i></div></div>
            <div class="cg-ubar cg-foe" id="cg-eBar"><div class="cg-nm" id="cg-eName"></div><div class="cg-trk"><i id="cg-eFill"></i></div></div>
            <div class="cg-floats" id="cg-floats"></div>
            <div class="cg-status" id="cg-status"></div>
            <div class="cg-labels" id="cg-labels"></div>
            <div class="cg-prompt" id="cg-prompt"></div>
            <div class="cg-pausebadge" id="cg-pause">⏸ Caçada pausada</div>
          </div>
        </div>
        <div class="cg-keyhint" id="cg-keyHint">Use as <b>setas</b> (ou WASD) para andar · <b>E</b> ou Enter para entrar · <b>Esc</b> volta à caçada</div>
        <div class="cg-chips" id="cg-chips"></div>
        <div class="cg-herostats" id="cg-heroStats"></div>
        <div class="cg-passive" id="cg-passive"></div>
      </div>
    </div>

    <div>
      <div class="cg-tabs" id="cg-tabs">
        <button class="cg-tab cg-on" data-tab="hunt">Caça</button>
        <button class="cg-tab" data-tab="train">Treino</button>
        <button class="cg-tab" data-tab="gear">Equip.</button>
        <button class="cg-tab" data-tab="hero">Herói</button>
        <button class="cg-tab" data-tab="city">Cidade</button>
        <button class="cg-tab" data-tab="farm">Fazenda</button>
        ${DEV?'<button class="cg-tab" data-tab="test">Teste</button>':''}
      </div>
      <div class="cg-card">
        <div class="cg-panel cg-on" id="cg-p-hunt"></div>
        <div class="cg-panel" id="cg-p-train"></div>
        <div class="cg-panel" id="cg-p-gear"></div>
        <div class="cg-panel" id="cg-p-hero"></div>
        <div class="cg-panel" id="cg-p-city"></div>
        <div class="cg-panel" id="cg-p-farm"></div>
        ${DEV?`<div class="cg-panel" id="cg-p-test">
          <div class="cg-nm2">Velocidade do jogo</div>
          <div class="cg-btnrow" id="cg-speedBtns"><button class="cg-btn cg-small cg-on" data-speed="1">×1</button><button class="cg-btn cg-small" data-speed="10">×10</button><button class="cg-btn cg-small" data-speed="50">×50</button></div>
          <div class="cg-nm2">Ver as evoluções</div>
          <div class="cg-btnrow" id="cg-evoBtns"></div>
          <div class="cg-nm2">Progresso offline</div>
          <div class="cg-btnrow"><button class="cg-btn cg-small" data-off="3600">Simular 1 hora</button><button class="cg-btn cg-small" data-off="28800">Simular 8 horas</button></div>
          <div class="cg-nm2">Outros</div>
          <div class="cg-btnrow"><button class="cg-btn cg-small" id="cg-btnGold">+100 mil ouro</button><button class="cg-btn cg-small" id="cg-btnLvl">+5 níveis</button><button class="cg-btn cg-small" id="cg-btnMats">+10 materiais</button><button class="cg-btn cg-small" id="cg-btnLand">Dar terreno</button><button class="cg-btn cg-small" id="cg-btnPot">+10 poções</button><button class="cg-btn cg-small cg-danger" id="cg-btnReset">Reiniciar progresso</button></div>
          <p class="cg-hint">Ferramentas de teste (aparecem só com ?genesis=teste na URL). O que você fizer aqui também é salvo.</p>
        </div>`:''}
      </div>
    </div>
  </div>
</div>

<div class="cg-toasts" id="cg-toasts"></div>
<div class="cg-overlay" id="cg-offline"><div class="cg-modal">
  <h2>♞ Bem-vindo de volta!</h2>
  <div class="cg-line" id="cg-offTime"></div><div class="cg-line" id="cg-offKills"></div><div class="cg-line" id="cg-offGold"></div><div class="cg-line" id="cg-offLv"></div><div class="cg-line" id="cg-offMats"></div>
  <button class="cg-btn cg-on" style="margin-top:14px;width:100%" id="cg-offOk">Continuar</button>
</div></div>
<div class="cg-evo" id="cg-build">
  <canvas id="cg-buildCv" width="256" height="144"></canvas>
  <div class="cg-evotxt"><h2 id="cg-buildTitle">FAZENDA MELHORADA!</h2><div class="cg-evosub" id="cg-buildSub"></div><div class="cg-evoskill" id="cg-buildDesc"></div><button class="cg-btn cg-on" id="cg-buildBtn" style="display:none;padding:9px 26px;font-size:15px">Continuar</button></div>
</div>
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
  const o={v:2,level:S.level,xp:S.xp,gold:S.gold,upg:Object.assign({},S.upg),gear:{},hunt:S.hunt,autoHunt:!!S.autoHunt,kills:S.kills,deaths:S.deaths,lastSave:Date.now(),
    potions:S.potions,buffs:{atk:Math.round(S.buffs.atk),xp:Math.round(S.buffs.xp),luck:Math.round(S.buffs.luck)},mats:S.mats.map(x=>Math.floor(x)),farm:S.farm,dep:S.dep.map(x=>Math.floor(x))};
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
  const a6=x=>{ const r=[]; for(let i=0;i<6;i++) r.push(Math.floor(num(x&&x[i],0,0,1e9))); return r; };
  s.potions=Math.floor(num(o.potions,0,0,Core.POTION_CAP));
  s.buffs={}; ['atk','xp','luck'].forEach(k=>{ s.buffs[k]=num(o.buffs&&o.buffs[k],0,0,Core.BUFF_MAX); });
  s.mats=a6(o.mats); s.dep=a6(o.dep);
  s.farm=Math.floor(num(o.farm,0,0,Core.FARM.length));
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
  $('tabs').addEventListener('click',e=>{ const b=e.target.closest('.cg-tab'); if(!b) return; openTab(b.dataset.tab); });
  $('sceneBar').addEventListener('click',e=>{ const b=e.target.closest('.cg-scn'); if(!b||b.disabled) return; setMode(b.dataset.scene); });
  buildBag(); renderCityPanel(); renderFarmPanel(true);
  document.addEventListener('keydown',onKey); document.addEventListener('keyup',onKeyUp); addEventListener('blur',()=>Town.clearKeys());
  $('offOk').onclick=()=>{ $('offline').classList.remove('cg-show'); saveLocal(); dirty=true; };
  if(DEV) buildDev();
  Stage.init($('stage'),()=>S,{huntName:$('huntName'),hBar:$('hBar'),hFill:$('hFill'),eBar:$('eBar'),eFill:$('eFill'),eName:$('eName'),floats:$('floats'),status:$('status')});
  Town.init($('stage'),{labels:$('labels'),prompt:$('prompt'),floats:$('floats')},{getState:()=>S,onEnter});
  $('prompt').onclick=()=>{ const z=Town.nearZone(); if(z) onEnter(z); };
  Farm.Build.init({root:$('build'),canvas:$('buildCv'),title:$('buildTitle'),sub:$('buildSub'),desc:$('buildDesc'),btn:$('buildBtn')});
  Stage.Evo.init({root:$('evo'),canvas:$('evoCv'),title:$('evoTitle'),sub:$('evoSub'),skill:$('evoSkill'),btn:$('evoBtn')});
  addEventListener('resize',()=>{ if(active) fitStage(); });
}


/* =====================================================================
   CIDADE, FAZENDA E MOCHILA
   ===================================================================== */
function openTab(name){
  curTab=name;
  host.querySelectorAll('.cg-tab').forEach(x=>x.classList.toggle('cg-on',x.dataset.tab===name));
  host.querySelectorAll('.cg-panel').forEach(p=>p.classList.toggle('cg-on',p.id==='cg-p-'+name));
}
function busyOverlay(){ return Stage.Evo.active||Farm.Build.active||$('offline').classList.contains('cg-show'); }
function setMode(m){
  if(!S) return;
  if(m==='farm'&&!(S.farm>0)) return;
  if(m===mode) return;
  mode=m; Town.clearKeys(); Town.hidePrompt();
  $('stageWrap').classList.toggle('cg-town',m!=='hunt');
  host.querySelectorAll('.cg-scn').forEach(b=>b.classList.toggle('cg-on',b.dataset.scene===m));
  $('keyHint').style.display=m==='hunt'?'none':'block';
  $('pause').style.display=m==='hunt'?'none':'block';
  if(m==='city'){ Town.setScene('city',{state:S}); shop=null; renderCityPanel(); openTab('city'); }
  else if(m==='farm'){ Town.setScene('farm',{level:S.farm}); renderFarmPanel(true); openTab('farm'); }
  else{ shop=null; renderCityPanel(); if(curTab==='city'||curTab==='farm') openTab('hunt'); }
  lastInput=performance.now(); lastTs=performance.now();
  update(true);
}
function onKey(e){
  if(!mounted||!active||!S||mode==='hunt'||busyOverlay()) return;
  const tg=e.target&&e.target.tagName; if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT') return;
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  lastInput=performance.now();
  if(e.code==='Escape'){ setMode('hunt'); e.preventDefault(); return; }
  if(Town.keydown(e)) e.preventDefault();
}
function onKeyUp(e){ if(mode!=='hunt'&&Town.keyup(e)) e.preventDefault(); }
function onEnter(z){
  if(!S) return;
  if(z.id==='house'){ renderFarmPanel(true); openTab('farm'); return; }
  shop=buildShop(z.id); openTab('city'); update(true);
}

/* --- painel da cidade --- */
function cityIntro(box){
  box.innerHTML='<div class="cg-nm2">Bem-vindo à cidade!</div><p class="cg-hint" style="margin-top:4px">Ande com as <b>setas</b> até a porta de um prédio e aperte <b>E</b>. Enquanto você estiver na cidade, a caçada fica pausada.</p>'+
   [['🍺','Taverna','Poções de cura e elixires.'],['⚔','Ferraria','Armas melhores a cada nível.'],['🛡','Armaria','Armaduras melhores a cada nível.'],['📜','Corretor de Terras','Compre um terreno e construa sua fazenda.']].map(a=>'<div class="cg-row"><div><div class="cg-nm">'+a[0]+' '+a[1]+'</div><div class="cg-ds">'+a[2]+'</div></div></div>').join('');
}
function renderCityPanel(){
  const box=$('p-city'); if(!box) return;
  if(mode==='hunt'){ box.innerHTML='<div class="cg-nm2">Cidade</div><p class="cg-hint" style="margin-top:4px">Clique em <b>🏘 Cidade</b> acima do palco para passear, comprar poções, armas e armaduras e até um terreno.</p>'; return; }
  if(shop){ shop.build(); return; }
  cityIntro(box);
}
function buildShop(id){
  const box=$('p-city'); box.innerHTML=''; const rs=[];
  const head=(icon,title,sub)=>{ const d=document.createElement('div'); d.className='cg-shophead'; d.innerHTML='<span class="cg-shopicon">'+icon+'</span><div><div class="cg-nm" style="font-size:16px">'+title+'</div><div class="cg-ds">'+sub+'</div></div>'; box.appendChild(d); };
  const row=h=>{ const r=document.createElement('div'); r.className='cg-row'; r.innerHTML=h; box.appendChild(r); return r; };
  const note=t=>{ const p=document.createElement('p'); p.className='cg-hint'; p.innerHTML=t; box.appendChild(p); };
  const buy=(ok,msg)=>{ if(ok){ dirty=true; if(msg) Town.flo(msg,'gold'); Town.sparkle(10,['#ffd24d','#fff2b0']); saveLocal(); } update(true); };
  const obj={id};
  if(id==='bar'){
    head('🍺','Taverna do Peão Alegre','Poções para encarar caçadas mais difíceis.');
    const r=row('<div><div class="cg-nm">🧪 Poção de Cura <span class="cg-tag cg-have"></span></div><div class="cg-ds">Bebida sozinha quando a vida cai abaixo de 35% (recarga de 6 s). Recupera 50% da vida.</div></div><div class="cg-btncol"><button class="cg-btn cg-small cg-b1"></button><button class="cg-btn cg-small cg-b5"></button></div>');
    const have=r.querySelector('.cg-have'), b1=r.querySelector('.cg-b1'), b5=r.querySelector('.cg-b5');
    b1.onclick=()=>buy(Core.buyHeal(S),'+1 🧪');
    b5.onclick=()=>{ let n=0; for(let i=0;i<5;i++) if(Core.buyHeal(S)) n++; buy(n>0,'+'+n+' 🧪'); };
    rs.push(()=>{ const c=Core.healPrice(S), room=Core.POTION_CAP-S.potions; have.textContent=S.potions+'/'+Core.POTION_CAP; b1.textContent='1 · '+fmt(c); b1.disabled=room<1||S.gold<c; b5.textContent='5 · '+fmt(c*5); b5.disabled=room<5||S.gold<c*5; });
    const el=[];
    Core.ELIXIRS.forEach(x=>{
      const rr=row('<div><div class="cg-nm">'+x.icon+' '+x.name+' <span class="cg-tag cg-left"></span></div><div class="cg-ds">'+x.desc+'. Só conta com a caçada rodando.</div></div><div><button class="cg-btn cg-small cg-b"></button></div>');
      const left=rr.querySelector('.cg-left'), b=rr.querySelector('.cg-b');
      b.onclick=()=>buy(Core.buyElixir(S,x.id),x.icon+' ativo!');
      rs.push(()=>{ const c=Core.elixirPrice(S), t=S.buffs[x.id]; left.textContent=t>0?'ativo '+fmtMin(t):'inativo'; left.className='cg-tag cg-left'+(t>0?' cg-curtag':''); b.textContent='Beber · '+fmt(c); b.disabled=S.gold<c||t>=Core.BUFF_MAX; });
    });
    note('Os elixires se acumulam, até 2 horas de cada.');
  }else if(id==='forge'||id==='armory'){
    const slot=id==='forge'?'weapon':'armor';
    head(id==='forge'?'⚔':'🛡',id==='forge'?'Ferraria do Martelo Dourado':'Armaria da Muralha',id==='forge'?'Armas fortes aumentam o seu ataque.':'Armaduras aumentam vida e defesa.');
    const cur=document.createElement('div'); cur.className='cg-slot'; cur.innerHTML='<div class="cg-t">Equipado agora</div><div class="cg-n"></div><div class="cg-b"></div>'; box.appendChild(cur);
    const cn=cur.querySelector('.cg-n'), cb=cur.querySelector('.cg-b');
    rs.push(()=>{ const it=S.gear[slot]; if(it){ const Rr=Core.RARITY[it.rar]; cn.textContent=Core.itemName(it); cn.style.color=Rr.c; cb.textContent=Rr.n+' · Tier '+(it.tier+1)+' · +'+Math.round(Core.itemBonus(it)*100)+'%'; } else{ cn.textContent='Nada'; cn.style.color='var(--text-dim)'; cb.textContent='Compre algo abaixo.'; } });
    Core.shopList(slot).forEach(o=>{
      const Rr=Core.RARITY[o.rar];
      const r=row('<div><div class="cg-nm" style="color:'+Rr.c+'">'+Core.itemName(o)+' <span class="cg-tag">'+Rr.n+'</span></div><div class="cg-ds">Tier '+(o.tier+1)+' · +'+Math.round(Core.itemBonus(o)*100)+'% '+Core.SLOT_EFFECT[slot]+' · nível '+o.minLevel+'+</div></div><div><button class="cg-btn cg-small cg-b"></button></div>');
      const b=r.querySelector('.cg-b');
      b.onclick=()=>buy(Core.buyGear(S,slot,o.tier,o.rar),'Comprado!');
      rs.push(()=>{ const st=Core.shopState(S,o); r.classList.toggle('cg-locked',st.reason==='level');
        b.textContent=st.reason==='level'?'Nível '+o.minLevel:st.reason==='owned'?'Você tem melhor':'Comprar · '+fmt(o.price); b.disabled=!st.ok; });
    });
    note('Itens melhores que o seu são equipados na hora e o antigo é vendido.');
  }else if(id==='land'){
    head('📜','Corretor de Terras','"Um pedaço de chão só seu, herói. O futuro da sua família."');
    const r=row('<div><div class="cg-nm">🌱 Terreno para fazenda <span class="cg-tag cg-st"></span></div><div class="cg-ds">Começa só com terra e mato. Com materiais raros das caçadas, vira uma cabana, uma casa, um sítio... até um castelo (10 níveis). Cada nível da fazenda dá +'+Math.round(Core.FARM_BONUS*100)+'% de ouro e XP.</div><div class="cg-ds" style="margin-top:4px">Preço: <b style="color:var(--gold)">'+fmt(Core.LAND_PRICE)+'</b> de ouro · nível '+Core.LAND_LEVEL+'+</div></div><div><button class="cg-btn cg-small cg-b"></button></div>');
    const st=r.querySelector('.cg-st'), b=r.querySelector('.cg-b');
    b.onclick=()=>{
      if(S.farm>0){ setMode('farm'); return; }
      if(Core.buyLand(S)){ dirty=true; saveLocal(); saveCloud(); toast('🏡 <b>Terreno comprado!</b> O botão <b>Fazenda</b> foi liberado.'); Town.sparkle(30,['#ffd24d','#fff2b0','#ffffff']);
        const l=Town.scene&&Town.scene.labels&&Town.scene.labels.find(x=>x.zone==='land'); if(l){ l.text='🏡 Terras'; Town.refreshLabels(); } }
      update(true);
    };
    rs.push(()=>{
      if(S.farm>0){ st.textContent='comprado'; st.className='cg-tag cg-curtag'; b.textContent='Ir para a Fazenda'; b.disabled=false; }
      else{ st.textContent=S.level<Core.LAND_LEVEL?'nível '+Core.LAND_LEVEL:'à venda'; st.className='cg-tag'; b.textContent=S.level<Core.LAND_LEVEL?'Nível '+Core.LAND_LEVEL:'Comprar · '+fmt(Core.LAND_PRICE); b.disabled=S.level<Core.LAND_LEVEL||S.gold<Core.LAND_PRICE; r.classList.toggle('cg-locked',S.level<Core.LAND_LEVEL); }
    });
    note('Depois de comprar, use o botão <b>🏡 Fazenda</b> acima do palco para ir até lá.');
  }
  obj.refresh=()=>rs.forEach(f=>f());
  obj.build=()=>{ /* reconstrói (ex.: ao voltar para a aba) */ const nb=buildShop(id); shop=nb; };
  obj.refresh();
  return obj;
}
function fmtMin(s){ s=Math.ceil(s); const m=Math.floor(s/60), r=s%60; return m+':'+(r<10?'0':'')+r; }

/* --- painel da fazenda --- */
function renderFarmPanel(force){
  const box=$('p-farm'); if(!box) return;
  const lv=S?S.farm:0;
  if(!force&&lv===farmShown) return;
  farmShown=lv; farmRows=[]; box.innerHTML='';
  if(!S||lv<1){ box.innerHTML='<div class="cg-nm2">Fazenda</div><p class="cg-hint" style="margin-top:4px">Você ainda não tem um terreno. Fale com o <b>Corretor de Terras</b> na cidade (nível '+Core.LAND_LEVEL+', '+fmt(Core.LAND_PRICE)+' de ouro).</p>'; return; }
  const cur=Core.FARM[lv-1], nx=Core.farmNext(S);
  const h=document.createElement('div'); h.className='cg-shophead';
  h.innerHTML='<span class="cg-shopicon">🏡</span><div><div class="cg-nm" style="font-size:16px">'+cur.name+' <span class="cg-tag cg-curtag">nível '+lv+'/10</span></div><div class="cg-ds">'+cur.desc+(lv>1?' Bônus: +'+Math.round(Core.FARM_BONUS*(lv-1)*100)+'% de ouro e XP.':'')+'</div></div>';
  box.appendChild(h);
  if(!nx){ const p=document.createElement('p'); p.className='cg-passive'; p.innerHTML='<b>Castelo completo!</b> Você chegou ao topo da fazenda. Parabéns, campeão!'; box.appendChild(p); }
  else{
    const t=document.createElement('div'); t.className='cg-nm2'; t.innerHTML='Próxima obra: '+nx.name+' <span class="cg-tag">nível '+nx.lv+'</span>'; box.appendChild(t);
    const d=document.createElement('div'); d.className='cg-ds'; d.textContent=nx.desc; box.appendChild(d);
    const rq=document.createElement('div'); rq.className='cg-ds'; rq.style.marginTop='4px'; box.appendChild(rq);
    nx.mats.forEach((n,i)=>{ if(!n) return; const m=Core.MATS[i];
      const r=document.createElement('div'); r.className='cg-row';
      r.innerHTML='<div><div class="cg-nm">'+m.icon+' '+m.name+' <span class="cg-tag cg-prg"></span></div><div class="cg-bar" style="height:6px"><i class="cg-pb"></i></div><div class="cg-ds cg-bag"></div></div><div><button class="cg-btn cg-small cg-dl">Entregar</button></div>';
      box.appendChild(r);
      const ref={i,prg:r.querySelector('.cg-prg'),pb:r.querySelector('.cg-pb'),bag:r.querySelector('.cg-bag'),btn:r.querySelector('.cg-dl'),need:n};
      ref.btn.onclick=()=>{ const k=Core.deliverMat(S,i); if(k>0){ dirty=true; toast(m.icon+' Entregou <b>'+k+'</b> '+m.name+'.'); saveLocal(); } update(true); };
      farmRows.push(ref);
    });
    const br=document.createElement('div'); br.className='cg-btnrow'; br.style.marginTop='10px';
    br.innerHTML='<button class="cg-btn cg-small cg-dlAll">Entregar tudo</button><button class="cg-btn cg-on cg-build">🔨 Construir</button>'; box.appendChild(br);
    const all=br.querySelector('.cg-dlAll'), bb=br.querySelector('.cg-build');
    all.onclick=()=>{ const k=Core.deliverAll(S); if(k>0){ dirty=true; toast('📦 Entregou <b>'+k+'</b> materiais.'); saveLocal(); } update(true); };
    bb.onclick=()=>{ const from=S.farm; if(Core.upgradeFarm(S)){ dirty=true; saveLocal(); saveCloud(); renderFarmPanel(true); Farm.Build.start(from,S.farm,()=>{ if(mode==='farm') Town.setScene('farm',{level:S.farm}); lastTs=performance.now(); update(true); }); } };
    farmRows.ctl={all,bb,rq,nx};
  }
  /* de onde vêm os materiais */
  const sc=document.createElement('div'); sc.className='cg-nm2'; sc.textContent='Onde conseguir'; box.appendChild(sc);
  const info=document.createElement('p'); info.className='cg-hint'; info.style.marginTop='4px';
  info.innerHTML='Cada abate tem <b>'+(Core.MAT_CHANCE*100).toFixed(1).replace('.',',')+'%</b> de chance (elites <b>'+(Core.MAT_CHANCE*Core.MAT_ELITE_MUL*100).toFixed(1).replace('.',',')+'%</b>) de largar o material do tier da caçada. Quanto mais rápido você derrota, mais tentativas por hora. O <b>Elixir da Sorte</b> aumenta a chance em 50%.';
  box.appendChild(info);
  Core.MATS.forEach((m,i)=>{ const d=document.createElement('div'); d.className='cg-ds'; d.style.margin='2px 0'; d.innerHTML=m.icon+' <b>'+m.name+'</b> — Tier '+(i+1)+': '+Core.HUNTS.filter(x=>x.tier===i).map(x=>x.name).join(', '); box.appendChild(d); });
}
function refreshFarm(){
  if(!S) return;
  if(S.farm!==farmShown) renderFarmPanel(true);
  if(!farmRows.ctl) return;
  const c=farmRows.ctl, nx=c.nx;
  farmRows.forEach(r=>{ const dep=S.dep[r.i], have=S.mats[r.i]; r.prg.textContent=dep+'/'+r.need; r.prg.className='cg-tag'+(dep>=r.need?' cg-curtag':''); r.pb.style.width=Math.min(100,dep/r.need*100)+'%'; r.bag.textContent='Na mochila: '+have; r.btn.disabled=dep>=r.need||have<1; r.btn.textContent=dep>=r.need?'Completo':'Entregar'; });
  const lvOk=S.level>=nx.level; c.rq.innerHTML='Requer herói nível <b style="color:'+(lvOk?'var(--success)':'#e0938c')+'">'+nx.level+'</b> (você: '+S.level+') e todos os materiais entregues.';
  c.all.disabled=!S.mats.some((n,i)=>n>0&&nx.mats[i]>S.dep[i]); c.bb.disabled=!Core.farmReady(S);
}

/* --- mochila (aba Equip.) e faixa de status --- */
function buildBag(){
  const gb=$('p-gear'); const d=document.createElement('div'); d.innerHTML='<div class="cg-nm2">Mochila</div><div class="cg-ds" id="cg-bagPot" style="margin:4px 0"></div><div id="cg-bagMats"></div><p class="cg-hint" id="cg-bagHint"></p>'; gb.appendChild(d);
  const mb=d.querySelector('#cg-bagMats');
  Core.MATS.forEach((m,i)=>{ const r=document.createElement('div'); r.className='cg-ds'; r.style.margin='2px 0'; mb.appendChild(r); refs.bag.mats[i]=r; });
}
function refreshBag(){
  const b=refs.bag; $('bagPot').innerHTML='🧪 Poções de cura: <b>'+S.potions+'</b>/'+Core.POTION_CAP;
  Core.MATS.forEach((m,i)=>{ b.mats[i].innerHTML=m.icon+' '+m.name+': <b style="color:'+(S.mats[i]>0?'var(--gold)':'inherit')+'">'+S.mats[i]+'</b>'; });
  $('bagHint').textContent='Os materiais caem raramente nas caçadas e servem para construir a fazenda.';
}
function refreshChips(){
  const c=[]; if(S.potions>0) c.push('<span class="cg-chip">🧪 '+S.potions+'</span>');
  Core.ELIXIRS.forEach(x=>{ if(S.buffs[x.id]>0) c.push('<span class="cg-chip cg-chip-on">'+x.icon+' '+fmtMin(S.buffs[x.id])+'</span>'); });
  const h=c.join(''); const el=$('chips'); if(el._h!==h){ el._h=h; el.innerHTML=h; } el.style.display=c.length?'flex':'none';
}

function buildGenerated(){ /* nada a recriar por usuário; mantido para futuras extensões */ }
function buildDev(){
  const box=$('evoBtns'); [[1,19],[2,39],[3,59],[4,79],[5,89]].forEach(([i,l])=>{ const b=document.createElement('button'); b.className='cg-btn cg-small'; b.textContent='→ '+Core.FORMS[i].name; b.onclick=()=>{ if(!S) return; Core.setLevel(S,l); S.xp=Math.max(0,Core.xpToNext(l)-1); dirty=true; update(true); toast('Nível '+l+'. Falta 1 XP para a evolução!'); }; box.appendChild(b); });
  host.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{ speed=parseInt(b.dataset.speed,10); host.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('cg-on',x===b)); });
  host.querySelectorAll('[data-off]').forEach(b=>b.onclick=()=>{ if(!S) return; showOffline(Core.applyOffline(S,parseInt(b.dataset.off,10))); dirty=true; update(true); });
  $('btnGold').onclick=()=>{ S.gold+=100000; dirty=true; update(true); };
  $('btnLvl').onclick=()=>{ Core.setLevel(S,S.level+5); dirty=true; update(true); };
  $('btnMats').onclick=()=>{ for(let i=0;i<6;i++) S.mats[i]+=10; dirty=true; update(true); };
  $('btnLand').onclick=()=>{ if(S.level<Core.LAND_LEVEL) Core.setLevel(S,Core.LAND_LEVEL); if(!S.farm){ S.farm=1; S.dep=[0,0,0,0,0,0]; } dirty=true; renderFarmPanel(true); update(true); };
  $('btnPot').onclick=()=>{ S.potions=Math.min(Core.POTION_CAP,S.potions+10); dirty=true; update(true); };
  $('btnReset').onclick=()=>{ if(confirm('Apagar todo o progresso do Chess Genesis?')){ S=Core.newState(); dirty=true; saveLocal(); saveCloud(); update(true); toast('Progresso reiniciado.'); } };
}
function showOffline(r){
  $('offTime').innerHTML='Você ficou fora por <b>'+Core.fmtTime(r.seconds)+'</b>.';
  $('offKills').innerHTML=r.kills?('Seu herói derrotou <b>'+fmt(r.kills)+'</b> inimigos.'):'Seu herói aguardou em posição.';
  $('offGold').innerHTML='Ouro coletado: <b>'+fmt(r.gold)+'</b>.';
  $('offLv').innerHTML=r.levels?('Subiu <b>'+r.levels+'</b> nível(is)'+(r.evolved?' e <b>evoluiu</b>!':'.')):'';
  { const ms=(r.mats||[]).map((n,i)=>n>0?Core.MATS[i].icon+' '+n+' '+Core.MATS[i].name:'').filter(Boolean); $('offMats').innerHTML=ms.length?('Materiais encontrados: <b>'+ms.join(' · ')+'</b>'):''; }
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
  refreshBag(); refreshChips(); refreshFarm(); if(shop) shop.refresh();
  { const fb=$('scnFarm'); if(fb){ fb.disabled=!(S.farm>0); fb.textContent=(S.farm>0?'🏡 Fazenda':'🔒 Fazenda'); } }
  refs.forms.forEach((r,i)=>{ r.root.classList.toggle('cg-cur',i===D.formIdx); r.root.classList.toggle('cg-locked',i>D.formIdx); r.st.textContent=i<D.formIdx?'✓':(i===D.formIdx?'atual':'🔒'); });
}

/* ---------- laço do jogo ---------- */
function handleEvents(ev){
  if(active) Stage.onEvents(ev);
  ev.forEach(e=>{
    if(e.t==='loot'){ dirty=true; if(!active) return; if(!e.equipped&&e.item.rar<2) return; const R=Core.RARITY[e.item.rar]; toast('<b style="color:'+R.c+'">'+R.n+'</b> · '+Core.itemName(e.item)+(e.equipped?' <span style="color:var(--success)">equipado!</span>':' <span style="color:var(--text-dim)">vendido por '+fmt(e.sold)+'</span>')); }
    else if(e.t==='down'&&e.streak>=3&&active){ toast('⚠ Seu herói caiu várias vezes. Tente uma caçada de nível menor ou treine mais.',true); }
    else if(e.t==='mat'){ dirty=true; const m=Core.MATS[e.tier]; if(active) toast('<b style="color:#ffd24d">'+m.icon+' '+m.name+'</b> encontrado! <span class="cg-dim">(raro)</span>'); }
    else if(e.t==='potion'){ dirty=true; if(active) toast('🧪 Poção de Cura usada. Restam '+e.left+'.'); }
    else if(e.t==='evolve'||e.t==='level'){ dirty=true; }
  });
}
function maybeEvolve(){
  if(!active||!S||!S.pendingEvo||busyOverlay()) return;
  const pe=S.pendingEvo; Stage.Evo.start(pe.from,pe.to,()=>{ S.pendingEvo=null; saveLocal(); dirty=true; update(true); lastTs=performance.now(); });
}
function logicTick(){
  const now=performance.now(); let dt=(now-lastTs)/1000; lastTs=now;
  if(!S) return;
  const busy=busyOverlay();
  if(!busy){
    if(dt>20){ const r=Core.applyOffline(S,dt); if(r.gold>1){ if(active) showOffline(r); else pendingOff=r; } dirty=true; dt=0; }
    dt=Math.min(dt,20)*speed; if(mode!=='hunt') dt=0;
    const ev=[]; const h=Math.max(.05,dt/400);
    while(dt>1e-6){ const st=Math.min(h,dt); Core.tick(S,st,ev); dt-=st; }
    if(ev.length) handleEvents(ev);
    if(S.autoHunt&&now-lastAuto>4000){ lastAuto=now; const b=Core.bestHunt(S); if(b!==S.hunt){ Core.selectHunt(S,b); dirty=true; if(active) toast('🗺 Caça automática: <b>'+Core.HUNTS[b].name+'</b>.'); } }
    if(active) maybeEvolve();
    if(mode!=='hunt'&&now-lastInput>150000){ setMode('hunt'); toast('⚔ Você ficou parado, então o herói voltou para a caçada.'); }
  }
  if(now-lastLocal>5000){ lastLocal=now; saveLocal(); }
  if(dirty&&now-lastCloud>CLOUD_EVERY_MS){ lastCloud=now; saveCloud(); }
  if(active&&now-lastUi>250){ lastUi=now; update(); }
}
function rafLoop(ts){
  if(!active){ rafId=0; return; }
  const real=Math.min(.05,Math.max(0,(ts-(rafLoop.last||ts))/1000)); rafLoop.last=ts;
  if(S){ if(mode==='hunt') Stage.frame(real,Stage.Evo.active); else if(!busyOverlay()) Town.frame(real); }
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
  document.addEventListener('visibilitychange',()=>{ if(document.hidden){ if(S&&mode!=='hunt') setMode('hunt'); flush(); } else lastTs=performance.now(); });
  addEventListener('pagehide',()=>{ saveLocal(); });
  setUser(null);
}
function setUser(u){
  if(!mounted) return;
  if(u&&(uid===u.uid||loadingUid===u.uid)) return;
  if(S&&uid){ flush(); }
  S=null; uid=null; user=null; loadToken++; loadingUid=null; cloudBlocked=false;
  if(mode!=='hunt'){ mode='hunt'; $('stageWrap').classList.remove('cg-town'); Town.clearKeys(); Town.hidePrompt(); }
  farmShown=-1; shop=null;
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
  if(!active&&was){ if(S&&mode!=='hunt') setMode('hunt'); if(S) flush(); }
}
G.UI={mount,setUser,setActive,flush,get state(){return S;},get dev(){return DEV;}};
})(typeof window!=='undefined'?window:globalThis);
