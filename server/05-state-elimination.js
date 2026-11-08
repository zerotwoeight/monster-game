// Summoner's Gambit server · 05-state-elimination.js · State broadcasting helpers, publicState, elimination, forfeit
// Loaded in order by server.js (v1.0.139, L2 split). All parts share one global scope, like <script> tags.
'use strict';

// ─── STATE BROADCASTING ───────────────────────────────────────────────────────

// ─── v1.0.91: shared helpers ──────────────────────────────────────────────────
// guardTurn: standard "right phase + your turn" check for player action handlers.
// Sends the same error messages the inline checks used; returns false if blocked.
// v1.0.132 (U5): a delayed Wild Card (Jinx / Delay / Stumble / Rattle) actually goes off on its target.
// The board plays a "curse lands" moment for each new entry; the phone uses it for the Delay note.
function _wcTrigger(id, p, extra = {}) {
  const byIdx = p.wcBy ? p.wcBy[id] : undefined;
  const by = byIdx != null ? G.players[byIdx] : null;
  if (p.wcBy) delete p.wcBy[id];
  G.wcTrigSeq = (G.wcTrigSeq || 0) + 1;
  G.wcTriggers = (G.wcTriggers || []).concat([{ seq: G.wcTrigSeq, id, idx: p.idx, name: p.name, byIdx: by ? by.idx : null, byName: by ? by.name : null, turn: G.turnCount, ...extra }]).slice(-6);
  return by ? by.name : null;
}

// v1.0.131 (G3): host Skip turn — allowed only while the current player is the one we're waiting on
const NUDGE_COOLDOWN_MS = 10000;
const WC_NO_SANCTIONED = ['jinx', 'delay', 'stumble'];   // v1.0.136: no effect on a Sanctioned player (no income / shop / roll)
const MAX_ROOMS = 100;   // v1.0.133 (S7): idle rooms are cleared by the hourly sweep; this stops room spam in between
const HOST_SKIPPABLE = ['setup', 'resolve:turn_summary', 'shop', 'stalemate', 'roll', 'resolve:landing', 'resolve:claim', 'resolve:battle',
  'resolve:own', 'resolve:temple', 'resolve:heal_tile', 'resolve:chest', 'resolve:wildcard_cards', 'resolve:wildcard_target',
  'resolve:wildcard_coup_tile', 'resolve:wildcard_coup_summon', 'resolve:wildcard_shatter', 'sanction:pick_tile', 'sanction:own', 'sanction:omen'];
function hostSkipBlockReason() {
  if (!G || G.phase === 'lobby' || G.phase === 'game_over') return 'No game in progress';
  if (G.pausedFor) return 'The game is paused — use Remove for a disconnected player';
  if (G.phase === 'setup' && G.autoSetupRunning) return 'Auto Setup is running';
  if (!HOST_SKIPPABLE.includes(G.phase)) return 'Something is resolving — try again in a moment';
  return null;
}

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
  if (G && G.board) for (const t of G.board) { tileFortune(t); tileOmen(t); }   // v1.0.117/119: drop stale Fortune meters + Omens before export
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
    lastStumble: !!p.lastStumble,   // v1.0.111
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
    sanctioned: !!p.sanctioned,          // v1.0.113
    sanctionedAt: p.sanctionedAt ?? null,
    redeemUsed: !!p.redeemUsed,
  }));

  return {
    phase: G.phase,
    roomCode: G.roomCode,
    currentPlayer: G.currentPlayer,
    turnCount: G.turnCount,
    round: curRound(),   // v1.0.127
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
    lastNudge: G.lastNudge || null,
    wcTriggers: G.wcTriggers || [],         // v1.0.132 (U5) curse-lands moments         // v1.0.131 {seq, idx} — board pops a 🔔 on the chip
    lastHostSkip: G.lastHostSkip || null,   // v1.0.131 {seq, idx, name, phase} — board shows "Host skipped …"
    hostSkippable: hostSkipBlockReason() === null,   // v1.0.131 board greys Skip while something is resolving
    setupRound: G.setupRound || 1,
    setupTurnIdx: G.setupTurnIdx || 0,
    setupTotalTurns: G.setupTotalTurns || 0,
    bonusRuns: getBonusRuns(),
    monoElementBonus: getMonoElementBonus(),
    turnSummary: G.turnSummary || null,
    roundCallout: G.roundCallout || null,
    tileFlashes: G.tileFlashes || [],
    lastWildCard: G.lastWildCard || null,
    wcTable: G.wcTable || null,   // v1.0.110
    skipSetup: !!G.skipSetup,               // v1.0.112
    sanction: G.sanction || null,
    lastWheel: G.lastWheel || null,          // v1.0.117: { seq, playerIdx, pos, upright, before, after, jackpot }            // v1.0.115: { seq, playerIdx, offers, pickedPos, omenOffers, result }
    rankings: G.rankings || null,           // v1.0.113: was built in endGame() but never exported — board fell back to its own sort
    autoSetupRunning: !!G.autoSetupRunning, // v1.0.112
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
  if (curRound() === 1) return false;   // v1.0.127 (was turnCount < players)

  const ownedTiles = G.board.filter(t => t.ownerId === playerIdx).length;
  if (ownedTiles > 0) return false;

  // Count how many players are already eliminated to assign rank
  const elimCount = G.players.filter(pl => pl.eliminated).length;
  p.eliminated = true;
  p.eliminatedRank = elimCount + 1; // lower = eliminated earlier (1 = first out)
  p.sanctioned = false;             // v1.0.113: Sanctioned → Eliminated

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
  if (p.sanctioned) return false;   // v1.0.113: already Sanctioned — Mana just floors at 0
  return sanctionPlayer(playerIdx);
}

// v1.0.113: Mana hit 0 → Sanctioned (was: Eliminated). Keeps tiles, summons and hand.
function sanctionPlayer(playerIdx) {
  const p = G.players[playerIdx];
  if (!p || p.eliminated || p.sanctioned) return false;
  p.sanctioned = true;
  p.sanctionedAt = G.turnCount;
  p.mana = 0;
  if (G.stalemateData && G.stalemateData.attackerIdx === playerIdx) G.stalemateData = null;   // they won't resolve it
  log(`⛓ ${p.name} ran out of Mana and is SANCTIONED!`);
  return true;
}

// v1.0.113: a Sanctioned player who has lost their last tile (on anyone's turn) is Eliminated.
function checkSanctionedTileLoss() {
  if (G.phase === 'setup' || curRound() === 1) return;   // v1.0.127
  for (const p of G.players) {
    if (p.sanctioned && !p.eliminated) checkElimination(p.idx);
  }
}

// v1.0.113: Redeem — 15✦, needs a tile, once per game, not in the final round.
const REDEEM_COST = 15;      // shown on the card; need at least this much to Redeem
const REDEEM_RETURN_BASE = 5; // v1.0.114: come back with +5✦ so Redeem never leaves you at 0 (net cost 10✦)
// v1.0.127: the current round. Games saved before v1.0.127 have no G.round — derive it once from turnCount.
function curRound() {
  if (G.round == null) G.round = Math.floor(G.turnCount / G.players.length) + 1;
  return G.round;
}
function isFinalRound() {
  return curRound() >= G.roundLimit;   // v1.0.127
}
function redeemBlockReason(playerIdx) {
  const p = G.players[playerIdx];
  if (!p || !p.sanctioned || p.eliminated) return 'Not Sanctioned';
  if (p.redeemUsed) return 'Redeem already used this game';
  if (isFinalRound()) return 'Redeem is not allowed in the final round';
  if (p.mana < REDEEM_COST) return `Need ${REDEEM_COST}✦ to Redeem`;
  if (!G.board.some(t => t.ownerId === playerIdx)) return 'Need at least 1 tile to Redeem';
  return null;
}
function redeemPlayer(playerIdx) {
  const why = redeemBlockReason(playerIdx);
  if (why) return why;
  const p = G.players[playerIdx];
  p.mana = p.mana - REDEEM_COST + REDEEM_RETURN_BASE;
  p.sanctioned = false;
  p.redeemUsed = true;
  for (const t of G.board) if (t.ownerId === playerIdx) clearFortune(t);   // Wheel of Fortune meters clear
  log(`✨ ${p.name} pays ${REDEEM_COST}✦ (+${REDEEM_RETURN_BASE}✦ back) and is REDEEMED — back in the game!`);
  return null;
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
  p.sanctioned = false;   // v1.0.113: leavers are Eliminated, never Sanctioned
  p.hand = [];
  p.mana = 0;
  p.notification = null;
  p.notifQueue = [];
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
    G.pendingWildCard = false; G.wildCardDrawn = null; G.wildCardPending = null; G.wcTable = null;
    G.pendingTemple = null; G.pendingChest = null; G.pendingLanding = null;
    G.pendingAttackerMonster = null;
    if (G.phase === 'setup') { if (!G.autoSetupRunning) advanceSetupTurn(); return true; }   // v1.0.112: Auto Setup skips leavers itself
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
  const active = G.players.filter(p => !p.eliminated && !p.sanctioned);   // v1.0.113
  if (active.length <= 1) {
    endGame();
    return true;
  }
  return false;
}

