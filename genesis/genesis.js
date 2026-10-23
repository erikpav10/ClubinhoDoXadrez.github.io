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
const LS_PREFIX='chessGenesis_v3_';
const CLOUD_EVERY_MS=30000;
const DEV=/[?&]genesis=teste/.test(location.search)||(function(){ try{ return localStorage.getItem('cgDev')==='1'; }catch(e){ return false; } })();

let host=null, adapter=null, mounted=false;
let S=null, user=null, uid=null;
let active=false, speed=1, paused=false;
let lastTs=0, lastUi=0, lastLocal=0, lastCloud=0, dirty=false, lastAuto=0, pendingOff=null, loadToken=0;
let rafId=0, tickId=0, loadingUid=null, cloudBlocked=false;
let mode='hunt', place='farm', lastInput=0, shop=null, farmShown=-1, farmSub='obras', farmRefresh=null, curTab='hunt', sleeping=false;
const $=id=>document.getElementById('cg-'+id);
const fmt=Core.fmt;
const refs={hunts:[],upg:{},gear:{},forms:[],bag:{mats:[]}};

/* ---------- HTML do módulo ---------- */
const HTML=`
<div class="rank-head"><div>
  <h2>♞ <span style="color:var(--gold);">CHESS GENESIS</span></h2>
  <p>Reúna os seis heróis, do Peão ao Rei. Você escolhe quem caça; quem está de folga trabalha na fazenda. Tudo continua rodando quando você está fora.</p>
</div></div>

<div class="cg-card cg-msg" id="cg-msg" style="display:none"></div>

<div id="cg-main" style="display:none">
  <div class="cg-stats">
    <div class="cg-card cg-stat"><div class="cg-lbl">Ouro</div><div class="cg-val" id="cg-sGold">0</div><div class="cg-sub" id="cg-sGoldRate"></div></div>
    <div class="cg-card cg-stat"><div class="cg-lbl">Nível</div><div class="cg-val" id="cg-sLevel">1</div><div class="cg-bar"><i id="cg-sXpBar"></i></div><div class="cg-sub" id="cg-sXp"></div></div>
    <div class="cg-card cg-stat"><div class="cg-lbl">Herói</div><div class="cg-val" id="cg-sForm">Peão</div><div class="cg-sub" id="cg-sNext"></div></div>
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
            <div class="cg-sleepfx" id="cg-sleepfx"><span>💤</span><b>Descansando…</b></div>
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
        <button class="cg-tab" data-tab="hero">Heróis</button>
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
          <div class="cg-nm2">Heróis</div>
          <div class="cg-btnrow" id="cg-evoBtns"></div>
          <div class="cg-nm2">Progresso offline</div>
          <div class="cg-btnrow"><button class="cg-btn cg-small" data-off="3600">Simular 1 hora</button><button class="cg-btn cg-small" data-off="28800">Simular 8 horas</button></div>
          <div class="cg-nm2">Outros</div>
          <div class="cg-btnrow"><button class="cg-btn cg-small" id="cg-btnGold">+100 mil ouro</button><button class="cg-btn cg-small" id="cg-btnLvl">+5 níveis (herói atual)</button><button class="cg-btn cg-small" id="cg-btnAll20">Todos nível 20</button><button class="cg-btn cg-small" id="cg-btnWork">Produção +1 h</button><button class="cg-btn cg-small" id="cg-btnFarmUp">Fazenda +1 nível</button><button class="cg-btn cg-small" id="cg-btnMats">+10 materiais</button><button class="cg-btn cg-small" id="cg-btnLand">Dar terreno</button><button class="cg-btn cg-small" id="cg-btnPot">+10 poções</button><button class="cg-btn cg-small cg-danger" id="cg-btnReset">Reiniciar progresso</button></div>
          <p class="cg-hint">Ferramentas de teste (aparecem só com ?genesis=teste na URL). O que você fizer aqui também é salvo.</p>
        </div>`:''}
      </div>
    </div>
  </div>
</div>

<div class="cg-toasts" id="cg-toasts"></div>
<div class="cg-overlay" id="cg-offline"><div class="cg-modal">
  <h2>♞ Bem-vindo de volta!</h2>
  <div class="cg-line" id="cg-offTime"></div><div class="cg-line" id="cg-offKills"></div><div class="cg-line" id="cg-offGold"></div><div class="cg-line" id="cg-offLv"></div><div class="cg-line" id="cg-offMats"></div><div class="cg-line" id="cg-offWork"></div>
  <button class="cg-btn cg-on" style="margin-top:14px;width:100%" id="cg-offOk">Continuar</button>
</div></div>
<div class="cg-evo" id="cg-build">
  <canvas id="cg-buildCv" width="256" height="144"></canvas>
  <div class="cg-evotxt"><h2 id="cg-buildTitle">FAZENDA MELHORADA!</h2><div class="cg-evosub" id="cg-buildSub"></div><div class="cg-evoskill" id="cg-buildDesc"></div><button class="cg-btn cg-on" id="cg-buildBtn" style="display:none;padding:9px 26px;font-size:15px">Continuar</button></div>
</div>
<div class="cg-evo" id="cg-evo">
  <canvas id="cg-evoCv" width="192" height="108"></canvas>
  <div class="cg-evotxt"><h2 id="cg-evoTitle">NOVO HERÓI!</h2><div class="cg-evosub" id="cg-evoSub"></div><div class="cg-evoskill" id="cg-evoSkill"></div><button class="cg-btn cg-on" id="cg-evoBtn" style="display:none;padding:9px 26px;font-size:15px">Continuar</button></div>
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
  const o={v:3,heroes:S.heroes.map(h=>({lv:h.lv,xp:Math.floor(h.xp),un:!!h.un})),active:S.active,gold:S.gold,upg:Object.assign({},S.upg),gear:{},hunt:S.hunt,autoHunt:!!S.autoHunt,kills:S.kills,deaths:S.deaths,lastSave:Date.now(),
    potions:S.potions,buffs:{atk:Math.round(S.buffs.atk),xp:Math.round(S.buffs.xp),luck:Math.round(S.buffs.luck),rest:Math.round(S.buffs.rest||0)},
    mats:S.mats.map(x=>Math.floor(x)),farm:S.farm,dep:S.dep.map(x=>Math.floor(x)),
    stock:S.stock.map(x=>Math.round(x*100)/100),chest:{pot:S.chest.pot,mats:S.chest.mats.map(x=>Math.floor(x))}};
  Core.SLOTS.forEach(s=>{ const it=S.gear[s]; if(it) o.gear[s]={slot:it.slot,tier:it.tier,rar:it.rar}; });
  if(S.pendingEvo) o.pendingEvo={from:S.pendingEvo.from,to:S.pendingEvo.to};
  return o;
}
const num=(v,d,min,max)=>{ v=Number(v); if(!isFinite(v)) return d; return Math.min(max,Math.max(min,v)); };
function hydrate(o){
  if(!o||o.v!==3||typeof o!=='object') return null;
  const s=Core.newState();
  for(let i=0;i<Core.NH;i++){ const h=o.heroes&&o.heroes[i]; s.heroes[i].lv=Math.floor(num(h&&h.lv,1,1,Core.MAXLV)); s.heroes[i].xp=num(h&&h.xp,0,0,1e300); s.heroes[i].un=i===0||!!(h&&h.un); }
  s.active=Math.floor(num(o.active,0,0,Core.NH-1)); if(!s.heroes[s.active].un) s.active=0;
  s.gold=num(o.gold,0,0,1e300);
  Core.UPGS.forEach(u=>{ s.upg[u.id]=Math.floor(num(o.upg&&o.upg[u.id],0,0,u.max)); });
  Core.SLOTS.forEach(sl=>{ const it=o.gear&&o.gear[sl]; if(it) s.gear[sl]={slot:sl,tier:Math.floor(num(it.tier,0,0,5)),rar:Math.floor(num(it.rar,0,0,3))}; });
  s.hunt=Math.floor(num(o.hunt,0,0,Core.HUNTS.length-1)); if(s.level<Core.HUNTS[s.hunt].min) s.hunt=0;
  s.autoHunt=o.autoHunt!==false;
  s.kills=Math.floor(num(o.kills,0,0,1e15)); s.deaths=Math.floor(num(o.deaths,0,0,1e15));
  s.lastSave=num(o.lastSave,Date.now(),0,Date.now()+60000);
  if(o.pendingEvo&&Core.FORMS[o.pendingEvo.to]) s.pendingEvo={from:Math.floor(num(o.pendingEvo.from,0,0,5)),to:Math.floor(num(o.pendingEvo.to,1,0,5))};
  const a6=(x,max)=>{ const r=[]; for(let i=0;i<6;i++) r.push(Math.floor(num(x&&x[i],0,0,max||1e9))); return r; };
  s.potions=Math.floor(num(o.potions,0,0,Core.POTION_CAP));
  s.buffs={}; ['atk','xp','luck','rest'].forEach(k=>{ s.buffs[k]=num(o.buffs&&o.buffs[k],0,0,Core.BUFF_MAX); });
  s.mats=a6(o.mats); s.dep=a6(o.dep);
  s.farm=Math.floor(num(o.farm,0,0,Core.FARM.length));
  s.stock=[0,0,0,0,0,0].map((_,i)=>num(o.stock&&o.stock[i],0,0,1e15));
  s.chest={pot:Math.floor(num(o.chest&&o.chest.pot,0,0,Core.CHEST_POT)),mats:a6(o.chest&&o.chest.mats,Core.CHEST_MAT)};
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
  /* saves do sistema antigo (um herói só, v2) são descartados: o progresso recomeça do zero */
  if(remote&&remote.v===2) remote=null;
  if(local&&local.v===2) local=null;
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
  if(!fresh){ const away=(Date.now()-S.lastSave)/1000; if(away>60){ const r=Core.applyOffline(S,away); if(r.gold>1||r.work>1) pendingOff=r; } }
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
  // heróis
  const hb=$('p-hero');
  const hint=document.createElement('p'); hint.className='cg-hint'; hint.style.margin='0 0 8px'; hint.innerHTML='Troque de herói quando quiser. Quem <b>não</b> está na caçada vai trabalhar na <b>fazenda</b> e produz mercadorias para o Mercador. Cada herói tem o próprio nível, até o 100.'; hb.appendChild(hint);
  Core.FORMS.forEach((f,i)=>{
    const r=document.createElement('div'); r.className='cg-form';
    r.appendChild(spriteCanvas(i));
    const d=document.createElement('div');
    d.innerHTML='<div class="cg-nm">'+f.name+' <span class="cg-tag cg-lvtag"></span><span class="cg-tag cg-st"></span></div><div class="cg-ds"><b style="color:var(--gold)">'+f.skill+'</b> — '+f.sd+'</div><div class="cg-bar cg-hxp" style="height:5px;margin:5px 0 2px"><i></i></div><div class="cg-ds cg-job"></div><div class="cg-reqs"></div><div class="cg-btnrow cg-hbtn" style="margin-top:6px"><button class="cg-btn cg-small cg-use">Jogar com ele</button><button class="cg-btn cg-small cg-on cg-rec">Recrutar</button></div>';
    r.appendChild(d); hb.appendChild(r);
    const rf={root:r,st:d.querySelector('.cg-st'),lv:d.querySelector('.cg-lvtag'),xp:d.querySelector('.cg-hxp'),xpi:d.querySelector('.cg-hxp i'),job:d.querySelector('.cg-job'),reqs:d.querySelector('.cg-reqs'),use:d.querySelector('.cg-use'),rec:d.querySelector('.cg-rec')};
    rf.use.onclick=()=>{ if(S&&Core.switchHero(S,i)){ dirty=true; saveLocal(); toast('Agora você joga com o <b>'+f.name+'</b>.'); update(true); } };
    rf.rec.onclick=()=>{ if(S&&Core.recruit(S,i)){ dirty=true; saveLocal(); saveCloud(); update(true); maybeEvolve(); } };
    refs.forms.push(rf);
  });
  // abas
  $('tabs').addEventListener('click',e=>{ const b=e.target.closest('.cg-tab'); if(!b) return; openTab(b.dataset.tab); });
  $('sceneBar').addEventListener('click',e=>{ const b=e.target.closest('.cg-scn'); if(!b||b.disabled) return; if(b.dataset.scene==='farm'&&mode==='farm'&&place==='house'){ enterPlace('farm'); return; } setMode(b.dataset.scene); });
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
function busyOverlay(){ return sleeping||Stage.Evo.active||Farm.Build.active||$('offline').classList.contains('cg-show'); }
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
  else if(m==='farm'){ place='farm'; Town.setScene('farm',{level:S.farm,state:S}); renderFarmPanel(true); openTab('farm'); }
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
function enterPlace(p){
  if(!S||mode!=='farm') return;
  place=p; Town.clearKeys(); Town.hidePrompt();
  Town.setScene(p,{level:S.farm,state:S}); lastInput=performance.now(); update(true);
}
function openFarmSub(sub){ farmSub=sub; renderFarmPanel(true); openTab('farm'); }
function doSleep(){
  if(!S||sleeping) return;
  if(!Core.canSleep(S)){ toast('🛏 Você ainda está com o <b>Descanso Renovado</b> ativo. Volte quando faltarem menos de 5 minutos.'); return; }
  Core.sleep(S); sleeping=true; Town.clearKeys(); Town.hidePrompt(); dirty=true; saveLocal();
  const fx=$('sleepfx'); fx.classList.remove('cg-run'); void fx.offsetWidth; fx.classList.add('cg-run');
  setTimeout(()=>{ fx.classList.remove('cg-run'); sleeping=false; lastTs=performance.now(); lastInput=performance.now(); update(true);
    toast('🛏 <b>Descanso Renovado!</b> +25% de XP e golpes 10% mais rápidos por 30 min de caçada. Vida totalmente recuperada.'); },2600);
}
function onEnter(z){
  if(!S) return;
  if(z.id==='board'){ openFarmSub('obras'); return; }
  if(z.id==='merchant'){ openFarmSub('merc'); return; }
  if(z.id==='door'){ enterPlace('house'); return; }
  if(z.id==='exit'){ enterPlace('farm'); return; }
  if(z.id==='chest'){ openFarmSub('bau'); return; }
  if(z.id==='bed'){ doSleep(); return; }
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
    head('🍺','Taverna do Peão Alegre','Poções para encarar caçadas mais difíceis. Se a mochila encher, as poções vão para o baú da fazenda.');
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
    const r=row('<div><div class="cg-nm">🌱 Terreno para fazenda <span class="cg-tag cg-st"></span></div><div class="cg-ds">Começa só com terra e mato. Com materiais raros das caçadas, vira uma cabana, uma casa, um sítio... até um castelo (10 níveis). Cada nível da fazenda dá +'+Math.round(Core.FARM_BONUS*100)+'% de ouro e XP.</div><div class="cg-ds" style="margin-top:4px">Preço: <b style="color:var(--gold)">'+fmt(Core.LAND_PRICE)+'</b> de ouro · herói nível '+Core.LAND_LEVEL+'+</div><div class="cg-ds" style="margin-top:4px">🐴 Com a fazenda você pode recrutar o <b>Cavalo</b>, e os heróis de folga passam a trabalhar nela.</div></div><div><button class="cg-btn cg-small cg-b"></button></div>');
    const st=r.querySelector('.cg-st'), b=r.querySelector('.cg-b');
    b.onclick=()=>{
      if(S.farm>0){ setMode('farm'); return; }
      if(Core.buyLand(S)){ dirty=true; saveLocal(); saveCloud(); toast('🏡 <b>Terreno comprado!</b> O botão <b>Fazenda</b> foi liberado.'); Town.sparkle(30,['#ffd24d','#fff2b0','#ffffff']);
        const l=Town.scene&&Town.scene.labels&&Town.scene.labels.find(x=>x.zone==='land'); if(l){ l.text='🏡 Terras'; Town.refreshLabels(); } }
      update(true);
    };
    rs.push(()=>{
      if(S.farm>0){ st.textContent='comprado'; st.className='cg-tag cg-curtag'; b.textContent='Ir para a Fazenda'; b.disabled=false; }
      else{ const lo=Core.bestLevel(S)<Core.LAND_LEVEL; st.textContent=lo?'nível '+Core.LAND_LEVEL:'à venda'; st.className='cg-tag'; b.textContent=lo?'Nível '+Core.LAND_LEVEL:'Comprar · '+fmt(Core.LAND_PRICE); b.disabled=lo||S.gold<Core.LAND_PRICE; r.classList.toggle('cg-locked',lo); }
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
const SUBS=[['obras','🔨 Obras'],['equipe','👥 Equipe'],['merc','💰 Mercador'],['bau','📦 Baú']];
function mk(tag,cls,html){ const d=document.createElement(tag); if(cls) d.className=cls; if(html!=null) d.innerHTML=html; return d; }
function renderFarmPanel(force){
  const box=$('p-farm'); if(!box) return;
  const lv=S?S.farm:0;
  if(!force&&lv===farmShown) return;
  farmShown=lv; farmRefresh=null; box.innerHTML='';
  if(!S||lv<1){ box.innerHTML='<div class="cg-nm2">Fazenda</div><p class="cg-hint" style="margin-top:4px">Você ainda não tem um terreno. Fale com o <b>Corretor de Terras</b> na cidade (herói nível '+Core.LAND_LEVEL+', '+fmt(Core.LAND_PRICE)+' de ouro). Com a fazenda você libera o Cavalo e coloca os heróis de folga para trabalhar.</p>'; return; }
  const cur=Core.FARM[lv-1];
  const h=mk('div','cg-shophead','<span class="cg-shopicon">🏡</span><div><div class="cg-nm" style="font-size:16px">'+cur.name+' <span class="cg-tag cg-curtag">nível '+lv+'/10</span></div><div class="cg-ds">'+cur.desc+(lv>1?' Bônus: +'+Math.round(Core.FARM_BONUS*(lv-1)*100)+'% de ouro e XP.':'')+'</div></div>');
  box.appendChild(h);
  const nav=mk('div','cg-subnav'); SUBS.forEach(([id,label])=>{ const b=mk('button','cg-subbtn'+(farmSub===id?' cg-on':''),label); b.dataset.sub=id; b.onclick=()=>{ farmSub=id; renderFarmPanel(true); }; nav.appendChild(b); });
  box.appendChild(nav);
  const body=mk('div','cg-subbody'); box.appendChild(body);
  if(farmSub==='equipe') farmRefresh=buildTeam(body);
  else if(farmSub==='merc') farmRefresh=buildMerchant(body);
  else if(farmSub==='bau') farmRefresh=buildChest(body);
  else farmRefresh=buildWorks(body);
  if(farmRefresh) farmRefresh();
}

/* Obras: entregar materiais e construir */
function buildWorks(box){
  const lv=S.farm, nx=Core.farmNext(S), rows=[];
  if(!nx){ box.appendChild(mk('p','cg-passive','<b>Castelo completo!</b> Você chegou ao topo da fazenda. Parabéns, campeão!')); }
  else{
    box.appendChild(mk('div','cg-nm2','Próxima obra: '+nx.name+' <span class="cg-tag">nível '+nx.lv+'</span>'));
    box.appendChild(mk('div','cg-ds',nx.desc));
    const rq=mk('div','cg-ds'); rq.style.marginTop='4px'; box.appendChild(rq);
    nx.mats.forEach((n,i)=>{ if(!n) return; const m=Core.MATS[i];
      const r=mk('div','cg-row','<div><div class="cg-nm">'+m.icon+' '+m.name+' <span class="cg-tag cg-prg"></span></div><div class="cg-bar" style="height:6px"><i class="cg-pb"></i></div><div class="cg-ds cg-bag"></div></div><div><button class="cg-btn cg-small cg-dl">Entregar</button></div>');
      box.appendChild(r);
      const ref={i,prg:r.querySelector('.cg-prg'),pb:r.querySelector('.cg-pb'),bag:r.querySelector('.cg-bag'),btn:r.querySelector('.cg-dl'),need:n};
      ref.btn.onclick=()=>{ const k=Core.deliverMat(S,i); if(k>0){ dirty=true; toast(m.icon+' Entregou <b>'+k+'</b> '+m.name+'.'); saveLocal(); } update(true); };
      rows.push(ref);
    });
    const br=mk('div','cg-btnrow','<button class="cg-btn cg-small cg-dlAll">Entregar tudo</button><button class="cg-btn cg-on cg-build">🔨 Construir</button>'); br.style.marginTop='10px'; box.appendChild(br);
    const all=br.querySelector('.cg-dlAll'), bb=br.querySelector('.cg-build');
    all.onclick=()=>{ const k=Core.deliverAll(S); if(k>0){ dirty=true; toast('📦 Entregou <b>'+k+'</b> materiais.'); saveLocal(); } update(true); };
    bb.onclick=()=>{ const from=S.farm; if(Core.upgradeFarm(S)){ dirty=true; saveLocal(); saveCloud(); renderFarmPanel(true); Farm.Build.start(from,S.farm,()=>{ if(mode==='farm') Town.setScene(place,{level:S.farm,state:S}); lastTs=performance.now(); update(true); }); } };
    var ctl={all,bb,rq,nx};
  }
  box.appendChild(mk('div','cg-nm2','Onde conseguir'));
  const info=mk('p','cg-hint'); info.style.marginTop='4px';
  info.innerHTML='Cada abate tem <b>'+(Core.MAT_CHANCE*100).toFixed(1).replace('.',',')+'%</b> de chance (elites <b>'+(Core.MAT_CHANCE*Core.MAT_ELITE_MUL*100).toFixed(1).replace('.',',')+'%</b>) de largar o material do tier da caçada. Para juntar o material de um tier, escolha uma caçada daquele tier (desligue a caça automática). Os materiais do <b>baú</b> também contam nas entregas. O <b>Elixir da Sorte</b> aumenta a chance em 50%.';
  box.appendChild(info);
  Core.MATS.forEach((m,i)=>{ box.appendChild(mk('div','cg-ds',m.icon+' <b>'+m.name+'</b> — Tier '+(i+1)+': '+Core.HUNTS.filter(x=>x.tier===i).map(x=>x.name).join(', '))).style.margin='2px 0'; });
  return ()=>{
    if(!ctl) return;
    rows.forEach(r=>{ const dep=S.dep[r.i], have=S.mats[r.i], inChest=S.chest.mats[r.i]; r.prg.textContent=dep+'/'+r.need; r.prg.className='cg-tag cg-prg'+(dep>=r.need?' cg-curtag':''); r.pb.style.width=Math.min(100,dep/r.need*100)+'%'; r.bag.textContent='Na mochila: '+have+(Core.houseOpen(S)?' · no baú: '+inChest:''); r.btn.disabled=dep>=r.need||(have+inChest)<1; r.btn.textContent=dep>=r.need?'Completo':'Entregar'; });
    const bl=Core.bestLevel(S), lvOk=bl>=ctl.nx.level; ctl.rq.innerHTML='Requer um herói nível <b style="color:'+(lvOk?'var(--success)':'#e0938c')+'">'+ctl.nx.level+'</b> (seu melhor: '+bl+') e todos os materiais entregues.';
    ctl.all.disabled=!S.mats.some((n,i)=>(n+S.chest.mats[i])>0&&ctl.nx.mats[i]>S.dep[i]); ctl.bb.disabled=!Core.farmReady(S);
  };
}

/* Equipe: os heróis de folga trabalhando */
function buildTeam(box){
  box.appendChild(mk('p','cg-hint','Os heróis que <b>não</b> estão na caçada trabalham aqui sozinhos, até quando você está fora. O que produzem fica no celeiro até o <b>Mercador</b> comprar. Quanto mais nível, mais produzem. O celeiro lota depois de <b id="cg-capH"></b> de trabalho.')).style.margin='0 0 8px';
  const rows=[];
  Core.FORMS.forEach((f,i)=>{
    const r=mk('div','cg-row','<div><div class="cg-nm">'+f.crop.icon+' '+f.name+' <span class="cg-tag cg-wst"></span></div><div class="cg-ds cg-wdesc"></div><div class="cg-bar cg-wbar" style="height:6px;margin-top:4px"><i></i></div><div class="cg-ds cg-wstock"></div></div>');
    box.appendChild(r); rows.push({i,root:r,st:r.querySelector('.cg-wst'),desc:r.querySelector('.cg-wdesc'),bar:r.querySelector('.cg-wbar i'),stock:r.querySelector('.cg-wstock')});
  });
  const tot=mk('div','cg-passive',''); tot.style.marginTop='8px'; box.appendChild(tot);
  return ()=>{
    const ch=$('capH'); if(ch) ch.textContent=Core.capHours(S)+' horas';
    let gph=0;
    rows.forEach(r=>{ const f=Core.FORMS[r.i], h=S.heroes[r.i], un=h.un, cur=r.i===S.active, working=un&&!cur;
      r.root.classList.toggle('cg-locked',!un);
      r.st.textContent=!un?'🔒 não recrutado':cur?'caçando (ativo)':'trabalhando'; r.st.className='cg-tag cg-wst'+(working?' cg-curtag':'');
      if(!un){ r.desc.textContent=f.job+'.'; r.bar.style.width='0%'; r.stock.textContent=''; return; }
      const rate=Core.workRate(S,r.i), cap=Core.barnCap(S,r.i), have=Math.floor(S.stock[r.i]);
      r.desc.innerHTML=f.job+' · nível '+h.lv+' · <b>'+fmt(rate)+' '+f.crop.name+'/h</b> ('+fmt(Core.workValue(S,r.i))+' ouro/h)'+(cur?' <span class="cg-dim">· parado: está caçando</span>':'');
      r.bar.style.width=Math.min(100,S.stock[r.i]/cap*100)+'%';
      r.stock.innerHTML='No celeiro: <b style="color:var(--gold)">'+fmt(have)+'</b> / '+fmt(cap)+' · vale '+fmt(have*f.crop.price)+' ouro';
      if(working) gph+=Core.workValue(S,r.i);
    });
    tot.innerHTML='Produção da equipe agora: <b>'+fmt(gph)+' ouro/h</b> em mercadorias. Valor no celeiro: <b>'+fmt(Core.stockValue(S))+'</b>.';
  };
}

/* Mercador: vende tudo que a equipe produziu */
function buildMerchant(box){
  box.appendChild(mk('div','cg-shophead','<span class="cg-shopicon">💰</span><div><div class="cg-nm" style="font-size:16px">Mercador da Entrada</div><div class="cg-ds">"Traga tudo que os seus heróis colheram. Pago na hora, em ouro!"</div></div>'));
  const rows=[];
  Core.FORMS.forEach((f,i)=>{
    const r=mk('div','cg-row','<div><div class="cg-nm">'+f.crop.icon+' '+f.crop.name+' <span class="cg-tag cg-n"></span></div><div class="cg-ds cg-p"></div></div><div><button class="cg-btn cg-small cg-sell">Vender</button></div>');
    box.appendChild(r); const rf={i,root:r,n:r.querySelector('.cg-n'),p:r.querySelector('.cg-p'),b:r.querySelector('.cg-sell')};
    rf.b.onclick=()=>{ const o=Core.sellStock(S,i); if(o.gold>0){ dirty=true; saveLocal(); toast('💰 Vendeu '+f.crop.icon+' <b>'+fmt(o.items[i])+'</b> '+f.crop.name+' por <b>'+fmt(o.gold)+'</b> de ouro.'); Town.flo&&mode==='farm'&&Town.flo('+'+fmt(o.gold)+' ouro','gold'); } update(true); };
    rows.push(rf);
  });
  const all=mk('button','cg-btn cg-on','Vender tudo'); all.style.cssText='width:100%;margin-top:10px;padding:9px'; box.appendChild(all);
  all.onclick=()=>{ const o=Core.sellStock(S); if(o.gold>0){ dirty=true; saveLocal(); saveCloud(); toast('💰 O Mercador pagou <b>'+fmt(o.gold)+'</b> de ouro por toda a colheita.'); if(mode==='farm'){ Town.flo('+'+fmt(o.gold)+' ouro','gold'); Town.sparkle(14,['#ffd24d','#fff2b0']); } } update(true); };
  box.appendChild(mk('p','cg-hint','O celeiro enche com o trabalho dos heróis de folga. Se ele lotar, a produção para até você vender.')).style.marginTop='8px';
  return ()=>{
    rows.forEach(r=>{ const f=Core.FORMS[r.i], un=S.heroes[r.i].un, n=Math.floor(S.stock[r.i]);
      r.root.classList.toggle('cg-locked',!un); r.n.textContent=un?fmt(n)+' / '+fmt(Core.barnCap(S,r.i)):'🔒'; r.p.textContent='Preço: '+f.crop.price+' ouro cada · total '+fmt(n*f.crop.price)+' ouro'; r.b.disabled=n<1; r.b.textContent=n>0?'Vender · '+fmt(n*f.crop.price):'Vender'; });
    const v=Core.stockValue(S); all.disabled=v<1; all.textContent=v>0?'Vender tudo · '+fmt(v)+' ouro':'Nada para vender ainda';
  };
}

/* Baú: mochila expandida (e a cama) */
function buildChest(box){
  if(!Core.houseOpen(S)){ box.appendChild(mk('p','cg-hint','Construa a <b>Cabana</b> (fazenda nível '+Core.HOUSE_LEVEL+') para ganhar uma casa, com um <b>baú</b> e uma <b>cama</b>.')); return null; }
  box.appendChild(mk('div','cg-shophead','<span class="cg-shopicon">📦</span><div><div class="cg-nm" style="font-size:16px">Baú da casa</div><div class="cg-ds">Mochila expandida: guarde poções e materiais. As entregas da obra usam o que estiver no baú.</div></div>'));
  const rows=[];
  const line=(label,key,idx,capBag,capChest)=>{
    const r=mk('div','cg-row','<div><div class="cg-nm">'+label+' <span class="cg-tag cg-c"></span></div><div class="cg-ds cg-b"></div></div><div class="cg-btncol"><button class="cg-btn cg-small cg-in">Guardar tudo</button><button class="cg-btn cg-small cg-out">Retirar tudo</button></div>');
    box.appendChild(r); const rf={key,idx,r,c:r.querySelector('.cg-c'),b:r.querySelector('.cg-b'),i:r.querySelector('.cg-in'),o:r.querySelector('.cg-out'),capBag,capChest};
    rf.i.onclick=()=>{ const n=Core.chestMove(S,key,idx,1e9,1); if(n>0){ dirty=true; saveLocal(); } update(true); };
    rf.o.onclick=()=>{ const n=Core.chestMove(S,key,idx,1e9,-1); if(n>0){ dirty=true; saveLocal(); } update(true); };
    rows.push(rf); };
  line('🧪 Poções de cura','pot',0);
  Core.MATS.forEach((m,i)=>line(m.icon+' '+m.name,'mat',i));
  const bed=mk('div','cg-passive',''); bed.style.marginTop='10px'; box.appendChild(bed);
  box.appendChild(mk('p','cg-hint','🛏 A <b>cama</b> fica dentro da casa: entre pela porta e fale com ela para ativar o <b>Descanso Renovado</b> (30 min, só conta durante a caçada).')).style.marginTop='6px';
  return ()=>{
    rows.forEach(rf=>{ const pot=rf.key==='pot'; const bag=pot?S.potions:S.mats[rf.idx], ch=pot?S.chest.pot:S.chest.mats[rf.idx], cap=pot?Core.CHEST_POT:Core.CHEST_MAT, bcap=pot?Core.POTION_CAP:null;
      rf.c.textContent='baú '+ch+'/'+cap; rf.b.textContent='Na mochila: '+bag+(bcap?'/'+bcap:''); rf.i.disabled=bag<1||ch>=cap; rf.o.disabled=ch<1||(pot&&bag>=bcap); });
    const rest=S.buffs.rest||0; bed.innerHTML=rest>0?'🛏 <b>Descanso Renovado</b> ativo: <b>'+fmtMin(rest)+'</b> restantes.':'🛏 Sem descanso ativo. Durma na cama para ganhar +25% de XP.';
  };
}
function refreshFarm(){
  if(!S) return;
  if(S.farm!==farmShown){ renderFarmPanel(true); return; }
  if(farmRefresh&&curTab==='farm') farmRefresh();
}

/* --- mochila (aba Equip.) e faixa de status --- */
function buildBag(){
  const gb=$('p-gear'); const d=document.createElement('div'); d.innerHTML='<div class="cg-nm2">Mochila</div><div class="cg-ds" id="cg-bagPot" style="margin:4px 0"></div><div id="cg-bagMats"></div><p class="cg-hint" id="cg-bagHint"></p>'; gb.appendChild(d);
  const mb=d.querySelector('#cg-bagMats');
  Core.MATS.forEach((m,i)=>{ const r=document.createElement('div'); r.className='cg-ds'; r.style.margin='2px 0'; mb.appendChild(r); refs.bag.mats[i]=r; });
}
function refreshBag(){
  const b=refs.bag; $('bagPot').innerHTML='🧪 Poções de cura: <b>'+S.potions+'</b>/'+Core.POTION_CAP+(Core.houseOpen(S)?' <span class="cg-dim">· no baú: '+S.chest.pot+'</span>':'');
  Core.MATS.forEach((m,i)=>{ b.mats[i].innerHTML=m.icon+' '+m.name+': <b style="color:'+(S.mats[i]>0?'var(--gold)':'inherit')+'">'+S.mats[i]+'</b>'+(Core.houseOpen(S)&&S.chest.mats[i]>0?' <span class="cg-dim">· no baú: '+S.chest.mats[i]+'</span>':''); });
  $('bagHint').textContent='Os materiais caem raramente nas caçadas e servem para construir a fazenda.';
}
function refreshChips(){
  const c=[]; if(S.potions>0) c.push('<span class="cg-chip">🧪 '+S.potions+'</span>');
  Core.ELIXIRS.forEach(x=>{ if(S.buffs[x.id]>0) c.push('<span class="cg-chip cg-chip-on">'+x.icon+' '+fmtMin(S.buffs[x.id])+'</span>'); });
  if(S.buffs.rest>0) c.push('<span class="cg-chip cg-chip-on" title="Descanso Renovado">🛏 '+fmtMin(S.buffs.rest)+'</span>');
  { const v=Core.stockValue(S); if(S.farm>0&&v>0) c.push('<span class="cg-chip" title="Mercadorias no celeiro, esperando o Mercador">🌾 '+fmt(v)+'</span>'); }
  const h=c.join(''); const el=$('chips'); if(el._h!==h){ el._h=h; el.innerHTML=h; } el.style.display=c.length?'flex':'none';
}

function buildGenerated(){ /* nada a recriar por usuário; mantido para futuras extensões */ }
function buildDev(){
  const box=$('evoBtns');
  Core.FORMS.forEach((f,i)=>{ if(!i) return; const b=document.createElement('button'); b.className='cg-btn cg-small'; b.textContent='Liberar '+f.name; b.onclick=()=>{ if(!S) return; Core.devUnlock(S,i); dirty=true; update(true); toast(f.name+' liberado (nível '+S.heroes[i].lv+').'); }; box.appendChild(b); });
  { const b=document.createElement('button'); b.className='cg-btn cg-small'; b.textContent='Ver cerimônia do herói atual'; b.onclick=()=>{ if(!S||S.active===0) return; S.pendingEvo={from:Math.max(0,S.active-1),to:S.active}; maybeEvolve(); }; box.appendChild(b); }
  host.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{ speed=parseInt(b.dataset.speed,10); host.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('cg-on',x===b)); });
  host.querySelectorAll('[data-off]').forEach(b=>b.onclick=()=>{ if(!S) return; showOffline(Core.applyOffline(S,parseInt(b.dataset.off,10))); dirty=true; update(true); });
  $('btnGold').onclick=()=>{ S.gold+=100000; dirty=true; update(true); };
  $('btnLvl').onclick=()=>{ Core.setLevel(S,S.level+5); dirty=true; update(true); };
  $('btnAll20').onclick=()=>{ S.heroes.forEach((h,i)=>{ h.un=true; h.lv=Math.max(h.lv,20); }); dirty=true; update(true); toast('Todos os heróis liberados no nível 20.'); };
  $('btnMats').onclick=()=>{ for(let i=0;i<6;i++) S.mats[i]+=10; dirty=true; update(true); };
  $('btnLand').onclick=()=>{ if(Core.bestLevel(S)<Core.LAND_LEVEL) Core.setLevel(S,Core.LAND_LEVEL); if(!S.farm){ S.farm=1; S.dep=[0,0,0,0,0,0]; } dirty=true; renderFarmPanel(true); update(true); };
  $('btnWork').onclick=()=>{ Core.work(S,3600); dirty=true; update(true); toast('+1 hora de trabalho no celeiro.'); };
  $('btnFarmUp').onclick=()=>{ if(!S.farm){ S.farm=1; } else if(S.farm<Core.FARM.length){ S.farm++; } S.dep=[0,0,0,0,0,0]; dirty=true; renderFarmPanel(true); if(mode==='farm') Town.setScene(place,{level:S.farm,state:S}); update(true); };
  $('btnPot').onclick=()=>{ S.potions=Math.min(Core.POTION_CAP,S.potions+10); dirty=true; update(true); };
  $('btnReset').onclick=()=>{ if(confirm('Apagar todo o progresso do Chess Genesis?')){ S=Core.newState(); if(mode!=='hunt') setMode('hunt'); dirty=true; saveLocal(); saveCloud(); update(true); toast('Progresso reiniciado.'); } };
}
function showOffline(r){
  $('offTime').innerHTML='Você ficou fora por <b>'+Core.fmtTime(r.seconds)+'</b>.';
  $('offKills').innerHTML=r.kills?('Seu herói derrotou <b>'+fmt(r.kills)+'</b> inimigos.'):'Seu herói aguardou em posição.';
  $('offGold').innerHTML=r.gold>1?'Ouro coletado: <b>'+fmt(r.gold)+'</b>.':'';
  $('offLv').innerHTML=r.levels?('Seu herói subiu <b>'+r.levels+'</b> nível(is).'):'';
  $('offWork').innerHTML=(r.work>1)?('🌾 Os heróis de folga trabalharam na fazenda e produziram mercadorias no valor de <b>'+fmt(r.work)+'</b> de ouro. Vá ao <b>Mercador</b> para vender.'):'';
  { const ms=(r.mats||[]).map((n,i)=>n>0?Core.MATS[i].icon+' '+n+' '+Core.MATS[i].name:'').filter(Boolean); $('offMats').innerHTML=ms.length?('Materiais encontrados: <b>'+ms.join(' · ')+'</b>'):''; }
  $('offline').classList.add('cg-show');
}

/* ---------- atualização da interface ---------- */
function refreshHeroes(){
  refs.forms.forEach((r,i)=>{
    const h=S.heroes[i], f=Core.FORMS[i], cur=i===S.active, can=Core.canRecruit(S,i);
    r.root.classList.toggle('cg-cur',cur); r.root.classList.toggle('cg-locked',!h.un&&!can);
    r.lv.textContent=h.un?'nível '+h.lv+(h.lv>=Core.MAXLV?' (máx.)':''):(can?'disponível':'bloqueado'); r.lv.className='cg-tag cg-lvtag'+(h.un?'':' cg-dimtag');
    r.st.textContent=cur?'em caçada':(h.un?(S.farm>0?'na fazenda':'de folga'):(can?'pronto!':'🔒')); r.st.className='cg-tag cg-st'+(cur?' cg-curtag':'');
    r.xp.style.display=h.un?'block':'none'; if(h.un) r.xpi.style.width=(h.lv>=Core.MAXLV?100:Math.min(100,h.xp/Core.xpToNext(h.lv)*100))+'%';
    r.job.innerHTML=(h.un&&S.farm>0&&!cur)?(f.crop.icon+' '+f.job+': <b style="color:var(--gold)">'+fmt(Core.workRate(S,i))+' '+f.crop.name+'/h</b>'):(f.crop.icon+' Na fazenda: '+f.job.toLowerCase()+'.');
    if(h.un){ r.reqs.innerHTML=''; }
    else{ const html=Core.heroReqs(S,i).map(q=>{
        const nm=q.kind==='hero'?Core.FORMS[q.hero].name+' nível '+q.lv+(q.have>0&&!q.ok?' <span class="cg-dim">(você: '+q.have+')</span>':''):(q.lv>=Core.FARM.length?'Fazenda no nível máximo (10)':(q.lv===1?'Comprar a fazenda (nível 1)':'Fazenda nível '+q.lv))+(!q.ok&&q.kind==='farm'&&q.have>0?' <span class="cg-dim">(atual: '+q.have+')</span>':'');
        return '<div class="cg-rq '+(q.ok?'cg-rqok':'cg-rqno')+'">'+(q.ok?'✓':'✗')+' '+nm+'</div>'; }).join('');
      if(r.reqs._h!==html){ r.reqs._h=html; r.reqs.innerHTML='<div class="cg-ds" style="margin-top:4px">Para recrutar:</div>'+html; } }
    r.use.style.display=(h.un&&!cur)?'inline-block':'none';
    r.rec.style.display=(!h.un&&can)?'inline-block':'none';
  });
}
function pct(x){ return (x*100).toFixed(x<.1?1:0)+'%'; }
function update(){
  if(!S||!mounted) return;
  const D=Core.derive(S), F=D.form, need=Core.xpToNext(S.level);
  const nUn=S.heroes.filter(h=>h.un).length;
  $('sGold').textContent=fmt(S.gold);
  const ex=Core.expected(S); $('sGoldRate').textContent='≈ '+fmt(ex.kps*ex.gold*60)+' ouro/min';
  $('sLevel').textContent=S.level+(S.level>=Core.MAXLV?' (máx.)':'');
  $('sXpBar').style.width=(S.level>=Core.MAXLV?100:Math.min(100,S.xp/need*100))+'%';
  $('sXp').textContent=S.level>=Core.MAXLV?'Nível máximo':fmt(S.xp)+' / '+fmt(need)+' XP';
  $('sForm').textContent=F.name;
  { const nxt=S.heroes.findIndex(h=>!h.un); const rc=Core.FORMS.findIndex((f,i)=>Core.canRecruit(S,i));
    $('sNext').textContent=rc>=0?('Pronto para recrutar: '+Core.FORMS[rc].name+'!'):(nxt>=0?('Heróis: '+nUn+'/6 · próximo: '+Core.FORMS[nxt].name):'Time completo (6/6)'); }
  $('sKills').textContent=fmt(S.kills); $('sDeaths').textContent=S.deaths?('derrotas: '+S.deaths):'sem derrotas';
  $('hName').textContent=F.name+' · Nv '+S.level;
  $('heroStats').innerHTML=[['Vida',fmt(D.maxHp)],['Ataque',fmt(D.atk)],['Defesa',fmt(D.def)+' ('+Math.round((1-D.dmgTaken)*100)+'%)'],['Golpes/s',(1/D.interval).toFixed(2)],['Crítico',pct(D.crit)+' ×'+D.cm],['Dano/s',fmt(D.dps)],['Ouro','+'+pct(D.goldMul-1)],['XP','+'+pct(D.xpMul-1)]].map(a=>'<div class="cg-hs"><span>'+a[0]+'</span><b>'+a[1]+'</b></div>').join('');
  $('passive').innerHTML='<b>'+F.skill+'</b> — '+F.sd+(D.learn>1.001?'<br><span class="cg-dim">📚 Mentoria: +'+Math.round((D.learn-1)*100)+'% de XP, porque o seu herói mais forte está no nível '+Core.bestLevel(S)+'.</span>':'')+(D.rest?'<br><span style="color:var(--success)">🛏 Descanso Renovado: +25% de XP e golpes 10% mais rápidos.</span>':'');
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
  refreshHeroes();
  { const rc=Core.FORMS.some((f,i)=>Core.canRecruit(S,i)); const tb=host.querySelector('[data-tab="hero"]'); if(tb) tb.classList.toggle('cg-ping',rc); }
}

/* ---------- laço do jogo ---------- */
function handleEvents(ev){
  if(active) Stage.onEvents(ev);
  ev.forEach(e=>{
    if(e.t==='loot'){ dirty=true; if(!active) return; if(!e.equipped&&e.item.rar<2) return; const R=Core.RARITY[e.item.rar]; toast('<b style="color:'+R.c+'">'+R.n+'</b> · '+Core.itemName(e.item)+(e.equipped?' <span style="color:var(--success)">equipado!</span>':' <span style="color:var(--text-dim)">vendido por '+fmt(e.sold)+'</span>')); }
    else if(e.t==='down'&&e.streak>=3&&active){ toast('⚠ Seu herói caiu várias vezes. Tente uma caçada de nível menor ou treine mais.',true); }
    else if(e.t==='mat'){ dirty=true; const m=Core.MATS[e.tier]; if(active) toast('<b style="color:#ffd24d">'+m.icon+' '+m.name+'</b> encontrado! <span class="cg-dim">(raro)</span>'); }
    else if(e.t==='potion'){ dirty=true; if(active) toast('🧪 Poção de Cura usada. Restam '+e.left+'.'); }
    else if(e.t==='recruitReady'){ dirty=true; if(active) toast('🎉 Você já pode recrutar o <b>'+Core.FORMS[e.hero].name+'</b>! Abra a aba <b>Heróis</b>.'); }
    else if(e.t==='level'){ dirty=true; }
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
    if(dt>20){ const r=Core.applyOffline(S,dt); if(r.gold>1||r.work>1){ if(active) showOffline(r); else pendingOff=r; } dirty=true; dt=0; }
    dt=Math.min(dt,20)*speed; Core.work(S,dt); if(mode!=='hunt') dt=0;
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
  farmShown=-1; shop=null; place='farm'; sleeping=false;
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
