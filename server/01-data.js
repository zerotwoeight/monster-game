// Summoner's Gambit server · 01-data.js · Monster data, starter sets, Wild Card pools, helpers
// Loaded in order by server.js (v1.0.139, L2 split). All parts share one global scope, like <script> tags.
'use strict';

const http = require('http');
const path = require('path');
const os   = require('os');

const PORT = process.env.PORT || 3000;
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
  // v1.0.141 HP buff: Succubus 45→65, Arcane Arbiter 40→60, Red Dragon 40→60; Rares Luminar 35→55, Hex Stalker 42→60, Verdant Sorcerer 30→55
  {id:'succubus',       type:'Dark',   name:'Succubus',       arch:'ascendant', hp:65, maxHp:65, atk:32, def:10, cost:20, gen:5, isSpecial:true,
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
  {id:'arcane_arbiter', type:'Arcane', name:'Arcane Arbiter', arch:'ascendant', hp:60, maxHp:60, atk:40, def:15, cost:20, gen:5, isSpecial:true,
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
  {id:'red_dragon',     type:'Beast',  name:'Red Dragon',     arch:'ascendant', hp:60, maxHp:60, atk:50, def:9,  cost:20, gen:5, isSpecial:true,
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
   hp:55, maxHp:55, atk:30, def:12, cost:26, gen:4, isSpecial:false,
   rareDesc:'2× vs Dark & Undead · No weaknesses'},
  {id:'hex_stalker',      type:'Undead', type2:'Beast',  name:'Hex Stalker',      arch:'rare', rarity:'rare',
   hp:60, maxHp:60, atk:30, def:11, cost:25, gen:3, isSpecial:false,
   rareDesc:'2× vs Arcane & Nature · No weaknesses'},
  {id:'verdant_sorcerer', type:'Arcane', type2:'Nature', name:'Verdant Sorcerer', arch:'rare', rarity:'rare',
   hp:55, maxHp:55, atk:30, def:12, cost:27, gen:4, isSpecial:false,
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
// v1.0.147: Iron tier 15✦ → 5✦ (doubles should always feel lucky)
const WILD_CARD_POOLS = {
  low: [
    { id:'mend',    name:'Mend',    cost:5, tier:'low',  target:'own_station', desc:'Heal one of your stationed summons for 20 HP' },
    { id:'stumble', name:'Stumble', cost:5, tier:'low',  target:'player',      desc:'Curse a target player — they skip their dice roll next turn and move exactly 3 spaces' },
    { id:'delay',   name:'Delay',   cost:5, tier:'low',  target:'player',      desc:'Force a target player to skip their shop phase next turn' },
    { id:'jinx',    name:'Jinx',    cost:5, tier:'low',  target:'player',      desc:"Target player's passive mana income next turn is halved" },
    // v1.0.150 — Wild Cards v2, batch 1
    { id:'levy',        name:'Levy',        cost:5, tier:'low', target:'player',        desc:"Target player's next shop buy costs +50%" },
    { id:'keen_edge',   name:'Keen Edge',   cost:5, tier:'low', target:'own_summon',    desc:"One of your summons (hand or stationed) strikes +25% on its next strike" },
    { id:'wellspring',  name:'Wellspring',  cost:5, tier:'low', target:'self',          desc:'Gain 15✦ right now' },
    { id:'bane_ground', name:'Bane Ground', cost:5, tier:'low', target:'enemy_station', desc:"An enemy summon's tile permanently becomes the element that beats it" },
    { id:'bargain',     name:'Bargain',     cost:5, tier:'low', target:'self',          desc:'Your next shop buy is half price. Skip or sell instead: +3✦' },
    { id:'parry',       name:'Parry',       cost:5, tier:'low', target:'own_station',   desc:'One of your stationed summons: the first strike against it is halved' },   // v1.0.151
  ],
  mid: [
    { id:'ambush',  name:'Ambush',  cost:30, tier:'mid',  target:'self',        desc:'Your next attacker deals +40% damage' },
    { id:'fortify', name:'Fortify', cost:30, tier:'mid',  target:'self',        desc:'Your next defender takes −40% damage' },
    { id:'rattle',  name:'Rattle',  cost:30, tier:'mid',  target:'player',      desc:"Target player's next battle, their summon fights at half ATK" },
    { id:'poach',   name:'Poach',   cost:30, tier:'mid',  target:'player',      desc:"Steal a random summon from a target player's hand" },
    { id:'patronage', name:'Patronage', cost:30, tier:'mid', target:'self', desc:'Your next two shop buys are free. Each of those shops you skip or sell instead: +8✦' },   // v1.0.150
    { id:'aegis',     name:'Aegis',     cost:30, tier:'mid', target:'own_station',   desc:'One of your stationed summons: the first strike against it deals 0. It still strikes back' },   // v1.0.151
    { id:'disarm',    name:'Disarm',    cost:30, tier:'mid', target:'enemy_station', desc:"An enemy summon's next counter-strike deals 0" },   // v1.0.151
    { id:'sever',     name:'Sever',     cost:30, tier:'mid', target:'enemy_station', desc:'An enemy summon breaks free and goes wild: it belongs to nobody, and whoever lands there must fight it' },   // v1.0.152
  ],
  high: [
    { id:'coup',     name:'Coup',     cost:60, tier:'high', target:'coup',    desc:'Sacrifice one summon from your hand to seize any occupied enemy tile. Their stationed summon defects — it stays on the tile and now fights for you.' },
    { id:'plague',   name:'Plague',   cost:60, tier:'high', target:'player',  desc:"All of a target player's stationed summons lose 20 HP" },
    { id:'windfall', name:'Windfall', cost:60, tier:'high', target:'self',    desc:'Your passive mana income next turn is tripled' },
    { id:'shatter',  name:'Shatter',  cost:60, tier:'high', target:'shatter', desc:'Destroy any 2 stationed summons on the board; both tiles go neutral' },
    { id:'flurry',   name:'Flurry',   cost:60, tier:'high', target:'self',    desc:'Your next attack strikes twice: attack, counter, then a second strike' },   // v1.0.151
    { id:'phoenix_pact', name:'Phoenix Pact', cost:60, tier:'high', target:'self', desc:'The next time your Mana hits 0 you come back at 30✦ instead of being Sanctioned' },   // v1.0.152
  ]
};

// v1.0.150: what a shop offer costs this player right now (Levy +50%, Bargain half, Patronage free; Levy + Bargain cancel)
const DEATH_SENTENCE_CHANCE = 0.20;   // v1.0.152: Death Knight instant kill (was 0.10)
const BARGAIN_CONSOLATION = 3, PATRONAGE_CONSOLATION = 8, PATRONAGE_SHOPS = 2, WELLSPRING_MANA = 15;
function shopPrice(p, o) {
  const s = p && p.wcShop, lev = !!(p && p.wcEffects && p.wcEffects.levy);
  if (s && s.kind === 'patronage') return 0;
  const bar = !!(s && s.kind === 'bargain');
  if (lev && bar) return o.cost;
  if (bar) return Math.floor(o.cost / 2);
  if (lev) return Math.ceil(o.cost * 1.5);
  return o.cost;
}
// v1.0.150: the shop closed (buy / sell / skip) — use up Levy, Bargain or one Patronage shop; consolation if nothing was bought
function shopClosed(p, bought) {
  if (p.wcEffects && p.wcEffects.levy) p.wcEffects.levy = false;
  const s = p.wcShop;
  if (!s) return;
  if (!bought) {
    const bonus = s.kind === 'patronage' ? PATRONAGE_CONSOLATION : BARGAIN_CONSOLATION;
    p.mana += bonus;
    log(`🃏 ${p.name} passed on ${s.kind === 'patronage' ? 'Patronage' : 'Bargain'} — +${bonus}✦`);
  }
  if (s.kind === 'patronage' && --s.left > 0) return;
  p.wcShop = null;
}

// v1.0.150: Bane Ground target check — an enemy (of the current player) single-element summon not already on its bane element
function _baneOk(t) {
  if (!t || t.ownerId == null || t.ownerId === G.currentPlayer || !t.summonInstance) return false;
  const m = t.summonInstance;
  if (m.type2 || !TYPE_WEAK[m.type]) return false;
  const owner = G.players[t.ownerId];
  if (!owner || owner.eliminated) return false;
  return t.element !== TYPE_WEAK[m.type];
}

// v1.0.151: Parry / Aegis / Disarm target checks (relative to the current player)
function _shieldOk(t, kind) {
  if (!t || t.ownerId !== G.currentPlayer || !t.summonInstance) return false;
  return !(kind === 'parry' && t.summonInstance.shield === 'aegis');   // Parry never downgrades an Aegis
}
function _disarmOk(t) {
  if (!t || t.ownerId == null || t.ownerId === G.currentPlayer || !t.summonInstance || t.summonInstance.disarmed) return false;
  const o = G.players[t.ownerId]; return !!(o && !o.eliminated);
}

// v1.0.152: Sever target check, and the stand-in "owner" of a wild (ownerless) monster during a battle
const PHOENIX_MANA = 30;
function _severOk(t) {
  if (!t || t.ownerId == null || t.ownerId === G.currentPlayer || !t.summonInstance) return false;
  const o = G.players[t.ownerId]; return !!(o && !o.eliminated);
}
function isFeral(t) { return !!(t && t.ownerId == null && t.summonInstance); }
function _wildOwner() {
  return { idx: null, name: 'The wild', color: '#8a8a8a', mana: 0, battlesWon: 0, battlesLost: 0, destroyedCount: 0,
           lastTurnBattleManaGain: 0, lastTurnBattleManaLoss: 0, wcEffects: {}, hand: [], isWild: true };
}

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
      deathSentenceEnabled: true,    // Death Knight: 20% instant kill on any damage dealt
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

