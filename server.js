// ─── Monster Board Game — Local Multiplayer Server ────────────────────────────
// Run: node server.js
// Players connect to http://<your-ip>:3000/player
// Board view:  http://<your-ip>:3000/board
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const http = require('http');
const path = require('path');
const os   = require('os');

const PORT = process.env.PORT || 3000;
const SERVER_VERSION = 'v1.0.19';

// ─── DATA ────────────────────────────────────────────────────────────────────

const TYPES = ['Light','Dark','Arcane','Undead','Beast','Nature'];

const TYPE_COLOR = {
  Light:'#e0c07a', Dark:'#b56fd0', Arcane:'#7f92e8',
  Undead:'#5fb3a4', Beast:'#d98a5a', Nature:'#7fb36a'
};

// Strong[A] = type A beats
const TYPE_STRONG = { Light:'Dark', Dark:'Arcane', Arcane:'Undead', Undead:'Beast', Beast:'Nature', Nature:'Light' };
const TYPE_WEAK   = { Light:'Nature', Dark:'Light', Arcane:'Dark', Undead:'Arcane', Beast:'Undead', Nature:'Beast' };

// Master monster roster
const ROSTER = [
  // ── Light ──
  {id:'solar_knight',   type:'Light',  name:'Solar Knight',   arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'dawnguard',      type:'Light',  name:'Dawnguard',      arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'high_paladin',   type:'Light',  name:'High Paladin',   arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'ardent_saint',   type:'Light',  name:'Ardent Saint',   arch:'ascendant', hp:65, maxHp:65, atk:15, def:15, cost:20, gen:5, isSpecial:true,
    special:'Aura of Renewal',  specialDesc:'Heal all friendly stationed monsters 5 HP/turn',
    condition:'healed4', conditionDesc:'Healed 4+ monsters this game'},
  // Light — new
  {id:'dawn_striker',   type:'Light',  name:'Dawn Striker',   arch:'assailant', hp:25, maxHp:25, atk:36, def:6,  cost:8,  gen:2, isSpecial:false},
  {id:'radiant_lancer', type:'Light',  name:'Radiant Lancer', arch:'vanguard',  hp:30, maxHp:30, atk:28, def:10, cost:10, gen:2, isSpecial:false},
  {id:'sunfire_herald', type:'Light',  name:'Sunfire Herald', arch:'vanguard',  hp:40, maxHp:40, atk:22, def:11, cost:10, gen:2, isSpecial:false},

  // ── Dark ──
  {id:'nightshard',     type:'Dark',   name:'Nightshard',     arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'void_sentinel',  type:'Dark',   name:'Void Sentinel',  arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'shadow_paladin', type:'Dark',   name:'Shadow Paladin', arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'succubus',       type:'Dark',   name:'Succubus',       arch:'ascendant', hp:45, maxHp:45, atk:32, def:10, cost:20, gen:5, isSpecial:true,
    special:'Mana Drain', specialDesc:'Win a battle → steal 10 Mana from loser\'s owner',
    condition:'moreManaThanAll', conditionDesc:'Have more Mana than every other player'},
  // Dark — new
  {id:'void_reaper',    type:'Dark',   name:'Void Reaper',    arch:'assailant', hp:18, maxHp:18, atk:42, def:4,  cost:8,  gen:2, isSpecial:false},
  {id:'dusk_blade',     type:'Dark',   name:'Dusk Blade',     arch:'vanguard',  hp:30, maxHp:30, atk:29, def:8,  cost:10, gen:2, isSpecial:false},
  {id:'umbral_stalker', type:'Dark',   name:'Umbral Stalker', arch:'vanguard',  hp:42, maxHp:42, atk:21, def:11, cost:10, gen:2, isSpecial:false},

  // ── Arcane ──
  {id:'sorcerer',       type:'Arcane', name:'Sorcerer',       arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'rune_priestess', type:'Arcane', name:'Rune Priestess', arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'arch_mage',      type:'Arcane', name:'Arch Mage',      arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'arcane_arbiter', type:'Arcane', name:'Arcane Arbiter', arch:'ascendant', hp:40, maxHp:40, atk:27, def:15, cost:20, gen:5, isSpecial:true,
    special:'Nullify', specialDesc:'Cancel type modifier once per battle (forces 1× neutral)',
    condition:'changed3', conditionDesc:'Changed tile element 3+ times this game'},
  // Arcane — new
  {id:'spell_wraith',   type:'Arcane', name:'Spell Wraith',   arch:'assailant', hp:22, maxHp:22, atk:38, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'runic_duelist',  type:'Arcane', name:'Runic Duelist',  arch:'vanguard',  hp:32, maxHp:32, atk:27, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'mana_weaver',    type:'Arcane', name:'Mana Weaver',    arch:'vanguard',  hp:38, maxHp:38, atk:23, def:12, cost:10, gen:2, isSpecial:false},

  // ── Undead ──
  {id:'bone_wraith',    type:'Undead', name:'Bone Wraith',    arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'death_knight',   type:'Undead', name:'Death Knight',   arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'shade_walker',   type:'Undead', name:'Shade Walker',   arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'demon_lord',     type:'Undead', name:'Demon Lord',     arch:'ascendant', hp:85, maxHp:85, atk:17, def:8,  cost:20, gen:5, isSpecial:true,
    special:'Last Rite', specialDesc:'When HP hits 0, survive at 15 HP instead (once per game)',
    condition:'lost4', conditionDesc:'Had 4+ monsters destroyed this game', lastRiteUsed:false},
  // Undead — new
  {id:'grave_specter',  type:'Undead', name:'Grave Specter',  arch:'assailant', hp:18, maxHp:18, atk:42, def:4,  cost:8,  gen:2, isSpecial:false},
  {id:'cursed_revenant',type:'Undead', name:'Cursed Revenant',arch:'vanguard',  hp:33, maxHp:33, atk:26, def:10, cost:10, gen:2, isSpecial:false},
  {id:'plague_herald',  type:'Undead', name:'Plague Herald',  arch:'vanguard',  hp:40, maxHp:40, atk:22, def:11, cost:10, gen:2, isSpecial:false},

  // ── Beast ──
  {id:'razorclaw',      type:'Beast',  name:'Razorclaw',      arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'iron_hide',      type:'Beast',  name:'Iron Hide',      arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'pack_hunter',    type:'Beast',  name:'Pack Hunter',    arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'red_dragon',     type:'Beast',  name:'Red Dragon',     arch:'ascendant', hp:35, maxHp:35, atk:40, def:9,  cost:20, gen:5, isSpecial:true,
    special:'Intimidate', specialDesc:'When claiming a tile, adjacent owners pay 5 Mana each',
    condition:'mostMonsters', conditionDesc:'Have the most monsters stationed on board'},
  // Beast — new
  {id:'feral_striker',  type:'Beast',  name:'Feral Striker',  arch:'assailant', hp:22, maxHp:22, atk:38, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'blood_mane',     type:'Beast',  name:'Blood Mane',     arch:'vanguard',  hp:32, maxHp:32, atk:28, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'stoneback',      type:'Beast',  name:'Stoneback',      arch:'vanguard',  hp:42, maxHp:42, atk:20, def:12, cost:10, gen:2, isSpecial:false},

  // ── Nature ──
  {id:'thornling',      type:'Nature', name:'Thornling',      arch:'assailant', hp:20, maxHp:20, atk:40, def:5,  cost:8,  gen:2, isSpecial:false},
  {id:'ancient_oak',    type:'Nature', name:'Ancient Oak',    arch:'guardian',  hp:60, maxHp:60, atk:18, def:12, cost:12, gen:3, isSpecial:false},
  {id:'grove_warden',   type:'Nature', name:'Grove Warden',   arch:'vanguard',  hp:35, maxHp:35, atk:25, def:9,  cost:10, gen:2, isSpecial:false},
  {id:'world_tree',     type:'Nature', name:'World Tree',     arch:'ascendant', hp:55, maxHp:55, atk:22, def:13, cost:20, gen:5, isSpecial:true,
    special:'Deep Roots', specialDesc:'+1 Mana Gen per Nature tile owner controls',
    condition:'own4Nature', conditionDesc:'Own 4+ Nature tiles currently'},
  // Nature — new
  {id:'briar_sprite',   type:'Nature', name:'Briar Sprite',   arch:'assailant', hp:22, maxHp:22, atk:37, def:6,  cost:8,  gen:2, isSpecial:false},
  {id:'vine_stalker',   type:'Nature', name:'Vine Stalker',   arch:'vanguard',  hp:33, maxHp:33, atk:26, def:10, cost:10, gen:2, isSpecial:false},
  {id:'moss_golem',     type:'Nature', name:'Moss Golem',     arch:'vanguard',  hp:42, maxHp:42, atk:20, def:12, cost:10, gen:2, isSpecial:false},

  // ── Dual-Element Rares ──
  // Gets BOTH elements' advantages: max(mod1, mod2). Mutual weaknesses cancel → no weak sides.
  {id:'seraphim',         type:'Light',  type2:'Arcane', name:'Luminar Operative', arch:'rare', rarity:'rare',
   hp:35, maxHp:35, atk:22, def:12, cost:26, gen:4, isSpecial:false,
   rareDesc:'2× vs Dark & Undead · No weaknesses'},
  {id:'hex_stalker',      type:'Undead', type2:'Beast',  name:'Hex Stalker',      arch:'rare', rarity:'rare',
   hp:42, maxHp:42, atk:20, def:11, cost:25, gen:3, isSpecial:false,
   rareDesc:'2× vs Beast & Nature · No weaknesses'},
  {id:'verdant_sorcerer', type:'Arcane', type2:'Nature', name:'Verdant Sorcerer', arch:'rare', rarity:'rare',
   hp:30, maxHp:30, atk:24, def:12, cost:27, gen:4, isSpecial:false,
   rareDesc:'2× vs Light & Undead · No weaknesses'},
];

const SPECIALS = ROSTER.filter(m => m.isSpecial);
const RARES    = ROSTER.filter(m => m.rarity === 'rare');
const NORMALS  = ROSTER.filter(m => !m.isSpecial && !m.rarity);

// Starter sets — 6 sets × 5 cards each (no Mana cost during setup phase)
const STARTER_SETS = {
  A: { name:'The Cabal',        theme:'Dark / Undead / Arcane',  desc:'2 Assailants + 2 Guardians + 1 Vanguard — shadow magic trinity',
       monsters:['nightshard','grave_specter','void_sentinel','rune_priestess','mana_weaver'] },
  B: { name:'The Warpack',      theme:'Dark / Beast / Undead',   desc:'2 Assailants + 2 Guardians + 1 Vanguard — primal hunter force',
       monsters:['void_reaper','feral_striker','iron_hide','death_knight','cursed_revenant'] },
  C: { name:'The Order',        theme:'Light / Arcane / Nature', desc:'2 Assailants + 2 Guardians + 1 Vanguard — holy nature alliance',
       monsters:['dawn_striker','spell_wraith','dawnguard','ancient_oak','vine_stalker'] },
  D: { name:'The Arcane Watch', theme:'Arcane',                  desc:'1 Assailant + 1 Guardian + 3 Vanguards — versatile arcane mastery',
       monsters:['spell_wraith','rune_priestess','arch_mage','runic_duelist','mana_weaver'] },
  E: { name:'Divine Guard',     theme:'Light',                   desc:'2 Guardians + 1 Assailant + 2 Vanguards — impenetrable light fortress',
       monsters:['dawnguard','dawnguard','dawn_striker','radiant_lancer','sunfire_herald'] },
  F: { name:'Chaos Legion',     theme:'Dark',                    desc:'3 Assailants + 2 Vanguards — pure dark aggression',
       monsters:['nightshard','nightshard','void_reaper','dusk_blade','umbral_stalker'] },
};

const PLAYER_COLORS = ['#e05252','#5ca8e0','#5dc97d','#e0b050','#c07fd8','#60cdc0'];
const CHANGE_ELEMENT_COST = 18;
const MANA_PENALTY        = 20;
const HEAL_COST_PER_HP    = 1.5;
const DEFAULT_ROUND_LIMIT = 30; // rounds per player (selectable in lobby)

// ─── HELPERS ─────────────────────────────────────────────────────────────────

let _iid = 0;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function makeMonster(templateId) {
  const t = ROSTER.find(r => r.id === templateId);
  if (!t) throw new Error('unknown monster: ' + templateId);
  return { ...t, iid: ++_iid, charm: false, lastRiteUsed: false };
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
  return offers;
}

function buildBoard() {
  // 28 tiles. Position 0=Start, 7=Temple, 14=Chest, 21=Heal
  const specials = [
    { pos:0,  kind:'start',   label:'Mana Well', icon:'✦' },
    { pos:7,  kind:'chest',   label:'Chest',     icon:'📦' },
    { pos:14, kind:'heal',    label:'Healing',   icon:'💚' },
    { pos:21, kind:'temple',  label:'Temple',    icon:'🏛' },
  ];
  const specialPos = new Set(specials.map(s => s.pos));

  const types = [];
  for (let i = 0; i < 24; i++) types.push(TYPES[i % 6]);
  shuffle(types);

  let typeIdx = 0;
  const tiles = [];
  for (let i = 0; i < 28; i++) {
    const sp = specials.find(s => s.pos === i);
    if (sp) {
      tiles.push({ pos:i, kind:sp.kind, label:sp.label, icon:sp.icon,
                   element:null, ownerId:null, monsterId:null });
    } else {
      const el = types[typeIdx++];
      tiles.push({ pos:i, kind:'element', label:el, icon:'', element:el,
                   ownerId:null, monsterId:null });
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
  };
}

// Defer a room-scoped action — safe across async gaps (setTimeout loses G closure)
function scheduleRoomAction(roomCode, fn, ms) {
  setTimeout(() => {
    G = rooms.get(roomCode);
    if (G) fn();
  }, ms);
}

function addPlayer(name, color, starterSet) {
  const idx = G.players.length;
  const hand = STARTER_SETS[starterSet].monsters.map(id => makeMonster(id));
  const sessionKey = crypto.randomBytes(8).toString('hex');
  return {
    idx, name, color, starterSet, sessionKey,
    isConnected: true,
    mana: 40,
    hand,            // monster instances
    position: 0,
    healCount: 0,
    destroyedCount: 0,
    elementChangeCount: 0,
    lastDiceRoll: null,
    // stat trackers
    battlesWon: 0,
    battlesLost: 0,
    peakTiles: 0,
    totalManaEarned: 40, // starts with initial 40
  };
}

function log(text) {
  if (!G) return;
  G.events.unshift({ text, ts: Date.now() });
  if (G.events.length > 40) G.events.pop();
}

// ─── SPECIAL CONDITION CHECKS ─────────────────────────────────────────────────

function canUseSpecial(playerIdx, monster) {
  if (!monster.isSpecial) return true;
  const p = G.players[playerIdx];
  switch (monster.condition) {
    case 'healed4':       return p.healCount >= 4;
    case 'moreManaThanAll': {
      const others = G.players.filter((_,i) => i !== playerIdx);
      return others.length === 0 || p.mana > Math.max(...others.map(o => o.mana));
    }
    case 'changed3':      return p.elementChangeCount >= 3;
    case 'lost4':         return p.destroyedCount >= 4;
    case 'mostMonsters': {
      const counts = G.players.map(pl =>
        G.board.filter(t => t.ownerId === pl.idx && t.monsterId).length
      );
      return counts[playerIdx] > 0 && counts[playerIdx] === Math.max(...counts);
    }
    case 'own4Nature': {
      const natureTiles = G.board.filter(t => t.ownerId === playerIdx && t.element === 'Nature').length;
      return natureTiles >= 4;
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
  }
  if (bonusRun) {
    dmg = Math.round(dmg * 1.20);
    log(`🔥 Tile Synergy! ${attacker.name} strikes for +20% damage`);
  }
  if (monoBuff) {
    dmg = Math.round(dmg * 1.20);
    log(`⭐ Mono-Element Mastery! ${attacker.name} strikes for +20% damage`);
  }
  return Math.max(1, dmg);
}

// Returns { attackerHp, defenderHp, atkDmg, defDmg, outcome }
// outcome: 'attacker_wins' | 'defender_wins' | 'mutual' | 'stalemate'
function resolveBattle(attackerM, defenderM, tile) {
  const nullify = (attackerM.isSpecial && attackerM.id === 'arcane_arbiter')
               || (defenderM.isSpecial  && defenderM.id  === 'arcane_arbiter');

  const atkDmg = doStrike(attackerM, defenderM, tile, nullify);
  defenderM.hp -= atkDmg;

  // Last Rite check for defender
  if (defenderM.hp <= 0 && defenderM.id === 'demon_lord' && !defenderM.lastRiteUsed) {
    defenderM.hp = 15;
    defenderM.lastRiteUsed = true;
    log('💀 Last Rite triggers! Demon Lord survives at 15 HP!');
  }

  let defDmg = 0;
  if (defenderM.hp > 0) {
    const defBonus = bonusTileSet().has(tile.pos);
    const defMonoBuff = monoElementPlayerSet().has(tile.ownerId);
    defDmg = doStrike(defenderM, attackerM, tile, nullify, defBonus, defMonoBuff);
    attackerM.hp -= defDmg;
    if (attackerM.hp <= 0 && attackerM.id === 'demon_lord' && !attackerM.lastRiteUsed) {
      attackerM.hp = 15;
      attackerM.lastRiteUsed = true;
      log('💀 Last Rite triggers! Demon Lord survives at 15 HP!');
    }
  }

  let outcome;
  if (attackerM.hp <= 0 && defenderM.hp <= 0) outcome = 'mutual';
  else if (attackerM.hp <= 0) outcome = 'defender_wins';
  else if (defenderM.hp <= 0) outcome = 'attacker_wins';
  else outcome = 'stalemate';

  return { atkDmg, defDmg, outcome };
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
    if (!t0.monsterInstance || t0.monsterInstance.type !== t0.element) continue;
    if (!t1.monsterInstance || t1.monsterInstance.type !== t1.element) continue;
    if (!t2.monsterInstance || t2.monsterInstance.type !== t2.element) continue;
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
// A player qualifies if ALL of the following share exactly one element:
//   • every monster in their hand (dual-type rares disqualify)
//   • every monster stationed on the board by them (dual-type rares disqualify)
//   • every elemental tile they own
// Must own at least 1 elemental tile AND have at least 1 monster (hand or stationed).
function getMonoElementBonus() {
  if (!G || !G.board || !G.players) return [];
  const result = [];
  for (const p of G.players) {
    // Gather element tags; null = dual-type (instant disqualify)
    const tags = [];
    for (const m of p.hand) {
      tags.push(m.type2 ? null : m.type);
    }
    for (const t of G.board) {
      if (t.ownerId !== p.idx || !t.monsterInstance) continue;
      const mi = t.monsterInstance;
      tags.push(mi.type2 ? null : mi.type);
    }
    const ownedElemTiles = G.board.filter(t => t.ownerId === p.idx && t.kind === 'element');
    // Must have at least 1 elemental tile AND at least 1 monster
    if (ownedElemTiles.length === 0 || tags.length === 0) continue;
    // Dual-type disqualifies
    if (tags.includes(null)) continue;
    // All tile elements must match
    for (const t of ownedElemTiles) tags.push(t.element);
    const unique = new Set(tags);
    if (unique.size !== 1) continue;
    result.push({ playerIdx: p.idx, element: [...unique][0] });
  }
  return result;
}

// Set of playerIdx values currently holding Mono-Element Mastery
function monoElementPlayerSet() {
  const s = new Set();
  for (const r of getMonoElementBonus()) s.add(r.playerIdx);
  return s;
}

// ─── PASSIVE INCOME / SPECIALS ────────────────────────────────────────────────

function collectPassiveIncome(playerIdx) {
  const p = G.players[playerIdx];
  let earned = 5; // baseline

  for (const tile of G.board) {
    if (tile.ownerId !== playerIdx || !tile.monsterId) continue;
    const m = p.hand.find(h => h.iid === tile.monsterId)
           || G.board.reduce((acc, t) => acc, null); // stationed monster is on the board, not in hand

    // stationed monsters are stored separately in tile.monsterInstance
    const mi = tile.monsterInstance;
    if (!mi) continue;
    let gen = mi.gen;
    // World Tree special
    if (mi.id === 'world_tree') {
      const natureTiles = G.board.filter(t => t.ownerId === playerIdx && t.element === 'Nature').length;
      gen += natureTiles;
    }
    earned += gen;
  }

  // Ardent Saint passive — heal all friendly stationed monsters 5 HP/turn
  for (const tile of G.board) {
    if (tile.ownerId !== playerIdx) continue;
    const mi = tile.monsterInstance;
    if (mi && mi.id === 'ardent_saint') {
      for (const t2 of G.board) {
        if (t2.ownerId === playerIdx && t2.monsterInstance && t2 !== tile) {
          t2.monsterInstance.hp = Math.min(t2.monsterInstance.maxHp, t2.monsterInstance.hp + 5);
        }
      }
    }
  }

  // Consecutive tile bonus — heal +1 HP to each monster in a qualifying run
  const bonusRuns = getBonusRuns();
  const healedThisTurn = new Set();
  for (const run of bonusRuns) {
    if (run.playerIdx !== playerIdx) continue;
    for (const tPos of run.tiles) {
      if (healedThisTurn.has(tPos)) continue;
      healedThisTurn.add(tPos);
      const bt = G.board[tPos];
      if (bt && bt.monsterInstance) {
        bt.monsterInstance.hp = Math.min(bt.monsterInstance.maxHp, bt.monsterInstance.hp + 1);
      }
    }
  }
  if (healedThisTurn.size > 0) {
    log(`🔥 ${p.name}'s Tile Synergy heals ${healedThisTurn.size} monster${healedThisTurn.size > 1 ? 's' : ''} +1 HP`);
  }

  // Mono-Element Mastery — heal all stationed monsters +1 HP if player qualifies
  const monoBonus = getMonoElementBonus().find(r => r.playerIdx === playerIdx);
  if (monoBonus) {
    let monoHealCount = 0;
    for (const t of G.board) {
      if (t.ownerId !== playerIdx || !t.monsterInstance) continue;
      t.monsterInstance.hp = Math.min(t.monsterInstance.maxHp, t.monsterInstance.hp + 1);
      monoHealCount++;
    }
    if (monoHealCount > 0) {
      log(`⭐ ${p.name}'s Mono-Element Mastery (${monoBonus.element}) heals ${monoHealCount} monster${monoHealCount > 1 ? 's' : ''} +1 HP`);
    }
  }

  const MANA_SOFT_CAP = 150;
  if (p.mana >= MANA_SOFT_CAP) {
    earned = Math.max(5, Math.floor(earned * 0.5)); // still earn baseline but halved above cap
  }
  p.mana += earned;
  if (p.mana > MANA_SOFT_CAP && p.mana - earned < MANA_SOFT_CAP) {
    log(`⚠️ ${p.name} is over the ${MANA_SOFT_CAP}✦ soft cap — income reduced`);
  }
  log(`✦ ${p.name} earns ${earned} Mana (now ${p.mana})`);
}

function countStationedMonsters(playerIdx) {
  return G.board.filter(t => t.ownerId === playerIdx && t.monsterInstance).length;
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

function publicState() {
  // Safe copy of board (monsterInstance as summary)
  const board = G.board.map(t => {
    const ti = { ...t };
    if (t.monsterInstance) {
      const m = t.monsterInstance;
      ti.monster = { iid:m.iid, id:m.id, name:m.name, type:m.type,
                     hp:m.hp, maxHp:m.maxHp, atk:m.atk, def:m.def,
                     cost:m.cost, gen:m.gen, isSpecial:m.isSpecial, charm:m.charm };
    } else {
      ti.monster = null;
    }
    delete ti.monsterInstance;
    return ti;
  });

  const players = G.players.map(p => ({
    idx: p.idx, name: p.name, color: p.color, starterSet: p.starterSet,
    mana: p.mana, position: p.position,
    handSize: p.hand.length,
    tileCount: G.board.filter(t => t.ownerId === p.idx).length,
    stationedCount: countStationedMonsters(p.idx),
    healCount: p.healCount,
    destroyedCount: p.destroyedCount,
    elementChangeCount: p.elementChangeCount,
    lastDiceRoll: p.lastDiceRoll,
    battlesWon: p.battlesWon,
    battlesLost: p.battlesLost,
    peakTiles: p.peakTiles,
    totalManaEarned: p.totalManaEarned,
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
      offers: G.pendingTemple.offers.map(m => ({
        iid:m.iid, id:m.id, name:m.name, type:m.type,
        hp:m.hp, maxHp:m.maxHp, atk:m.atk, def:m.def,
        cost:m.cost, gen:m.gen, isSpecial:true, charm:false,
        special:m.special, specialDesc:m.specialDesc,
        condition:m.condition, conditionDesc:m.conditionDesc
      }))
    } : null,
    shopOffers: G.shopOffers.map(m => ({
      iid:m.iid, id:m.id, name:m.name, type:m.type,
      hp:m.hp, maxHp:m.maxHp, atk:m.atk, def:m.def,
      cost:m.cost, gen:m.gen, isSpecial:false, charm:false
    })),
    lastBattle: G.lastBattle || null,
    pendingAttackerMonster: G.pendingAttackerMonster || null,
    pausedFor: G.pausedFor || null,
    setupRound: G.setupRound || 1,
    setupTurnIdx: G.setupTurnIdx || 0,
    setupTotalTurns: G.setupTotalTurns || 0,
    bonusRuns: getBonusRuns(),
    monoElementBonus: getMonoElementBonus(),
    serverVersion: SERVER_VERSION,
  };
}

// broadcast() and sendError() are defined later in the server section,
// after the clients Map is set up.

// ─── TURN MANAGEMENT ─────────────────────────────────────────────────────────

function startShopPhase() {
  const p = G.players[G.currentPlayer];
  p.lastDiceRoll = null;  // reset so stale roll values don't trigger false animations
  G.lastBattle = null;    // clear battle result so it doesn't persist across turns
  G.pendingAttackerMonster = null; // clear attacker preview
  // Round 1 grace period — monsters placed during setup shouldn't immediately earn;
  // mana generation starts from round 2 onward (turnCount >= playerCount)
  if (G.turnCount >= G.players.length) {
    collectPassiveIncome(G.currentPlayer);
  } else {
    log(`⏳ ${G.players[G.currentPlayer].name} — income starts Round 2`);
  }
  G.shopOffers = pickShopOffers(); // always generate offers (needed for stalemate buy option too)

  // Stalemate check — if this player has a pending stalemate, skip normal shop/roll
  // and go straight to stalemate resolution with buy/sell/attack options
  if (G.stalemateData && G.stalemateData.attackerIdx === G.currentPlayer) {
    G.phase = 'stalemate';
    console.log(`[SG] *** STALEMATE PHASE for player ${G.currentPlayer} (${p.name}) on tile ${G.stalemateData.tilePos} ***`);
    log(`⚔️ ${p.name} must resolve the stalemate on tile ${G.stalemateData.tilePos}`);
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
  // Auto-advance players who have no monsters left — nothing they can do but pass
  if (cp && cp.hand.length === 0) {
    log(`⏭ ${cp.name} has no monsters — auto-pass (round ${G.setupRound})`);
    advanceSetupTurn();
    return;
  }
  log(`🌟 Setup round ${G.setupRound} — ${cp ? cp.name : '?'}'s turn (turn ${G.setupTurnIdx + 1}/${G.setupTotalTurns})`);
  broadcast();
}

function advanceTurn() {
  G.turnCount++;
  if (G.turnCount >= G.roundLimit * G.players.length) {
    endGame();
    return;
  }
  G.currentPlayer = (G.currentPlayer + 1) % G.players.length;
  // Only clear stalemateData when the stalemate player has actually resolved it.
  // If the incoming current player isn't the stalemate attacker, keep it alive so
  // startShopPhase can detect it when we cycle back around to them.
  if (G.stalemateData && G.stalemateData.attackerIdx === G.currentPlayer) {
    // This is the stalemate player's resolution turn — stalemateData stays until
    // startShopPhase routes them into the stalemate phase and they act on it.
  } else if (!G.stalemateData) {
    // nothing to do
  }
  startShopPhase();
}

function endGame() {
  G.phase = 'game_over';
  // Compute final tile counts
  const finalTiles = p => G.board.filter(t => t.ownerId === p.idx).length;
  const ranked = [...G.players].sort((a, b) => {
    const ta = finalTiles(a), tb = finalTiles(b);
    if (tb !== ta) return tb - ta;
    return b.mana - a.mana;
  });
  log(`🏆 Game over! Winner: ${ranked[0].name}!`);
  G.rankings = ranked.map(p => ({
    idx: p.idx, name: p.name, color: p.color,
    tiles: finalTiles(p),
    mana: p.mana,
    battlesWon: p.battlesWon,
    battlesLost: p.battlesLost,
    peakTiles: p.peakTiles,
    totalManaEarned: p.totalManaEarned,
    monstersLost: p.destroyedCount,
    handSize: p.hand.length,
  }));
  broadcast();
}

function resolveRoll(playerIdx) {
  const p = G.players[playerIdx];
  const roll = rand(1, 6) + rand(1, 6);
  p.lastDiceRoll = roll;
  const oldPos = p.position;
  const newPos = (oldPos + roll) % 28;
  p.position = newPos;

  // Check for Mana Well passes (but not landing — landing is handled separately)
  if (newPos !== 0 && oldPos + roll >= 28) {
    p.mana += 10;
    log(`✦ ${p.name} passed Mana Well: +10 Mana`);
  }

  log(`🎲 ${p.name} rolled ${roll} → tile ${newPos}`);

  const tile = G.board[newPos];

  if (tile.kind === 'start') {
    p.mana += 10;
    log(`✦ ${p.name} landed on Mana Well: +10 Mana`);
    G.phase = 'roll';
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
    // Immediately add the free monster to hand (if room); snapshot it for display
    if (reward.kind === 'free_monster') {
      if (p.hand.length < 5) {
        const freeM = makeMonster(NORMALS[rand(0, NORMALS.length - 1)].id);
        p.hand.push(freeM);
        G.pendingChest.monster = { iid:freeM.iid, id:freeM.id, name:freeM.name, type:freeM.type,
          hp:freeM.hp, maxHp:freeM.maxHp, atk:freeM.atk, def:freeM.def,
          cost:freeM.cost, gen:freeM.gen, isSpecial:freeM.isSpecial||false, charm:freeM.charm||false };
        log(`🎁 ${p.name} got free monster: ${freeM.name}`);
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
    // Empty — player can claim if they have a monster
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

  join(ws, conn, data) {
    const code = String(data.roomCode || '').toUpperCase().trim();
    const name  = String(data.name  || 'Player').slice(0, 18);

    // Look up room by code; fall back to first lobby room if only one exists
    let room = rooms.get(code);
    if (!room && !code && rooms.size === 1) {
      room = [...rooms.values()][0];
    }
    if (!room) return sendError(ws, 'Room not found — ask the host for the room code');

    G = room;
    conn.roomCode = room.roomCode;

    // During active game: allow name-based manual rejoin for disconnected players
    if (G.phase !== 'lobby') {
      const disc = G.players.find(p => !p.isConnected && p.name.toLowerCase() === name.toLowerCase());
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

    if (G.players.length >= 6) return sendError(ws, 'Game full (max 6 players)');
    const set   = ['A','B','C','D','E','F'].includes(data.starterSet) ? data.starterSet : 'C';
    const color = PLAYER_COLORS[G.players.length];
    const p = addPlayer(name, color, set);
    G.players.push(p);
    conn.playerIdx = p.idx;
    conn.sessionKey = p.sessionKey;
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
    if (![30, 40, 60].includes(limit)) return sendError(ws, 'Invalid round limit');
    G.roundLimit = limit;
    log(`⏱ Round limit set to ${limit} rounds per player`);
    broadcast();
  },

  start_game(ws, conn, data) {
    if (!G || G.phase !== 'lobby') return sendError(ws, 'Not in lobby');
    if (G.players.length < 2) return sendError(ws, 'Need at least 2 players');
    if (data && data.roundLimit && [30,40,60].includes(Number(data.roundLimit))) {
      G.roundLimit = Number(data.roundLimit);
    }
    log(`🎮 Game started! ${G.roundLimit} rounds per player`);
    startSetupPhase();
  },

  end_game(ws, conn, data) {
    if (!G) return;
    const code = G.roomCode;
    log(`🔄 Game ended by host — returning to lobby`);
    G = freshGame(code);
    rooms.set(code, G);
    broadcast();
  },

  new_game(ws, conn, data) {
    if (!G) return;
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

  // ── Shop ───────────────────────────────────────────────────────────────────

  buy(ws, conn, data) {
    if (G.phase !== 'shop') return sendError(ws, 'Not shop phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    if (p.hand.length >= 5) return sendError(ws, 'Hand full');
    const offer = G.shopOffers.find(o => o.iid === data.iid);
    if (!offer) return sendError(ws, 'Invalid offer');
    if (p.mana < offer.cost) return sendError(ws, 'Not enough Mana');
    p.mana -= offer.cost;
    const m = makeMonster(offer.id);
    p.hand.push(m);
    G.shopOffers = G.shopOffers.filter(o => o.iid !== offer.iid);
    log(`🛒 ${p.name} bought ${m.name} (−${m.cost}✦)`);
    G.phase = 'roll';
    broadcast();
  },

  sell(ws, conn, data) {
    if (G.phase !== 'shop') return sendError(ws, 'Not shop phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    const idx = p.hand.findIndex(m => m.iid === data.iid);
    if (idx === -1) return sendError(ws, 'Monster not in hand');
    const m = p.hand[idx];
    const refund = Math.floor(m.cost * (m.hp / m.maxHp));
    p.hand.splice(idx, 1);
    p.mana += refund;
    log(`💰 ${p.name} sold ${m.name} for ${refund}✦`);
    G.phase = 'roll';
    broadcast();
  },

  skip_shop(ws, conn, data) {
    if (G.phase !== 'shop') return sendError(ws, 'Not shop phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    G.phase = 'roll';
    broadcast();
  },

  // ── Stalemate ──────────────────────────────────────────────────────────────

  // Player chooses to fight — enters normal resolve:battle so they pick attacker via select_attacker/attack
  stalemate_fight(ws, conn, data) {
    if (G.phase !== 'stalemate') return sendError(ws, 'Not stalemate phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    if (!p.hand || p.hand.length === 0) return sendError(ws, 'No monsters in hand');
    const sd = G.stalemateData;
    // Verify the tile is still contested (defender's monster still there)
    const tile = G.board[sd.tilePos];
    if (!tile || !tile.monsterInstance) {
      // Defender monster gone somehow — just clear and advance
      G.stalemateData = null;
      advanceTurn();
      return;
    }
    G.stalemateData = null;
    G.pendingAttackerMonster = null;
    G.phase = 'resolve:battle';
    log(`⚔️ ${p.name} chooses to battle again on tile ${sd.tilePos}!`);
    broadcast();
  },

  // Player retreats from stalemate — pays 8 Mana, skips rolling, goes straight to shop
  stalemate_continue(ws, conn, data) {
    if (G.phase !== 'stalemate') return sendError(ws, 'Not stalemate phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    const RETREAT_COST = 8;
    const paid = Math.min(p.mana, RETREAT_COST);
    p.mana -= paid;
    G.stalemateData = null;
    // Jump straight to shop (passive income already collected at turn start)
    G.phase = 'shop';
    log(`🚶 ${p.name} retreats from stalemate${paid > 0 ? ` — paid ${paid}✦` : ''}`);
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
    if (G.phase !== 'setup') return sendError(ws, 'Not setup phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    const tilePos = parseInt(data.tilePos, 10);
    if (isNaN(tilePos) || tilePos < 0 || tilePos >= 28) return sendError(ws, 'Invalid tile number (0–27)');
    const tile = G.board[tilePos];
    if (!tile) return sendError(ws, 'Invalid tile');
    if (tile.kind !== 'element') return sendError(ws, 'Can only claim elemental tiles during setup');
    if (tile.ownerId !== null && tile.ownerId !== undefined) return sendError(ws, 'Tile already claimed');
    const m = p.hand.find(h => h.iid === data.iid);
    if (!m) return sendError(ws, 'Monster not in hand');
    // Free claim — no mana cost
    p.hand.splice(p.hand.indexOf(m), 1);
    tile.ownerId = G.currentPlayer;
    tile.monsterId = m.iid;
    tile.monsterInstance = m;
    _updatePeakTiles(G.currentPlayer);
    log(`🌟 ${p.name} claimed tile ${tilePos} (${tile.element}) with ${m.name} [Setup]`);
    advanceSetupTurn();
  },

  setup_pass(ws, conn, data) {
    if (G.phase !== 'setup') return sendError(ws, 'Not setup phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    log(`⏭ ${G.players[G.currentPlayer].name} passed setup turn`);
    advanceSetupTurn();
  },

  // ── Roll ───────────────────────────────────────────────────────────────────

  roll(ws, conn, data) {
    if (G.phase !== 'roll') return sendError(ws, 'Not roll phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    resolveRoll(G.currentPlayer);
  },

  // ── Claim empty tile ───────────────────────────────────────────────────────

  claim(ws, conn, data) {
    if (G.phase !== 'resolve:claim') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    const m = p.hand.find(h => h.iid === data.iid);
    if (!m) return sendError(ws, 'Monster not in hand');
    if (!canUseSpecial(G.currentPlayer, m)) return sendError(ws, 'Special condition not met');
    if (p.mana < m.cost) return sendError(ws, 'Not enough Mana');
    p.mana -= m.cost;
    const mIdx = p.hand.indexOf(m);
    p.hand.splice(mIdx, 1);
    tile.ownerId = G.currentPlayer;
    tile.monsterId = m.iid;
    tile.monsterInstance = m;
    log(`🚩 ${p.name} claimed tile ${p.position} with ${m.name}`);

    // Red Dragon Intimidate
    if (m.id === 'red_dragon') {
      const neighbors = [(p.position + 1) % 28, (p.position + 27) % 28];
      for (const n of neighbors) {
        const nt = G.board[n];
        if (nt.ownerId !== null && nt.ownerId !== G.currentPlayer) {
          const op = G.players[nt.ownerId];
          const loss = Math.min(op.mana, 5);
          op.mana -= loss;
          log(`🐉 Intimidate! ${op.name} pays ${loss}✦`);
        }
      }
    }

    advanceTurn();
  },

  skip_claim(ws, conn, data) {
    if (G.phase !== 'resolve:claim') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    advanceTurn();
  },

  // ── Battle ─────────────────────────────────────────────────────────────────

  attack(ws, conn, data) {
    if (G.phase !== 'resolve:battle') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    const defOwner = G.players[tile.ownerId];
    const defM = tile.monsterInstance;
    if (!defM) return sendError(ws, 'No defender on tile');
    const attM = p.hand.find(m => m.iid === data.iid);
    if (!attM) return sendError(ws, 'Monster not in hand');
    if (!canUseSpecial(G.currentPlayer, attM)) return sendError(ws, 'Special condition not met');

    const { atkDmg, defDmg, outcome } = resolveBattle(attM, defM, tile);
    log(`⚔️ ${p.name}(${attM.name}) attacks ${defOwner.name}(${defM.name}) on tile ${p.position}`);
    log(`   ATK dealt ${atkDmg}, DEF struck back ${defDmg} — ${outcome}`);

    // snapshot both monsters before _applyBattleOutcome mutates them
    G.lastBattle = {
      attackerIdx: G.currentPlayer,
      defOwnerIdx: tile.ownerId,
      attM: { name:attM.name, type:attM.type, atk:attM.atk, def:attM.def, id:attM.id, isSpecial:attM.isSpecial||false, hp:attM.hp, maxHp:attM.maxHp },
      defM: { name:defM.name, type:defM.type, atk:defM.atk, def:defM.def, id:defM.id, isSpecial:defM.isSpecial||false, hp:defM.hp, maxHp:defM.maxHp },
      atkDmg, defDmg, outcome
    };
    _applyBattleOutcome(outcome, p, attM, defOwner, defM, tile, p.position);
    G.pendingAttackerMonster = null;
    // Track stalemate — resolved on this player's next turn
    if (outcome === 'stalemate') {
      G.stalemateData = { attackerIdx: G.currentPlayer, tilePos: p.position };
    }
    G.phase = 'resolve:battle_result';
    broadcast();
    scheduleRoomAction(G.roomCode, advanceTurn, 3500);
  },

  // Preview which attacker the player is hovering — broadcasts to board in real-time
  preview_attacker(ws, conn, data) {
    if (G.phase !== 'resolve:battle') return;
    if (conn.playerIdx !== G.currentPlayer) return;
    const p = G.players[G.currentPlayer];
    if (data.iid == null) {
      G.pendingAttackerMonster = null;
    } else {
      const m = p.hand.find(m => m.iid === data.iid);
      if (m) G.pendingAttackerMonster = { iid:m.iid, id:m.id, name:m.name, type:m.type,
        hp:m.hp, maxHp:m.maxHp, atk:m.atk, def:m.def, cost:m.cost, gen:m.gen,
        isSpecial:m.isSpecial||false, charm:m.charm||false };
    }
    broadcast();
  },

  retreat(ws, conn, data) {
    if (G.phase !== 'resolve:battle') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    const penalty = Math.min(p.mana, MANA_PENALTY);
    p.mana -= penalty;
    log(`🏃 ${p.name} retreated — paid ${penalty}✦ penalty`);
    G.pendingAttackerMonster = null;
    advanceTurn();
  },

  // ── Own tile ───────────────────────────────────────────────────────────────

  swap(ws, conn, data) {
    if (G.phase !== 'resolve:own') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    if (p.hand.length >= 5) return sendError(ws, 'Hand full — cannot swap');
    const tile = G.board[p.position];
    const oldM = tile.monsterInstance;
    const newM = p.hand.find(m => m.iid === data.newMonsterIid);
    if (!newM) return sendError(ws, 'Monster not in hand');
    if (!canUseSpecial(G.currentPlayer, newM)) return sendError(ws, 'Special condition not met');
    // Cost to deploy new monster
    if (p.mana < newM.cost) return sendError(ws, 'Not enough Mana');
    p.mana -= newM.cost;
    const idx = p.hand.indexOf(newM);
    p.hand.splice(idx, 1);
    if (oldM) p.hand.push(oldM);
    tile.monsterInstance = newM;
    tile.monsterId = newM.iid;
    log(`🔄 ${p.name} swapped ${oldM ? oldM.name : 'empty'} → ${newM.name} on tile ${p.position}`);
    advanceTurn();
  },

  heal_stationed(ws, conn, data) {
    if (G.phase !== 'resolve:own') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    const m = tile.monsterInstance;
    if (!m) return sendError(ws, 'No monster to heal');
    const missing = m.maxHp - m.hp;
    if (missing <= 0) return sendError(ws, 'Already at full HP');
    const cost = Math.ceil(HEAL_COST_PER_HP * missing);
    if (p.mana < cost) return sendError(ws, `Need ${cost}✦ to heal fully — not enough Mana`);
    p.mana -= cost;
    m.hp = m.maxHp;
    p.healCount++;
    log(`💚 ${p.name} healed ${m.name} to full (−${cost}✦)`);
    advanceTurn();
  },

  heal_partial(ws, conn, data) {
    if (G.phase !== 'resolve:own') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    const m = tile.monsterInstance;
    if (!m) return sendError(ws, 'No monster to heal');
    const amount = Math.min(Math.max(0, parseInt(data.amount) || 0), m.maxHp - m.hp);
    const cost = Math.ceil(HEAL_COST_PER_HP * amount);
    if (p.mana < cost) return sendError(ws, 'Not enough Mana');
    p.mana -= cost;
    m.hp += amount;
    p.healCount++;
    log(`💚 ${p.name} healed ${m.name} for ${amount} HP (−${cost}✦)`);
    advanceTurn();
  },

  change_element(ws, conn, data) {
    if (G.phase !== 'resolve:own') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    if (p.mana < CHANGE_ELEMENT_COST) return sendError(ws, `Need ${CHANGE_ELEMENT_COST}✦`);
    if (!TYPES.includes(data.element)) return sendError(ws, 'Invalid element');
    const tile = G.board[p.position];
    const old = tile.element;
    tile.element = data.element;
    tile.label = data.element;
    p.mana -= CHANGE_ELEMENT_COST;
    p.elementChangeCount++;
    log(`🌀 ${p.name} changed tile ${p.position}: ${old} → ${data.element} (−${CHANGE_ELEMENT_COST}✦)`);
    advanceTurn();
  },

  skip_own(ws, conn, data) {
    if (G.phase !== 'resolve:own') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    advanceTurn();
  },

  // ── Temple ─────────────────────────────────────────────────────────────────

  temple_trade(ws, conn, data) {
    if (G.phase !== 'resolve:temple') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
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
    const gained = makeMonster(special.id);
    p.hand.push(gained);
    log(`🏛 ${p.name} traded ${sacrifice.name} for ${gained.name}!`);
    G.pendingTemple = null;
    advanceTurn();
  },

  temple_leave(ws, conn, data) {
    if (G.phase !== 'resolve:temple') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    G.pendingTemple = null;
    log(`${G.players[G.currentPlayer].name} left the Temple`);
    advanceTurn();
  },

  // ── Heal tile ──────────────────────────────────────────────────────────────

  heal_tile_apply(ws, conn, data) {
    if (G.phase !== 'resolve:heal_tile') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    const p = G.players[G.currentPlayer];
    // data.tilePos = tile where the stationed monster is
    const tile = G.board[data.tilePos];
    if (!tile || tile.ownerId !== G.currentPlayer) return sendError(ws, 'Not your tile');
    const m = tile.monsterInstance;
    if (!m) return sendError(ws, 'No monster on that tile');
    const missing = m.maxHp - m.hp;
    if (missing <= 0) return sendError(ws, 'Already at full HP');
    const maxAfford = Math.floor(p.mana / HEAL_COST_PER_HP);
    const amount = Math.min(missing, maxAfford);
    const cost = Math.ceil(HEAL_COST_PER_HP * amount);
    p.mana -= cost;
    m.hp += amount;
    p.healCount++;
    log(`💚 ${p.name} healed ${m.name} for ${amount} HP at Healing tile (−${cost}✦)`);
    G.phase = 'resolve:heal_tile'; // stays for UI, cleared on skip
    broadcast();
    scheduleRoomAction(G.roomCode, advanceTurn, 800);
  },

  heal_tile_skip(ws, conn, data) {
    if (G.phase !== 'resolve:heal_tile') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    advanceTurn();
  },

  // ── Chest ──────────────────────────────────────────────────────────────────

  chest_apply_potion(ws, conn, data) {
    if (G.phase !== 'resolve:chest') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    if (!G.pendingChest || G.pendingChest.kind !== 'potion') return sendError(ws, 'No potion');
    const p = G.players[G.currentPlayer];
    const tile = G.board[data.tilePos];
    if (!tile || tile.ownerId !== G.currentPlayer) return sendError(ws, 'Not your tile');
    const m = tile.monsterInstance;
    if (!m) return sendError(ws, 'No monster there');
    const chest = G.pendingChest;
    let healed = 0;
    const missing = m.maxHp - m.hp;
    if (chest.tier === 'Minor')  healed = Math.min(missing, 15);
    else if (chest.tier === 'Major') healed = Math.floor(missing * 0.5);
    else healed = missing;
    m.hp += healed;
    p.healCount++;
    log(`🧪 ${chest.tier} Potion healed ${m.name} for ${healed} HP`);
    G.pendingChest = null;
    advanceTurn();
  },

  chest_assign_charm(ws, conn, data) {
    if (G.phase !== 'resolve:chest') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    if (!G.pendingChest || G.pendingChest.kind !== 'charm') return sendError(ws, 'No charm');
    const p = G.players[G.currentPlayer];
    // data.iid = hand monster, data.tilePos = stationed monster's tile
    let m = p.hand.find(h => h.iid === data.iid);
    if (!m && data.tilePos !== undefined) {
      const tile = G.board[data.tilePos];
      if (tile && tile.ownerId === G.currentPlayer) m = tile.monsterInstance;
    }
    if (!m) return sendError(ws, 'No monster selected');
    if (m.charm) return sendError(ws, 'Already has a charm');
    m.charm = true;
    log(`⚡ Battle Charm assigned to ${m.name}`);
    G.pendingChest = null;
    advanceTurn();
  },

  chest_warp(ws, conn, data) {
    if (G.phase !== 'resolve:chest') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
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
    if (G.phase !== 'resolve:chest') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    G.pendingChest = null;
    log(`${G.players[G.currentPlayer].name} skipped chest reward`);
    advanceTurn();
  },

  chest_skip(ws, conn, data) {
    if (G.phase !== 'resolve:chest') return sendError(ws, 'Wrong phase');
    if (conn.playerIdx !== G.currentPlayer) return sendError(ws, 'Not your turn');
    G.pendingChest = null;
    advanceTurn();
  },

};

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

function _updatePeakTiles(playerIdx) {
  const p = G.players[playerIdx];
  if (!p) return;
  const cur = G.board.filter(t => t.ownerId === playerIdx).length;
  if (cur > p.peakTiles) p.peakTiles = cur;
}

function _applyBattleOutcome(outcome, attPlayer, attM, defPlayer, defM, tile, tilePos) {
  if (outcome === 'attacker_wins') {
    // Remove attacker from hand, place on tile
    attPlayer.hand = attPlayer.hand.filter(m => m.iid !== attM.iid);
    tile.ownerId = attPlayer.idx;
    tile.monsterId = attM.iid;
    tile.monsterInstance = attM;
    // Stats
    attPlayer.battlesWon++;
    defPlayer.battlesLost++;
    defPlayer.destroyedCount++;
    _updatePeakTiles(attPlayer.idx);
    log(`🏆 ${attPlayer.name} wins! ${defM.name} destroyed, ${tile.pos} claimed`);
    // Succubus
    if (attM.id === 'succubus') {
      const stolen = Math.min(defPlayer.mana, 10);
      defPlayer.mana -= stolen;
      attPlayer.mana += stolen;
      log(`🧛 Mana Drain: ${attPlayer.name} steals ${stolen}✦ from ${defPlayer.name}`);
    }
    // Red Dragon Intimidate on battle-win claim
    if (attM.id === 'red_dragon') {
      const neighbors = [(tilePos + 1) % 28, (tilePos + 27) % 28];
      for (const n of neighbors) {
        const nt = G.board[n];
        if (nt.ownerId !== null && nt.ownerId !== attPlayer.idx) {
          const op = G.players[nt.ownerId];
          const loss = Math.min(op.mana, 5);
          op.mana -= loss;
          log(`🐉 Intimidate! ${op.name} pays ${loss}✦`);
        }
      }
    }
  } else if (outcome === 'defender_wins') {
    attPlayer.hand = attPlayer.hand.filter(m => m.iid !== attM.iid);
    attPlayer.battlesLost++;
    defPlayer.battlesWon++;
    attPlayer.destroyedCount++;
    log(`🛡️ ${defPlayer.name} defends! ${attM.name} destroyed`);
  } else if (outcome === 'mutual') {
    attPlayer.hand = attPlayer.hand.filter(m => m.iid !== attM.iid);
    attPlayer.battlesLost++;
    defPlayer.battlesLost++;
    attPlayer.destroyedCount++;
    defPlayer.destroyedCount++;
    tile.ownerId = null;
    tile.monsterId = null;
    tile.monsterInstance = null;
    log(`💥 Mutual destruction! Tile ${tilePos} unclaimed`);
  } else if (outcome === 'stalemate') {
    log(`🤝 Stalemate! Both survive`);
  }
}

// Handle warp landing — same as resolveRoll but position already set
function resolveRoll_fromPos(playerIdx, pos) {
  const p = G.players[playerIdx];
  const tile = G.board[pos];
  if (!tile.ownerId && tile.ownerId !== 0) {
    G.phase = 'resolve:claim';
  } else if (tile.ownerId === playerIdx) {
    G.phase = 'resolve:own';
  } else {
    G.phase = 'resolve:battle';
  }
  broadcast();
}

// ─── PURE NODE.JS HTTP + WEBSOCKET SERVER ────────────────────────────────────
// No external deps — uses only built-in 'http', 'fs', 'path', 'crypto', 'os'

const fs     = require('fs');
const crypto = require('crypto');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
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
  const payload = Buffer.from(JSON.stringify(data));
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
  let urlPath = req.url.split('?')[0];

  // Health-check endpoint — used by Railway and other platforms to confirm the server is alive
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

  if (urlPath === '/' || urlPath === '') urlPath = '/board.html';
  if (urlPath === '/board')  urlPath = '/board.html';
  if (urlPath === '/player') urlPath = '/player.html';

  const filePath = path.join(PUBLIC, urlPath);
  // Security: ensure we stay within public/
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
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

// Redefine broadcast to work with raw sockets — only sends to clients in the current room
function broadcast(extra = {}) {
  if (!G) return;
  const roomCode = G.roomCode;
  const gs = publicState();
  for (const [socket, conn] of clients) {
    if (socket.destroyed) continue;
    if (conn.roomCode !== roomCode) continue;
    const msg = { type:'state', game: gs, ...extra };
    if (conn.playerIdx !== null && conn.playerIdx !== undefined) {
      const p = G && G.players[conn.playerIdx];
      if (p) {
        msg.myIdx = conn.playerIdx;
        msg.hand = p.hand.map(m => ({
          iid:m.iid, id:m.id, name:m.name, type:m.type,
          hp:m.hp, maxHp:m.maxHp, atk:m.atk, def:m.def,
          cost:m.cost, gen:m.gen, isSpecial:m.isSpecial, charm:m.charm,
          special:m.special||null, specialDesc:m.specialDesc||null,
          condition:m.condition||null, conditionDesc:m.conditionDesc||null,
          canUse: canUseSpecial(conn.playerIdx, m),
        }));
      }
    }
    wsSend(socket, msg);
  }
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => serveStatic(req, res));

server.on('upgrade', (req, socket, head) => {
  if (req.headers['upgrade'] !== 'websocket') { socket.destroy(); return; }
  if (!wsHandshake(socket, req)) return;

  const conn = { playerIdx: null, sessionKey: null, roomCode: null, isBoard: false, buf: Buffer.alloc(0) };
  clients.set(socket, conn);

  // Send a ready ping — client sends board_connect or join to get room state
  wsSend(socket, { type: 'ready', rooms: [...rooms.keys()] });

  socket.on('data', (chunk) => {
    conn.buf = Buffer.concat([conn.buf, chunk]);
    while (true) {
      const frame = wsParseFrame(conn.buf);
      if (!frame) break;
      conn.buf = conn.buf.slice(frame.consumed);

      if (frame.opcode === 0x8) { socket.destroy(); break; }  // close
      if (frame.opcode === 0x9) {
        // ping → pong
        const pong = Buffer.alloc(2); pong[0] = 0x8a; pong[1] = 0;
        try { socket.write(pong); } catch {}
        continue;
      }
      if (frame.opcode !== 0x1) continue; // only handle text frames

      let data;
      try { data = JSON.parse(frame.text); } catch { continue; }

      const action = data.action;
      if (!action || typeof action !== 'string') continue;
      const handler = handlers[action];
      if (!handler) { sendError(socket, 'Unknown action: ' + action); continue; }

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
      // In lobby: remove the player slot entirely
      G.players = G.players.filter(p => p.idx !== conn.playerIdx);
      G.players.forEach((p, i) => { p.idx = i; p.color = PLAYER_COLORS[i]; });
      for (const [sock, c] of clients) {
        if (c.sessionKey) {
          const pl = G.players.find(p => p.sessionKey === c.sessionKey);
          if (pl) c.playerIdx = pl.idx;
        }
      }
      broadcast();
    } else if (G.phase !== 'lobby' && conn.playerIdx !== null && conn.playerIdx !== undefined) {
      // In game: mark disconnected and pause
      const p = G.players[conn.playerIdx];
      if (p && p.isConnected) {
        p.isConnected = false;
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
  const ip = getLocalIp();
  console.log('');
  console.log('  ╔════════════════════════════════════════╗');
  console.log('  ║      Monster Board Game — Server       ║');
  console.log('  ╠════════════════════════════════════════╣');
  console.log(`  ║  Board view  →  http://${ip}:${PORT}/board  `);
  console.log(`  ║  Player view →  http://${ip}:${PORT}/player `);
  console.log('  ║  (share these URLs with players on     ║');
  console.log('  ║   the same WiFi network)               ║');
  console.log('  ╚════════════════════════════════════════╝');
  console.log('');
});
