(function(root){
/* ===== CHESS GENESIS IDLE — NÚCLEO (regras e números; sem tela) ===== */
const Core=(function(){
"use strict";
const MAXLV=100;
const WALK_TIME=1.3, KILL_PAUSE=0.6, DOWN_TIME=5;
const OFFLINE_CAP=8*3600, OFFLINE_EFF=0.5;
const ELITE_CHANCE=0.08;

/* Formas da peça (evoluem em marcos de nível) */
const FORMS=[
 {id:'pawn',  name:'Peão',  lv:1,  atk:1,   hp:1,   def:1,   int:1.0, crit:.03, cm:1.8, regen:.010, skill:'Avanço',      sd:'O primeiro golpe de cada luta causa +50% de dano.'},
 {id:'knight',name:'Cavalo',lv:20, atk:1.5, hp:1.35,def:1.2, int:.85, crit:.06, cm:1.8, regen:.010, skill:'Salto em L',  sd:'20% de chance de golpear duas vezes.'},
 {id:'rook',  name:'Torre', lv:40, atk:1.85,hp:2.3, def:2.1, int:1.1, crit:.05, cm:1.8, regen:.010, skill:'Muralha',     sd:'Recebe 15% menos dano.'},
 {id:'bishop',name:'Bispo', lv:60, atk:2.8, hp:2.4, def:1.8, int:1.0, crit:.10, cm:1.9, regen:.030, skill:'Luz Sagrada', sd:'Regenera 3% da vida por segundo.'},
 {id:'queen', name:'Rainha',lv:80, atk:4.2, hp:3.8, def:2.6, int:.85, crit:.15, cm:2.3, regen:.020, skill:'Soberana',    sd:'Crítico mais frequente e muito mais forte.'},
 {id:'king',  name:'Rei',   lv:90, atk:5.4, hp:5.2, def:3.2, int:.80, crit:.15, cm:2.3, regen:.020, skill:'Decreto Real',sd:'+25% de ouro e de experiência.'}
];
function formIndex(level){ let k=0; for(let i=0;i<FORMS.length;i++) if(level>=FORMS[i].lv) k=i; return k; }

/* Tipos de inimigo (a arte usa piece + pal) */
const KINDS={
 pawnBlack:   {name:'Peão Preto',        piece:'pawn',  pal:'dark'},
 pawnWorn:    {name:'Peão Desgastado',   piece:'pawn',  pal:'rust'},
 pawnWhite:   {name:'Peão Equipado',     piece:'pawn',  pal:'pale'},
 pawnGuard:   {name:'Peão Guardião',     piece:'pawn',  pal:'blue'},
 pawnElite:   {name:'Peão de Elite',     piece:'pawn',  pal:'crimson'},
 knightShadow:{name:'Cavalo das Sombras',piece:'knight',pal:'shadow'},
 knightBronze:{name:'Cavalo de Bronze',  piece:'knight',pal:'bronze'},
 knightSteel: {name:'Cavalo de Aço',     piece:'knight',pal:'steel'},
 rookStone:   {name:'Torre de Pedra',    piece:'rook',  pal:'stone'},
 rookEnch:    {name:'Torre Enfeitiçada', piece:'rook',  pal:'teal'},
 rookObs:     {name:'Torre de Obsidiana',piece:'rook',  pal:'obsidian'},
 bishopShadow:{name:'Bispo Sombrio',     piece:'bishop',pal:'violet'},
 bishopElem:  {name:'Bispo Elemental',   piece:'bishop',pal:'ember'},
 queenGuard:  {name:'Guarda da Rainha',  piece:'knight',pal:'crimson'},
 queenRival:  {name:'Rainha Rival',      piece:'queen', pal:'blood'},
 kingRenegade:{name:'Rei Renegado',      piece:'king',  pal:'void'}
};

const TIERS=[
 {name:'Os Primeiros Passos',   icon:'🌾'},
 {name:'As Rotas Comerciais',   icon:'🍺'},
 {name:'O Domínio dos Cavaleiros',icon:'🏰'},
 {name:'Bastiões e Fortificações',icon:'🛡'},
 {name:'O Domínio Sagrado',     icon:'🔮'},
 {name:'O Trono Real',          icon:'👑'}
];

/* Hunts (caçadas): 2 por tier */
const HUNTS=[
 {id:'campos',   tier:0,name:'Campos de Trigo',        lo:1, hi:5,  min:1,  kinds:['pawnBlack','pawnWorn'],                 scene:'farm'},
 {id:'vila',     tier:0,name:'Vila Rural',             lo:5, hi:10, min:5,  kinds:['pawnBlack','pawnWorn'],                 scene:'village'},
 {id:'estrada',  tier:1,name:'Estrada dos Viajantes',  lo:10,hi:15, min:10, kinds:['pawnWhite','pawnWorn','pawnGuard'],     scene:'road'},
 {id:'casarao',  tier:1,name:'Casarão Abandonado',     lo:15,hi:20, min:15, kinds:['pawnGuard','pawnWhite'],                scene:'mansion'},
 {id:'acamp',    tier:2,name:'Acampamento Militar',    lo:20,hi:30, min:20, kinds:['pawnElite','knightShadow'],             scene:'camp'},
 {id:'ponte',    tier:2,name:'Ponte de Pedra',         lo:30,hi:40, min:30, kinds:['knightShadow','knightBronze','pawnElite'],scene:'bridge'},
 {id:'muralha',  tier:3,name:'Muralhas do Castelo',    lo:40,hi:50, min:40, kinds:['rookStone','knightSteel'],              scene:'wall'},
 {id:'ruinas',   tier:3,name:'Torre de Vigia e Ruínas',lo:50,hi:60, min:50, kinds:['rookStone','rookEnch','knightSteel'],   scene:'ruins'},
 {id:'santuario',tier:4,name:'Santuário Místico',      lo:60,hi:70, min:60, kinds:['bishopShadow','rookObs'],               scene:'shrine'},
 {id:'biblio',   tier:4,name:'Biblioteca Esquecida',   lo:70,hi:80, min:70, kinds:['bishopElem','bishopShadow','rookObs'],  scene:'library'},
 {id:'trono',    tier:5,name:'Salão do Trono',         lo:80,hi:90, min:80, kinds:['queenGuard','queenRival'],              scene:'throne'},
 {id:'xeque',    tier:5,name:'Dimensão do Xeque-Mate', lo:90,hi:100,min:90, kinds:['queenRival','kingRenegade','queenGuard'],scene:'void'}
];

/* Melhorias compradas com ouro */
const UPGS=[
 {id:'atk', name:'Treino de Combate', icon:'⚔', base:40, g:1.32,max:50,desc:'+6% de ataque por nível'},
 {id:'hp',  name:'Vigor',             icon:'❤', base:40, g:1.32,max:50,desc:'+6% de vida por nível'},
 {id:'def', name:'Armadura Reforçada',icon:'🛡', base:60, g:1.32,max:50,desc:'+8% de defesa por nível'},
 {id:'spd', name:'Passo Ágil',        icon:'💨', base:150,g:1.37,max:25,desc:'−2% no tempo entre golpes por nível'},
 {id:'gold',name:'Faro para Ouro',    icon:'💰', base:100,g:1.32,max:50,desc:'+8% de ouro por nível'},
 {id:'xp',  name:'Estudo Tático',     icon:'📖', base:250,g:1.34,max:50,desc:'+5% de experiência por nível'}
];
function upgCost(u,lvl){ return Math.ceil(u.base*Math.pow(u.g,lvl)); }

/* Equipamentos (drops) */
const SLOTS=['weapon','armor','charm'];
const SLOT_NAME={weapon:'Arma',armor:'Armadura',charm:'Amuleto'};
const ITEM_NAMES={
 weapon:['Enxada Afiada','Cajado de Viajante','Lança de Cavaleiro','Martelo de Pedra','Cetro Sagrado','Espada Real'],
 armor: ['Gibão de Palha','Capa de Viajante','Cota de Malha','Escudo de Torre','Manto Místico','Armadura Real'],
 charm: ['Amuleto de Trigo','Moeda da Sorte','Brasão do Cavaleiro','Selo da Muralha','Relicário Antigo','Coroa Menor']
};
const SLOT_EFFECT={weapon:'ataque',armor:'vida e defesa',charm:'ouro e XP'};
const RARITY=[{n:'Comum',m:1,c:'#b9b3a3'},{n:'Raro',m:1.6,c:'#6aa8e8'},{n:'Épico',m:2.4,c:'#b57be8'},{n:'Lendário',m:3.5,c:'#f0b441'}];
const GEAR_PCT=0.03;
function itemPower(it){ return it?(it.tier+1)*RARITY[it.rar].m:0; }
function itemBonus(it){ return itemPower(it)*GEAR_PCT; }
function itemSell(it){ return Math.max(1,Math.round(3*itemPower(it)*Math.pow(1.9,it.tier+1)*GOLD_SCALE)); }
function itemName(it){ return ITEM_NAMES[it.slot][it.tier]; }


/* =====================================================================
   CIDADE, POÇÕES, MATERIAIS, TERRENO E FAZENDA
   ===================================================================== */
/* Materiais: cada tier de caçada solta o seu. Chance bem baixa de propósito. */
const MATS=[
 {id:'wood',   name:'Tábua de Carvalho', icon:'🪵', tier:0},
 {id:'tile',   name:'Telha de Barro',    icon:'🧱', tier:1},
 {id:'stone',  name:'Bloco de Pedra',    icon:'🪨', tier:2},
 {id:'iron',   name:'Barra de Ferro',    icon:'🔩', tier:3},
 {id:'crystal',name:'Cristal Sagrado',   icon:'🔮', tier:4},
 {id:'royal',  name:'Fragmento Real',    icon:'👑', tier:5}
];
const MAT_CHANCE=0.009;      /* 0,90% por abate */
const MAT_ELITE_MUL=3;       /* elites: 2,7% */
const LUCK_MUL=1.5;          /* Elixir da Sorte */

/* Fazenda: nível 1 = terreno vazio ... nível 10 = castelo.
   level = nível do herói exigido; mats = materiais por tier (6 números). */
const LAND_LEVEL=25, LAND_PRICE=600000;
const FARM_BONUS=0.01;       /* +1% de ouro e XP por nível da fazenda acima do 1 */
const FARM=[
 {lv:1, name:'Terreno Vazio',       level:0,  mats:[0,0,0,0,0,0],        desc:'Só terra e mato. Tudo começa aqui.'},
 {lv:2, name:'Cabana e Hortinha',   level:25, mats:[8,0,0,0,0,0],        desc:'Uma cabana de madeira e as primeiras plantações.'},
 {lv:3, name:'Casa de Campo',       level:30, mats:[12,6,0,0,0,0],       desc:'Uma casa de verdade, com poço e uma horta maior.'},
 {lv:4, name:'Sítio de Pedra',      level:38, mats:[0,14,6,0,0,0],       desc:'Base de pedra, chaminé, celeiro e pomar.'},
 {lv:5, name:'Fazenda do Moinho',   level:46, mats:[0,16,12,0,0,0],      desc:'Casa de dois andares, celeiro e um moinho girando.'},
 {lv:6, name:'Casarão',             level:54, mats:[0,0,20,8,0,0],       desc:'Um casarão de telhas vermelhas com jardim.'},
 {lv:7, name:'Mansão com Jardins',  level:62, mats:[0,0,0,18,6,0],       desc:'Alas laterais, fonte e muro com portão.'},
 {lv:8, name:'Solar Fortificado',   level:70, mats:[0,0,0,22,12,0],      desc:'Muralhas, torres de vigia e estandartes.'},
 {lv:9, name:'Fortaleza',           level:80, mats:[0,0,0,0,20,6],       desc:'Uma fortaleza com fosso e ponte levadiça.'},
 {lv:10,name:'Castelo Real',        level:90, mats:[0,0,0,0,28,14],      desc:'O castelo dos campeões. O auge da sua jornada.'}
];

/* Loja: cada tier libera no mesmo nível da caçada correspondente */
const SHOP_LV=[1,10,20,40,60,80];
const SHOP_BASE=[300,2000,25000,150000,500000,1200000];
const SHOP_RARE_MUL=2.5;

/* Poções */
const POTION_CAP=30, BUFF_DUR=1800, BUFF_MAX=7200;
const ELIXIRS=[
 {id:'atk', name:'Elixir de Força', icon:'⚔', desc:'+25% de ataque por 30 min'},
 {id:'xp',  name:'Elixir do Saber', icon:'📖', desc:'+25% de experiência por 30 min'},
 {id:'luck',name:'Elixir da Sorte', icon:'🍀', desc:'+50% de chance de materiais por 30 min'}
];

/* ---------- fórmulas ---------- */
/* Ritmo "volta todo dia": o fator de lentidão cresce com o nível */
const SLOW_BASE=5, SLOW_EXTRA=9, SLOW_KNEE=50, GOLD_SCALE=0.05;
function slow(L){ return SLOW_BASE+SLOW_EXTRA*Math.min(1,Math.pow(L/SLOW_KNEE,1.6)); }
function xpToNext(L){ return Math.max(12,Math.round(0.37*Math.pow(L,4.1)*(1+Math.pow(L/30,1.75))*slow(L))); }
function heroBase(L){
  const f=FORMS[formIndex(L)];
  return {atk:5*Math.pow(1.065,L-1)*f.atk, hp:40*Math.pow(1.07,L-1)*f.hp, def:(2+0.9*L)*f.def, f};
}
function drOf(def){ return Math.min(0.7,def/(def+150)); }

function derive(S){
  const b=heroBase(S.level), f=b.f, up=S.upg, g=S.gear;
  const wA=itemBonus(g.weapon), aH=itemBonus(g.armor), cH=itemBonus(g.charm);
  const bf=S.buffs||{};
  const farmMul=1+FARM_BONUS*Math.max(0,(S.farm||0)-1);
  const atk=b.atk*(1+0.06*up.atk)*(1+wA)*(bf.atk>0?1.25:1);
  const maxHp=b.hp*(1+0.06*up.hp)*(1+aH);
  const def=b.def*(1+0.08*up.def)*(1+aH);
  const dmgTaken=(1-drOf(def))*(f.id==='rook'?0.85:1);
  const interval=Math.max(0.4,f.int*(1-0.02*up.spd));
  const kingMul=f.id==='king'?1.25:1;
  const goldMul=(1+0.08*up.gold)*(1+cH)*kingMul*farmMul;
  const xpMul=(1+0.05*up.xp)*(1+cH)*kingMul*farmMul*(bf.xp>0?1.25:1);
  const critAvg=1+f.crit*(f.cm-1);
  const dps=atk*critAvg*(f.id==='knight'?1.16:1)/interval;
  return {form:f,formIdx:formIndex(S.level),atk,maxHp,def,dmgTaken,interval,crit:f.crit,cm:f.cm,regen:f.regen,goldMul,xpMul,dps};
}

/* Inimigo calculado a partir de um herói "de referência" do mesmo nível:
   sem melhorias, o herói vence perdendo ~15% da vida. Melhorias/nível dão folga. */
function enemyStats(e,elite){
  const ref=heroBase(e), f=ref.f, hits=4.2;
  const eInt=elite?1.2:1.3;
  const T=hits*f.int, n=T/eInt;
  const refDm=(1-drOf(ref.def))*(f.id==='rook'?0.85:1);
  const hp=ref.atk*hits*(elite?2.0:1);
  const atk=0.15*ref.hp/(n*refDm)*(elite?0.9:1);
  return {hp,atk,int:eInt};
}
function relFactor(L,e){ return Math.max(0.15,Math.min(1,1-0.07*(L-e-3))); }
function xpKill(S,e,elite,d){ return 10*e*e*(elite?2.5:1)*d.xpMul*relFactor(S.level,e); }
function goldKill(e,elite,d){ return Math.max(1,1.2*Math.pow(e,1.7)*GOLD_SCALE*(elite?3:1)*d.goldMul); }

/* ---------- estado ---------- */
function newState(){
  const S={v:2,level:1,xp:0,gold:0,
    upg:{},gear:{weapon:null,armor:null,charm:null},
    hunt:0,autoHunt:true,kills:0,deaths:0,deathStreak:0,
    potions:0,buffs:{atk:0,xp:0,luck:0},mats:[0,0,0,0,0,0],farm:0,dep:[0,0,0,0,0,0],potCd:0,
    lastSave:Date.now(),pendingEvo:null,
    phase:'walk',pt:0,heroHp:1,enemy:null,first:true,atkT:0,enemyT:0};
  UPGS.forEach(u=>S.upg[u.id]=0);
  S.heroHp=derive(S).maxHp; spawn(S);
  return S;
}
function spawn(S){
  const h=HUNTS[S.hunt];
  const kind=h.kinds[(Math.random()*h.kinds.length)|0];
  const lvl=h.lo+((Math.random()*(h.hi-h.lo+1))|0);
  const elite=Math.random()<ELITE_CHANCE;
  const st=enemyStats(lvl,elite), K=KINDS[kind];
  S.enemy={kind,lvl,elite,hp:st.hp,maxHp:st.hp,atk:st.atk,int:st.int,name:(elite?'Elite · ':'')+K.name};
  S.phase='walk'; S.pt=0;
}
function isUnlocked(S,i){ return S.level>=HUNTS[i].min; }
function selectHunt(S,i){
  if(i<0||i>=HUNTS.length||!isUnlocked(S,i)) return false;
  S.hunt=i; S.deathStreak=0; spawn(S); return true;
}

function bestHunt(S){
  const keep=S.hunt; let pick=0;
  for(let i=0;i<HUNTS.length;i++){ if(!isUnlocked(S,i)) continue; S.hunt=i; const ex=expected(S); if(ex.kps>0&&!ex.deaths) pick=i; }
  S.hunt=keep; return pick;
}
function gainXp(S,xp,ev){
  if(S.level>=MAXLV) return;
  S.xp+=xp;
  while(S.level<MAXLV && S.xp>=xpToNext(S.level)){
    S.xp-=xpToNext(S.level);
    const before=formIndex(S.level); S.level++;
    const after=formIndex(S.level);
    if(ev) ev.push({t:'level',level:S.level});
    if(after!==before){ if(S.pendingEvo) S.pendingEvo.to=after; else S.pendingEvo={from:before,to:after}; if(ev) ev.push({t:'evolve',from:before,to:after}); }
    const d=derive(S); S.heroHp=Math.min(d.maxHp,S.heroHp+d.maxHp*0.25);
  }
  if(S.level>=MAXLV) S.xp=0;
}

function rollLoot(S,elite){
  const chance=elite?0.45:0.07;
  if(Math.random()>=chance) return null;
  const r=Math.random();
  let rar=r<0.70?0:r<0.92?1:r<0.99?2:3;
  if(elite && rar<3 && Math.random()<0.30) rar++;
  return {slot:SLOTS[(Math.random()*3)|0],tier:HUNTS[S.hunt].tier,rar};
}
function handleLoot(S,it,ev){
  const cur=S.gear[it.slot];
  if(itemPower(it)>itemPower(cur)){
    S.gear[it.slot]=it;
    if(cur){ const g=itemSell(cur); S.gold+=g; }
    if(ev) ev.push({t:'loot',item:it,equipped:true});
  }else{
    const g=itemSell(it); S.gold+=g;
    if(ev) ev.push({t:'loot',item:it,equipped:false,sold:g});
  }
}

function killEnemy(S,ev,d){
  const e=S.enemy;
  const xp=xpKill(S,e.lvl,e.elite,d), gold=goldKill(e.lvl,e.elite,d);
  S.gold+=gold; S.kills++; S.deathStreak=0;
  S.phase='dead'; S.pt=0;
  if(ev) ev.push({t:'kill',gold,xp,elite:e.elite,name:e.name});
  gainXp(S,xp,ev);
  const it=rollLoot(S,e.elite); if(it) handleLoot(S,it,ev);
  if(Math.random()<matChance(S,e.elite)){ const t=HUNTS[S.hunt].tier; S.mats[t]++; if(ev) ev.push({t:'mat',tier:t}); }
}
function matChance(S,elite){ return MAT_CHANCE*(elite?MAT_ELITE_MUL:1)*((S.buffs&&S.buffs.luck>0)?LUCK_MUL:1); }
function usePotion(S,d,ev){
  if(S.potions>0 && S.potCd<=0 && S.heroHp>0 && S.heroHp<d.maxHp*0.35){
    S.potions--; S.potCd=6; S.heroHp=Math.min(d.maxHp,S.heroHp+d.maxHp*0.5);
    if(ev) ev.push({t:'potion',left:S.potions});
  }
}

function tick(S,dt,ev){
  const d=derive(S);
  if(S.heroHp>d.maxHp) S.heroHp=d.maxHp;
  S.pt+=dt;
  if(S.potCd>0) S.potCd-=dt;
  if(S.buffs){ for(const k in S.buffs) if(S.buffs[k]>0) S.buffs[k]=Math.max(0,S.buffs[k]-dt); }
  if(S.phase==='walk'){
    S.heroHp=Math.min(d.maxHp,S.heroHp+d.maxHp*0.10*dt);
    if(S.pt>=WALK_TIME){ S.phase='fight'; S.pt=0; S.atkT=0.35; S.enemyT=0.9; S.first=true; if(ev) ev.push({t:'engage'}); }
  }else if(S.phase==='fight'){
    const e=S.enemy;
    S.heroHp=Math.min(d.maxHp,S.heroHp+d.maxHp*d.regen*dt);
    S.atkT-=dt; S.enemyT-=dt;
    let guard=0;
    while(S.atkT<=0 && S.phase==='fight' && guard++<20){
      let dmg=d.atk*(0.92+Math.random()*0.16);
      if(d.form.id==='pawn' && S.first) dmg*=1.5;
      S.first=false;
      const crit=Math.random()<d.crit; if(crit) dmg*=d.cm;
      e.hp-=dmg; if(ev) ev.push({t:'hit',dmg,crit});
      if(d.form.id==='knight' && e.hp>0 && Math.random()<0.2){
        const d2=dmg*0.8; e.hp-=d2; if(ev) ev.push({t:'hit',dmg:d2,crit:false,second:true});
      }
      S.atkT+=d.interval;
      if(e.hp<=0){ killEnemy(S,ev,d); }
    }
    guard=0;
    while(S.enemyT<=0 && S.phase==='fight' && guard++<20){
      const dmg=e.atk*d.dmgTaken*(0.92+Math.random()*0.16);
      S.heroHp-=dmg; if(ev) ev.push({t:'enemyHit',dmg});
      S.enemyT+=e.int;
      usePotion(S,d,ev);
      if(S.heroHp<=0){
        S.heroHp=0; S.phase='down'; S.pt=0; S.deaths++; S.deathStreak++;
        if(ev) ev.push({t:'down',streak:S.deathStreak});
      }
    }
  }else if(S.phase==='dead'){
    if(S.pt>=KILL_PAUSE){ spawn(S); }
  }else if(S.phase==='down'){
    if(S.pt>=DOWN_TIME){ S.heroHp=d.maxHp; spawn(S); }
  }
}

/* ---------- progresso offline (modelo esperado, conservador) ---------- */
function expected(S){
  const h=HUNTS[S.hunt], d=derive(S);
  const eAvg=(h.lo+h.hi)/2;
  const nor=enemyStats(eAvg,false), eli=enemyStats(eAvg,true);
  const pe=ELITE_CHANCE;
  function oneFight(st,elite){
    const fightT=Math.max(0.2,st.hp/(d.dps*(1)) );
    const hitsTaken=fightT/st.int;
    const loss=st.atk*d.dmgTaken*hitsTaken/d.maxHp;
    const regen=0.10*WALK_TIME/1+d.regen*fightT;
    return {fightT,loss,regen};
  }
  const A=oneFight(nor,false), B=oneFight(eli,true);
  const loss=(1-pe)*A.loss+pe*B.loss, regen=(1-pe)*A.regen+pe*B.regen;
  const fightT=(1-pe)*A.fightT+pe*B.fightT;
  // ciclo de vida até morrer
  let hp=1,k=0,cap=300; while(k<cap){ hp-=loss; if(hp<=0) break; k++; hp=Math.min(1,hp+regen); }
  if(k===0) return {kps:0,xp:0,gold:0};
  const per=WALK_TIME+KILL_PAUSE+fightT;
  const cycleT=k*per+(k<cap?DOWN_TIME:0);
  const kps=k/cycleT;
  const xp=(1-pe)*xpKill(S,eAvg,false,d)+pe*xpKill(S,eAvg,true,d);
  const gold=(1-pe)*goldKill(eAvg,false,d)+pe*goldKill(eAvg,true,d);
  return {kps,xp,gold,per,deaths:k<cap};
}
function applyOffline(S,seconds){
  seconds=Math.min(Math.max(0,seconds),OFFLINE_CAP);
  let remaining=seconds*OFFLINE_EFF;
  const out={seconds,kills:0,gold:0,xp:0,levels:0,evolved:false,mats:[0,0,0,0,0,0]};
  const matsF=[0,0,0,0,0,0], avgMat=MAT_CHANCE*((1-ELITE_CHANCE)+ELITE_CHANCE*MAT_ELITE_MUL);
  const savedBuffs=S.buffs; S.buffs={atk:0,xp:0,luck:0};
  const addK=k=>{ out.kills+=k; matsF[HUNTS[S.hunt].tier]+=k*avgMat; };
  const lv0=S.level, f0=formIndex(S.level);
  let guard=0;
  if(S.autoHunt) S.hunt=bestHunt(S);
  while(remaining>0 && guard++<400){
    const ex=expected(S); if(ex.kps<=0) break;
    if(S.level>=MAXLV){ const k=remaining*ex.kps; S.gold+=k*ex.gold; out.gold+=k*ex.gold; addK(k); break; }
    const need=xpToNext(S.level)-S.xp;
    const kNeed=Math.ceil(need/ex.xp), tNeed=kNeed/ex.kps;
    if(tNeed<=remaining){
      S.gold+=kNeed*ex.gold; out.gold+=kNeed*ex.gold; addK(kNeed); out.xp+=kNeed*ex.xp;
      gainXp(S,kNeed*ex.xp,null); remaining-=tNeed;
      if(S.autoHunt) S.hunt=bestHunt(S);
    }else{
      const k=remaining*ex.kps; S.gold+=k*ex.gold; out.gold+=k*ex.gold; addK(k); out.xp+=k*ex.xp;
      S.xp+=k*ex.xp; remaining=0;
    }
  }
  out.kills=Math.floor(out.kills); S.kills+=out.kills;
  for(let i=0;i<6;i++){ const f=matsF[i], n=Math.floor(f)+(Math.random()<(f%1)?1:0); out.mats[i]=n; S.mats[i]+=n; }
  S.buffs=savedBuffs;
  out.levels=S.level-lv0;
  const f1=formIndex(S.level);
  if(f1!==f0){ out.evolved=true; if(S.pendingEvo) S.pendingEvo.to=f1; else S.pendingEvo={from:f0,to:f1}; }
  const d=derive(S); S.heroHp=d.maxHp; spawn(S);
  return out;
}

/* ---------- compras ---------- */
function setLevel(S,L){
  L=Math.max(1,Math.min(MAXLV,L)); const before=formIndex(S.level);
  S.level=L; S.xp=0; const after=formIndex(L);
  if(after!==before){ if(S.pendingEvo) S.pendingEvo.to=after; else S.pendingEvo={from:before,to:after}; }
  const d=derive(S); S.heroHp=d.maxHp; spawn(S);
}
function buyUpg(S,id){
  const u=UPGS.find(x=>x.id===id); if(!u) return false;
  const lv=S.upg[id]; if(lv>=u.max) return false;
  const c=upgCost(u,lv); if(c>S.gold) return false;
  S.gold-=c; S.upg[id]++; return true;
}

/* ---------- cidade: loja, bar, terreno e fazenda ---------- */
function shopItem(slot,tier,rar){ return {slot,tier,rar,price:Math.round(SHOP_BASE[tier]*(rar?SHOP_RARE_MUL:1)),minLevel:SHOP_LV[tier]}; }
function shopList(slot){ const out=[]; for(let t=0;t<6;t++){ out.push(shopItem(slot,t,0)); out.push(shopItem(slot,t,1)); } return out; }
function shopState(S,o){
  if(S.level<o.minLevel) return {ok:false,reason:'level'};
  if(itemPower({tier:o.tier,rar:o.rar})<=itemPower(S.gear[o.slot])) return {ok:false,reason:'owned'};
  if(S.gold<o.price) return {ok:false,reason:'gold'};
  return {ok:true};
}
function buyGear(S,slot,tier,rar){
  const o=shopItem(slot,tier,rar); if(!shopState(S,o).ok) return false;
  S.gold-=o.price; const old=S.gear[slot]; S.gear[slot]={slot,tier,rar};
  if(old) S.gold+=itemSell(old);
  return true;
}
function refGold(L){ return 1.2*Math.pow(L,1.7)*GOLD_SCALE; }
function healPrice(S){ return Math.max(8,Math.round(15*refGold(S.level))); }
function elixirPrice(S){ return Math.max(150,Math.round(700*refGold(S.level))); }
function buyHeal(S){ const c=healPrice(S); if(S.potions>=POTION_CAP||S.gold<c) return false; S.gold-=c; S.potions++; return true; }
function buyElixir(S,id){
  if(!ELIXIRS.find(x=>x.id===id)) return false;
  const c=elixirPrice(S); if(S.gold<c||(S.buffs[id]||0)>=BUFF_MAX) return false;
  S.gold-=c; S.buffs[id]=Math.min(BUFF_MAX,(S.buffs[id]||0)+BUFF_DUR); return true;
}
function buyLand(S){ if(S.farm>0||S.level<LAND_LEVEL||S.gold<LAND_PRICE) return false; S.gold-=LAND_PRICE; S.farm=1; S.dep=[0,0,0,0,0,0]; return true; }
function farmNext(S){ return (S.farm>=1&&S.farm<FARM.length)?FARM[S.farm]:null; }
function deliverMat(S,i){ const nx=farmNext(S); if(!nx) return 0; const n=Math.min(nx.mats[i]-S.dep[i],S.mats[i]); if(n<=0) return 0; S.mats[i]-=n; S.dep[i]+=n; return n; }
function deliverAll(S){ let t=0; for(let i=0;i<6;i++) t+=deliverMat(S,i); return t; }
function farmReady(S){ const nx=farmNext(S); return !!nx && S.level>=nx.level && nx.mats.every((n,i)=>S.dep[i]>=n); }
function upgradeFarm(S){ if(!farmReady(S)) return false; S.farm++; S.dep=[0,0,0,0,0,0]; return true; }

function fmt(n){
  if(!isFinite(n)) return '∞';
  if(n<1000) return (n<10&&n%1!==0)?n.toFixed(1):Math.floor(n).toString();
  const names=['mil','mi','bi','tri','qua','qui','sex','sep'];
  let i=-1; while(n>=1000&&i<names.length-1){ n/=1000; i++; }
  return (n<10?n.toFixed(2):n<100?n.toFixed(1):Math.floor(n))+' '+names[i];
}
function fmtTime(sec){
  sec=Math.floor(sec); const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;
  return (h?h+'h ':'')+(m||h?m+'min ':'')+(!h?s+'s':'');
}

return {MAXLV,WALK_TIME,KILL_PAUSE,DOWN_TIME,FORMS,KINDS,TIERS,HUNTS,UPGS,SLOTS,SLOT_NAME,SLOT_EFFECT,RARITY,
  formIndex,xpToNext,heroBase,derive,enemyStats,xpKill,goldKill,newState,spawn,isUnlocked,selectHunt,gainXp,
  tick,expected,bestHunt,applyOffline,setLevel,buyUpg,upgCost,itemPower,itemBonus,itemSell,itemName,handleLoot,fmt,fmtTime,
  MATS,MAT_CHANCE,MAT_ELITE_MUL,LUCK_MUL,matChance,LAND_LEVEL,LAND_PRICE,FARM_BONUS,FARM,SHOP_LV,POTION_CAP,BUFF_DUR,BUFF_MAX,ELIXIRS,
  shopItem,shopList,shopState,buyGear,healPrice,elixirPrice,buyHeal,buyElixir,buyLand,farmNext,deliverMat,deliverAll,farmReady,upgradeFarm,refGold};
})();
root.Genesis=root.Genesis||{}; root.Genesis.Core=Core;
if(typeof module!=='undefined') module.exports=Core;
})(typeof window!=='undefined'?window:globalThis);
