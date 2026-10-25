// ─── Summon Board Game — Local Multiplayer Server ────────────────────────────
// Run: node server.js
// Players connect to http://<your-ip>:3000/player
// Board view:  http://<your-ip>:3000/board
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const http = require('http');
const path = require('path');
const os   = require('os');

const PORT = process.env.PORT || 3000;
const SERVER_VERSION = 'v1.0.109';   // v1.0.109: randomised starter sets (8 pools, 1 Guardian + 4 random) + sets G Dead Covenant / H Ancient Guard
// prev: v1.0.108   // v1.0.108: version bump — player v0.5.27 (Ascendant unlock condition on detail sheet)
// prev: v1.0.107   // v1.0.107: version bump — player v0.5.26 (starter-set banner art)
// prev: v1.0.106   // v1.0.106: version bump — board v0.6.25 / player v0.5.25 (new art + big-moment animations)

// ─── DATA ────────────────────────────────────────────────────────────────────

const TYPES = ['Light','Dark','Arcane','Undead','Beast','Nature'];

const TYPE_COLOR = {
  Light:'#e0c07a', Dark:'#b56fd0', Arcane:'#7f92e8',
  Undead:'#5fb3a4', Beast:'#d98a5a', Nature:'#7fb36a'
};

// Strong[A] = type A beats
const TYPE_STRONG = { Light:'Undead', Dark:'Beast', Arcane:'Dark', Undead:'Arcane', Beast:'Nature', Nature:'Light' };
const TYPE_WEAK   = { Light:'Nature', Dark:'Arcane', Arcane:'Undead', Undead:'Light', Beast:'Dark', Nature:'Beast' };

// Master summon roster
const ROSTER = [
  // ── Light ──
  {id:'solar_knight',   type:'Light',  name:'Solar Knight',   arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'dawnguard',      type:'Light',  name:'Dawnguard',      arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'high_paladin',   type:'Light',  name:'High Paladin',   arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'ardent_saint',   type:'Light',  name:'Ardent Saint',   arch:'ascendant', hp:65, maxHp:65, atk:25, def:15, cost:20, gen:5, isSpecial:true,
    special:'Aura of Renewal',  specialDesc:'Heal all friendly stationed summons 5 HP/turn',
    condition:'healed2', conditionDesc:'Healed 2+ summons this game'},
  // Light — new
  {id:'dawn_striker',   type:'Light',  name:'Dawn Striker',   arch:'assailant', hp:25, maxHp:25, atk:36, def:6,  cost:8,  gen:2, isSpecial:false},
  {id:'radiant_lancer', type:'Light',  name:'Radiant Lancer', arch:'vanguard',  hp:30, maxHp:30, atk:28, def:10, cost:10, gen:2, isSpecial:false},
  {id:'sunfire_herald', type:'Light',  name:'Sunfire Herald', arch:'vanguard',  hp:40, maxHp:40, atk:22, def:11, cost:10, gen:2, isSpecial:false},

  // ── Dark ──
  {id:'nightshard',     type:'Dark',   name:'Nightshard',     arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'void_sentinel',  type:'Dark',   name:'Void Sentinel',  arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'shadow_paladin', type:'Dark',   name:'Shadow Paladin', arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'succubus',       type:'Dark',   name:'Succubus',       arch:'ascendant', hp:45, maxHp:45, atk:32, def:10, cost:20, gen:5, isSpecial:true,
    special:'Mana Drain', specialDesc:'Win or stalemate → steal 10 Mana from opponent',
    condition:'mana40', conditionDesc:'Have at least 40✦ Mana'},
  // Dark — new
  {id:'void_reaper',    type:'Dark',   name:'Void Reaper',    arch:'assailant', hp:18, maxHp:18, atk:42, def:4,  cost:8,  gen:2, isSpecial:false},
  {id:'dusk_blade',     type:'Dark',   name:'Dusk Blade',     arch:'vanguard',  hp:30, maxHp:30, atk:29, def:8,  cost:10, gen:2, isSpecial:false},
  {id:'umbral_stalker', type:'Dark',   name:'Umbral Stalker', arch:'vanguard',  hp:42, maxHp:42, atk:21, def:11, cost:10, gen:2, isSpecial:false},

  // ── Arcane ──
  {id:'sorcerer',       type:'Arcane', name:'Sorcerer',       arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'rune_priestess', type:'Arcane', name:'Rune Priestess', arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'arch_mage',      type:'Arcane', name:'Arch Mage',      arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'arcane_arbiter', type:'Arcane', name:'Arcane Arbiter', arch:'ascendant', hp:40, maxHp:40, atk:40, def:15, cost:20, gen:5, isSpecial:true,
    special:'Chaos Flux', specialDesc:'After any battle or stalemate against it, one random attacker-owned tile changes to a random element',
    condition:'changed1Arcane', conditionDesc:'Changed 1+ tile to Arcane element this game'},
  // Arcane — new
  {id:'spell_wraith',   type:'Arcane', name:'Spell Wraith',   arch:'assailant', hp:22, maxHp:22, atk:38, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'runic_duelist',  type:'Arcane', name:'Runic Duelist',  arch:'vanguard',  hp:32, maxHp:32, atk:27, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'mana_weaver',    type:'Arcane', name:'Mana Weaver',    arch:'vanguard',  hp:38, maxHp:38, atk:23, def:12, cost:10, gen:2, isSpecial:false},

  // ── Undead ──
  {id:'bone_wraith',    type:'Undead', name:'Bone Wraith',    arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'death_knight',   type:'Undead', name:'Death Knight',   arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'shade_walker',   type:'Undead', name:'Shade Walker',   arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'demon_lord',     type:'Undead', name:'Demon Lord',     arch:'ascendant', hp:85, maxHp:85, atk:40, def:8,  cost:20, gen:5, isSpecial:true,
    special:'Last Rite', specialDesc:'When HP hits 0, survive at 15 HP instead (once per game)',
    condition:'lost2', conditionDesc:'Had 2+ summons destroyed in battle this game', lastRiteUsed:false},
  // Undead — new
  {id:'grave_specter',  type:'Undead', name:'Grave Specter',  arch:'assailant', hp:18, maxHp:18, atk:42, def:4,  cost:8,  gen:2, isSpecial:false},
  {id:'cursed_revenant',type:'Undead', name:'Cursed Revenant',arch:'vanguard',  hp:33, maxHp:33, atk:26, def:10, cost:10, gen:2, isSpecial:false},
  {id:'plague_herald',  type:'Undead', name:'Plague Herald',  arch:'vanguard',  hp:40, maxHp:40, atk:22, def:11, cost:10, gen:2, isSpecial:false},

  // ── Beast ──
  {id:'razorclaw',      type:'Beast',  name:'Razorclaw',      arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'iron_hide',      type:'Beast',  name:'Iron Hide',      arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'pack_hunter',    type:'Beast',  name:'Pack Hunter',    arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'red_dragon',     type:'Beast',  name:'Red Dragon',     arch:'ascendant', hp:40, maxHp:40, atk:50, def:9,  cost:20, gen:5, isSpecial:true,
    special:'Intimidate', specialDesc:'Adjacent enemy stationed summons cost their owner 5✦ at the start of each affected player\'s turn',
    condition:'stationed3', conditionDesc:'Have 3+ summons stationed on board'},
  // Beast — new
  {id:'feral_striker',  type:'Beast',  name:'Feral Striker',  arch:'assailant', hp:22, maxHp:22, atk:38, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'stormtalon',     type:'Beast',  name:'Stormtalon',     arch:'vanguard',  hp:32, maxHp:32, atk:28, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'stoneback',      type:'Beast',  name:'Stoneback',      arch:'vanguard',  hp:42, maxHp:42, atk:20, def:12, cost:10, gen:2, isSpecial:false},

  // ── Nature ──
  {id:'thornling',      type:'Nature', name:'Thornling',      arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'ancient_oak',    type:'Nature', name:'Ancient Oak',    arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'grove_warden',   type:'Nature', name:'Grove Warden',   arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'world_tree',     type:'Nature', name:'World Tree',     arch:'ascendant', hp:65, maxHp:65, atk:12, def:13, cost:20, gen:5, isSpecial:true,
    special:'Deep Roots', specialDesc:'+1 Mana Gen per Nature tile owned + per Nature summon stationed on any of your tiles',
    condition:'own2Nature', conditionDesc:'Own 2+ Nature tiles currently'},
  // Nature — new
  {id:'briar_sprite',   type:'Nature', name:'Briar Sprite',   arch:'assailant', hp:22, maxHp:22, atk:37, def:6,  cost:8,  gen:2, isSpecial:false},
  {id:'vine_stalker',   type:'Nature', name:'Vine Stalker',   arch:'vanguard',  hp:33, maxHp:33, atk:26, def:10, cost:10, gen:2, isSpecial:false},
  {id:'moss_golem',     type:'Nature', name:'Moss Golem',     arch:'vanguard',  hp:42, maxHp:42, atk:20, def:12, cost:10, gen:2, isSpecial:false},

  // ── Dual-Element Rares ──
  // Gets BOTH elements' advantages: max(mod1, mod2). Mutual weaknesses cancel → no weak sides.
  {id:'luminar_operative',         type:'Light',  type2:'Arcane', name:'Luminar Operative', arch:'rare', rarity:'rare',
   hp:35, maxHp:35, atk:30, def:12, cost:26, gen:4, isSpecial:false,
   rareDesc:'2× vs Dark & Undead · No weaknesses'},
  {id:'hex_stalker',      type:'Undead', type2:'Beast',  name:'Hex Stalker',      arch:'rare', rarity:'rare',
   hp:42, maxHp:42, atk:30, def:11, cost:25, gen:3, isSpecial:false,
   rareDesc:'2× vs Arcane & Nature · No weaknesses'},
  {id:'verdant_sorcerer', type:'Arcane', type2:'Nature', name:'Verdant Sorcerer', arch:'rare', rarity:'rare',
   hp:30, maxHp:30, atk:30, def:12, cost:27, gen:4, isSpecial:false,
   rareDesc:'2× vs Dark & Light · No weaknesses'},

  // ── Support Cards — neutral (no element), passive aura while stationed ──
  {id:'mana_refinery', type:null, name:'Mana Refinery', arch:'support', rarity:'support',
   hp:18, maxHp:18, atk:1, def:10, cost:12, gen:0, isSpecial:false,
   supportDesc:'+1✦/round per friendly stationed summon (needs ≥1 Refinery; copies don\'t stack)'},
  {id:'weapon_smith',  type:null, name:'Weapon Smith',  arch:'support', rarity:'support',
   hp:18, maxHp:18, atk:1, def:10, cost:12, gen:0, isSpecial:false,
   supportDesc:'+5 ATK to your attacker per copy in hand (stacks)'},
  {id:'forge',         type:null, name:'Forge',         arch:'support', rarity:'support',
   hp:18, maxHp:18, atk:1, def:10, cost:12, gen:0, isSpecial:false,
   supportDesc:'+5 DEF to your defender per copy stationed (stacks)'},
  {id:'field_medic',   type:null, name:'Field Medic',   arch:'support', rarity:'support',
   hp:18, maxHp:18, atk:1, def:10, cost:12, gen:0, isSpecial:false,
   supportDesc:'+2 HP/round to all stationed summons (stacks)'},
];

const SPECIALS  = ROSTER.filter(m => m.isSpecial);
const RARES     = ROSTER.filter(m => m.rarity === 'rare');
const SUPPORTS  = ROSTER.filter(m => m.rarity === 'support');
const NORMALS   = ROSTER.filter(m => !m.isSpecial && !m.rarity);

// ─── WILD CARD POOLS ─────────────────────────────────────────────────────────
const WILD_CARD_POOLS = {
  low: [
    { id:'mend',    name:'Mend',    cost:15, tier:'low',  target:'own_station', desc:'Heal one of your stationed summons for 20 HP' },
    { id:'stumble', name:'Stumble', cost:15, tier:'low',  target:'player',      desc:'Curse a target player — they skip their dice roll next turn and move exactly 3 spaces' },
    { id:'delay',   name:'Delay',   cost:15, tier:'low',  target:'player',      desc:'Force a target player to skip their shop phase next turn' },
    { id:'jinx',    name:'Jinx',    cost:15, tier:'low',  target:'player',      desc:"Target player's passive mana income next turn is halved" },
  ],
  mid: [
    { id:'ambush',  name:'Ambush',  cost:30, tier:'mid',  target:'self',        desc:'Your next attacker deals +40% damage' },
    { id:'fortify', name:'Fortify', cost:30, tier:'mid',  target:'self',        desc:'Your next defender takes −40% damage' },
    { id:'rattle',  name:'Rattle',  cost:30, tier:'mid',  target:'player',      desc:"Target player's next battle, their summon fights at half ATK" },
    { id:'poach',   name:'Poach',   cost:30, tier:'mid',  target:'player',      desc:"Steal a random summon from a target player's hand" },
  ],
  high: [
    { id:'coup',     name:'Coup',     cost:60, tier:'high', target:'coup',    desc:'Sacrifice one summon from your hand to seize any occupied enemy tile. Their stationed summon defects — it stays on the tile and now fights for you.' },
    { id:'plague',   name:'Plague',   cost:60, tier:'high', target:'player',  desc:"All of a target player's stationed summons lose 20 HP" },
    { id:'windfall', name:'Windfall', cost:60, tier:'high', target:'self',    desc:'Your passive mana income next turn is tripled' },
    { id:'shatter',  name:'Shatter',  cost:60, tier:'high', target:'shatter', desc:'Destroy any 2 stationed summons on the board; both tiles go neutral' },
  ]
};

// v1.0.102: record each resolved Wild Card play so the board can animate it.
// extra: { targetIdx?, tilePos?, picks?, stolenName? }
function _wcPlayed(cardId, extra = {}) {
  const card = [...WILD_CARD_POOLS.low, ...WILD_CARD_POOLS.mid, ...WILD_CARD_POOLS.high].find(c => c.id === cardId);
  if (!card) return;
  G.wcPlayedSeq = (G.wcPlayedSeq || 0) + 1;
  G.lastWildCard = { seq: G.wcPlayedSeq, id: card.id, name: card.name, tier: card.tier, desc: card.desc,
                     casterIdx: G.currentPlayer, ...extra };
}

// v1.0.104: summon voices — record which monster just arrived so the board can play its clip.
// moment: 'claim' | 'swap' | 'temple' | 'chest'. Board only; setup claims are deliberately not recorded.
function _voice(monsterId, moment) {
  G.voiceSeq = (G.voiceSeq || 0) + 1;
  G.lastVoice = { seq: G.voiceSeq, id: monsterId, moment, playerIdx: G.currentPlayer };
}

// Starter sets — v1.0.109: 8 randomised element pools (no Mana cost during setup phase).
// Each hand = 1 Guardian + 4 random Assailants/Vanguards from the set's elements.
// Rules: max 2 Assailants, max 2 copies of any card; never Ascendants, Rares or Support.
// Two players on the same set are rerolled until their hands differ by at least 2 cards.
const STARTER_SETS = {
  A: { name:'The Cabal',        theme:'Dark / Undead / Arcane',  elements:['Dark','Undead','Arcane'] },
  B: { name:'The Warpack',      theme:'Dark / Beast / Undead',   elements:['Dark','Beast','Undead'] },
  C: { name:'The Order',        theme:'Light / Arcane / Nature', elements:['Light','Arcane','Nature'] },
  D: { name:'The Arcane Watch', theme:'Arcane',                  elements:['Arcane'] },
  E: { name:'Divine Guard',     theme:'Light',                   elements:['Light'] },
  F: { name:'Chaos Legion',     theme:'Dark',                    elements:['Dark'] },
  G: { name:'Dead Covenant',    theme:'Undead',                  elements:['Undead'] },
  H: { name:'Ancient Guard',    theme:'Nature / Beast',          elements:['Nature','Beast'] },
};
const STARTER_SET_KEYS = Object.keys(STARTER_SETS);
const STARTER_HAND_SIZE = 5, STARTER_MAX_ASSAILANTS = 2, STARTER_MAX_COPIES = 2, STARTER_MIN_DIFF = 2;

function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// One random hand (array of template ids) for a set.
function rollStarterHand(setKey) {
  const els = STARTER_SETS[setKey].elements;
  const inSet = r => els.includes(r.type);
  const guardians = ROSTER.filter(r => r.arch === 'guardian' && inSet(r)).map(r => r.id);
  const flex      = ROSTER.filter(r => (r.arch === 'assailant' || r.arch === 'vanguard') && inSet(r));
  const hand = [_pick(guardians)];
  const count = id => hand.filter(h => h === id).length;
  while (hand.length < STARTER_HAND_SIZE) {
    const assailants = hand.filter(id => ROSTER.find(r => r.id === id).arch === 'assailant').length;
    const ok = flex.filter(r => count(r.id) < STARTER_MAX_COPIES &&
                                !(r.arch === 'assailant' && assailants >= STARTER_MAX_ASSAILANTS));
    hand.push(_pick(ok).id);
  }
  return hand;
}

// Cards that differ between two hands (multiset difference, one direction — sizes are equal).
function _handDiff(a, b) {
  const rest = [...b]; let diff = 0;
  for (const id of a) { const i = rest.indexOf(id); if (i >= 0) rest.splice(i, 1); else diff++; }
  return diff;
}

// Rolls a hand that differs by 2+ cards from every hand already dealt from the same set.
function dealStarterHand(setKey, existingPlayers) {
  const others = (existingPlayers || []).filter(p => p.starterSet === setKey && p.starterHand).map(p => p.starterHand);
  let best = null, bestScore = -1;
  for (let tries = 0; tries < 200; tries++) {
    const h = rollStarterHand(setKey);
    const score = others.length ? Math.min(...others.map(o => _handDiff(h, o))) : STARTER_HAND_SIZE;
    if (score >= STARTER_MIN_DIFF) return h;
    if (score > bestScore) { best = h; bestScore = score; }
  }
  return best;   // fallback — closest we found
}

const PLAYER_COLORS = ['#e05252','#5ca8e0','#5dc97d','#e0b050','#c07fd8','#60cdc0'];
const CHANGE_ELEMENT_COST = 18;
const MANA_PENALTY        = 8;
const HEAL_COST_PER_HP    = 1.5;
const DEFAULT_ROUND_LIMIT = 20; // rounds per player (selectable in lobby: 10/20/30)

// ─── HELPERS ─────────────────────────────────────────────────────────────────

let _iid = 0;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function makeSummon(templateId) {
  const t = ROSTER.find(r => r.id === templateId);
  if (!t) throw new Error('unknown summon: ' + templateId);
  return {
    ...t,
    iid: ++_iid,
    charm: false,
    lastRiteUsed: false,
    // ── Phase 1: per-instance ability state ──────────────────────────────────
    abilityData: {
      // Light
      layOnHandsUsed: false,         // High Paladin: once per game reactive survive below 30% HP
      // Dark
      voidHungerBonus: 0,            // Void Reaper: cumulative ATK stacks from wins (+2 per win)
      // Arcane
      sorcererAtkBonus: 0,           // Sorcerer: permanent ATK bonus (+1 per win)
      sorcererGenBonus: 0,           // Sorcerer: permanent Gen bonus (+1 per win)
      runicDuelistBonus: 0,          // Runic Duelist: ATK bonus from friendly arcane count (recalc each battle)
      // Rune Priestess: Runic Amplification — gen doubled on Arcane tile (handled in collectPassiveIncome, no flag needed)
      // Arch Mage: Mana Infusion — +2✦/turn while stationed (handled in collectPassiveIncome, no flag needed)
      // Undead
      cursedRevenantSurvivals: 0,    // Cursed Revenant: survivals → DEF stacks (+2 DEF per survival)
      shadeWalkerCurse: 0,           // Shade Walker: turns remaining on post-battle DoT curse
      shadeWalkerCurseAmt: 0,        // Shade Walker: HP loss per tick
      deathSentenceEnabled: true,    // Death Knight: 10% instant kill on any damage dealt
      // Beast
      apexPredatorBattleWins: 0,     // Razorclaw: battle wins counter (+1 ATK per win)
      ironHideHpBonus: 0,            // Iron Hide: permanent HP bonus from survivals (+3 maxHp per survival)
      // Nature
      stationedTurns: 0,             // Vine Stalker / Moss Golem / Ancient Oak: rounds stationed
      vineAuraActive: false,         // Vine Stalker: aura unlocked after 5 turns
      mossAuraActive: false,         // Moss Golem: aura unlocked after 5 turns
      oakOvergrowthAtk: 0,           // Ancient Oak: permanent ATK bonus from Overgrowth (+3 every 3 turns)
      oakOvergrowthDef: 0,           // Ancient Oak: permanent DEF bonus from Overgrowth (+3 every 3 turns)
      // Shared / Generic
      extraGenPerTurn: 0,            // Spell Wraith steal, Mana Weaver aura, etc.
    },
  };
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickShopOffers() {
  const pool = [...NORMALS];
  shuffle(pool);
  const offers = pool.slice(0, 5).map(m => ({ ...m, iid: ++_iid }));
  // ~10% chance: replace one slot with a rare dual-element monster
  if (RARES.length > 0 && Math.random() < 0.10) {
    const rare = RARES[rand(0, RARES.length - 1)];
    offers[rand(0, 4)] = { ...rare, iid: ++_iid };
  }
  // ~10% chance: replace one slot with a support card (independent roll)
  if (SUPPORTS.length > 0 && Math.random() < 0.10) {
    const sup = SUPPORTS[rand(0, SUPPORTS.length - 1)];
    offers[rand(0, 4)] = { ...sup, iid: ++_iid };
  }
  return offers;
}

function buildBoard() {
  // 28 tiles. Position 0=Start, 7=Chest, 14=Heal, 21=Temple
  const specials = [
    { pos:0,  kind:'start',  label:'Mana Well', icon:'✦' },
    { pos:7,  kind:'chest',  label:'Chest',     icon:'📦' },
    { pos:14, kind:'heal',   label:'Healing',   icon:'💚' },
    { pos:21, kind:'temple', label:'Temple',    icon:'🏛' },
  ];
  const specialPos = new Set(specials.map(s => s.pos));

  // Collect all 24 elemental positions
  const elPositions = [];
  for (let i = 0; i < 28; i++) { if (!specialPos.has(i)) elPositions.push(i); }

  // Find valid 3-consecutive-elemental run start positions (wraps around board)
  const validRunStarts = [];
  for (let i = 0; i < 28; i++) {
    const p1 = (i + 1) % 28, p2 = (i + 2) % 28;
    if (!specialPos.has(i) && !specialPos.has(p1) && !specialPos.has(p2)) {
      validRunStarts.push(i);
    }
  }

  // Pick a guaranteed 3-tile run: random element + random valid start position
  const featuredEl = TYPES[Math.floor(Math.random() * TYPES.length)];
  const runStart   = validRunStarts[Math.floor(Math.random() * validRunStarts.length)];
  const runPos     = new Set([runStart, (runStart + 1) % 28, (runStart + 2) % 28]);

  // Build remaining pool: 1 more of featuredEl (4 total − 3 in run) + 4 each of others
  const pool = [featuredEl];
  for (const t of TYPES) { if (t !== featuredEl) for (let i = 0; i < 4; i++) pool.push(t); }
  shuffle(pool);

  // Assign elements — run positions get featuredEl, rest draw from pool
  const elementAt = new Map();
  let pi = 0;
  for (const pos of elPositions) {
    elementAt.set(pos, runPos.has(pos) ? featuredEl : pool[pi++]);
  }

  // Build tiles array
  const tiles = [];
  for (let i = 0; i < 28; i++) {
    const sp = specials.find(s => s.pos === i);
    if (sp) {
      tiles.push({ pos:i, kind:sp.kind, label:sp.label, icon:sp.icon,
                   element:null, ownerId:null, summonId:null,
                   // Phase 1: per-tile ability fields
                   neverOwned: true,    // Grave Specter: true until first claimed
                   cursed: 0,           // Cursed Revenant / dark effects: turns remaining
                   genReduction: 0,     // Spell Wraith steal: permanent gen reduction on tile
                 });
    } else {
      const el = elementAt.get(i);
      tiles.push({ pos:i, kind:'element', label:el, icon:'', element:el,
                   ownerId:null, summonId:null,
                   // Phase 1: per-tile ability fields
                   neverOwned: true,    // Grave Specter: true until first claimed
                   cursed: 0,           // Cursed Revenant / dark effects: turns remaining
                   genReduction: 0,     // Spell Wraith steal: permanent gen reduction on tile
                 });
    }
  }
  return tiles;
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// ─── GAME STATE ──────────────────────────────────────────────────────────────

// ─── ROOM REGISTRY ───────────────────────────────────────────────────────────
// Multi-room support: each room is an independent game state.
const rooms = new Map(); // roomCode → game state
let G = null;            // current room context — set at start of each handler call

function freshGame(roomCode) {
  return {
    phase: 'lobby',          // lobby | shop | stalemate | roll | resolve:* | game_over
    roomCode: roomCode || generateRoomCode(),
    players: [],             // see addPlayer()
    board: buildBoard(),
    currentPlayer: 0,        // index
    turnCount: 0,
    roundLimit: DEFAULT_ROUND_LIMIT, // rounds per player, chosen in lobby
    events: [],              // { text, ts }
    stalemateData: null,     // { attackerIdx, tilePos, defenderIid }
    lastBattle: null,        // { attackerIdx, defOwnerIdx, attM, defM, atkDmg, defDmg, outcome }
    pendingChest: null,      // chest reward data waiting on player action
    pendingTemple: null,     // temple offers
    shopOffers: [],
    pausedFor: null,         // { idx, name, color } when a player disconnects mid-game
    setupRound: 1,           // current setup round (1-3)
    setupTurnIdx: 0,         // total setup turns taken (0 to 3*N-1)
    setupTotalTurns: 0,      // = 3 * N, set when setup starts
    pendingWildCard: false,  // set true when player passes position 0
    pendingLanding: null,    // { roll, options:[pos,pos,pos] } — set after roll, cleared on choose_landing
    wildCardDrawn: null,     // { low: card, mid: card, high: card }
    wildCardPending: null,   // { cardId, step } for multi-step cards (coup/shatter)
    turnSummary: null,       // snapshot of this turn's income/effects for the summary screen
    roundCallout: null,      // null | 'penultimate' | 'final' — set at round boundary, cleared after callout
    lastActivityAt: Date.now(), // timestamp of last broadcast — used for stale room cleanup
  };
}

// Defer a room-scoped action — safe across async gaps (setTimeout loses G closure)
function scheduleRoomAction(roomCode, fn, ms) {
  // v1.0.96: capture the forfeit generation — if the active player forfeits before this
  // fires, the turn was already advanced by forfeitPlayer() and this timer must not run.
  const _r = rooms.get(roomCode);
  const gen = _r ? (_r._forfeitGen || 0) : 0;
  setTimeout(() => {
    G = rooms.get(roomCode);
    if (!G) return;
    if ((G._forfeitGen || 0) !== gen) return;
    fn();
  }, ms);
}

function addPlayer(name, color, starterSet) {
  const idx = G.players.length;
  const starterHand = dealStarterHand(starterSet, G.players);   // v1.0.109: randomised
  const hand = starterHand.map(id => makeSummon(id));
  const sessionKey = crypto.randomBytes(8).toString('hex');
  return {
    idx, name, color, starterSet, starterHand, sessionKey,
    isConnected: true,
    mana: 40,
    hand,            // summon instances
    position: 0,
    healCount: 0,
    destroyedCount: 0,
    elementChangeCount: 0,
    arcaneChangeCount: 0,
    lastDiceRoll: null,
    // stat trackers
    battlesWon: 0,
    battlesLost: 0,
    peakTiles: 0,
    totalManaEarned: 40, // starts with initial 40
    wcEffects: { stumble:false, delay:false, jinx:false, ambush:false, fortify:false, rattle:false, windfall:false },
    // Phase 1: per-player ability state
    hemorrhageStacks: 0,       // Plague Herald: turns remaining of HP drain
    hemorrhageAmt: 0,          // Plague Herald: HP drained per tick
    lastTurnLandedOnWell: false,  // true if player landed on tile 0 (Mana Well) last turn
    notification: null,  // { cardId, cardName, cardDesc, castByName, castByColor, tier }
    eliminated: false,   // true once player owns 0 tiles at end of their own turn (post-setup)
    eliminatedRank: null, // set when eliminated — higher = survived longer (e.g. last eliminated = 1)
    lastTurnBattleManaGain: 0,   // mana received from battle outcomes last turn
    lastTurnBattleManaLoss: 0,   // mana paid/lost from battle outcomes last turn
  };
}

function log(text) {
  if (!G) return;
  G.events.unshift({ text, ts: Date.now() });
  if (G.events.length > 40) G.events.pop();
}

// ─── SPECIAL CONDITION CHECKS ─────────────────────────────────────────────────

function canUseSpecial(playerIdx, summon) {
  if (!summon.isSpecial) return true;
  const p = G.players[playerIdx];
  switch (summon.condition) {
    case 'healed2':       return p.healCount >= 2;
    case 'mana40':        return p.mana >= 40;
    case 'changed1Arcane': return p.arcaneChangeCount >= 1;
    case 'lost2':         return p.destroyedCount >= 2;
    case 'stationed3': {
      const count = G.board.filter(t => t.ownerId === playerIdx && t.summonId).length;
      return count >= 3;
    }
    case 'own2Nature': {
      const natureTiles = G.board.filter(t => t.ownerId === playerIdx && t.element === 'Nature').length;
      return natureTiles >= 2;
    }
    default: return true;
  }
}

// ─── COMBAT ──────────────────────────────────────────────────────────────────

function tileEffectOnDefender(tile, defender) {
  if (!tile.element || !defender) return 1;
  const defTypes = [defender.type, ...(defender.type2 ? [defender.type2] : [])];
  // Bonus: tile element matches any of the defender's types
  if (defTypes.includes(tile.element)) return 1.15;
  // Debuff: only for single-element monsters where tile beats the one type
  if (!defender.type2 && TYPE_STRONG[tile.element] === defender.type) return 0.85;
  // Dual-element: mutual weakness coverage means no debuff
  return 1;
}

function _singleTypeMod(atkType, defType) {
  if (TYPE_STRONG[atkType] === defType) return 2;
  if (TYPE_WEAK[atkType]   === defType) return 0.5;
  return 1;
}

function typeMultiplier(attacker, defender, nullify = false) {
  if (nullify) return 1;
  // Dual-element attacker: take the best modifier from either element
  if (attacker.type2) {
    return Math.max(
      _singleTypeMod(attacker.type,  defender.type),
      _singleTypeMod(attacker.type2, defender.type)
    );
  }
  return _singleTypeMod(attacker.type, defender.type);
}

function doStrike(attacker, defender, tile, nullify = false, bonusRun = false, monoBuff = false) {
  const tileEffect = tileEffectOnDefender(tile, defender);
  const defStat = Math.round(defender.def * tileEffect);
  const baseDmg = Math.max(1, attacker.atk - defStat);
  const typeMod = typeMultiplier(attacker, defender, nullify);
  const roll    = rand(0, 3);
  let dmg = Math.round(baseDmg * typeMod) + roll;
  if (attacker.charm) {
    dmg = Math.round(dmg * 1.25);
    attacker.charm = false;
    log(`⚡ Battle Charm activated on ${attacker.name}! +25% damage`);
    fxM(attacker, 'Battle Charm', `${attacker.name} strikes with +25% damage`, '+25%', 'good');
  }
  if (attacker._ambush) { dmg = Math.round(dmg * 1.40); attacker._ambush = false; log(`🃏 Ambush! +40% damage`); fxM(attacker, 'Ambush (Wild Card)', 'Strike deals +40% damage', '+40%', 'good'); }
  if (bonusRun) {
    dmg = Math.round(dmg * 1.20);
    log(`🔥 Tile Synergy! ${attacker.name} strikes for +20% damage`);
    fxM(attacker, 'Tile Synergy', '3-tile element run: +20% damage', '+20%', 'good');
  }
  if (monoBuff) {
    dmg = Math.round(dmg * 1.20);
    log(`⭐ Mono-Element Mastery! ${attacker.name} strikes for +20% damage`);
    fxM(attacker, 'Mono-Element Mastery', 'All one element: +20% damage', '+20%', 'good');
  }
  return Math.max(1, dmg);
}

// Returns { attackerHp, defenderHp, atkDmg, defDmg, outcome }
// outcome: 'attacker_wins' | 'defender_wins' | 'mutual' | 'stalemate'
// ─── v1.0.94: battle effect recorder + tile flash events ─────────────────────
// During an attack, every ability/wild-card effect is recorded here and attached to
// G.lastBattle.effects so the board (callouts) and phones (result list) can show them.
// Entry: { side:'att'|'def', name, text, value, tone:'good'|'bad' } — side = whose monster it happened to/for.
let _fx = null, _fxAttM = null, _fxDefM = null;
function fx(side, name, text, value, tone) {
  if (_fx) _fx.push({ side, name, text, value: value == null ? '' : String(value), tone: tone || 'good' });
}
// Record against whichever battle monster `m` is (works inside doStrike/resolveBattle)
function fxM(m, name, text, value, tone) {
  if (!_fx) return;
  fx(m === _fxAttM ? 'att' : 'def', name, text, value, tone);
}
// Ability-driven tile element change → flash event for the board (battle or claim)
function _convertTile(tile, newEl, label) {
  const from = tile.element;
  tile.element = newEl;
  if (from === newEl) return from;
  G.tileFlashSeq = (G.tileFlashSeq || 0) + 1;
  G.tileFlashes = [...(G.tileFlashes || []).slice(-7), { id: G.tileFlashSeq, pos: tile.pos, from, to: newEl, label }];
  return from;
}

function resolveBattle(attackerM, defenderM, tile, rattled = false) {
  const nullify = false; // Arcane Arbiter now has Chaos Flux instead of Nullify

  // ── PRE-STRIKE ABILITIES ────────────────────────────────────────────────────

  // Solar Knight — Radiant Strike: on claim, tile converts to Light element (handled in claim/battle outcome, not here)

  // Radiant Lancer — Piercing Light: ignore 30% of defender DEF on every attack
  // Applied by temporarily reducing defenderM.def before doStrike
  let piercingLightActive = false;
  let pierceRestore = 0;
  if (attackerM.id === 'radiant_lancer') {
    piercingLightActive = true;
    pierceRestore = defenderM.def;
    defenderM.def = Math.max(0, defenderM.def - Math.round(defenderM.def * 0.3));
    log(`🔱 Piercing Light: ${defenderM.name} DEF reduced by 30% for this strike (${pierceRestore} → ${defenderM.def})`);
    fxM(attackerM, 'Piercing Light', `Ignored 30% of ${defenderM.name}\'s DEF`, '−30% DEF', 'good');
  }

  // Void Sentinel — Last Darkness: reactive ATK boost when HP drops below 30% (checked post-damage)
  // No pre-strike block needed here; handled after damage is applied below

  // Rune Priestess — Runic Amplification: gen doubled on Arcane tile (handled in collectPassiveIncome)
  // Rune Priestess no longer has Runic Barrier one-shot survive

  // Dusk Blade — Hemorrhage: on win, reduces defPlayer mana income next turn by 4✦ (handled in _applyBattleOutcome)
  // No pre-strike ATK boost for Dusk Blade

  // Stormtalon — Lightning Strike: ALWAYS attacks first (even when defending).
  // If defenderM IS Stormtalon, it pre-emptively strikes the attacker BEFORE the attacker strikes.
  // If that pre-emptive strike kills the attacker, attacker cannot attack at all.
  let stormtalonPreemptiveKilled = false;
  let stormtalonPreemptiveDmg = 0;
  if (defenderM.id === 'stormtalon') {
    stormtalonPreemptiveDmg = doStrike(defenderM, attackerM, tile, nullify);
    attackerM.hp -= stormtalonPreemptiveDmg;
    log(`⚡ Lightning Strike (pre-emptive): Stormtalon strikes first! Deals ${stormtalonPreemptiveDmg} to ${attackerM.name} (now ${attackerM.hp}/${attackerM.maxHp} HP)`);
    fxM(defenderM, 'Lightning Strike', `Struck first for ${stormtalonPreemptiveDmg} damage`, `${stormtalonPreemptiveDmg} dmg`, 'good');
    if (attackerM.hp <= 0) {
      stormtalonPreemptiveKilled = true;
      log(`⚡ Lightning Strike: Stormtalon's pre-emptive strike KILLED ${attackerM.name} — attacker cannot retaliate!`);
      fxM(defenderM, 'Lightning Strike', `Killed ${attackerM.name} before it could strike`, 'KO', 'good');
    }
  }

  // Shadow Paladin — Dark Pact: +1 ATK per friendly Dark summon stationed (handled in getEffectiveStats)
  // No pre-strike ATK boost for Shadow Paladin here

  // Arch Mage — Mana Infusion: +2✦/turn while stationed (handled in collectPassiveIncome, not pre-strike)

  // Skip attacker's strike if Stormtalon (defender) pre-emptively killed the attacker
  let atkDmg = 0;
  if (!stormtalonPreemptiveKilled) {
    atkDmg = doStrike(attackerM, defenderM, tile, nullify);
  } else {
    // attacker already dead from Stormtalon pre-emptive — no strike
    atkDmg = 0;
  }

  // Restore Piercing Light DEF reduction after attacker's strike
  if (piercingLightActive) defenderM.def = pierceRestore;

  const actualAtkDmg = atkDmg;
  defenderM.hp -= actualAtkDmg;

  // Death Knight — Death Sentence: 10% chance to instantly kill defender on any damage dealt
  if (attackerM.id === 'death_knight' && actualAtkDmg > 0 && defenderM.hp > 0) {
    if (Math.random() < 0.10) {
      defenderM.hp = 0;
      log(`💀 Death Sentence: Death Knight instant kill triggers! ${defenderM.name} slain!`);
      fxM(attackerM, 'Death Sentence', `Instantly slew ${defenderM.name}`, 'KO', 'good');
    }
  }

  // Void Sentinel — Last Darkness: when HP drops below 30% of maxHp, ATK becomes 36 (reactive)
  if (defenderM.id === 'void_sentinel' && defenderM.maxHp > 0) {
    const threshold30 = Math.floor(defenderM.maxHp * 0.30);
    if (defenderM.hp <= threshold30 && defenderM.hp > 0) {
      defenderM.atk = 36;
      log(`🌑 Last Darkness: Void Sentinel HP critical — ATK surges to 36!`);
      fxM(defenderM, 'Last Darkness', 'HP critical — ATK surged to 36', 'ATK 36', 'good');
    }
  }

  // High Paladin — Lay on Hands: once per game, self-heal 15 HP when HP drops below 30%
  if (defenderM.id === 'high_paladin' && defenderM.abilityData && !defenderM.abilityData.layOnHandsUsed && defenderM.maxHp > 0) {
    const threshold30 = Math.floor(defenderM.maxHp * 0.30);
    if (defenderM.hp <= threshold30 && defenderM.hp > 0) {
      const healed = Math.min(15, defenderM.maxHp - defenderM.hp);
      defenderM.hp = Math.min(defenderM.maxHp, defenderM.hp + 15);
      defenderM.abilityData.layOnHandsUsed = true;
      log(`✝️ Lay on Hands: High Paladin heals ${healed} HP (triggered below 30% HP, now ${defenderM.hp}/${defenderM.maxHp})`);
      fxM(defenderM, 'Lay on Hands', `Healed ${healed} HP below 30%`, `+${healed} HP`, 'good');
    }
  }
  // High Paladin as attacker — Lay on Hands reactive
  if (attackerM.id === 'high_paladin' && attackerM.abilityData && !attackerM.abilityData.layOnHandsUsed && attackerM.maxHp > 0) {
    const threshold30 = Math.floor(attackerM.maxHp * 0.30);
    if (attackerM.hp <= threshold30 && attackerM.hp > 0) {
      const healed = Math.min(15, attackerM.maxHp - attackerM.hp);
      attackerM.hp = Math.min(attackerM.maxHp, attackerM.hp + 15);
      attackerM.abilityData.layOnHandsUsed = true;
      log(`✝️ Lay on Hands: High Paladin heals ${healed} HP (triggered below 30% HP, now ${attackerM.hp}/${attackerM.maxHp})`);
      fxM(attackerM, 'Lay on Hands', `Healed ${healed} HP below 30%`, `+${healed} HP`, 'good');
    }
  }

  // Last Rite check for defender
  if (defenderM.hp <= 0 && defenderM.id === 'demon_lord' && !defenderM.lastRiteUsed) {
    defenderM.hp = 15;
    defenderM.lastRiteUsed = true;
    log('💀 Last Rite triggers! Demon Lord survives at 15 HP!');
    fxM(defenderM, 'Last Rite', 'Survived a lethal blow at 15 HP', '15 HP', 'good');
  }

  let defDmg = 0;
  // Stormtalon — Lightning Strike: if defender killed on initial strike, no counter
  const stormtalonKilledDefender = (attackerM.id === 'stormtalon' && defenderM.hp <= 0);
  if (stormtalonKilledDefender) {
    log(`⚡ Lightning Strike: Stormtalon killed ${defenderM.name} — no counter-strike!`);
    fxM(attackerM, 'Lightning Strike', `Killed ${defenderM.name} — no counter-strike`, 'KO', 'good');
  }
  // Nightshard — Soul Siphon: on kill, steal 4✦ from defeated monster's owner (handled in _applyBattleOutcome)
  // No counter skip for Nightshard anymore

  if (defenderM.hp > 0 && !stormtalonKilledDefender && !stormtalonPreemptiveKilled) {
    const defBonus = bonusTileSet().has(tile.pos);
    const defMonoBuff = monoElementPlayerSet().has(tile.ownerId);

    // Radiant Lancer defending — Piercing Light on counter-strike too (30% of attacker DEF)
    let counterPierceRestore = 0;
    if (defenderM.id === 'radiant_lancer') {
      counterPierceRestore = attackerM.def;
      attackerM.def = Math.max(0, attackerM.def - Math.round(attackerM.def * 0.3));
      log(`🔱 Piercing Light: ${attackerM.name} DEF reduced by 30% for counter-strike (${counterPierceRestore} → ${attackerM.def})`);
      fxM(defenderM, 'Piercing Light', `Ignored 30% of ${attackerM.name}\'s DEF`, '−30% DEF', 'good');
    }

    if (rattled) {
      const savedAtk = defenderM.atk;
      defenderM.atk = Math.floor(defenderM.atk * 0.5);
      defDmg = doStrike(defenderM, attackerM, tile, nullify, defBonus, defMonoBuff);
      defenderM.atk = savedAtk;
      log(`🃏 Rattle! ${defenderM.name} fights at half ATK`);
      fxM(defenderM, 'Rattle (Wild Card)', `${defenderM.name} countered at half ATK`, '½ ATK', 'bad');
    } else {
      defDmg = doStrike(defenderM, attackerM, tile, nullify, defBonus, defMonoBuff);
    }

    // Restore counter Piercing Light
    if (defenderM.id === 'radiant_lancer') attackerM.def = counterPierceRestore;

    // High Paladin defending — no more Divine Retribution; Lay on Hands is reactive above

    // Fortify: reduce damage dealt to the attacker
    if (attackerM._fortify) { defDmg = Math.round(defDmg * 0.60); attackerM._fortify = false; log(`🃏 Fortify! damage reduced 40%`); fxM(attackerM, 'Fortify (Wild Card)', 'Counter damage reduced 40%', '−40%', 'good'); }
    attackerM.hp -= defDmg;

    // Death Knight — Death Sentence on counter-strike: 10% chance to instantly kill attacker
    if (defenderM.id === 'death_knight' && defDmg > 0 && attackerM.hp > 0) {
      if (Math.random() < 0.10) {
        attackerM.hp = 0;
        log(`💀 Death Sentence: Death Knight counter instant kill triggers! ${attackerM.name} slain!`);
        fxM(defenderM, 'Death Sentence', `Instantly slew ${attackerM.name}`, 'KO', 'good');
      }
    }

    // Void Sentinel — Last Darkness: check post-counter too (if attacker is void_sentinel)
    if (attackerM.id === 'void_sentinel' && attackerM.maxHp > 0) {
      const threshold30 = Math.floor(attackerM.maxHp * 0.30);
      if (attackerM.hp <= threshold30 && attackerM.hp > 0) {
        attackerM.atk = 36;
        log(`🌑 Last Darkness: Void Sentinel HP critical — ATK surges to 36!`);
        fxM(attackerM, 'Last Darkness', 'HP critical — ATK surged to 36', 'ATK 36', 'good');
      }
    }

    // High Paladin — Lay on Hands: also check post-counter for attacker
    if (attackerM.id === 'high_paladin' && attackerM.abilityData && !attackerM.abilityData.layOnHandsUsed && attackerM.maxHp > 0) {
      const threshold30 = Math.floor(attackerM.maxHp * 0.30);
      if (attackerM.hp <= threshold30 && attackerM.hp > 0) {
        const healed = Math.min(15, attackerM.maxHp - attackerM.hp);
        attackerM.hp = Math.min(attackerM.maxHp, attackerM.hp + 15);
        attackerM.abilityData.layOnHandsUsed = true;
        log(`✝️ Lay on Hands: High Paladin heals ${healed} HP after counter (now ${attackerM.hp}/${attackerM.maxHp})`);
        fxM(attackerM, 'Lay on Hands', `Healed ${healed} HP below 30%`, `+${healed} HP`, 'good');
      }
    }

    if (attackerM.hp <= 0 && attackerM.id === 'demon_lord' && !attackerM.lastRiteUsed) {
      attackerM.hp = 15;
      attackerM.lastRiteUsed = true;
      log('💀 Last Rite triggers! Demon Lord survives at 15 HP!');
      fxM(attackerM, 'Last Rite', 'Survived a lethal blow at 15 HP', '15 HP', 'good');
    }
  }

  // Ancient Oak — Overgrowth: when Ancient Oak is attacked (as defender), reset stationedTurns
  if (defenderM.id === 'ancient_oak' && defenderM.abilityData) {
    defenderM.abilityData.stationedTurns = 0;
    log(`🌳 Overgrowth: Ancient Oak was attacked — stationedTurns reset to 0`);
    fxM(defenderM, 'Overgrowth', 'Growth timer reset by the attack', 'reset', 'bad');
  }

  let outcome;
  if (attackerM.hp <= 0 && defenderM.hp <= 0) outcome = 'mutual';
  else if (attackerM.hp <= 0) outcome = 'defender_wins';
  else if (defenderM.hp <= 0) outcome = 'attacker_wins';
  else outcome = 'stalemate';

  // When Stormtalon pre-emptively killed the attacker, defDmg (counter) is 0 but
  // stormtalonPreemptiveDmg is the real damage Stormtalon dealt — include it so G.lastBattle shows correct UI.
  const finalDefDmg = defDmg + (stormtalonPreemptiveKilled ? stormtalonPreemptiveDmg : 0);
  return { atkDmg: actualAtkDmg, defDmg: finalDefDmg, outcome };
}

// ─── CONSECUTIVE TILE BONUS ───────────────────────────────────────────────────
// Returns all qualifying runs of 3 consecutive same-element tiles (circular board)
// owned by the same player, each having a stationed monster whose type matches the element.
function getBonusRuns() {
  if (!G || !G.board) return [];
  const n = G.board.length;
  const runs = [];
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const t0 = G.board[i];
    const t1 = G.board[(i + 1) % n];
    const t2 = G.board[(i + 2) % n];
    if (t0.kind !== 'element' || t1.kind !== 'element' || t2.kind !== 'element') continue;
    if (t0.ownerId == null) continue;
    if (t0.ownerId !== t1.ownerId || t0.ownerId !== t2.ownerId) continue;
    if (t0.element !== t1.element || t0.element !== t2.element) continue;
    if (!t0.summonInstance || t0.summonInstance.type !== t0.element) continue;
    if (!t1.summonInstance || t1.summonInstance.type !== t1.element) continue;
    if (!t2.summonInstance || t2.summonInstance.type !== t2.element) continue;
    const key = [i, (i + 1) % n, (i + 2) % n].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    runs.push({ playerIdx: t0.ownerId, element: t0.element, tiles: [i, (i + 1) % n, (i + 2) % n] });
  }
  return runs;
}

// Set of tile positions currently inside any bonus run
function bonusTileSet() {
  const s = new Set();
  for (const r of getBonusRuns()) r.tiles.forEach(t => s.add(t));
  return s;
}

// ─── MONO-ELEMENT MASTERY ─────────────────────────────────────────────────────
// A player qualifies if ALL summons share exactly one element:
//   • every monster in their hand (dual-type rares disqualify)
//   • every monster stationed on the board by them (dual-type rares disqualify)
// Must own at least 1 elemental tile (strategic gate) AND have at least 1 monster.
// Tile elements are NOT checked — only summons in hand + stationed matter.
function getMonoElementBonus() {
  if (!G || !G.board || !G.players) return [];
  const result = [];
  for (const p of G.players) {
    // Gather element tags from summons only; null = dual-type (instant disqualify)
    // Support cards (rarity:'support') are neutral — skip them entirely
    const tags = [];
    for (const m of p.hand) {
      if (m.rarity === 'support') continue;
      tags.push(m.type2 ? null : m.type);
    }
    for (const t of G.board) {
      if (t.ownerId !== p.idx || !t.summonInstance) continue;
      const mi = t.summonInstance;
      if (mi.rarity === 'support') continue;
      tags.push(mi.type2 ? null : mi.type);
    }
    const ownedElemTiles = G.board.filter(t => t.ownerId === p.idx && t.kind === 'element');
    // Must have at least 1 monster AND own at least 1 elemental tile
    if (tags.length === 0 || ownedElemTiles.length === 0) continue;
    // Dual-type disqualifies
    if (tags.includes(null)) continue;
    // All summons must share exactly one element
    const unique = new Set(tags);
    if (unique.size !== 1) continue;
    const monoEl = [...unique][0];
    // Tile gate: must own at least 1 element tile whose element matches the mono element
    // (attackers can target that tile to break mastery)
    if (!ownedElemTiles.some(t => t.element === monoEl)) continue;
    result.push({ playerIdx: p.idx, element: monoEl });
  }
  return result;
}

// Set of playerIdx values currently holding Mono-Element Mastery
function monoElementPlayerSet() {
  const s = new Set();
  for (const r of getMonoElementBonus()) s.add(r.playerIdx);
  return s;
}

// ─── PHASE 1: ABILITY INFRASTRUCTURE ─────────────────────────────────────────

/**
 * getEffectiveStats(monster, tilePos, ownerIdx)
 * Returns { atk, def, gen } after applying all aura buffs/debuffs.
 * Called before battle resolution so abilities affect the fight without
 * permanently mutating the monster's base stats.
 *
 * Auras covered:
 *  • Dawnguard       — +5 DEF to adjacent friendly stationed summons
 *  • Sunfire Herald  — +5 ATK to adjacent friendly stationed summons
 *  • Umbral Stalker  — −5 DEF to adjacent enemy stationed summons
 *  • Briar Sprite    — +5 ATK to all friendly Nature summons (same owner)
 *  • Grove Warden    — +5 DEF to all friendly Nature summons (same owner)
 *  • Mana Weaver     — +1 GEN/turn to all friendly stationed summons (same owner)
 *  • Forge support   — +5 DEF per stationed Forge (existing, handled in resolveBattle;
 *                       included here for completeness via weaponSmithCount path)
 *  • Luminar Operative (luminar_operative) — Luminary Field: +2 ATK/DEF to friendly summons on Light or Arcane tiles
 *  • Hex Stalker      — Hex Dominion:    +2 ATK/DEF to friendly summons on Undead or Beast tiles
 *  • Verdant Sorcerer — Verdant Surge:   +2 ATK/DEF to friendly summons on Arcane or Nature tiles
 */
function getEffectiveStats(monster, tilePos, ownerIdx) {
  if (!G || !G.board) return { atk: monster.atk, def: monster.def, gen: monster.gen };
  // v1.0.92: single pass over the board (was 2 full loops + up to 5 filters + a
  // find() inside the loop). Rules unchanged — verified against v1.0.91 output.
  const N = G.board.length;
  const left = (tilePos + 1) % N, right = (tilePos + N - 1) % N;
  const ownTile = G.board.find(t => t.pos === tilePos);
  const tileEl = ownTile ? ownTile.element : null;
  const onLightArcane  = tileEl === 'Light'  || tileEl === 'Arcane';
  const onUndeadBeast  = tileEl === 'Undead' || tileEl === 'Beast';
  const onArcaneNature = tileEl === 'Arcane' || tileEl === 'Nature';
  const isNature = monster.type === 'Nature';

  let atkBonus = 0, defBonus = 0, genBonus = 0;
  let tilesOwned = 0, arcaneCount = 0, darkCount = 0, otherBeastCount = 0;

  for (const tile of G.board) {
    const friendly = tile.ownerId === ownerIdx;
    if (friendly) tilesOwned++;
    const mi = tile.summonInstance;
    if (!mi) continue;
    const isSelfTile = tile.pos === tilePos;

    // Friendly element counts (self included except Pack Hunter)
    if (friendly) {
      if (mi.type === 'Arcane') arcaneCount++;
      if (mi.type === 'Dark')   darkCount++;
      if (mi.type === 'Beast' && !isSelfTile) otherBeastCount++;
    }

    // Adjacent auras
    if (tile.pos === left || tile.pos === right) {
      if (friendly && !isSelfTile) {
        if (mi.id === 'dawnguard')      defBonus += 5;  // Guardian Shield
        if (mi.id === 'sunfire_herald') atkBonus += 5;  // Radiant Aura
      }
      if (!friendly && mi.id === 'umbral_stalker') defBonus -= 5; // Shadow Veil
    }

    // Board-wide friendly auras (never from self)
    if (friendly && !isSelfTile) {
      if (isNature && mi.id === 'briar_sprite') atkBonus += 5;
      if (isNature && mi.id === 'grove_warden') defBonus += 5;
      if (mi.id === 'mana_weaver') genBonus += 1;
      if (mi.id === 'luminar_operative' && onLightArcane)  { atkBonus += 2; defBonus += 2; } // Luminary Field
      if (mi.id === 'hex_stalker'      && onUndeadBeast)  { atkBonus += 2; defBonus += 2; } // Hex Dominion
      if (mi.id === 'verdant_sorcerer' && onArcaneNature) { atkBonus += 2; defBonus += 2; } // Verdant Surge
      if (mi.id === 'vine_stalker' && mi.abilityData && mi.abilityData.vineAuraActive) atkBonus += 3;
      if (mi.id === 'moss_golem'   && mi.abilityData && mi.abilityData.mossAuraActive) defBonus += 5;
    }
  }

  // Per-monster self stacks / scaling
  const ad = monster.abilityData;
  if (ad) {
    switch (monster.id) {
      case 'void_reaper':     atkBonus += ad.voidHungerBonus || 0; break;
      case 'sorcerer':        atkBonus += ad.sorcererAtkBonus || 0; break;
      case 'runic_duelist':   atkBonus += arcaneCount; break;
      case 'cursed_revenant': defBonus += (ad.cursedRevenantSurvivals || 0) * 2; break;
      case 'shadow_paladin':  atkBonus += darkCount; break;
      case 'razorclaw':       atkBonus += tilesOwned + (ad.apexPredatorBattleWins || 0); break;
      case 'feral_striker':   atkBonus += tilesOwned * 2; break;
      case 'stoneback':       defBonus += tilesOwned * 2; break;
      case 'pack_hunter':     atkBonus += otherBeastCount * 3; break;
      case 'ancient_oak':     atkBonus += ad.oakOvergrowthAtk || 0; defBonus += ad.oakOvergrowthDef || 0; break;
    }
  }

  return {
    atk: Math.max(1, monster.atk + atkBonus),
    def: Math.max(0, monster.def + defBonus),
    gen: Math.max(0, monster.gen + genBonus),
  };
}

/**
 * processTurnStartEffects(playerIdx)
 * Called at the START of a player's turn (before income), handling:
 *  • Shade Walker DoT curse on stationed monsters
 *  • Hemorrhage stacks on players (Plague Herald)
 *  • Vine Stalker / Moss Golem stationed-turn counters
 *  • stationedTurns increment for Ancient Oak (uses Grove Warden identity once active)
 *  • Increments / decrements per-instance abilityData counters
 */
function processTurnStartEffects(playerIdx) {
  if (!G || !G.board || !G.players) return;

  const p = G.players[playerIdx];

  // ── Hemorrhage stacks (Plague Herald ability — Phase 2 sets them) ─────────
  if (p.hemorrhageStacks > 0) {
    let totalDrain = 0;
    for (const tile of G.board) {
      if (tile.ownerId !== playerIdx || !tile.summonInstance) continue;
      const mi = tile.summonInstance;
      const drain = Math.min(mi.hp - 1, p.hemorrhageAmt); // can't kill via hemorrhage
      if (drain > 0) {
        mi.hp -= drain;
        totalDrain += drain;
      }
    }
    p.hemorrhageStacks--;
    if (totalDrain > 0) {
      log(`🩸 Hemorrhage! ${p.name}'s stationed summons bleed ${p.hemorrhageAmt} HP (${p.hemorrhageStacks} turns left)`);
    }
    if (p.hemorrhageStacks <= 0) {
      p.hemorrhageStacks = 0;
      p.hemorrhageAmt = 0;
    }
  }

  // ── Shade Walker DoT curse on enemy monsters ──────────────────────────────
  // Shade Walker's curse is stored on the MONSTER instance (shadeWalkerCurse turns)
  // We tick it for all monsters across the whole board that belong to this player.
  // Note: Shade Walker afflicts the OPPONENT's monster — so we tick ALL board monsters
  // each turn, decrement the curse counter on whatever monster holds it.
  // v1.0.98: ticks once per round on the cursed monster's OWNER's turn, wherever it is
  // (stationed or back in hand) — "follows the monster". Previously ticked every player's
  // turn and only for stationed monsters.
  const _cursed = [
    ...G.board.filter(t => t.ownerId === playerIdx && t.summonInstance).map(t => [t.summonInstance, `tile ${t.pos}`]),
    ...(p.hand || []).map(m => [m, 'hand']),
  ];
  for (const [mi, where] of _cursed) {
    if (!mi || !mi.abilityData) continue;
    if (mi.abilityData.shadeWalkerCurse > 0) {
      const loss = mi.abilityData.shadeWalkerCurseAmt || 5;
      mi.hp = Math.max(1, mi.hp - loss); // can't kill via Shade Walker DoT
      mi.abilityData.shadeWalkerCurse--;
      log(`🌑 Shade Walker curse: ${mi.name} (${where}) takes ${loss} HP (${mi.abilityData.shadeWalkerCurse} turns left)`);
    }
  }

  // ── Vine Stalker / Moss Golem stationed-turn counters ────────────────────
  // Tick stationedTurns for ALL stationed summons (across all owned tiles by any player)
  // We only tick those whose owner is the CURRENT player so turns are counted per-player-turn
  for (const tile of G.board) {
    if (tile.ownerId !== playerIdx || !tile.summonInstance) continue;
    const mi = tile.summonInstance;
    if (!mi.abilityData) continue;

    // Increment stationed turns for aura-building pieces
    if (mi.id === 'vine_stalker' || mi.id === 'moss_golem' || mi.id === 'ancient_oak') {
      mi.abilityData.stationedTurns = (mi.abilityData.stationedTurns || 0) + 1;
      const turns = mi.abilityData.stationedTurns;

      if (mi.id === 'vine_stalker' && !mi.abilityData.vineAuraActive && turns >= 5) {
        mi.abilityData.vineAuraActive = true;
        log(`🌿 Vine Stalker awakens! +3 ATK aura active for ${p.name}'s friendly stationed summons`);
      }
      if (mi.id === 'moss_golem' && !mi.abilityData.mossAuraActive && turns >= 5) {
        mi.abilityData.mossAuraActive = true;
        log(`🪨 Moss Golem awakens! +5 DEF aura active for ${p.name}'s friendly stationed summons`);
      }
      // Ancient Oak — Overgrowth: every 3 turns stationed without being attacked, +3 ATK/+3 DEF permanently
      // stationedTurns resets on attack (handled in resolveBattle when ancient_oak is defender)
      if (mi.id === 'ancient_oak' && turns > 0 && turns % 3 === 0) {
        mi.abilityData.oakOvergrowthAtk = (mi.abilityData.oakOvergrowthAtk || 0) + 3;
        mi.abilityData.oakOvergrowthDef = (mi.abilityData.oakOvergrowthDef || 0) + 3;
        log(`🌳 Overgrowth: Ancient Oak grows! +3 ATK +3 DEF permanently (turns: ${turns}, total: +${mi.abilityData.oakOvergrowthAtk}/+${mi.abilityData.oakOvergrowthDef})`);
      }
    }

    // Iron Hide — Hardened Shell: gains +3 HP permanently each time it SURVIVES a battle
    // (HP regen per tile was wrong; survival bonus is applied in _applyBattleOutcome)
  }

  // ── Plague Herald — Pestilence: adjacent enemy stationed monsters lose 3 HP/turn ──
  for (const tile of G.board) {
    if (tile.ownerId !== playerIdx || !tile.summonInstance) continue;
    if (tile.summonInstance.id !== 'plague_herald') continue;
    const phNeighbors = [(tile.pos + 1) % 28, (tile.pos + 27) % 28];
    for (const np of phNeighbors) {
      const nt = G.board[np];
      if (nt && nt.ownerId !== playerIdx && nt.summonInstance) {
        const loss = Math.max(0, Math.min(nt.summonInstance.hp - 1, 3)); // can't kill via Pestilence
        if (loss > 0) {
          nt.summonInstance.hp -= loss;
          log(`🦠 Pestilence: ${nt.summonInstance.name} loses ${loss} HP from adjacent Plague Herald (now ${nt.summonInstance.hp}/${nt.summonInstance.maxHp})`);
        }
      }
    }
  }

  // v1.0.98: Spell Wraith — Mana Siphon moved to collectPassiveIncome (real drain on the victim's income).
}

// ─── PASSIVE INCOME / SPECIALS ────────────────────────────────────────────────

function collectPassiveIncome(playerIdx) {
  const p = G.players[playerIdx];
  let earned = 5; // baseline
  let summonGen = 0;

  for (const tile of G.board) {
    if (tile.ownerId !== playerIdx || !tile.summonId) continue;

    // stationed summons are stored separately in tile.summonInstance
    const mi = tile.summonInstance;
    if (!mi) continue;
    let gen = mi.gen;
    // World Tree special — Deep Roots: +1 Gen per Nature tile owned + per Nature summon stationed
    if (mi.id === 'world_tree') {
      const natureTiles = G.board.filter(t => t.ownerId === playerIdx && t.element === 'Nature').length;
      const natureMonsters = G.board.filter(t => t.ownerId === playerIdx && t.summonInstance &&
        (t.summonInstance.type === 'Nature' || t.summonInstance.type2 === 'Nature')).length;
      gen += natureTiles + natureMonsters;
    }
    // Per-ability gen tracking for tally visualization
    const _tallyBreakdown = [];

    // World Tree special — gen bonus added earlier above; capture it now
    if (mi.id === 'world_tree') {
      const wtBonus = gen - mi.gen;
      if (wtBonus > 0) _tallyBreakdown.push({ label: '🌳 Deep Roots', bonus: wtBonus });
    }

    // Rune Priestess — Runic Amplification: gen doubled while stationed on an Arcane tile
    if (mi.id === 'rune_priestess' && tile.element === 'Arcane') {
      _tallyBreakdown.push({ label: '🔮 Runic Amp ×2', bonus: mi.gen }); // extra = base gen (doubled)
      gen *= 2;
      log(`🔮 Runic Amplification: Rune Priestess on Arcane tile — gen doubled to ${gen}✦`);
    }

    // Arch Mage — Mana Infusion: +2✦ bonus income per turn while stationed (v1.0.103: was +3)
    if (mi.id === 'arch_mage') {
      _tallyBreakdown.push({ label: '🔮 Mana Infusion', bonus: 2 });
      gen += 2;
      log(`🔮 Mana Infusion: Arch Mage grants +2✦ bonus income (total gen: ${gen})`);
    }

    // Sorcerer — Arcane Ascent: gen bonus from permanent sorcererGenBonus
    if (mi.id === 'sorcerer' && mi.abilityData && mi.abilityData.sorcererGenBonus) {
      _tallyBreakdown.push({ label: '🔮 Arcane Ascent', bonus: mi.abilityData.sorcererGenBonus });
      gen += mi.abilityData.sorcererGenBonus;
    }

    // Store actual gen for tally display (reflects all ability bonuses)
    mi._tallyGen = gen;
    mi._tallyGenBreakdown = _tallyBreakdown;

    earned += gen;
    summonGen += gen;
  }

  // v1.0.98: Spell Wraith — Mana Siphon (real drain). Each of this player's stationed summons
  // next to an enemy Spell Wraith loses its base Gen from this turn's income; that Mana goes to
  // the Wraith's owner. Same numbers computeRoundTally shows as spellWraithDrain.
  let spellWraithDrainTotal = 0;
  for (const tile of G.board) {
    if (tile.ownerId !== playerIdx || !tile.summonInstance) continue;
    const mi = tile.summonInstance;
    for (const np of [(tile.pos + 1) % 28, (tile.pos + 27) % 28]) {
      const wt = G.board[np];
      if (!wt || !wt.summonInstance || wt.summonInstance.id !== 'spell_wraith') continue;
      if (wt.ownerId == null || wt.ownerId === playerIdx) continue;
      const want = mi.gen || 0;
      const take = Math.max(0, Math.min(want, earned));
      if (take <= 0) continue;
      earned -= take;
      spellWraithDrainTotal += take;
      const owner = G.players[wt.ownerId];
      if (owner) {
        owner.mana += take;
        if (owner.totalManaEarned != null) owner.totalManaEarned += take;
      }
      log(`✨ Mana Siphon: ${owner ? owner.name + "'s " : ''}Spell Wraith drains ${take}✦ from ${p.name}'s ${mi.name}`);
    }
  }

  // Ardent Saint passive — heal all friendly stationed summons 5 HP/turn
  const ardentSaintCount = G.board.filter(t => t.ownerId === playerIdx && t.summonInstance && t.summonInstance.id === 'ardent_saint').length;
  for (const tile of G.board) {
    if (tile.ownerId !== playerIdx) continue;
    const mi = tile.summonInstance;
    if (mi && mi.id === 'ardent_saint') {
      for (const t2 of G.board) {
        if (t2.ownerId === playerIdx && t2.summonInstance && t2 !== tile) {
          t2.summonInstance.hp = Math.min(t2.summonInstance.maxHp, t2.summonInstance.hp + 5);
        }
      }
    }
  }

  // Mana Refinery passive — +1✦ per friendly stationed summon if player has ≥1 Refinery stationed
  const friendlySummonCount = G.board.filter(t => t.ownerId === playerIdx && t.summonInstance).length;
  const manaRefineryCount = G.board.filter(t => t.ownerId === playerIdx && t.summonInstance && t.summonInstance.id === 'mana_refinery').length;
  const manaRefineryBonus = manaRefineryCount > 0 ? friendlySummonCount : 0;
  if (manaRefineryBonus > 0) {
    earned += manaRefineryBonus;
    log(`🏭 Mana Refinery: ${p.name} earns +${manaRefineryBonus}✦ (${friendlySummonCount} stationed summons × 1✦)`);
  }

  // Field Medic passive — +2 HP/round to all stationed summons per copy (stacks)
  const fieldMedicCount = G.board.filter(t => t.ownerId === playerIdx && t.summonInstance && t.summonInstance.id === 'field_medic').length;
  if (fieldMedicCount > 0) {
    const healPerSummon = fieldMedicCount * 2;
    for (const tile of G.board) {
      if (tile.ownerId !== playerIdx || !tile.summonInstance) continue;
      if (tile.summonInstance.id === 'field_medic') continue; // field medics don't heal themselves
      tile.summonInstance.hp = Math.min(tile.summonInstance.maxHp, tile.summonInstance.hp + healPerSummon);
    }
    log(`🏥 Field Medic ×${fieldMedicCount}: ${p.name}'s summons heal +${healPerSummon} HP`);
  }

  // Weapon Smith passive — +5 ATK per copy IN HAND of attacker (applied at battle time in doStrike; tracked here for summary display)
  const weaponSmithCount = p.hand.filter(m => m.id === 'weapon_smith').length;

  // Forge passive — +5 DEF per copy stationed (applied at battle time in resolveBattle; tracked here for summary display)
  const forgeCount = G.board.filter(t => t.ownerId === playerIdx && t.summonInstance && t.summonInstance.id === 'forge').length;

  // Red Dragon Intimidate aura — enemy stationed summons adjacent to the Red Dragon pay 5✦/turn
  let intimidateLoss = 0;
  for (const tile of G.board) {
    if (!tile.summonInstance || tile.summonInstance.id !== 'red_dragon') continue;
    if (tile.ownerId === playerIdx) continue; // only affects OTHER players' monsters
    // Check if current player has a monster adjacent to this Red Dragon
    const neighbors = [(tile.pos + 1) % 28, (tile.pos + 27) % 28];
    for (const n of neighbors) {
      const nt = G.board[n];
      if (nt && nt.ownerId === playerIdx && nt.summonInstance) {
        const loss = Math.min(p.mana, 5);
        p.mana -= loss;
        intimidateLoss += loss;
        log(`🐉 Intimidate! ${p.name}'s ${nt.summonInstance.name} is adjacent to Red Dragon — pays ${loss}✦`);
      }
    }
  }

  // Consecutive tile bonus — heal +1 HP to each summon in a qualifying run
  const bonusRuns = getBonusRuns();
  const healedThisTurn = new Set();
  for (const run of bonusRuns) {
    if (run.playerIdx !== playerIdx) continue;
    for (const tPos of run.tiles) {
      if (healedThisTurn.has(tPos)) continue;
      healedThisTurn.add(tPos);
      const bt = G.board[tPos];
      if (bt && bt.summonInstance) {
        bt.summonInstance.hp = Math.min(bt.summonInstance.maxHp, bt.summonInstance.hp + 1);
      }
    }
  }
  if (healedThisTurn.size > 0) {
    log(`🔥 ${p.name}'s Tile Synergy heals ${healedThisTurn.size} summon${healedThisTurn.size > 1 ? 's' : ''} +1 HP`);
  }

  // Mono-Element Mastery — heal all stationed summons +1 HP if player qualifies
  const monoBonus = getMonoElementBonus().find(r => r.playerIdx === playerIdx);
  let monoHealCount = 0;
  if (monoBonus) {
    for (const t of G.board) {
      if (t.ownerId !== playerIdx || !t.summonInstance) continue;
      t.summonInstance.hp = Math.min(t.summonInstance.maxHp, t.summonInstance.hp + 1);
      monoHealCount++;
    }
    if (monoHealCount > 0) {
      log(`⭐ ${p.name}'s Mono-Element Mastery (${monoBonus.element}) heals ${monoHealCount} summon${monoHealCount > 1 ? 's' : ''} +1 HP`);
    }
  }

  // Tile upkeep — 1 Mana per owned tile (applies from round 2 onward)
  const ownedTileCount = G.board.filter(t => t.ownerId === playerIdx).length;
  let upkeep = 0;
  if (ownedTileCount > 0) {
    upkeep = ownedTileCount;
    p.mana = Math.max(0, p.mana - upkeep);
    log(`🏗️ ${p.name} pays ${upkeep}✦ upkeep for ${ownedTileCount} tile${ownedTileCount > 1 ? 's' : ''}`);
  }

  // Dusk Blade — Hemorrhage: reduce this player's income if flagged by an enemy Dusk Blade win last turn
  if (p._hemorrhageIncomeReduction) {
    const reduction = Math.min(earned, p._hemorrhageIncomeReduction);
    earned = Math.max(0, earned - reduction);
    log(`🗡️ Hemorrhage: ${p.name}'s Mana income reduced by ${reduction}✦ (Dusk Blade curse)`);
    p._hemorrhageIncomeReduction = 0;
  }

  // Wild card effects on income — snapshot flags before clearing
  const hadWindfall = p.wcEffects.windfall;
  const hadJinx = p.wcEffects.jinx;
  if (p.wcEffects.windfall) { earned = earned * 3; p.wcEffects.windfall = false; log(`🃏 Windfall! ${p.name}'s income tripled`); }
  if (p.wcEffects.jinx)    { earned = Math.floor(earned * 0.5); p.wcEffects.jinx = false; log(`🃏 Jinx! ${p.name}'s income halved`); }

  const MANA_SOFT_CAP = 150;
  const softCapped = p.mana >= MANA_SOFT_CAP;
  if (softCapped) {
    earned = Math.max(5, Math.floor(earned * 0.5)); // still earn baseline but halved above cap
  }
  p.mana += earned;
  if (p.mana > MANA_SOFT_CAP && p.mana - earned < MANA_SOFT_CAP) {
    log(`⚠️ ${p.name} is over the ${MANA_SOFT_CAP}✦ soft cap — income reduced`);
  }
  log(`✦ ${p.name} earns ${earned} Mana (now ${p.mana})`);

  // ── Build turn summary snapshot ───────────────────────────────────────────
  const wellBonus = p.lastTurnLandedOnWell ? 40 : 0;
  p.lastTurnLandedOnWell = false; // consume after reading
  const stationedCount = countStationedSummons(playerIdx);
  const tileCount = G.board.filter(t => t.ownerId === playerIdx).length;

  // Active wild card effects to show (effects still pending THIS turn — not the ones just consumed)
  const activeWcEffects = [];
  if (p.wcEffects.stumble)  activeWcEffects.push({ id:'stumble',  label:'Stumble',  desc:'Skip roll — move exactly 3', color:'blue' });
  if (p.wcEffects.delay)    activeWcEffects.push({ id:'delay',    label:'Delay',    desc:'Shop phase skipped',          color:'amber' });
  // jinx/windfall already consumed above — show if they were active
  if (hadWindfall)          activeWcEffects.push({ id:'windfall', label:'Windfall', desc:'Income tripled this turn',    color:'green' });
  if (hadJinx)              activeWcEffects.push({ id:'jinx',     label:'Jinx',     desc:'Income halved this turn',     color:'red' });
  if (p.wcEffects.ambush)   activeWcEffects.push({ id:'ambush',   label:'Ambush',   desc:'Next attack +40%',            color:'accent' });
  if (p.wcEffects.fortify)  activeWcEffects.push({ id:'fortify',  label:'Fortify',  desc:'Next defense −40% damage',    color:'accent' });
  if (p.wcEffects.rattle)   activeWcEffects.push({ id:'rattle',   label:'Rattle',   desc:'Next battle at half ATK',     color:'red' });

  // Tile synergy runs belonging to this player
  const myRuns = getBonusRuns().filter(r => r.playerIdx === playerIdx);
  const tileSynergyCount = myRuns.reduce((sum, r) => sum + r.tiles.length, 0);

  const round = Math.floor(G.turnCount / G.players.length) + 1;
  const roundsRemaining = G.roundLimit - round;

  G.turnSummary = {
    playerIdx,
    playerName: p.name,
    playerColor: p.color,
    round,
    roundLimit: G.roundLimit,
    roundsRemaining: Math.max(0, roundsRemaining),
    manaAfter: p.mana,
    tileCount,
    stationedCount,
    // Income breakdown
    baseline: 5,
    summonGen,
    manaRefineryBonus,
    wellBonus,
    intimidateLoss,
    upkeep,
    windfallActive: hadWindfall,
    jinxActive: hadJinx,
    softCapped,
    netEarned: earned,
    // HP bonuses
    tileSynergyCount,
    monoHealCount,
    medicHeal: fieldMedicCount > 0 ? fieldMedicCount * 2 : 0,
    auraHeal: ardentSaintCount > 0 ? ardentSaintCount * 5 : 0,
    weaponSmithCount,
    forgeCount,
    activePassives: (() => {
      const ap = [];
      if (ardentSaintCount > 0) ap.push({ id:'ardent_saint', label:`Ardent Saint ×${ardentSaintCount}`, desc:`Aura of Renewal: +${ardentSaintCount * 5} HP/turn to all friendly summons` });
      if (fieldMedicCount > 0) ap.push({ id:'field_medic', label:`Field Medic ×${fieldMedicCount}`, desc:`+${fieldMedicCount * 2} HP/turn to all friendly summons` });
      if (manaRefineryCount > 0) ap.push({ id:'mana_refinery', label:`Mana Refinery ×${manaRefineryCount}`, desc:`+${manaRefineryBonus}✦ bonus income (1✦ per stationed summon)` });
      if (weaponSmithCount > 0) ap.push({ id:'weapon_smith', label:`Weapon Smith ×${weaponSmithCount}`, desc:`+${weaponSmithCount * 5} ATK to your attacking summon (copies in hand)` });
      if (forgeCount > 0) ap.push({ id:'forge', label:`Forge ×${forgeCount}`, desc:`+${forgeCount * 5} DEF to all stationed summons` });
      return ap;
    })(),
    // Wild card state
    activeWcEffects,
    // Battle mana from previous turn
    battleManaGain: p.lastTurnBattleManaGain,
    battleManaLoss: p.lastTurnBattleManaLoss,
  };

  // Reset battle mana trackers for next turn
  p.lastTurnBattleManaGain = 0;
  p.lastTurnBattleManaLoss = 0;
}

function countStationedSummons(playerIdx) {
  return G.board.filter(t => t.ownerId === playerIdx && t.summonInstance).length;
}

// ─── CHEST DRAWS ─────────────────────────────────────────────────────────────

function drawChestReward() {
  const r = Math.random();
  if (r < 0.45) {
    // Potion — sub-roll
    const r2 = Math.random();
    let tier, healVal;
    if (r2 < 0.6)       { tier = 'Minor'; healVal = 15; }
    else if (r2 < 0.9)  { tier = 'Major'; healVal = 'half'; }
    else                 { tier = 'Full';  healVal = 'full'; }
    return { kind:'potion', tier, healVal, icon:'🧪', rarity:'Common' };
  } else if (r < 0.70) {
    return { kind:'charm', icon:'⚡', rarity:'Uncommon' };
  } else if (r < 0.85) {
    return { kind:'warp',  icon:'🌀', rarity:'Rare' };
  } else {
    return { kind:'free_monster', icon:'🎁', rarity:'Rare' };
  }
}

// ─── STATE BROADCASTING ───────────────────────────────────────────────────────

// ─── v1.0.91: shared helpers ──────────────────────────────────────────────────
// guardTurn: standard "right phase + your turn" check for player action handlers.
// Sends the same error messages the inline checks used; returns false if blocked.
function guardTurn(ws, conn, phases, phaseMsg = 'Wrong phase') {
  if (!G || !phases.includes(G.phase)) { sendError(ws, phaseMsg); return false; }
  if (conn.playerIdx !== G.currentPlayer) { sendError(ws, 'Not your turn'); return false; }
  return true;
}

// Monster → client serialization (was hand-written 4×: hand, board, shop, temple)
function monCore(m) {
  return { iid:m.iid, id:m.id, name:m.name, type:m.type,
           hp:m.hp, maxHp:m.maxHp, atk:m.atk, def:m.def,
           cost:m.cost, gen:m.gen, isSpecial:m.isSpecial, charm:m.charm };
}
function monExt(m) {
  return { type2:m.type2||null, rarity:m.rarity||null, arch:m.arch||null, supportDesc:m.supportDesc||null };
}
function monSpecial(m) {
  return { special:m.special||null, specialDesc:m.specialDesc||null,
           condition:m.condition||null, conditionDesc:m.conditionDesc||null };
}
// Board tile occupant
function serializeBoardMonster(m) { return { ...monCore(m), ...monExt(m) }; }
// Player's own hand card
function serializeHandMonster(m, playerIdx) {
  return { ...monCore(m), ...monExt(m), ...monSpecial(m), canUse: canUseSpecial(playerIdx, m) };
}
// Shop offer (never special, never charmed)
function serializeShopMonster(m) { return { ...monCore(m), ...monExt(m), isSpecial:false, charm:false }; }
// Temple offer (always special)
function serializeTempleMonster(m) { return { ...monCore(m), ...monSpecial(m), isSpecial:true, charm:false }; }

function publicState() {
  // Safe copy of board (summonInstance as summary)
  const board = G.board.map(t => {
    const ti = { ...t };
    if (t.summonInstance) {
      const m = t.summonInstance;
      ti.summon = serializeBoardMonster(m);
    } else {
      ti.summon = null;
    }
    delete ti.summonInstance;
    return ti;
  });

  // v1.0.92: tile + stationed counts for all players in one board pass
  const tileCounts = {}, stationedCounts = {};
  for (const t of G.board) {
    if (t.ownerId == null) continue;
    tileCounts[t.ownerId] = (tileCounts[t.ownerId] || 0) + 1;
    if (t.summonInstance) stationedCounts[t.ownerId] = (stationedCounts[t.ownerId] || 0) + 1;
  }
  const players = G.players.map(p => ({
    idx: p.idx, name: p.name, color: p.color, starterSet: p.starterSet,
    mana: p.mana, position: p.position,
    handSize: p.hand.length,
    tileCount: tileCounts[p.idx] || 0,
    stationedCount: stationedCounts[p.idx] || 0,
    healCount: p.healCount,
    destroyedCount: p.destroyedCount,
    elementChangeCount: p.elementChangeCount,
    arcaneChangeCount: p.arcaneChangeCount,
    lastDiceRoll: p.lastDiceRoll,
    lastDice: p.lastDice || null,
    battlesWon: p.battlesWon,
    battlesLost: p.battlesLost,
    peakTiles: p.peakTiles,
    totalManaEarned: p.totalManaEarned,
    wcEffects: p.wcEffects || {},
    notification: p.notification || null,
    isConnected: p.isConnected !== false, // include so board can show disconnect badge
    eliminated: p.eliminated || false,
    eliminatedRank: p.eliminatedRank || null,
    forfeited: p.forfeited || false,
  }));

  return {
    phase: G.phase,
    roomCode: G.roomCode,
    currentPlayer: G.currentPlayer,
    turnCount: G.turnCount,
    roundLimit: G.roundLimit,
    events: G.events.slice(0, 15),
    players,
    board,
    stalemateData: G.stalemateData,
    pendingChest: G.pendingChest,
    pendingTemple: G.pendingTemple ? {
      offers: G.pendingTemple.offers.map(serializeTempleMonster)
    } : null,
    shopOffers: G.shopOffers.map(serializeShopMonster),
    lastBattle: G.lastBattle || null,
    pendingAttackerSummon: G.pendingAttackerSummon || null,
    pendingLanding: G.pendingLanding || null,
    wildCardDrawn: G.wildCardDrawn || null,
    wildCardPending: G.wildCardPending || null,
    pausedFor: G.pausedFor || null,
    setupRound: G.setupRound || 1,
    setupTurnIdx: G.setupTurnIdx || 0,
    setupTotalTurns: G.setupTotalTurns || 0,
    bonusRuns: getBonusRuns(),
    monoElementBonus: getMonoElementBonus(),
    turnSummary: G.turnSummary || null,
    roundCallout: G.roundCallout || null,
    tileFlashes: G.tileFlashes || [],
    lastWildCard: G.lastWildCard || null,
    lastVoice: G.lastVoice || null,
    serverVersion: SERVER_VERSION,
  };
}

// broadcast() and sendError() are defined later in the server section,
// after the clients Map is set up.

// ─── ELIMINATION ─────────────────────────────────────────────────────────────

// Call at the end of a player's own turn. Marks them eliminated if they own 0 tiles.
// Only fires after setup phase is complete (turnCount >= players.length ensures at least
// 1 full setup round has passed before the rule can arm).
function checkElimination(playerIdx) {
  const p = G.players[playerIdx];
  if (!p || p.eliminated) return false;
  // Grace: don't arm during setup phase
  if (G.phase === 'setup') return false;
  // Grace: first full round (turnCount < players.length means setup just ended)
  if (G.turnCount < G.players.length) return false;

  const ownedTiles = G.board.filter(t => t.ownerId === playerIdx).length;
  if (ownedTiles > 0) return false;

  // Count how many players are already eliminated to assign rank
  const elimCount = G.players.filter(pl => pl.eliminated).length;
  p.eliminated = true;
  p.eliminatedRank = elimCount + 1; // lower = eliminated earlier (1 = first out)

  log(`💀 ${p.name} owns 0 tiles and is ELIMINATED! (rank: out at ${p.eliminatedRank})`);

  // Board overlay hint — set a special notification so board.html can flash it
  // (the elimination event is in the event log; board.html reads events)
  return true; // signal: elimination happened
}

// Immediate mana-death check — call after any action that drains mana.
// Eliminates the player on the spot if mana hits 0. No grace period.
function checkManaElimination(playerIdx) {
  const p = G.players[playerIdx];
  if (!p || p.eliminated) return false;
  if (p.mana > 0) return false;
  p.mana = 0;
  const elimCount = G.players.filter(pl => pl.eliminated).length;
  p.eliminated = true;
  p.eliminatedRank = elimCount + 1;
  log(`💸 ${p.name} ran out of Mana and is ELIMINATED!`);
  return true;
}

// ─── FORFEIT (v1.0.96) ───────────────────────────────────────────────────────
// Voluntary quit (leave_game) or host removal (remove_player). Works like an
// elimination: tiles keep their stationed summons (still owned by the out player,
// same as a normal elimination, so others must battle for them); hand + Mana are
// discarded; pending effects on the player are cancelled (no refunds). Permanent —
// a forfeited player can never rejoin.
function forfeitPlayer(idx, reason) {
  const p = G.players[idx];
  if (!p || p.eliminated) return false;
  if (G.phase === 'lobby' || G.phase === 'game_over') return false;

  const elimCount = G.players.filter(pl => pl.eliminated).length;
  p.eliminated = true;
  p.eliminatedRank = elimCount + 1;
  p.forfeited = true;
  p.hand = [];
  p.mana = 0;
  p.notification = null;
  if (p.wcEffects) for (const k of Object.keys(p.wcEffects)) p.wcEffects[k] = (typeof p.wcEffects[k] === 'number') ? 0 : false;
  p.hemorrhageStacks = 0; p.hemorrhageAmt = 0; p._hemorrhageIncomeReduction = 0;
  if (G.stalemateData && G.stalemateData.attackerIdx === idx) G.stalemateData = null;

  log(reason === 'removed'
    ? `🚪 ${p.name} was removed by the host — out of the game`
    : `🏳 ${p.name} left the game — out of the game`);

  // Pause bookkeeping: clear if it was for them; re-point at another dropout if any
  if (G.pausedFor && G.pausedFor.idx === idx) G.pausedFor = null;
  if (!G.pausedFor) {
    const other = G.players.find(pl => !pl.eliminated && pl.isConnected === false);
    if (other) G.pausedFor = { idx: other.idx, name: other.name, color: other.color };
  }

  if (checkLastStanding()) { broadcast(); return true; }

  if (G.currentPlayer === idx) {
    // Invalidate any timers scheduled for this turn, cancel pending turn state
    G._forfeitGen = (G._forfeitGen || 0) + 1;
    G.pendingWildCard = false; G.wildCardDrawn = null; G.wildCardPending = null;
    G.pendingTemple = null; G.pendingChest = null; G.pendingLanding = null;
    G.pendingAttackerMonster = null;
    if (G.phase === 'setup') { advanceSetupTurn(); return true; }
    if (G.phase === 'resolve:round_callout') {
      // Turn hasn't started yet — hand it to the next active player; callout continues
      let n = idx, guard = 0;
      do { n = (n + 1) % G.players.length; } while (G.players[n].eliminated && ++guard <= G.players.length);
      G.currentPlayer = n;
      broadcast();
      return true;
    }
    advanceTurn();
    return true;
  }
  broadcast();
  return true;
}

// Call after every turn. If only 1 non-eliminated player remains, end the game immediately.
function checkLastStanding() {
  const active = G.players.filter(p => !p.eliminated);
  if (active.length <= 1) {
    endGame();
    return true;
  }
  return false;
}

// ─── TURN MANAGEMENT ─────────────────────────────────────────────────────────

// Builds the per-summon tally array for the pre-round animation.
// Called after processTurnStartEffects + collectPassiveIncome have run, so
// all HP changes and aura states are final.
// hpSnapshot: { tilePos → hp } captured BEFORE processTurnStartEffects
// milestoneSnapshot: { tilePos → { vineAuraActive, mossAuraActive, oakAtkBonus, oakDefBonus } }
function computeRoundTally(playerIdx, hpSnapshot, milestoneSnapshot) {
  const tally = [];
  const N = G.board.length;

  for (const tile of G.board) {
    if (tile.ownerId !== playerIdx || !tile.summonInstance) continue;
    const mi = tile.summonInstance;
    const pos = tile.pos;

    // Skip monsters that have all-zero beats AND no milestones (checked below)
    const eff = getEffectiveStats(mi, pos, playerIdx);

    // ── Beat 1: Net mana this turn ────────────────────────────────────────────
    // Use actual gen from collectPassiveIncome (_tallyGen), which includes ability
    // bonuses like Rune Priestess doubling and Arch Mage +2.  Falls back to eff.gen
    // only if _tallyGen wasn't set (e.g. skipped collectPassiveIncome somehow).
    const actualGen = mi._tallyGen !== undefined ? mi._tallyGen : eff.gen;
    let netMana = actualGen;
    let spellWraithDrain = 0;
    const neighbors = [(pos + 1) % N, (pos + N - 1) % N];
    for (const t2 of G.board) {
      if (t2.ownerId === playerIdx || !t2.summonInstance) continue;
      if (t2.summonInstance.id === 'spell_wraith' && neighbors.includes(t2.pos)) {
        // Enemy Spell Wraith adjacent: it drains this summon's base gen
        spellWraithDrain += mi.gen;
        netMana -= mi.gen;
      }
    }
    const genBreakdown = mi._tallyGenBreakdown || [];

    // ── Beat 2 & 3: Net ATK / DEF deltas from all auras ──────────────────────
    const netAtk = eff.atk - mi.atk;
    const netDef = eff.def - mi.def;

    // ── Beat 4: Net HP change this turn ──────────────────────────────────────
    const snapHp = hpSnapshot[pos] !== undefined ? hpSnapshot[pos] : mi.hp;
    const netHp = mi.hp - snapHp;

    // ── Beat 5: Milestones ────────────────────────────────────────────────────
    const snap = milestoneSnapshot[pos] || {};
    const milestones = [];
    if (!snap.vineAuraActive && mi.abilityData?.vineAuraActive) milestones.push('vine_aura');
    if (!snap.mossAuraActive && mi.abilityData?.mossAuraActive) milestones.push('moss_aura');
    const newOakAtk = mi.abilityData?.atkBonus || 0;
    const newOakDef = mi.abilityData?.defBonus || 0;
    if (newOakAtk > (snap.oakAtkBonus || 0) || newOakDef > (snap.oakDefBonus || 0)) {
      milestones.push('oak_overgrowth');
    }

    // Skip entirely if all zero and no milestones
    if (netMana === 0 && netAtk === 0 && netDef === 0 && netHp === 0 && milestones.length === 0) continue;

    tally.push({
      tilePos: pos,
      monsterId: mi.id,
      monsterName: mi.name,
      monsterType: mi.type,
      netMana,
      netAtk,
      netDef,
      netHp,
      milestones,
      genBreakdown,        // ability labels explaining the mana total
      spellWraithDrain,    // how much an adjacent Spell Wraith drained
    });
  }

  // ── Player-level mana bonus entries — Mana Refinery ──────────────────────
  // These are added after the per-summon loop because the refinery bonus is a
  // flat per-copy bonus collected outside the gen loop in collectPassiveIncome.
  const refineryTiles = G.board.filter(t =>
    t.ownerId === playerIdx && t.summonInstance && t.summonInstance.id === 'mana_refinery'
  );
  for (const rt of refineryTiles) {
    tally.push({
      tilePos: rt.pos,
      monsterId: 'mana_refinery',
      monsterName: 'Mana Refinery',
      monsterType: null,
      netMana: 1,   // +1✦ per stationed copy
      netAtk: 0, netDef: 0, netHp: 0,
      milestones: [],
      genBreakdown: [{ label: '🏭 Refinery Bonus', bonus: 1 }],
      spellWraithDrain: 0,
      isPlayerBonus: true,
    });
  }

  return tally;
}

function startShopPhase() {
  const p = G.players[G.currentPlayer];
  p.lastDice = null;
  p.lastDiceRoll = null;  // reset so stale roll values don't trigger false animations
  G.lastBattle = null;    // clear battle result so it doesn't persist across turns
  G.pendingAttackerSummon = null; // clear attacker preview

  // Round 1 grace period — summons placed during setup shouldn't immediately earn;
  // mana generation starts from round 2 onward (turnCount >= playerCount)
  const isRound1 = G.turnCount < G.players.length;
  if (!isRound1) {
    // Snapshot HP and milestone states BEFORE effects run so tally can compute deltas
    const _hpSnapshot = {};
    const _milestoneSnapshot = {};
    for (const tile of G.board) {
      if (tile.ownerId === G.currentPlayer && tile.summonInstance) {
        _hpSnapshot[tile.pos] = tile.summonInstance.hp;
        _milestoneSnapshot[tile.pos] = {
          vineAuraActive: tile.summonInstance.abilityData?.vineAuraActive || false,
          mossAuraActive: tile.summonInstance.abilityData?.mossAuraActive || false,
          oakAtkBonus:    tile.summonInstance.abilityData?.atkBonus       || 0,
          oakDefBonus:    tile.summonInstance.abilityData?.defBonus       || 0,
        };
      }
    }
    processTurnStartEffects(G.currentPlayer); // Phase 1 + 2: ability ticks before income
    collectPassiveIncome(G.currentPlayer);
    // Attach round tally for pre-round animation on the client
    if (G.turnSummary) {
      G.turnSummary.roundTally = computeRoundTally(G.currentPlayer, _hpSnapshot, _milestoneSnapshot);
    }
  } else {
    G.turnSummary = null; // no summary in round 1
    log(`⏳ ${p.name} — income starts Round 2`);
  }
  G.shopOffers = pickShopOffers(); // always generate offers (needed for stalemate buy option too)

  // Safety: if round limit already reached, end now rather than routing to stalemate
  if (G.turnCount >= G.roundLimit * G.players.length) { endGame(); return; }

  // Round 2+ — show turn summary before shop/stalemate/roll
  if (!isRound1) {
    G.phase = 'resolve:turn_summary';
    log(`📋 ${p.name}'s turn summary`);
    broadcast();
    return;
  }

  // Round 1 — skip summary and go straight to shop
  _startActualTurn();
}

// Called after turn summary is dismissed (or directly in round 1)
function _startActualTurn() {
  const p = G.players[G.currentPlayer];

  // Stalemate check — if this player has a pending stalemate, skip normal shop/roll
  // and go straight to stalemate resolution with buy/sell/attack options
  if (G.stalemateData && G.stalemateData.attackerIdx === G.currentPlayer) {
    G.phase = 'stalemate';
    console.log(`[SG] *** STALEMATE PHASE for player ${G.currentPlayer} (${p.name}) on tile ${G.stalemateData.tilePos} ***`);
    log(`⚔️ ${p.name} must resolve the stalemate on tile ${G.stalemateData.tilePos}`);
    broadcast();
    return;
  }

  // Wild card: Delay — skip shop phase
  if (p.wcEffects.delay) {
    p.wcEffects.delay = false;
    G.phase = 'roll';
    log(`🃏 Delay! ${p.name}'s shop phase is skipped`);
    broadcast();
    return;
  }

  G.phase = 'shop';
  log(`🛒 ${p.name}'s turn — shop open`);
  broadcast();
}

function startSetupPhase() {
  G.phase = 'setup';
  G.setupRound = 1;
  G.setupTurnIdx = 0;
  G.setupTotalTurns = 3 * G.players.length;
  G.currentPlayer = 0;
  log(`🌟 Setup phase! ${G.players.length} players · ${G.setupTotalTurns} turns total.`);
  broadcast();
}

function advanceSetupTurn() {
  G.setupTurnIdx++;
  if (G.setupTurnIdx >= G.setupTotalTurns) {
    // Setup done — start normal game
    log(`✅ Setup complete! Game begins.`);
    G.currentPlayer = 0;
    startShopPhase();
    return;
  }
  G.currentPlayer = G.setupTurnIdx % G.players.length;
  G.setupRound = Math.floor(G.setupTurnIdx / G.players.length) + 1;
  const cp = G.players[G.currentPlayer];
  // Auto-advance players who have no summons left — nothing they can do but pass
  if (cp && cp.hand.length === 0) {
    log(`⏭ ${cp.name} has no summons — auto-pass (round ${G.setupRound})`);
    advanceSetupTurn();
    return;
  }
  log(`🌟 Setup round ${G.setupRound} — ${cp ? cp.name : '?'}'s turn (turn ${G.setupTurnIdx + 1}/${G.setupTotalTurns})`);
  broadcast();
}

function advanceTurn() {
  // Guard: stale scheduleRoomAction timers can fire after endGame() — ignore them
  if (G.phase === 'game_over') return;

  // Wild card intercept — fires ONCE after turn resolves if player passed position 0
  // Skip if the current player was eliminated mid-turn (e.g. mana hit 0 in battle)
  if (G.pendingWildCard && G.wildCardDrawn === null) {
    const _wcPlayer = G.players[G.currentPlayer];
    if (_wcPlayer && !_wcPlayer.eliminated) {
      G.pendingWildCard = false;
      // Draw one card randomly from each tier pool
      const drawFrom = pool => pool[rand(0, pool.length - 1)];
      G.wildCardDrawn = {
        low:  drawFrom(WILD_CARD_POOLS.low),
        mid:  drawFrom(WILD_CARD_POOLS.mid),
        high: drawFrom(WILD_CARD_POOLS.high),
      };
      G.phase = 'resolve:wildcard_cards';
      log(`🃏 ${_wcPlayer.name} passed the Mana Well — Wild Card event!`);
      broadcast();
      return; // don't advance turn yet
    }
    // Player eliminated — discard the pending wildcard silently
    log(`🃏 Wild Card skipped — ${_wcPlayer ? _wcPlayer.name : '?'} was eliminated mid-turn`);
    G.pendingWildCard = false;
  }
  // Clear any lingering wildcard state
  G.pendingWildCard = false;
  G.wildCardDrawn = null;
  G.wildCardPending = null;

  // ── Elimination check (end of current player's turn) ──────────────────────
  checkElimination(G.currentPlayer);
  if (checkLastStanding()) return; // game ended — don't advance further

  G.turnCount++;
  if (G.turnCount >= G.roundLimit * G.players.length) {
    endGame();
    return;
  }

  // Advance to next non-eliminated player
  let nextPlayer = (G.currentPlayer + 1) % G.players.length;
  let loopGuard = 0;
  while (G.players[nextPlayer].eliminated) {
    nextPlayer = (nextPlayer + 1) % G.players.length;
    if (++loopGuard > G.players.length) {
      // All players eliminated somehow — just end the game
      endGame();
      return;
    }
  }
  G.currentPlayer = nextPlayer;

  // Only clear stalemateData when the stalemate player has actually resolved it.
  // If the incoming current player isn't the stalemate attacker, keep it alive so
  // startShopPhase can detect it when we cycle back around to them.
  if (G.stalemateData && G.stalemateData.attackerIdx === G.currentPlayer) {
    // This is the stalemate player's resolution turn — stalemateData stays until
    // startShopPhase routes them into the stalemate phase and they act on it.
  } else if (!G.stalemateData) {
    // nothing to do
  }

  // ── Round boundary callout ────────────────────────────────────────────────
  // Fire before shop phase when we're crossing into a penultimate or final round.
  // G.turnCount was just incremented; upcomingRound is the round we're entering.
  if (G.turnCount % G.players.length === 0) {
    const upcomingRound = Math.floor(G.turnCount / G.players.length) + 1;
    if (upcomingRound === G.roundLimit) {
      G.roundCallout = 'final';
    } else if (upcomingRound === G.roundLimit - 1 && G.roundLimit > 1) {
      G.roundCallout = 'penultimate';
    }
    if (G.roundCallout) {
      G.phase = 'resolve:round_callout';
      broadcast();
      return; // board sends round_callout_complete to resume
    }
  }

  startShopPhase();
}

function endGame() {
  G.phase = 'game_over';
  G.stalemateData = null; // clear any pending stalemate — game is over
  const finalTiles = p => G.board.filter(t => t.ownerId === p.idx).length;

  // Survivors sort by tiles → mana; eliminated sort by eliminatedRank descending
  // (higher eliminatedRank = survived longer = better placement among losers)
  const survivors  = G.players.filter(p => !p.eliminated)
    .sort((a, b) => {
      const ta = finalTiles(a), tb = finalTiles(b);
      if (tb !== ta) return tb - ta;
      return b.mana - a.mana;
    });
  const eliminated = G.players.filter(p => p.eliminated)
    .sort((a, b) => (b.eliminatedRank || 0) - (a.eliminatedRank || 0));
  const ranked = [...survivors, ...eliminated];

  // Last-standing win: if only 1 survivor remains, announce them as champion
  const champion = ranked[0];
  const wasLastStanding = survivors.length === 1 && eliminated.length > 0;
  if (wasLastStanding) {
    log(`🏆 Last Player Standing! ${champion.name} wins!`);
  } else {
    log(`🏆 Game over! Winner: ${champion.name}!`);
  }

  G.rankings = ranked.map(p => ({
    idx: p.idx, name: p.name, color: p.color,
    tiles: finalTiles(p),
    mana: p.mana,
    battlesWon: p.battlesWon,
    battlesLost: p.battlesLost,
    peakTiles: p.peakTiles,
    totalManaEarned: p.totalManaEarned,
    summonsLost: p.destroyedCount,
    handSize: p.hand.length,
    eliminated: p.eliminated || false,
    eliminatedRank: p.eliminatedRank || null,
    forfeited: p.forfeited || false,
    wasLastStanding,
  }));
  broadcast();
}

function resolveRoll(playerIdx) {
  const p = G.players[playerIdx];
  const oldPos = p.position;
  // v1.0.100: keep both dice so the board can show two real dice
  const d1 = rand(1, 6), d2 = rand(1, 6);
  let roll = d1 + d2;
  p.lastDice = [d1, d2];

  // Stumble effect — skip roll, forced to move exactly 3
  if (p.wcEffects.stumble) {
    p.wcEffects.stumble = false;
    roll = 3;
    p.lastDice = [1, 2];   // v1.0.100: show the forced 3 on the dice
    log(`🃏 Stumble! ${p.name} is cursed — forced to move 3 spaces`);
  }

  // Minimum floor of 3 (2d6 min is 2; bump to 3)
  if (roll < 3) roll = 3;

  p.lastDiceRoll = roll;

  // Wild Card eligibility — based on FULL roll arc crossing position 0, NOT the chosen tile
  const fullRollPos = (oldPos + roll) % 28;
  if (fullRollPos !== 0 && oldPos + roll >= 28) {
    G.pendingWildCard = true;
  }

  log(`🎲 ${p.name} rolled ${roll}`);

  // Compute 3 landing options: [roll-2, roll-1, roll] steps forward from current position
  // min roll is 3 so roll-2 ≥ 1 — always at least 1 step forward, no duplicates
  const options = [
    (oldPos + roll - 2) % 28,
    (oldPos + roll - 1) % 28,
    (oldPos + roll)     % 28,
  ];

  G.pendingLanding = { roll, options };
  G.phase = 'resolve:landing';
  broadcast();
}

// Resolve landing after player chooses their tile (also used by warp)
function resolveLandingTile(playerIdx) {
  const p = G.players[playerIdx];
  const newPos = p.position;
  const tile = G.board[newPos];

  if (tile.kind === 'start') {
    p.mana += 40;
    log(`✦ ${p.name} landed on Mana Well: +40 Mana`);
    G.phase = 'resolve:well';
    broadcast();
    scheduleRoomAction(G.roomCode, advanceTurn, 1500);
    return;
  }

  if (tile.kind === 'heal') {
    G.phase = 'resolve:heal_tile';
    broadcast();
    return;
  }

  if (tile.kind === 'temple') {
    // 3 random Specials as offers
    const shuffled = shuffle([...SPECIALS]);
    G.pendingTemple = { offers: shuffled.slice(0,3).map(m => ({ ...m, iid: ++_iid })) };
    G.phase = 'resolve:temple';
    log(`🏛 ${p.name} landed on Temple`);
    broadcast();
    return;
  }

  if (tile.kind === 'chest') {
    const reward = drawChestReward();
    G.pendingChest = { ...reward, tilePos: newPos };
    // Immediately add the free summon to hand (if room); snapshot it for display
    if (reward.kind === 'free_monster') {
      if (p.hand.length < 5) {
        const freeM = makeSummon(NORMALS[rand(0, NORMALS.length - 1)].id);
        p.hand.push(freeM);
        G.pendingChest.summon = { iid:freeM.iid, id:freeM.id, name:freeM.name, type:freeM.type,
          hp:freeM.hp, maxHp:freeM.maxHp, atk:freeM.atk, def:freeM.def,
          cost:freeM.cost, gen:freeM.gen, isSpecial:freeM.isSpecial||false, charm:freeM.charm||false };
        log(`🎁 ${p.name} got free summon: ${freeM.name}`);
        _voice(freeM.id, 'chest');
      } else {
        log(`🎁 ${p.name} drew free_monster but hand is full — reward lost`);
      }
    }
    G.phase = 'resolve:chest';
    log(`📦 ${p.name} landed on Treasure Chest — drew ${reward.rarity} ${reward.icon}`);
    broadcast();
    return;
  }

  // Elemental tile
  if (!tile.ownerId && tile.ownerId !== 0) {
    // Empty — player can claim if they have a summon
    G.phase = 'resolve:claim';
    broadcast();
  } else if (tile.ownerId === playerIdx) {
    // Own tile
    G.phase = 'resolve:own';
    broadcast();
  } else {
    // Enemy tile
    G.phase = 'resolve:battle';
    broadcast();
  }
}

// ─── ACTION HANDLERS ─────────────────────────────────────────────────────────

const handlers = {

  // ── Lobby ──────────────────────────────────────────────────────────────────

  // Board opens and claims (or creates) a room
  board_connect(ws, conn, data) {
    const code = String(data.roomCode || '').toUpperCase().trim();
    let room;
    if (code && rooms.has(code)) {
      room = rooms.get(code);
    } else {
      room = freshGame(code || undefined);
      rooms.set(room.roomCode, room);
    }
    conn.roomCode = room.roomCode;
    conn.isBoard = true;
    G = room;
    broadcast();
  },

  // Spectator connects to an existing room (read-only, no actions)
  spectate_connect(ws, conn, data) {
    const code = String(data.roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return sendError(ws, 'Room not found — check the room code');
    conn.roomCode = room.roomCode;
    conn.isSpectator = true;
    G = room;
    // Send current state directly to this spectator
    wsSend(ws, { type: 'state', game: publicState() });
  },

  join(ws, conn, data) {
    const code = String(data.roomCode || '').toUpperCase().trim();
    const name  = String(data.name  || 'Player').slice(0, 18);

    // Look up room by code; fall back to first lobby room if only one exists
    let room = rooms.get(code);
    if (!room && !code && rooms.size === 1) {
      room = [...rooms.values()][0];
    }
    if (!room) return sendError(ws, 'Room not found — ask the host for the room code');

    // If the room is not in lobby phase, check whether it's still active.
    // An abandoned room (no live WebSocket connections) is reset to a fresh lobby
    // so new players aren't permanently locked out by a stale session.
    if (room.phase !== 'lobby') {
      const hasActiveConn = [...clients.values()].some(c => c.roomCode === room.roomCode);
      if (!hasActiveConn) {
        log(`🔄 Player joining abandoned room ${room.roomCode} (phase: ${room.phase}) — reset to lobby`);
        room = freshGame(room.roomCode);
        rooms.set(room.roomCode, room);
      }
    }

    G = room;
    conn.roomCode = room.roomCode;

    // During an active game: allow name-based manual rejoin for disconnected players
    if (G.phase !== 'lobby') {
      const disc = G.players.find(p => !p.isConnected && !p.forfeited && p.name.toLowerCase() === name.toLowerCase());
      if (disc) {
        conn.playerIdx = disc.idx;
        conn.sessionKey = disc.sessionKey;
        disc.isConnected = true;
        if (G.pausedFor && G.pausedFor.idx === disc.idx) G.pausedFor = null;
        log(`🔄 ${disc.name} manually rejoined`);
        wsSend(ws, { type: 'session', sessionKey: disc.sessionKey });
        broadcast();
        return;
      }
      return sendError(ws, 'Game already in progress');
    }

    // In lobby: if this name matches a disconnected slot, reclaim it (handles lost sessionKey)
    const discLobby = G.players.find(p => !p.isConnected && p.name.toLowerCase() === name.toLowerCase());
    if (discLobby) {
      discLobby.isConnected = true;
      conn.playerIdx = discLobby.idx;
      conn.sessionKey = discLobby.sessionKey;
      log(`🔄 ${discLobby.name} reclaimed lobby slot`);
      wsSend(ws, { type: 'session', sessionKey: discLobby.sessionKey });
      broadcast();
      return;
    }

    if (G.players.length >= 6) return sendError(ws, 'Game full (max 6 players)');
    const set   = STARTER_SET_KEYS.includes(data.starterSet) ? data.starterSet : 'C';
    const color = PLAYER_COLORS[G.players.length];
    const p = addPlayer(name, color, set);
    G.players.push(p);
    conn.playerIdx = p.idx;
    conn.sessionKey = p.sessionKey;
    // Auto-adjust default round limit for large groups
    if (G.players.length >= 5 && G.roundLimit === 20) {
      G.roundLimit = 10;
      log(`⏱ Round limit auto-set to 10 (${G.players.length} players)`);
    } else if (G.players.length <= 4 && G.roundLimit === 10) {
      G.roundLimit = 20;
      log(`⏱ Round limit auto-set to 20 (${G.players.length} players)`);
    }
    log(`👤 ${name} joined with set ${set}`);
    wsSend(ws, { type: 'session', sessionKey: p.sessionKey });
    broadcast();
  },

  rejoin(ws, conn, data) {
    const key = String(data.sessionKey || '');
    // Search all rooms for this session key
    let foundRoom = null, foundPlayer = null;
    for (const [, room] of rooms) {
      const pl = room.players.find(p => p.sessionKey === key);
      if (pl) { foundRoom = room; foundPlayer = pl; break; }
    }
    if (!foundRoom || !foundPlayer) return sendError(ws, 'Session expired — please rejoin');
    if (foundPlayer.forfeited) { wsSend(ws, { type: 'left_game' }); return; } // v1.0.96: out for good
    G = foundRoom;
    conn.roomCode = foundRoom.roomCode;
    conn.playerIdx = foundPlayer.idx;
    conn.sessionKey = foundPlayer.sessionKey;
    foundPlayer.isConnected = true;
    if (G.pausedFor && G.pausedFor.idx === foundPlayer.idx) {
      G.pausedFor = null;
      log(`✅ ${foundPlayer.name} reconnected — game resumed`);
    } else {
      log(`🔄 ${foundPlayer.name} reconnected`);
    }
    broadcast();
  },

  set_round_limit(ws, conn, data) {
    if (!G || G.phase !== 'lobby') return sendError(ws, 'Not in lobby');
    const limit = Number(data.limit);
    if (![10, 20, 30].includes(limit)) return sendError(ws, 'Invalid round limit');
    G.roundLimit = limit;
    log(`⏱ Round limit set to ${limit} rounds per player`);
    broadcast();
  },

  start_game(ws, conn, data) {
    if (!G || G.phase !== 'lobby') return sendError(ws, 'Not in lobby');
    if (!conn.isBoard) return sendError(ws, 'Only the host can start the game'); // v1.0.89
    // Remove lobby slots that disconnected and never came back before game start
    const before = G.players.length;
    G.players = G.players.filter(p => p.isConnected);
    if (G.players.length < before) {
      G.players.forEach((p, i) => { p.idx = i; p.color = PLAYER_COLORS[i]; });
      // Update any lingering connections' playerIdx references
      for (const [, c] of clients) {
        if (c.roomCode === G.roomCode && c.sessionKey) {
          const pl = G.players.find(p => p.sessionKey === c.sessionKey);
          if (pl) c.playerIdx = pl.idx; else c.playerIdx = null;
        }
      }
    }
    if (G.players.length < 2) return sendError(ws, 'Need at least 2 players');
    if (data && data.roundLimit && [10,20,30].includes(Number(data.roundLimit))) {
      G.roundLimit = Number(data.roundLimit);
    }
    log(`🎮 Game started! ${G.roundLimit} rounds per player`);
    startSetupPhase();
  },

  // v1.0.96: player voluntarily leaves mid-game (permanent)
  leave_game(ws, conn, data) {
    if (!G) return;
    if (conn.playerIdx === null || conn.playerIdx === undefined) return;
    const idx = conn.playerIdx;
    if (G.phase === 'lobby' || G.phase === 'game_over') return sendError(ws, 'No game in progress');
    forfeitPlayer(idx, 'left');
    wsSend(ws, { type: 'left_game' });
  },

  // v1.0.96: host removes a disconnected player (board only, not spectators)
  remove_player(ws, conn, data) {
    if (!G) return;
    if (!conn.isBoard || conn.isSpectator) return sendError(ws, 'Only the host can remove players');
    const idx = Number(data.idx);
    const p = G.players[idx];
    if (!p || p.eliminated) return;
    if (p.isConnected !== false) return sendError(ws, 'Player is still connected');
    forfeitPlayer(idx, 'removed');
  },

  end_game(ws, conn, data) {
    if (!G) return;
    // v1.0.89: host (board) only — phones cannot reset a game in progress
    if (!conn.isBoard) return sendError(ws, 'Only the host can end the game');
    const code = G.roomCode;
    log(`🔄 Game ended by host — returning to lobby`);
    G = freshGame(code);
    rooms.set(code, G);
    broadcast();
  },

  new_game(ws, conn, data) {
    if (!G) return;
    // v1.0.89: host (board) only — player view has no new-game control
    if (!conn.isBoard) return sendError(ws, 'Only the host can start a new game');
    const code = G.roomCode;
    log(`🔄 New game — returning to lobby`);
    G = freshGame(code);
    rooms.set(code, G);
    // Update all room-member connections to the new G
    for (const [, c] of clients) {
      if (c.roomCode === code) {
        c.playerIdx = null;
        c.sessionKey = null;
      }
    }
    broadcast();
  },

  // ── Turn Summary ───────────────────────────────────────────────────────────

  dismiss_turn_summary(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:turn_summary'])) return;
    G.turnSummary = null;
    _startActualTurn();
  },

  // Board signals players that the pre-round tally animation is done — players can now show their summary
  tally_complete(ws, conn, data) {
    if (!conn.isBoard) return; // only board can signal this
    const roomCode = G ? G.roomCode : conn.roomCode;
    for (const [socket, c] of clients) {
      if (socket.destroyed) continue;
      if (c.roomCode !== roomCode) continue;
      if (c.isBoard || c.isSpectator) continue; // players only
      wsSend(socket, { type: 'tally_complete' });
    }
  },

  // Board signals that the round callout overlay animation is complete — resume to shop
  round_callout_complete(ws, conn, data) {
    if (!conn.isBoard) return; // only board can signal this
    if (!G || G.phase !== 'resolve:round_callout') return;
    const roomCode = G.roomCode;
    // Relay to all player sockets (informational — triggers re-render via next state broadcast)
    for (const [socket, c] of clients) {
      if (socket.destroyed) continue;
      if (c.roomCode !== roomCode) continue;
      if (c.isBoard || c.isSpectator) continue;
      wsSend(socket, { type: 'round_callout_complete' });
    }
    G.roundCallout = null;
    startShopPhase();
  },

  // ── Shop ───────────────────────────────────────────────────────────────────

  buy(ws, conn, data) {
    if (!guardTurn(ws, conn, ['shop'], 'Not shop phase')) return;
    const p = G.players[G.currentPlayer];
    if (p.hand.length >= 5) return sendError(ws, 'Hand full');
    const offer = G.shopOffers.find(o => o.iid === data.iid);
    if (!offer) return sendError(ws, 'Invalid offer');
    if (p.mana < offer.cost) return sendError(ws, 'Not enough Mana');
    p.mana -= offer.cost;
    const m = makeSummon(offer.id);
    p.hand.push(m);
    G.shopOffers = G.shopOffers.filter(o => o.iid !== offer.iid);
    log(`🛒 ${p.name} bought ${m.name} (−${m.cost}✦)`);
    G.phase = 'roll';
    broadcast();
  },

  sell(ws, conn, data) {
    if (!guardTurn(ws, conn, ['shop'], 'Not shop phase')) return;
    const p = G.players[G.currentPlayer];
    const idx = p.hand.findIndex(m => m.iid === data.iid);
    if (idx === -1) return sendError(ws, 'Summon not in hand');
    const m = p.hand[idx];
    const refund = Math.floor(m.cost * (m.hp / m.maxHp));
    p.hand.splice(idx, 1);
    p.mana += refund;
    log(`💰 ${p.name} sold ${m.name} for ${refund}✦`);
    G.phase = 'roll';
    broadcast();
  },

  skip_shop(ws, conn, data) {
    if (!guardTurn(ws, conn, ['shop'], 'Not shop phase')) return;
    G.phase = 'roll';
    broadcast();
  },

  // ── Stalemate ──────────────────────────────────────────────────────────────

  // Player chooses to fight — enters normal resolve:battle so they pick attacker via select_attacker/attack
  stalemate_fight(ws, conn, data) {
    if (!guardTurn(ws, conn, ['stalemate'], 'Not stalemate phase')) return;
    const p = G.players[G.currentPlayer];
    if (!p.hand || p.hand.length === 0) return sendError(ws, 'No summons in hand');
    const sd = G.stalemateData;
    // Verify the tile is still contested (defender's summon still there)
    const tile = G.board[sd.tilePos];
    if (!tile || !tile.summonInstance) {
      // Defender monster gone somehow — just clear and advance
      G.stalemateData = null;
      advanceTurn();
      return;
    }
    G.stalemateData = null;
    G.pendingAttackerSummon = null;
    G.phase = 'resolve:battle';
    log(`⚔️ ${p.name} chooses to battle again on tile ${sd.tilePos}!`);
    broadcast();
  },

  // Player retreats from stalemate — pays 5 Mana, skips rolling, goes straight to shop
  stalemate_continue(ws, conn, data) {
    if (!guardTurn(ws, conn, ['stalemate'], 'Not stalemate phase')) return;
    const p = G.players[G.currentPlayer];
    const RETREAT_COST = 8;
    const paid = Math.min(p.mana, RETREAT_COST);
    p.mana -= paid;
    if (paid > 0) _trackBattleMana(p, -paid);
    log(`🚶 ${p.name} retreats from stalemate${paid > 0 ? ` — paid ${paid}✦` : ''}`);
    checkManaElimination(G.currentPlayer);
    if (checkLastStanding()) return; // game ended
    G.stalemateData = null;
    // Jump straight to shop (passive income already collected at turn start)
    G.phase = 'shop';
    broadcast();
  },

  // Legacy aliases — kept for old clients
  stalemate_attack(ws, conn, data) { return handlers.stalemate_fight(ws, conn, data); },
  stalemate_skip(ws, conn, data)   { return handlers.stalemate_continue(ws, conn, data); },
  stalemate_move(ws, conn, data)   { return handlers.stalemate_continue(ws, conn, data); },
  stalemate_buy(ws, conn, data)    { return handlers.stalemate_continue(ws, conn, data); },
  stalemate_sell(ws, conn, data)   { return handlers.stalemate_continue(ws, conn, data); },

  // ── Setup phase ────────────────────────────────────────────────────────────

  setup_claim(ws, conn, data) {
    if (!guardTurn(ws, conn, ['setup'], 'Not setup phase')) return;
    const p = G.players[G.currentPlayer];
    const tilePos = parseInt(data.tilePos, 10);
    if (isNaN(tilePos) || tilePos < 0 || tilePos >= 28) return sendError(ws, 'Invalid tile number (0–27)');
    const tile = G.board[tilePos];
    if (!tile) return sendError(ws, 'Invalid tile');
    if (tile.kind !== 'element') return sendError(ws, 'Can only claim elemental tiles during setup');
    if (tile.ownerId !== null && tile.ownerId !== undefined) return sendError(ws, 'Tile already claimed');
    const m = p.hand.find(h => h.iid === data.iid);
    if (!m) return sendError(ws, 'Summon not in hand');
    // Free claim — no mana cost
    p.hand.splice(p.hand.indexOf(m), 1);
    tile.ownerId = G.currentPlayer;
    tile.summonId = m.iid;
    tile.summonInstance = m;
    tile.neverOwned = false; // Phase 1: mark tile as ever-claimed
    _updatePeakTiles(G.currentPlayer);
    log(`🌟 ${p.name} claimed tile ${tilePos} (${tile.element}) with ${m.name} [Setup]`);
    // Per-claim ability triggers (setup phase)
    // Feral Striker: Territorial is now dynamic (tile count) — no per-claim stack
    // Stoneback: Granite Hide is now dynamic (tile count) — no per-claim stack
    // Solar Knight — Radiant Strike: on claim, tile converts to Light element
    if (m.id === 'solar_knight') {
      _convertTile(tile, 'Light', 'Radiant Strike');
      log(`☀️ Radiant Strike: Solar Knight converts tile ${tilePos} to Light element (setup)!`);
    }
    advanceSetupTurn();
  },

  setup_pass(ws, conn, data) {
    if (!guardTurn(ws, conn, ['setup'], 'Not setup phase')) return;
    log(`⏭ ${G.players[G.currentPlayer].name} passed setup turn`);
    advanceSetupTurn();
  },

  // ── Roll ───────────────────────────────────────────────────────────────────

  roll(ws, conn, data) {
    if (!guardTurn(ws, conn, ['roll'], 'Not roll phase')) return;
    resolveRoll(G.currentPlayer);
  },

  // ── Landing tile choice ────────────────────────────────────────────────────

  choose_landing(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:landing'], 'Not landing phase')) return;
    const tilePos = parseInt(data.tilePos);
    if (!Number.isInteger(tilePos) || !G.pendingLanding || !G.pendingLanding.options.includes(tilePos)) {
      return sendError(ws, 'Invalid landing choice');
    }
    const p = G.players[G.currentPlayer];
    p.position = tilePos;
    G.pendingLanding = null;
    // Track well landing for next turn's summary
    p.lastTurnLandedOnWell = (tilePos === 0);
    // If player lands on tile 0 (Mana Well), suppress the Wild Card — Mana Well covers the crossing
    if (tilePos === 0) G.pendingWildCard = false;
    log(`🎯 ${p.name} chooses tile ${tilePos}`);
    resolveLandingTile(G.currentPlayer);
  },

  // ── Claim empty tile ───────────────────────────────────────────────────────

  claim(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:claim'])) return;
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    const m = p.hand.find(h => h.iid === data.iid);
    if (!m) return sendError(ws, 'Summon not in hand');
    if (!canUseSpecial(G.currentPlayer, m)) return sendError(ws, 'Special condition not met');
    if (p.mana < m.cost) return sendError(ws, 'Not enough Mana');
    p.mana -= m.cost;
    const mIdx = p.hand.indexOf(m);
    p.hand.splice(mIdx, 1);
    tile.ownerId = G.currentPlayer;
    tile.summonId = m.iid;
    tile.summonInstance = m;
    tile.neverOwned = false; // Phase 1: mark tile as ever-claimed
    log(`🚩 ${p.name} claimed tile ${p.position} with ${m.name}`);
    _voice(m.id, 'claim');

    // ── Per-claim ability triggers ──────────────────────────────────────────
    // Feral Striker: Territorial is now dynamic (tile count) — no per-claim stack
    // Stoneback: Granite Hide is now dynamic (tile count) — no per-claim stack
    // Grave Specter: Necrotic Claim — tile converts to Undead on BATTLE WIN only (not free claim)
    // Solar Knight — Radiant Strike: on claim, tile converts to Light element
    if (m.id === 'solar_knight') {
      _convertTile(tile, 'Light', 'Radiant Strike');
      log(`☀️ Radiant Strike: Solar Knight converts tile ${p.position} to Light element!`);
    }

    advanceTurn();
  },

  skip_claim(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:claim'])) return;
    advanceTurn();
  },

  // ── Battle ─────────────────────────────────────────────────────────────────

  attack(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:battle'])) return;
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    const defOwner = G.players[tile.ownerId];
    const defM = tile.summonInstance;
    if (!defM) return sendError(ws, 'No defender on tile');
    const attM = p.hand.find(m => m.iid === data.iid);
    if (!attM) return sendError(ws, 'Summon not in hand');
    // Note: Ascendants can always be used in battle — condition only gates tile claiming

    // v1.0.94: start recording battle effects
    _fx = []; _fxAttM = attM; _fxDefM = defM;

    // Wild card effects before battle
    if (p.wcEffects.ambush) { p.wcEffects.ambush = false; attM._ambush = true; }
    if (p.wcEffects.fortify) { p.wcEffects.fortify = false; attM._fortify = true; }
    const defOwnerP = G.players[tile.ownerId];
    const rattled = !!(defOwnerP && defOwnerP.wcEffects && defOwnerP.wcEffects.rattle);
    if (rattled) { defOwnerP.wcEffects.rattle = false; }

    // ── Aura buffs via getEffectiveStats ──────────────────────────────────────
    // Attacker: apply aura modifiers (Sunfire Herald +ATK, Vine Stalker aura, etc.)
    const attTile = G.board.find(t => t.ownerId === p.idx && t.summonInstance && t.summonInstance.iid === attM.iid);
    const attTilePos = attTile ? attTile.pos : -1;
    const attEffective = getEffectiveStats(attM, attTilePos, p.idx);
    const origAttAtk = attM.atk;
    const origAttDef = attM.def;
    attM.atk = attEffective.atk;
    attM.def = attEffective.def;
    if (attEffective.atk !== origAttAtk) { log(`✨ Aura: ${attM.name} ATK ${origAttAtk} → ${attEffective.atk}`); fx('att', 'Auras', `ATK ${origAttAtk} → ${attEffective.atk}`, `${attEffective.atk > origAttAtk ? '+' : '−'}${Math.abs(attEffective.atk - origAttAtk)} ATK`, attEffective.atk > origAttAtk ? 'good' : 'bad'); }
    if (attEffective.def !== origAttDef) { log(`✨ Aura: ${attM.name} DEF ${origAttDef} → ${attEffective.def}`); fx('att', 'Auras', `DEF ${origAttDef} → ${attEffective.def}`, `${attEffective.def > origAttDef ? '+' : '−'}${Math.abs(attEffective.def - origAttDef)} DEF`, attEffective.def > origAttDef ? 'good' : 'bad'); }

    // Defender: apply aura modifiers (Dawnguard +DEF, Umbral Stalker −DEF, etc.)
    const defTilePos = tile.pos;
    const defEffective = getEffectiveStats(defM, defTilePos, tile.ownerId);
    const origDefAtk = defM.atk;
    const origDefDef = defM.def;
    defM.atk = defEffective.atk;
    defM.def = defEffective.def;
    if (defEffective.atk !== origDefAtk) { log(`✨ Aura: ${defM.name} ATK ${origDefAtk} → ${defEffective.atk}`); fx('def', 'Auras', `ATK ${origDefAtk} → ${defEffective.atk}`, `${defEffective.atk > origDefAtk ? '+' : '−'}${Math.abs(defEffective.atk - origDefAtk)} ATK`, defEffective.atk > origDefAtk ? 'good' : 'bad'); }
    if (defEffective.def !== origDefDef) { log(`✨ Aura: ${defM.name} DEF ${origDefDef} → ${defEffective.def}`); fx('def', 'Auras', `DEF ${origDefDef} → ${defEffective.def}`, `${defEffective.def > origDefDef ? '+' : '−'}${Math.abs(defEffective.def - origDefDef)} DEF`, defEffective.def > origDefDef ? 'good' : 'bad'); }

    // Weapon Smith aura — +5 ATK to attacker per copy IN HAND of attacker (stacks, per xlsx)
    const weaponSmithCount = p.hand.filter(m => m.id === 'weapon_smith').length;
    if (weaponSmithCount > 0) {
      attM.atk += weaponSmithCount * 5;
      log(`⚒️ Weapon Smith ×${weaponSmithCount}: ${attM.name} ATK → ${attM.atk}`);
      fx('att', 'Weapon Smith', `${weaponSmithCount} in hand: +${weaponSmithCount * 5} ATK`, `+${weaponSmithCount * 5} ATK`, 'good');
    }

    // Forge aura — +5 DEF to defender per copy stationed by defending player (stacks)
    const forgeCount = G.board.filter(t => t.ownerId === tile.ownerId && t.summonInstance && t.summonInstance.id === 'forge').length;
    if (forgeCount > 0) {
      defM.def += forgeCount * 5;
      log(`🔩 Forge ×${forgeCount}: ${defM.name} DEF → ${defM.def}`);
      fx('def', 'Forge', `${forgeCount} stationed: +${forgeCount * 5} DEF`, `+${forgeCount * 5} DEF`, 'good');
    }

    const { atkDmg, defDmg, outcome } = resolveBattle(attM, defM, tile, rattled);

    // Restore temporarily boosted stats after battle
    attM.atk = origAttAtk;
    attM.def = origAttDef;
    defM.atk = origDefAtk;
    defM.def = origDefDef;

    log(`⚔️ ${p.name}(${attM.name}) attacks ${defOwner.name}(${defM.name}) on tile ${p.position}`);
    log(`   ATK dealt ${atkDmg}, DEF struck back ${defDmg} — ${outcome}`);

    // snapshot both monsters before _applyBattleOutcome mutates them
    // mana deltas: attacker_wins(+4/−4), defender_wins(−8/+4), mutual(−8/+4), stalemate(−4/+4)
    const _manaDeltaMap = { attacker_wins:[+4,-4], defender_wins:[-8,+4], mutual:[-8,+4], stalemate:[-4,+4] };
    const [_attDelta, _defDelta] = _manaDeltaMap[outcome] || [0,0];
    G.lastBattle = {
      attackerIdx: G.currentPlayer,
      defOwnerIdx: tile.ownerId,
      attM: { name:attM.name, type:attM.type, atk:attM.atk, def:attM.def, id:attM.id, isSpecial:attM.isSpecial||false, hp:attM.hp, maxHp:attM.maxHp, cost:attM.cost, gen:attM.gen },
      defM: { name:defM.name, type:defM.type, atk:defM.atk, def:defM.def, id:defM.id, isSpecial:defM.isSpecial||false, hp:defM.hp, maxHp:defM.maxHp, cost:defM.cost, gen:defM.gen },
      atkDmg, defDmg, outcome,
      attManaDelta: _attDelta,
      defManaDelta: _defDelta,
    };
    _applyBattleOutcome(outcome, p, attM, defOwner, defM, tile, p.position);
    G.lastBattle.effects = _fx || [];
    _fx = null; _fxAttM = null; _fxDefM = null;
    G.pendingAttackerSummon = null;
    // Track stalemate — resolved on this player's next turn
    if (outcome === 'stalemate') {
      G.stalemateData = { attackerIdx: G.currentPlayer, tilePos: p.position };
    }
    G.phase = 'resolve:battle_result';
    broadcast();
    // v1.0.94: hold the result a little longer so the board can show effect callouts
    const _nFx = Math.min(8, G.lastBattle.effects.length);
    scheduleRoomAction(G.roomCode, advanceTurn, _nFx ? 5500 + _nFx * 600 : 3500);
  },

  // Preview which attacker the player is hovering — broadcasts to board in real-time
  preview_attacker(ws, conn, data) {
    if (G.phase !== 'resolve:battle') return;
    if (conn.playerIdx !== G.currentPlayer) return;
    const p = G.players[G.currentPlayer];
    if (data.iid == null) {
      G.pendingAttackerSummon = null;
    } else {
      const m = p.hand.find(m => m.iid === data.iid);
      if (m) G.pendingAttackerSummon = { iid:m.iid, id:m.id, name:m.name, type:m.type,
        hp:m.hp, maxHp:m.maxHp, atk:m.atk, def:m.def, cost:m.cost, gen:m.gen,
        isSpecial:m.isSpecial||false, charm:m.charm||false };
    }
    broadcast();
  },

  retreat(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:battle'])) return;
    const p = G.players[G.currentPlayer];
    const penalty = Math.min(p.mana, MANA_PENALTY);
    p.mana -= penalty;
    if (penalty > 0) _trackBattleMana(p, -penalty);
    log(`🏃 ${p.name} retreated — paid ${penalty}✦ penalty`);
    checkManaElimination(G.currentPlayer);
    G.pendingAttackerSummon = null;
    advanceTurn();
  },

  // ── Own tile ───────────────────────────────────────────────────────────────

  swap(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:own'])) return;
    const p = G.players[G.currentPlayer];
    // Hand-full check removed: swap is net-zero (stationed comes back to hand),
    // so a full hand of 5 is always valid for a swap.
    const tile = G.board[p.position];
    const oldM = tile.summonInstance;
    const newM = p.hand.find(m => m.iid === data.newSummonIid);
    if (!newM) return sendError(ws, 'Summon not in hand');
    if (!canUseSpecial(G.currentPlayer, newM)) return sendError(ws, 'Special condition not met');
    // Cost to deploy new summon
    if (p.mana < newM.cost) return sendError(ws, 'Not enough Mana');
    p.mana -= newM.cost;
    const idx = p.hand.indexOf(newM);
    p.hand.splice(idx, 1);
    if (oldM) p.hand.push(oldM);
    tile.summonInstance = newM;
    tile.summonId = newM.iid;
    log(`🔄 ${p.name} swapped ${oldM ? oldM.name : 'empty'} → ${newM.name} on tile ${p.position}`);
    _voice(newM.id, 'swap');
    advanceTurn();
  },

  // Flat heal: 5✦ → +20 HP (capped at maxHp)
  heal_stationed(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:own'])) return;
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    const m = tile.summonInstance;
    if (!m) return sendError(ws, 'No summon to heal');
    if (m.hp >= m.maxHp) return sendError(ws, 'Already at full HP');
    if (p.mana < 5) return sendError(ws, 'Need 5✦ to heal');
    const healed = Math.min(20, m.maxHp - m.hp);
    p.mana -= 5;
    m.hp += healed;
    p.healCount++;
    log(`💚 ${p.name} healed ${m.name} for ${healed} HP (−5✦)`);
    checkManaElimination(G.currentPlayer);
    advanceTurn();
  },

  // Sacrifice stationed summon for +15✦ — tile goes neutral
  sacrifice_tile(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:own'])) return;
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    if (!tile.summonInstance) return sendError(ws, 'No summon to sacrifice');
    const sacrificed = tile.summonInstance;
    tile.ownerId = null;
    tile.summonId = null;
    tile.summonInstance = null;
    p.mana += 15;
    p.destroyedCount++;
    log(`💀 ${p.name} sacrificed ${sacrificed.name} for +15✦ — tile ${p.position} goes neutral`);
    advanceTurn();
  },

  change_element(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:own'])) return;
    const p = G.players[G.currentPlayer];
    if (p.mana < CHANGE_ELEMENT_COST) return sendError(ws, `Need ${CHANGE_ELEMENT_COST}✦`);
    if (!TYPES.includes(data.element)) return sendError(ws, 'Invalid element');
    const tile = G.board[p.position];
    const old = tile.element;
    tile.element = data.element;
    tile.label = data.element;
    p.mana -= CHANGE_ELEMENT_COST;
    p.elementChangeCount++;
    if (data.element === 'Arcane') p.arcaneChangeCount++;
    log(`🌀 ${p.name} changed tile ${p.position}: ${old} → ${data.element} (−${CHANGE_ELEMENT_COST}✦)`);
    advanceTurn();
  },

  skip_own(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:own'])) return;
    advanceTurn();
  },

  // ── Temple ─────────────────────────────────────────────────────────────────

  temple_trade(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:temple'])) return;
    const p = G.players[G.currentPlayer];
    const special = G.pendingTemple.offers.find(o => o.iid === data.specialIid);
    if (!special) return sendError(ws, 'Invalid special offer');
    const sacrifice = p.hand.find(m => m.iid === data.sacrificeIid);
    if (!sacrifice) return sendError(ws, 'Sacrifice not in hand');
    if (sacrifice.type !== special.type) return sendError(ws, 'Type mismatch');
    if (p.mana < special.cost) return sendError(ws, 'Not enough Mana');
    p.mana -= special.cost;
    const sIdx = p.hand.indexOf(sacrifice);
    p.hand.splice(sIdx, 1);
    const gained = makeSummon(special.id);
    p.hand.push(gained);
    log(`🏛 ${p.name} traded ${sacrifice.name} for ${gained.name}!`);
    _voice(gained.id, 'temple');
    G.pendingTemple = null;
    advanceTurn();
  },

  temple_leave(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:temple'])) return;
    G.pendingTemple = null;
    log(`${G.players[G.currentPlayer].name} left the Temple`);
    advanceTurn();
  },

  // ── Heal tile ──────────────────────────────────────────────────────────────

  heal_tile_apply(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:heal_tile'])) return;
    const p = G.players[G.currentPlayer];
    const SHRINE_COST = 10;
    const SHRINE_HEAL = 10;
    if (p.mana < SHRINE_COST) return sendError(ws, 'Not enough Mana (need 10 ✦)');
    p.mana -= SHRINE_COST;
    let healed = 0;
    // Heal all stationed monsters on owned tiles
    G.board.forEach(tile => {
      if (tile.ownerId === G.currentPlayer && tile.summonInstance) {
        const gain = Math.min(SHRINE_HEAL, tile.summonInstance.maxHp - tile.summonInstance.hp);
        tile.summonInstance.hp += gain;
        if (gain > 0) healed++;
      }
    });
    // Heal all hand monsters
    p.hand.forEach(m => {
      const gain = Math.min(SHRINE_HEAL, m.maxHp - m.hp);
      m.hp += gain;
      if (gain > 0) healed++;
    });
    p.healCount++;
    log(`💚 ${p.name} used Healing Shrine — all monsters +${SHRINE_HEAL} HP (${healed} healed, −${SHRINE_COST}✦)`);
    G.phase = 'resolve:heal_tile';
    broadcast();
    scheduleRoomAction(G.roomCode, advanceTurn, 800);
  },

  heal_tile_skip(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:heal_tile'])) return;
    advanceTurn();
  },

  // ── Chest ──────────────────────────────────────────────────────────────────

  chest_apply_potion(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:chest'])) return;
    if (!G.pendingChest || G.pendingChest.kind !== 'potion') return sendError(ws, 'No potion');
    const p = G.players[G.currentPlayer];
    // Find by iid in hand OR stationed tiles (supports hand + stationed monsters)
    let m = p.hand.find(h => h.iid === data.iid);
    if (!m) {
      const tile = G.board.find(t => t.ownerId === G.currentPlayer && t.summonInstance && t.summonInstance.iid === data.iid);
      if (tile) m = tile.summonInstance;
    }
    if (!m) return sendError(ws, 'Summon not found');
    const missing = m.maxHp - m.hp;
    if (missing <= 0) return sendError(ws, 'Summon already at full HP');
    const chest = G.pendingChest;
    let healed = 0;
    if (chest.tier === 'Minor')       healed = Math.min(missing, 15);
    else if (chest.tier === 'Major')  healed = Math.floor(missing * 0.5);
    else                              healed = missing;
    m.hp += healed;
    p.healCount++;
    log(`🧪 ${chest.tier} Potion healed ${m.name} for ${healed} HP`);
    G.pendingChest = null;
    advanceTurn();
  },

  chest_assign_charm(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:chest'])) return;
    if (!G.pendingChest || G.pendingChest.kind !== 'charm') return sendError(ws, 'No charm');
    const p = G.players[G.currentPlayer];
    // data.iid = hand monster, data.tilePos = stationed monster's tile
    let m = p.hand.find(h => h.iid === data.iid);
    if (!m && data.tilePos !== undefined) {
      const tile = G.board[data.tilePos];
      if (tile && tile.ownerId === G.currentPlayer) m = tile.summonInstance;
    }
    if (!m) return sendError(ws, 'No summon selected');
    if (m.charm) return sendError(ws, 'Already has a charm');
    m.charm = true;
    log(`⚡ Battle Charm assigned to ${m.name}`);
    G.pendingChest = null;
    advanceTurn();
  },

  chest_warp(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:chest'])) return;
    if (!G.pendingChest || G.pendingChest.kind !== 'warp') return sendError(ws, 'No warp');
    G.pendingChest = null;
    // Warp to random non-special tile
    const eligible = G.board.filter(t => t.kind === 'element');
    const dest = eligible[rand(0, eligible.length - 1)];
    G.players[G.currentPlayer].position = dest.pos;
    log(`🌀 ${G.players[G.currentPlayer].name} warped to tile ${dest.pos} (${dest.element})`);
    // Resolve the landing
    resolveRoll_fromPos(G.currentPlayer, dest.pos);
  },

  chest_discard(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:chest'])) return;
    G.pendingChest = null;
    log(`${G.players[G.currentPlayer].name} skipped chest reward`);
    advanceTurn();
  },

  chest_skip(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:chest'])) return;
    const p = G.players[G.currentPlayer];
    const chest = G.pendingChest;
    if (chest && chest.kind === 'potion') {
      const POTION_MANA = { Minor: 3, Major: 6, Full: 10 };
      const bonus = POTION_MANA[chest.tier] || 3;
      p.mana += bonus;
      log(`🧪 ${p.name} converted ${chest.tier} Potion for ${bonus}✦`);
    }
    G.pendingChest = null;
    advanceTurn();
  },

  // ── Wild Card ──────────────────────────────────────────────────────────────

  wildcard_skip(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_cards'])) return;
    G.wildCardDrawn = null;
    log(`🃏 ${G.players[G.currentPlayer].name} skipped the Wild Card`);
    advanceTurn();
  },

  wildcard_select(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_cards'])) return;
    const p = G.players[G.currentPlayer];
    const { tier, cardId } = data;
    const drawn = G.wildCardDrawn;
    if (!drawn) return sendError(ws, 'No wild cards drawn');
    const card = drawn[tier];
    if (!card || card.id !== cardId) return sendError(ws, 'Invalid card selection');
    if (p.mana < card.cost) return sendError(ws, 'Not enough Mana');

    // Pre-flight: validate targetable state BEFORE deducting Mana
    if (card.id === 'poach') {
      const hasTarget = G.players.some((pl, i) => i !== G.currentPlayer && !pl.eliminated && pl.hand.length > 0);
      if (!hasTarget) return sendError(ws, 'Poach requires at least one opponent with a summon in hand');
    }
    if (card.id === 'plague') {
      const hasTarget = G.players.some((pl, i) => i !== G.currentPlayer && !pl.eliminated &&
        G.board.some(t => t.ownerId === i && t.summonInstance));
      if (!hasTarget) return sendError(ws, 'Plague requires at least one opponent with a stationed summon');
    }
    if (card.id === 'mend') {
      const healable = G.board.some(t => t.ownerId === G.currentPlayer && t.summonInstance);
      if (!healable) return sendError(ws, 'Mend requires at least one stationed summon to heal');
    }

    p.mana -= card.cost;
    G.wildCardDrawn = null;
    log(`🃏 ${p.name} played ${card.name} (−${card.cost}✦)`);

    if (card.target === 'self') {
      if (card.id === 'ambush')   p.wcEffects.ambush   = true;
      if (card.id === 'fortify')  p.wcEffects.fortify  = true;
      if (card.id === 'windfall') p.wcEffects.windfall = true;
      log(`🃏 ${card.name} — effect active for ${p.name}`);
      _wcPlayed(card.id);
      advanceTurn();
    } else if (card.target === 'own_station') {
      G.wildCardPending = { cardId: card.id };
      G.phase = 'resolve:wildcard_target';
      broadcast();
    } else if (card.target === 'player') {
      G.wildCardPending = { cardId: card.id };
      G.phase = 'resolve:wildcard_target';
      broadcast();
    } else if (card.target === 'coup') {
      if (p.hand.length === 0) return sendError(ws, 'Coup requires at least one summon in hand to sacrifice');
      // Pre-flight: need at least one occupied enemy tile
      const hasOccupiedEnemyTile = G.board.some(t =>
        t.ownerId !== null && t.ownerId !== G.currentPlayer &&
        !G.players[t.ownerId]?.eliminated && t.summonInstance
      );
      if (!hasOccupiedEnemyTile) return sendError(ws, 'Coup requires at least one occupied enemy tile to target');
      G.wildCardPending = { cardId: 'coup', step: 'tile' };
      G.phase = 'resolve:wildcard_coup_tile';
      broadcast();
    } else if (card.target === 'shatter') {
      // Pre-flight: need at least one stationed summon anywhere on the board
      const totalStationed = G.board.filter(t => t.summonInstance).length;
      if (totalStationed === 0) return sendError(ws, 'Shatter requires at least one stationed summon on the board');
      const minPicks = Math.min(2, totalStationed);
      G.wildCardPending = { cardId: 'shatter', step: 'pick', picks: [], minPicks };
      G.phase = 'resolve:wildcard_shatter';
      broadcast();
    }
  },

  wildcard_target(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_target'])) return;
    const p = G.players[G.currentPlayer];
    const pending = G.wildCardPending;
    if (!pending) return sendError(ws, 'No pending wild card');

    if (pending.cardId === 'mend') {
      const tile = G.board[data.tilePos];
      if (!tile || tile.ownerId !== G.currentPlayer || !tile.summonInstance) return sendError(ws, 'Invalid tile');
      const m = tile.summonInstance;
      const healed = Math.min(20, m.maxHp - m.hp);
      m.hp += healed;
      log(`🃏 Mend healed ${m.name} for ${healed} HP`);
      _wcPlayed('mend', { tilePos: data.tilePos });
      G.wildCardPending = null;
      advanceTurn();
    } else {
      const targetIdx = data.targetIdx;
      if (targetIdx === undefined || targetIdx === G.currentPlayer) return sendError(ws, 'Invalid target');
      const target = G.players[targetIdx];
      if (!target) return sendError(ws, 'Target not found');

      // Helper: set a notification on the targeted player
      function notifyTarget(cardId, cardName, desc, tier) {
        target.notification = {
          cardId, cardName, cardDesc: desc,
          castByName: p.name, castByColor: p.color, tier
        };
      }

      if (pending.cardId === 'stumble') {
        target.wcEffects.stumble = true;
        notifyTarget('stumble', 'Stumble', 'You\'re cursed — your dice roll is skipped next turn and you\'ll move exactly 3 spaces.', 'low');
        log(`🃏 Stumble — ${target.name} is cursed, moves 3 next turn`);
      }
      if (pending.cardId === 'delay') {
        target.wcEffects.delay = true;
        notifyTarget('delay', 'Delay', 'Your shop phase is skipped next turn.', 'low');
        log(`🃏 Delay — ${target.name}'s next shop is skipped`);
      }
      if (pending.cardId === 'jinx') {
        target.wcEffects.jinx = true;
        notifyTarget('jinx', 'Jinx', 'Your passive Mana income next turn is halved.', 'low');
        log(`🃏 Jinx — ${target.name}'s next income is halved`);
      }
      if (pending.cardId === 'rattle') {
        target.wcEffects.rattle = true;
        notifyTarget('rattle', 'Rattle', 'Your next battle summon fights at half ATK.', 'mid');
        log(`🃏 Rattle — ${target.name}'s next battle at half ATK`);
      }
      if (pending.cardId === 'plague') {
        let hit = 0;
        for (const t of G.board) {
          if (t.ownerId === targetIdx && t.summonInstance) {
            t.summonInstance.hp = Math.max(1, t.summonInstance.hp - 20);   // v1.0.103: was 15
            hit++;
          }
        }
        if (hit > 0) notifyTarget('plague', 'Plague', `All ${hit} of your stationed summon${hit!==1?'s':''} each lost 20 HP.`, 'high');
        log(`🃏 Plague — ${target.name}'s ${hit} summon${hit!==1?'s':''} each lose 20 HP`);
      }
      if (pending.cardId === 'poach') {
        if (target.hand.length === 0) {
          // Target has no hand cards — refund the mana cost and block the action
          const poachCard = (WILD_CARD_POOLS.mid || []).find(c => c.id === 'poach');
          if (poachCard) p.mana += poachCard.cost;
          G.wildCardPending = null;
          log(`🃏 Poach blocked — ${target.name} has no summons in hand (mana refunded)`);
          broadcast();
          return sendError(ws, `${target.name} has no summons in hand — Poach refunded`);
        }
        if (p.hand.length >= 5) {
          log(`🃏 Poach failed — ${p.name}'s hand is full`);
          _wcPlayed('poach', { targetIdx, failed: true });
          G.wildCardPending = null;
          advanceTurn();
          return;
        }
        const idx = rand(0, target.hand.length - 1);
        const stolen = target.hand.splice(idx, 1)[0];
        p.hand.push(stolen);
        notifyTarget('poach', 'Poach', `${p.name} stole ${stolen.name} from your hand!`, 'mid');
        log(`🃏 Poach — ${p.name} stole ${stolen.name} from ${target.name}`);
      }
      _wcPlayed(pending.cardId, { targetIdx });
      G.wildCardPending = null;
      advanceTurn();
    }
  },

  wildcard_coup_cancel(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_coup_tile', 'resolve:wildcard_coup_summon'])) return;
    const p = G.players[G.currentPlayer];
    // 50% refund — escape hatch when game forces a dead-end (no valid target tiles)
    const coupCard = (WILD_CARD_POOLS.high || []).find(c => c.id === 'coup');
    const refund = coupCard ? Math.floor(coupCard.cost / 2) : 30;
    p.mana += refund;
    G.wildCardPending = null;
    log(`🃏 Coup cancelled — ${p.name} received ${refund}✦ refund (50%)`);
    advanceTurn();
  },

  wildcard_coup_tile(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_coup_tile'])) return;
    const p = G.players[G.currentPlayer];
    const tilePos = parseInt(data.tilePos, 10);
    if (isNaN(tilePos)) return sendError(ws, 'Invalid tile');
    const tile = G.board[tilePos];
    if (!tile || tile.ownerId === null || tile.ownerId === G.currentPlayer) return sendError(ws, 'Must pick an enemy-owned tile');
    if (!tile.summonInstance) return sendError(ws, 'Coup requires an occupied tile — pick a tile with a stationed summon');
    G.wildCardPending.tilePos = tilePos;
    G.wildCardPending.step = 'summon';
    G.phase = 'resolve:wildcard_coup_summon';
    broadcast();
  },

  wildcard_coup_summon(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_coup_summon'])) return;
    const p = G.players[G.currentPlayer];
    const sacrifice = p.hand.find(h => h.iid === data.iid);
    if (!sacrifice) return sendError(ws, 'Summon not in hand');
    const tilePos = G.wildCardPending.tilePos;
    const tile = G.board[tilePos];
    if (!tile || !tile.summonInstance) return sendError(ws, 'Target tile is no longer occupied');
    const prevOwner = G.players[tile.ownerId];
    const stolen = tile.summonInstance;

    // Sacrifice the chosen hand monster (destroyed permanently)
    const sacrificeIdx = p.hand.indexOf(sacrifice);
    p.hand.splice(sacrificeIdx, 1);

    // Transfer tile ownership — stationed monster stays on tile, now fights for new owner
    tile.ownerId = G.currentPlayer;
    tile.neverOwned = false; // Phase 1: mark tile as ever-claimed
    // summonInstance and summonId remain unchanged — the monster defects in place

    // Notify previous owner
    prevOwner.notification = {
      cardId: 'coup', cardName: 'Coup',
      cardDesc: `${p.name} executed a Coup! They sacrificed ${sacrifice.name} to seize your tile — ${stolen.name} now fights for them.`,
      castByName: p.name, castByColor: p.color, tier: 'high'
    };

    log(`🃏 Coup — ${p.name} sacrificed ${sacrifice.name} to seize tile ${tilePos} and steal ${stolen.name} from ${prevOwner.name}`);
    _updatePeakTiles(G.currentPlayer);
    _wcPlayed('coup', { targetIdx: prevOwner ? prevOwner.idx : null, tilePos });
    G.wildCardPending = null;
    advanceTurn();
  },

  wildcard_shatter(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_shatter'])) return;
    const p = G.players[G.currentPlayer];
    const picks = G.wildCardPending.picks || [];
    const tilePos = parseInt(data.tilePos, 10);
    if (isNaN(tilePos)) return sendError(ws, 'Invalid tile');
    const tile = G.board[tilePos];
    if (!tile || !tile.summonInstance) return sendError(ws, 'No summon on that tile');
    if (picks.includes(tilePos)) return sendError(ws, 'Already selected');
    picks.push(tilePos);
    G.wildCardPending.picks = picks;
    const minPicks = G.wildCardPending.minPicks || 2;
    if (picks.length < minPicks) {
      broadcast();
      return;
    }
    for (const pos of picks) {
      const t = G.board[pos];
      if (t.summonInstance) {
        const owner = G.players[t.ownerId];
        log(`🃏 Shatter — ${t.summonInstance.name} destroyed on tile ${pos}`);
        if (owner) {
          owner.destroyedCount++;
          owner.notification = {
            cardId: 'shatter', cardName: 'Shatter',
            cardDesc: `${p.name} shattered your ${t.summonInstance.name} on tile ${pos}!`,
            castByName: p.name, castByColor: p.color, tier: 'high'
          };
        }
        t.summonInstance = null;
        t.summonId = null;
        t.ownerId = null;
      }
    }
    _wcPlayed('shatter', { picks: picks.slice() });
    G.wildCardPending = null;
    advanceTurn();
  },

  dismiss_notification(ws, conn, data) {
    if (!G || conn.playerIdx === null) return;
    const p = G.players[conn.playerIdx];
    if (!p) return;
    p.notification = null;
    broadcast();
  },

};

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

function _updatePeakTiles(playerIdx) {
  const p = G.players[playerIdx];
  if (!p) return;
  const cur = G.board.filter(t => t.ownerId === playerIdx).length;
  if (cur > p.peakTiles) p.peakTiles = cur;
}

function _trackBattleMana(player, delta) {
  if (!player) return;
  if (delta > 0) player.lastTurnBattleManaGain += delta;
  else if (delta < 0) player.lastTurnBattleManaLoss += Math.abs(delta);
}

// ─── v1.0.93: battle-outcome helpers ─────────────────────────────────────────
function _fmtMana(d) { return d >= 0 ? `+${d}` : `−${-d}`; }

// Standard battle mana swing. Negative deltas clamp at 0; tracking records nominal delta.
function _battleMana(attPlayer, attDelta, defPlayer, defDelta) {
  for (const [p, d] of [[attPlayer, attDelta], [defPlayer, defDelta]]) {
    p.mana = d < 0 ? Math.max(0, p.mana + d) : p.mana + d;
    _trackBattleMana(p, d);
  }
  log(`✦ Battle mana: ${attPlayer.name} ${_fmtMana(attDelta)}✦  ${defPlayer.name} ${_fmtMana(defDelta)}✦`);
}

// Steal up to `amt` Mana (Nightshard Soul Siphon, Succubus Mana Drain)
function _stealMana(thief, victim, amt) {
  const stolen = Math.min(victim.mana, amt);
  victim.mana -= stolen;
  thief.mana += stolen;
  _trackBattleMana(thief, +stolen);
  _trackBattleMana(victim, -stolen);
  return stolen;
}

function _clearTile(tile) {
  tile.ownerId = null; tile.summonId = null; tile.summonInstance = null;
}

// Per-monster stacks that fire whenever a monster WINS a battle (attacking or defending)
function _onBattleWin(m, ctx) {
  const ad = m.abilityData;
  const side = ctx === 'attack' ? 'att' : 'def';
  if (m.id === 'dawn_striker') {                       // Soulmend
    const healed = Math.min(8, m.maxHp - m.hp);
    m.hp = Math.min(m.maxHp, m.hp + 8);
    log(`🌅 Soulmend: Dawn Striker heals ${healed} HP on ${ctx} win (now ${m.hp}/${m.maxHp})`);
    fx(side, 'Soulmend', `Healed ${healed} HP after winning`, `+${healed} HP`, 'good');
  }
  if (m.id === 'void_reaper' && ad) {                  // Void Hunger
    ad.voidHungerBonus = (ad.voidHungerBonus || 0) + 2;
    log(`👁️ Void Hunger: Void Reaper ATK stack +2 on ${ctx} win (total bonus: +${ad.voidHungerBonus})`);
    fx(side, 'Void Hunger', `+2 ATK permanently (total +${ad.voidHungerBonus})`, '+2 ATK', 'good');
  }
  if (m.id === 'sorcerer' && ad) {                     // Arcane Ascent
    ad.sorcererAtkBonus = (ad.sorcererAtkBonus || 0) + 1;
    ad.sorcererGenBonus = (ad.sorcererGenBonus || 0) + 1;
    log(`✨ Arcane Ascent: Sorcerer permanently gains +1 ATK +1 Gen on ${ctx} win (total: +${ad.sorcererAtkBonus} ATK, +${ad.sorcererGenBonus} Gen)`);
    fx(side, 'Arcane Ascent', `+1 ATK and +1 Gen permanently (total +${ad.sorcererAtkBonus})`, '+1/+1', 'good');
  }
  if (m.id === 'razorclaw' && ad) {                    // Apex Predator
    ad.apexPredatorBattleWins = (ad.apexPredatorBattleWins || 0) + 1;
    log(`🦁 Apex Predator: Razorclaw battle wins: ${ad.apexPredatorBattleWins}`);
    fx(side, 'Apex Predator', `+1 ATK per win (${ad.apexPredatorBattleWins} wins)`, '+1 ATK', 'good');
  }
}

// Per-monster stacks that fire whenever a STATIONED/fighting monster SURVIVES (defense win or stalemate)
function _onSurvive(m, ctx, side) {
  if (m.id === 'cursed_revenant' && m.abilityData) {   // Undead Resilience
    m.abilityData.cursedRevenantSurvivals = (m.abilityData.cursedRevenantSurvivals || 0) + 1;
    log(`💀 Undead Resilience: Cursed Revenant survives ${ctx} — +2 DEF (survivals: ${m.abilityData.cursedRevenantSurvivals})`);
    fx(side, 'Undead Resilience', `Survived: +2 DEF permanently (${m.abilityData.cursedRevenantSurvivals} survivals)`, '+2 DEF', 'good');
  }
  if (m.id === 'iron_hide') {                          // Hardened Shell
    m.maxHp += 3; m.hp += 3;
    log(`🦏 Hardened Shell: Iron Hide survives ${ctx}! +3 maxHp permanently (now ${m.hp}/${m.maxHp})`);
    fx(side, 'Hardened Shell', `Survived: +3 max HP permanently (now ${m.maxHp})`, '+3 max HP', 'good');
  }
}

// Death Rattle / Thorn Burst: on-death damage to the winner. If it kills the winner,
// the tile goes unclaimed and the win/loss credits flip.
function _deathEffectDamage(winnerM, winnerP, loserP, tile, tilePos, dmg, label, winnerSide, abilityName, sourceName) {
  winnerM.hp -= dmg;
  fx(winnerSide, abilityName, `Took ${dmg} damage from ${sourceName} as it died`, `−${dmg} HP`, 'bad');
  if (winnerM.hp <= 0) {
    _clearTile(tile);
    winnerP.battlesWon--; loserP.battlesLost--;   // reverse the win credits
    winnerP.battlesLost++; winnerP.destroyedCount++;
    log(`${label}: ${winnerM.name} killed! Tile ${tilePos} goes unclaimed.`);
    fx(winnerSide, abilityName, `${winnerM.name} was killed — tile ${tilePos} goes unclaimed`, 'KO', 'bad');
  }
}

function _applyBattleOutcome(outcome, attPlayer, attM, defPlayer, defM, tile, tilePos) {
  if (outcome === 'attacker_wins') {
    attPlayer.hand = attPlayer.hand.filter(m => m.iid !== attM.iid);
    tile.ownerId = attPlayer.idx;
    tile.summonId = attM.iid;
    tile.summonInstance = attM;
    tile.neverOwned = false;
    attPlayer.battlesWon++;
    defPlayer.battlesLost++;
    defPlayer.destroyedCount++;
    _updatePeakTiles(attPlayer.idx);
    log(`🏆 ${attPlayer.name} wins! ${defM.name} destroyed, ${tile.pos} claimed`);
    _battleMana(attPlayer, +4, defPlayer, -4);
    checkManaElimination(defPlayer.idx);

    _onBattleWin(attM, 'attack');

    // Attacker on-kill effects
    if (attM.id === 'solar_knight') {                  // Radiant Strike
      _convertTile(tile, 'Light', 'Radiant Strike');
      log(`☀️ Radiant Strike: Solar Knight converts tile to Light element on battle win!`);
      fx('att', 'Radiant Strike', `Tile ${tilePos} became Light`, '→ Light', 'good');
    }
    if (attM.id === 'nightshard') {                    // Soul Siphon
      const stolen = _stealMana(attPlayer, defPlayer, 4);
      log(`🌑 Soul Siphon: Nightshard steals ${stolen}✦ from ${defPlayer.name} on kill`);
      fx('att', 'Soul Siphon', `Stole ${stolen}✦ from ${defPlayer.name}`, `+${stolen}✦`, 'good');
      fx('def', 'Soul Siphon', `${attPlayer.name}\'s Nightshard stole ${stolen}✦`, `−${stolen}✦`, 'bad');
    }
    if (attM.id === 'dusk_blade') {                    // Hemorrhage (income cut)
      defPlayer._hemorrhageIncomeReduction = (defPlayer._hemorrhageIncomeReduction || 0) + 4;
      log(`🗡️ Hemorrhage: Dusk Blade reduces ${defPlayer.name}'s Mana income by 4✦ next turn`);
      fx('att', 'Hemorrhage', `${defPlayer.name}\'s income −4✦ next turn`, '−4✦', 'good');
      fx('def', 'Hemorrhage', 'Your Mana income is −4✦ next turn', '−4✦', 'bad');
    }
    if (attM.id === 'grave_specter') {                 // Necrotic Claim
      _convertTile(tile, 'Undead', 'Necrotic Claim');
      fx('att', 'Necrotic Claim', `Tile ${tilePos} became Undead`, '→ Undead', 'good');
      log(`👻 Necrotic Claim: Grave Specter converts tile ${tilePos} to Undead element!`);
    }

    // Defender on-death effects (hit the attacker)
    if (defM.id === 'bone_wraith') {                   // Death Rattle
      log(`💀 Death Rattle: Bone Wraith's death deals 12 damage to ${attM.name} (now ${attM.hp - 12}/${attM.maxHp})`);
      fx('def', 'Death Rattle', `Dealt 12 damage to ${attM.name} on death`, '12 dmg', 'good');
      _deathEffectDamage(attM, attPlayer, defPlayer, tile, tilePos, 12, '💀 Death Rattle', 'att', 'Death Rattle', defM.name);
    }
    if (defM.id === 'thornling') {                     // Thorn Burst
      _convertTile(tile, 'Nature', 'Thorn Burst');
      fx('def', 'Thorn Burst', `Tile ${tilePos} became Nature`, '→ Nature', 'good');
      log(`🌿 Thorn Burst: Thornling's death deals 8 damage to ${attM.name} and tile ${tilePos} becomes Nature!`);
      fx('def', 'Thorn Burst', `Dealt 8 damage to ${attM.name} on death`, '8 dmg', 'good');
      _deathEffectDamage(attM, attPlayer, defPlayer, tile, tilePos, 8, '🌿 Thorn Burst', 'att', 'Thorn Burst', defM.name);
    }

    if (attM.id === 'succubus') {                      // Mana Drain
      const stolen = _stealMana(attPlayer, defPlayer, 10);
      log(`🧛 Mana Drain: ${attPlayer.name} steals ${stolen}✦ from ${defPlayer.name}`);
      fx('att', 'Mana Drain', `Stole ${stolen}✦ from ${defPlayer.name}`, `+${stolen}✦`, 'good');
      fx('def', 'Mana Drain', `${attPlayer.name}\'s Succubus stole ${stolen}✦`, `−${stolen}✦`, 'bad');
    }
  } else if (outcome === 'defender_wins') {
    attPlayer.hand = attPlayer.hand.filter(m => m.iid !== attM.iid);
    attPlayer.battlesLost++;
    defPlayer.battlesWon++;
    attPlayer.destroyedCount++;
    log(`🛡️ ${defPlayer.name} defends! ${attM.name} destroyed`);
    _battleMana(attPlayer, -8, defPlayer, +4);
    checkManaElimination(attPlayer.idx);

    // Survival + win stacks fire before Death Rattle (e.g. Iron Hide +3 HP lands first)
    _onSurvive(defM, 'battle', 'def');
    _onBattleWin(defM, 'defense');


    if (attM.id === 'bone_wraith') {                   // Death Rattle hits the defender
      log(`💀 Death Rattle: Bone Wraith's death deals 12 damage to ${defM.name} (now ${defM.hp - 12}/${defM.maxHp})`);
      fx('att', 'Death Rattle', `Dealt 12 damage to ${defM.name} on death`, '12 dmg', 'good');
      _deathEffectDamage(defM, defPlayer, attPlayer, tile, tilePos, 12, '💀 Death Rattle', 'def', 'Death Rattle', attM.name);
    }
  } else if (outcome === 'mutual') {
    attPlayer.hand = attPlayer.hand.filter(m => m.iid !== attM.iid);
    attPlayer.battlesLost++;
    defPlayer.battlesLost++;
    attPlayer.destroyedCount++;
    defPlayer.destroyedCount++;
    _clearTile(tile);
    log(`💥 Mutual destruction! Tile ${tilePos} unclaimed`);
    _battleMana(attPlayer, -8, defPlayer, +4);
    checkManaElimination(attPlayer.idx);
  } else if (outcome === 'stalemate') {
    log(`🤝 Stalemate! Both survive`);
    _battleMana(attPlayer, -4, defPlayer, +4);
    checkManaElimination(attPlayer.idx);

    _onSurvive(attM, 'stalemate', 'att');
    _onSurvive(defM, 'stalemate', 'def');

    // v1.0.98: Shade Walker — Cursed Touch. Stalemate is the only outcome where the
    // opponent survives, so this is where the curse lands. Doesn't stack/refresh.
    const _curse = (victim, side, victimSide) => {
      victim.abilityData = victim.abilityData || {};
      if (victim.abilityData.shadeWalkerCurse > 0) return;
      victim.abilityData.shadeWalkerCurse = 2;
      victim.abilityData.shadeWalkerCurseAmt = 5;
      log(`🌑 Cursed Touch: Shade Walker curses ${victim.name} — 5 HP per turn for 2 turns (follows the monster)`);
      fx(side, 'Cursed Touch', `Cursed ${victim.name}: 5 HP per turn for 2 turns`, 'curse', 'good');
      fx(victimSide, 'Cursed Touch', `${victim.name} is cursed: −5 HP per turn for 2 turns`, 'curse', 'bad');
    };
    if (attM.id === 'shade_walker') _curse(defM, 'att', 'def');
    if (defM.id === 'shade_walker') _curse(attM, 'def', 'att');

    if (attM.id === 'succubus') {                      // Mana Drain (stalemate too)
      const stolen = _stealMana(attPlayer, defPlayer, 10);
      log(`🧛 Mana Drain: ${attPlayer.name} steals ${stolen}✦ from ${defPlayer.name} (stalemate)`);
      fx('att', 'Mana Drain', `Stole ${stolen}✦ from ${defPlayer.name}`, `+${stolen}✦`, 'good');
      fx('def', 'Mana Drain', `${attPlayer.name}\'s Succubus stole ${stolen}✦`, `−${stolen}✦`, 'bad');
    }
  } else {
    return;
  }

  // Arcane Arbiter — Chaos Flux: defender-only, fires after ANY outcome against it
  // (scrambles one attacker-owned tile). Always the final effect.
  if (defM.id === 'arcane_arbiter') _applyChaosFlux(attPlayer);
}


// Arcane Arbiter — Chaos Flux: scramble one random tile owned by the ATTACKER
// Fires only when the Arbiter is the DEFENDER (stationed on a tile being attacked)
// "After any battle or stalemate against it, one random attacker-owned tile changes to a random element"
function _applyChaosFlux(attackingPlayer) {
  const ownedElemTiles = G.board.filter(t => t.ownerId === attackingPlayer.idx && t.element);
  if (ownedElemTiles.length === 0) return;
  const target = ownedElemTiles[Math.floor(Math.random() * ownedElemTiles.length)];
  const otherTypes = TYPES.filter(t => t !== target.element);
  const newEl = otherTypes[Math.floor(Math.random() * otherTypes.length)];
  const oldEl = target.element;
  _convertTile(target, newEl, 'Chaos Flux');
  target.label = newEl;
  fx('def', 'Chaos Flux', `Scrambled ${attackingPlayer.name}\'s tile ${target.pos}: ${oldEl} → ${newEl}`, 'scramble', 'good');
  fx('att', 'Chaos Flux', `Your tile ${target.pos} changed ${oldEl} → ${newEl}`, `→ ${newEl}`, 'bad');
  log(`🌀 Chaos Flux! ${attackingPlayer.name}'s tile ${target.pos} scrambled: ${oldEl} → ${newEl}`);
}

// Handle warp landing — position already set, just resolve the tile
function resolveRoll_fromPos(playerIdx, pos) {
  G.players[playerIdx].position = pos;
  G.pendingLanding = null;
  resolveLandingTile(playerIdx);
}

// ─── PURE NODE.JS HTTP + WEBSOCKET SERVER ────────────────────────────────────
// No external deps — uses only built-in 'http', 'fs', 'path', 'crypto', 'os'

const fs     = require('fs');
const crypto = require('crypto');

const STATE_FILE = path.join(__dirname, 'game-state.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.wav':  'audio/wav',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.mp3':  'audio/mpeg',
  '.ico':  'image/x-icon',
};

// ─── WebSocket helpers ────────────────────────────────────────────────────────
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsHandshake(socket, req) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return false; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  return true;
}

function wsSend(socket, data) {
  if (socket.destroyed) return;
  // v1.0.90: accepts a pre-serialized JSON string (broadcast builds shared state once)
  const payload = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try { socket.write(Buffer.concat([header, payload])); } catch {}
}

// Parse a single frame from a Buffer; returns {opcode, text} or null if incomplete
function wsParseFrame(buf) {
  if (buf.length < 2) return null;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2); offset = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2)); offset = 10;
  }
  const total = offset + (masked ? 4 : 0) + len;
  if (buf.length < total) return null;
  const opcode = buf[0] & 0x0f;
  let payload;
  if (masked) {
    const mask = buf.slice(offset, offset + 4);
    payload = Buffer.alloc(len);
    for (let i = 0; i < len; i++) payload[i] = buf[offset + 4 + i] ^ mask[i % 4];
  } else {
    payload = buf.slice(offset, offset + len);
  }
  return { opcode, text: payload.toString(), consumed: total };
}

// ─── HTTP static file server ──────────────────────────────────────────────────
const PUBLIC = path.join(__dirname, 'public');

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Health-check endpoint
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      version: SERVER_VERSION,
      rooms: rooms.size,
      roomList: [...rooms.entries()].map(([code, r]) => ({ code, phase: r.phase, players: r.players.length })),
    }));
    return;
  }

  // ── Admin endpoints ─────────────────────────────────────────────────────────

  // Clear a specific room by code
  if (urlPath.startsWith('/admin/clear/')) {
    const code = urlPath.split('/admin/clear/')[1].toUpperCase().trim();
    if (rooms.has(code)) {
      rooms.delete(code);
      saveState();
      console.log(`[admin] manually cleared room ${code}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, cleared: code }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Room not found' }));
    }
    return;
  }

  // Clear all rooms with no active connections
  if (urlPath === '/admin/clear-stale') {
    const cleared = [];
    for (const [code] of rooms) {
      const hasConn = [...clients.values()].some(c => c.roomCode === code);
      if (!hasConn) { rooms.delete(code); cleared.push(code); }
    }
    saveState();
    console.log(`[admin] cleared stale rooms: ${cleared.join(', ') || 'none'}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, cleared }));
    return;
  }

  // Clear ALL rooms (nuclear — disconnects everyone)
  if (urlPath === '/admin/clear-all') {
    const cleared = [...rooms.keys()];
    rooms.clear();
    saveState();
    console.log(`[admin] cleared ALL rooms (${cleared.length})`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, cleared }));
    return;
  }

  // Admin dashboard page
  if (urlPath === '/admin') {
    const now = Date.now();
    const rowsHtml = [...rooms.entries()].map(([code, room]) => {
      const idle = Math.round((now - (room.lastActivityAt || 0)) / 1000);
      const idleStr = idle < 60 ? `${idle}s` : idle < 3600 ? `${Math.round(idle/60)}m` : `${Math.round(idle/3600)}h`;
      const connCount = [...clients.values()].filter(c => c.roomCode === code).length;
      const players = room.players.map(p => `${p.name}${p.isConnected ? '' : ' (dc)'}`).join(', ') || '—';
      const rowStyle = connCount === 0 ? 'background:#2a1a1a' : 'background:#1a2a1a';
      return `<tr style="${rowStyle}">
        <td style="font-family:monospace;font-size:16px;letter-spacing:.1em;color:#c9a050">${code}</td>
        <td>${room.phase}</td>
        <td>${room.players.length}</td>
        <td style="color:${connCount>0?'#5dc97d':'#e05252'}">${connCount}</td>
        <td style="color:#888">${idleStr} ago</td>
        <td style="max-width:200px;font-size:12px;color:#aaa">${players}</td>
        <td><button onclick="clearRoom('${code}')" style="background:#5c2a2a;border:1px solid #a04040;color:#e08080;padding:4px 10px;border-radius:6px;cursor:pointer">Clear</button></td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>SG Admin — ${SERVER_VERSION}</title>
<style>
  body{background:#0d0e1c;color:#c8c9e0;font-family:system-ui,sans-serif;padding:32px;margin:0}
  h1{font-size:20px;color:#9184d9;margin:0 0 4px}
  .sub{color:#666;font-size:13px;margin-bottom:24px}
  table{border-collapse:collapse;width:100%;max-width:900px}
  th{text-align:left;padding:8px 12px;border-bottom:2px solid #2a2b3d;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
  td{padding:8px 12px;border-bottom:1px solid #1e1f2e}
  .actions{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
  button.action{padding:8px 18px;border-radius:8px;border:1px solid;cursor:pointer;font-size:14px}
  .btn-stale{background:#2a2a1a;border-color:#8a7a30;color:#c9a050}
  .btn-all  {background:#2a1a1a;border-color:#a04040;color:#e08080}
  .btn-ref  {background:#1a1a2a;border-color:#4040a0;color:#8080e0}
  .empty{color:#555;padding:20px 0;font-size:14px}
</style></head><body>
<h1>Summoners Gambit — Admin</h1>
<div class="sub">${SERVER_VERSION} · ${rooms.size} room(s) in memory · ${clients.size} connection(s)</div>
<div class="actions">
  <button class="action btn-stale" onclick="doAction('/admin/clear-stale')">⚡ Clear Stale (no connections)</button>
  <button class="action btn-all"   onclick="doAction('/admin/clear-all','Are you sure? This disconnects everyone.')">☠ Clear ALL Rooms</button>
  <button class="action btn-ref"   onclick="location.reload()">↺ Refresh</button>
</div>
${rooms.size === 0 ? '<div class="empty">No rooms in memory.</div>' : `
<table>
  <thead><tr><th>Code</th><th>Phase</th><th>Players</th><th>Conns</th><th>Idle</th><th>Names</th><th></th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>`}
<script>
function doAction(url, confirm_msg) {
  if (confirm_msg && !confirm(confirm_msg)) return;
  fetch(url).then(r=>r.json()).then(d=>{
    alert(d.cleared && d.cleared.length ? 'Cleared: ' + d.cleared.join(', ') : 'Nothing to clear');
    location.reload();
  });
}
function clearRoom(code) {
  if (!confirm('Clear room ' + code + '?')) return;
  fetch('/admin/clear/' + code).then(r=>r.json()).then(d=>{
    alert(d.ok ? 'Cleared ' + code : d.error);
    location.reload();
  });
}
</script></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/board.html';
  if (urlPath === '/board')    urlPath = '/board.html';
  if (urlPath === '/player')   urlPath = '/player.html';
  if (urlPath === '/spectate') urlPath = '/board.html'; // spectator uses same board view
  if (urlPath === '/battle-tester') urlPath = '/battle-tester.html';

  const filePath = path.join(PUBLIC, urlPath);
  // Security: ensure we stay within public/
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    // v1.0.101: pages + scripts must always revalidate so a deploy reaches phones on the next load;
    // art/audio can be cached for a day.
    const cache = (ext === '.html' || ext === '.js' || ext === '.css' || ext === '.json') ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(data);
  });
}

// ─── Client registry ──────────────────────────────────────────────────────────
// Map: socket → { playerIdx: null|number, buf: Buffer }
const clients = new Map();

// Shim: make socket look like a ws object so existing code (wsSend, sendError, broadcast) works
function socketSend(socket, json) { wsSend(socket, json); }

// Redefine sendError to work with raw socket
function sendError(socket, msg) {
  wsSend(socket, { type:'error', message: msg });
}

// ─── State persistence ────────────────────────────────────────────────────────
// Serialize the rooms Map to disk on every broadcast so process restarts
// (Railway deploys, crashes, idle scale-down) don't silently kill active games.
// Note: Railway's ephemeral filesystem persists within a running container but
// is wiped on redeploy — this protects against crashes/restarts, not redeploys.

// v1.0.90: debounced — broadcasts mark state dirty; disk write happens at most
// once per SAVE_DEBOUNCE_MS instead of a synchronous full write on every broadcast.
const SAVE_DEBOUNCE_MS = 2000;
let _saveTimer = null;
function saveState() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => { _saveTimer = null; saveStateNow(); }, SAVE_DEBOUNCE_MS);
}

function saveStateNow() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  try {
    const data = JSON.stringify([...rooms.entries()]);
    fs.writeFileSync(STATE_FILE, data, 'utf8');
  } catch (e) {
    console.error('[persist] save failed:', e.message);
  }
}

// Flush pending save on shutdown (Ctrl+C locally, SIGTERM on Railway redeploy/restart)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { saveStateNow(); process.exit(0); });
}

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    const entries = JSON.parse(data);
    for (const [code, state] of entries) {
      // Only restore games that aren't over yet
      if (state && state.phase !== 'game_over') {
        rooms.set(code, state);
        console.log(`[persist] restored room ${code} (phase: ${state.phase})`);
      }
    }
  } catch (e) {
    console.error('[persist] load failed (starting fresh):', e.message);
  }
}

// Redefine broadcast to work with raw sockets — only sends to clients in the current room
function broadcast(extra = {}) {
  if (!G) return;
  G.lastActivityAt = Date.now();
  const roomCode = G.roomCode;
  // v1.0.90: serialize shared game state ONCE per broadcast; per-player messages
  // only add their own myIdx + hand on top.
  const head = JSON.stringify({ type:'state', ...extra }).slice(0, -1);
  const sharedJson = head + ',"game":' + JSON.stringify(publicState());
  const spectatorMsg = sharedJson + '}';
  for (const [socket, conn] of clients) {
    if (socket.destroyed) continue;
    if (conn.roomCode !== roomCode) continue;
    const p = (conn.playerIdx !== null && conn.playerIdx !== undefined) ? G.players[conn.playerIdx] : null;
    if (!p) { wsSend(socket, spectatorMsg); continue; }
    const hand = p.hand.map(m => serializeHandMonster(m, conn.playerIdx));
    wsSend(socket, sharedJson + ',"myIdx":' + conn.playerIdx + ',"hand":' + JSON.stringify(hand) + '}');
  }
  // Persist (debounced)
  saveState();
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => serveStatic(req, res));

server.on('upgrade', (req, socket, head) => {
  if (req.headers['upgrade'] !== 'websocket') { socket.destroy(); return; }
  if (!wsHandshake(socket, req)) return;

  const conn = { playerIdx: null, sessionKey: null, roomCode: null, isBoard: false, isSpectator: false, buf: Buffer.alloc(0) };
  clients.set(socket, conn);

  // ── Keep-alive: server pings every 20s to prevent proxy/NAT idle-timeout drops ──
  conn.lastPong = Date.now();
  const keepAlive = setInterval(() => {
    if (socket.destroyed) { clearInterval(keepAlive); return; }
    // Drop connections that haven't ponged in 55 seconds (2+ missed pings)
    if (Date.now() - conn.lastPong > 55000) {
      clearInterval(keepAlive);
      socket.destroy();
      return;
    }
    // Send WebSocket ping frame (opcode 0x89, no payload)
    const ping = Buffer.alloc(2); ping[0] = 0x89; ping[1] = 0;
    try { socket.write(ping); } catch { clearInterval(keepAlive); }
  }, 20000);
  socket.on('close', () => clearInterval(keepAlive));
  socket.on('error', () => clearInterval(keepAlive));

  // Send a ready ping — client sends board_connect or join to get room state
  wsSend(socket, { type: 'ready', rooms: [...rooms.keys()] });

  socket.on('data', (chunk) => {
    conn.buf = Buffer.concat([conn.buf, chunk]);
    // Any data from the client means the TCP connection is alive — reset the dead-timer.
    // This is defense-in-depth alongside the explicit pong frame check below.
    conn.lastPong = Date.now();
    while (true) {
      const frame = wsParseFrame(conn.buf);
      if (!frame) break;
      conn.buf = conn.buf.slice(frame.consumed);

      if (frame.opcode === 0x8) { socket.destroy(); break; }  // close
      if (frame.opcode === 0x9) {
        // client ping → respond with pong (0x8a full byte, but opcode bits only = 0x0a)
        const pong = Buffer.alloc(2); pong[0] = 0x8a; pong[1] = 0;
        try { socket.write(pong); } catch {}
        continue;
      }
      // FIX: wsParseFrame extracts opcode as buf[0] & 0x0f (lower 4 bits).
      // Pong full byte = 0x8A, but extracted opcode = 0x0A (10), NOT 0x8a (138).
      // The previous check (=== 0x8a) never matched, so conn.lastPong was never updated
      // from pong frames — causing every connection to be killed after 55s.
      if (frame.opcode === 0x0a) {
        // client pong → confirm connection is alive (lastPong already updated above)
        continue;
      }
      if (frame.opcode !== 0x1) continue; // only handle text frames

      let data;
      try { data = JSON.parse(frame.text); } catch { continue; }

      const action = data.action;
      if (!action || typeof action !== 'string') continue;
      const handler = handlers[action];
      if (!handler) { sendError(socket, 'Unknown action: ' + action); continue; }

      // Spectators can only send spectate_connect — block everything else
      if (conn.isSpectator && action !== 'spectate_connect') {
        sendError(socket, 'Spectators cannot perform game actions'); continue;
      }

      // Set G context for this request from the connection's room
      if (conn.roomCode) G = rooms.get(conn.roomCode) || null;
      else G = null;

      try {
        handler(socket, conn, data);
      } catch (err) {
        console.error('Action error:', action, err);
        sendError(socket, 'Server error: ' + err.message);
      }
    }
  });

  function handleDisconnect() {
    const conn = clients.get(socket);
    clients.delete(socket);
    if (!conn || !conn.roomCode) return;
    G = rooms.get(conn.roomCode);
    if (!G) return;

    if (G.phase === 'lobby' && conn.playerIdx !== null && conn.playerIdx !== undefined) {
      // In lobby: mark disconnected (same as in-game) so rejoin with sessionKey works.
      // Previously we deleted the slot immediately — but that meant rejoin failed and
      // the player had to re-enter their info, causing a visible disconnect/rejoin flash.
      const p = G.players.find(pl => pl.idx === conn.playerIdx);
      if (p && p.isConnected) {
        p.isConnected = false;
        log(`⚠ ${p.name} disconnected from lobby`);
        broadcast();
      }
    } else if (G.phase !== 'lobby' && conn.playerIdx !== null && conn.playerIdx !== undefined) {
      // In game: mark disconnected and pause
      const p = G.players[conn.playerIdx];
      if (p && p.isConnected) {
        p.isConnected = false;
        // Eliminated players are already out — don't pause the game for them
        if (p.eliminated) {
          log(`👻 ${p.name} (eliminated) disconnected — no pause`);
          broadcast();
          return;
        }
        if (!G.pausedFor) {
          G.pausedFor = { idx: p.idx, name: p.name, color: p.color };
          log(`⚡ ${p.name} disconnected — game paused`);
        }
        broadcast();
      }
    }
  }
  socket.on('close', handleDisconnect);
  socket.on('error', handleDisconnect);
});

server.listen(PORT, '0.0.0.0', () => {
  loadState();
  const ip = getLocalIp();
  console.log('');
  console.log('  ╔════════════════════════════════════════╗');
  console.log(`  ║   Summon Board Game — Server ${SERVER_VERSION}  ║`);
  console.log('  ╠════════════════════════════════════════╣');
  console.log(`  ║  Board view  →  http://${ip}:${PORT}/board  `);
  console.log(`  ║  Player view →  http://${ip}:${PORT}/player `);
  console.log('  ║  (share these URLs with players on     ║');
  console.log('  ║   the same WiFi network)               ║');
  console.log('  ╚════════════════════════════════════════╝');
  console.log('');

  // ── Stale room cleanup — runs every 2 minutes ──────────────────────────────
  // Prevents rooms from accumulating indefinitely in memory and on disk.
  // A room is removed only when it has NO active connections AND exceeds the idle threshold:
  //   game_over        →  5 min  (results seen, nothing to keep)
  //   setup            → 10 min  (pre-game phase, clearly abandoned)
  //   lobby (0 players)→ 10 min  (empty shell, board closed without playing)
  //   lobby (has players)→30 min (players may still be joining)
  //   any mid-game phase→ 60 min (disconnected players get time to rejoin via session key)
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [code, room] of rooms) {
      const idle = now - (room.lastActivityAt || 0);
      const hasConn = [...clients.values()].some(c => c.roomCode === code);
      if (hasConn) continue; // active connections — never evict
      const phase = room.phase;
      if (phase === 'game_over'                                         && idle >  5 * 60 * 1000) { rooms.delete(code); cleaned++; continue; }
      if (phase === 'setup'                                             && idle > 10 * 60 * 1000) { rooms.delete(code); cleaned++; continue; }
      if (phase === 'lobby' && room.players.length === 0                && idle > 10 * 60 * 1000) { rooms.delete(code); cleaned++; continue; }
      if (phase === 'lobby' && room.players.length > 0                 && idle > 30 * 60 * 1000) { rooms.delete(code); cleaned++; continue; }
      if (idle > 60 * 60 * 1000) { rooms.delete(code); cleaned++; continue; } // mid-game: 1 hour
    }
    if (cleaned > 0) {
      console.log(`[cleanup] removed ${cleaned} stale room(s) — ${rooms.size} remaining`);
      saveState();
    }
  }, 2 * 60 * 1000);
});
