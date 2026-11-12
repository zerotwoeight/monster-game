// Summoner's Gambit server · 07-sanction.js · Wheel of Fortune, Omens, Sanction turn
// Loaded in order by server.js (v1.0.139, L2 split). All parts share one global scope, like <script> tags.
'use strict';

// ─── WHEEL OF FORTUNE (v1.0.117) ─────────────────────────────────────────────
// Each tile carries a Fortune meter (−3 Curse … +3 Blessing) set by its Sanctioned owner's flips.
// It belongs to that owner + that summon: a new owner, a destroyed/sacrificed/swapped summon or a
// Redeem clears it (checked lazily by tileFortune, so every path that changes a tile is covered).
const FORTUNE = {
   1: { name: 'Glimmer',    def: 0.10, counter: 0,    payout: 2, heal: 0 },
   2: { name: 'Radiance',   def: 0.20, counter: 0.10, payout: 4, heal: 0 },
   3: { name: 'Exaltation', def: 0.30, counter: 0.20, payout: 8, heal: 10 },
  '-1': { name: 'Tarnish', def: -0.10, bounty: 2 },
  '-2': { name: 'Blight',  def: -0.20, bounty: 4 },
  '-3': { name: 'Doom',    def: -0.30, bounty: 8, doom: 5 },
};
const WHEEL_JACKPOT = 5;
function tileFortune(tile) {
  if (!tile || !tile.fortune) return 0;
  const m = tile.summonInstance;
  if (tile.ownerId == null || tile.ownerId !== tile.fortuneOwner || !m || m.iid !== tile.fortuneIid) {
    tile.fortune = 0; tile.fortuneOwner = null; tile.fortuneIid = null;
    return 0;
  }
  return tile.fortune;
}
function clearFortune(tile) { if (tile) { tile.fortune = 0; tile.fortuneOwner = null; tile.fortuneIid = null; } }
// Doom: the cursed summon loses 5 HP at the start of every turn (never below 1)
function tickDoom() {
  for (const t of G.board) {
    const f = tileFortune(t);
    if (f !== -3) continue;
    const m = t.summonInstance;
    const before = m.hp;
    m.hp = Math.max(1, m.hp - FORTUNE['-3'].doom);
    if (m.hp < before) log(`☠ Doom: ${m.name} on tile ${t.pos} loses ${before - m.hp} HP (${m.hp}/${m.maxHp})`);
  }
}

// v1.0.121: one notice at a time per player — later ones queue behind it
function pushNotification(pl, n) {
  if (!pl || pl.eliminated) return;
  if (pl.notification) (pl.notifQueue = pl.notifQueue || []).push(n);
  else pl.notification = n;
}

// ─── OMENS (v1.0.119) ────────────────────────────────────────────────────────
// Placed by a Sanctioned player on a rival's tile. One per tile (a new one replaces the old).
// Lasts until the start of the placer's next turn. Tied to that tile's owner + summon, like Fortune.
const OMENS = {
  saints_ward:       { name: "Saint's Ward",      kind: 'blessing', desc: '+20% DEF on this tile' },
  kindled_blade:     { name: 'Kindled Blade',     kind: 'blessing', desc: "+20% damage on this summon's next strike" },
  mercys_touch:      { name: "Mercy's Touch",     kind: 'blessing', desc: 'Heals the summon 15 HP now' },
  golden_tithe:      { name: 'Golden Tithe',      kind: 'blessing', desc: "This tile's Gen ×2 at its owner's next income" },
  veil_of_stillness: { name: 'Veil of Stillness', kind: 'blessing', desc: "Can't be attacked — landing here just ends the move", weight: 0.5 },
  echoing_hymn:      { name: 'Echoing Hymn',      kind: 'blessing', desc: 'If attacked, the attacker takes 8 damage before the battle' },
  withering_brand:   { name: 'Withering Brand',   kind: 'curse',    desc: '−20% DEF on this tile' },
  hollow_hunger:     { name: 'Hollow Hunger',     kind: 'curse',    desc: "This tile's Gen is 0 at its owner's next income" },
  bleeding_sigil:    { name: 'Bleeding Sigil',    kind: 'curse',    desc: 'Summon loses 5 HP at the start of each turn (never below 1)' },
  shackled_will:     { name: 'Shackled Will',     kind: 'curse',    desc: "This summon's counter-strike deals half damage" },
  toll_of_the_bell:  { name: 'Toll of the Bell',  kind: 'curse',    desc: 'Owner pays 5✦ whenever a rival lands here (fight or retreat)' },
  betrayers_mark:    { name: "Betrayer's Mark",   kind: 'curse',    desc: 'If the tile is taken, the attacker gets +5✦' },
};
function drawOmens(n = 3) {
  const pool = Object.keys(OMENS).map(id => ({ id, w: OMENS[id].weight || 1 })), out = [];
  // v1.0.124: guarantee one Blessing and one Curse, then fill the rest at random (weights kept)
  const pickFrom = kind => {
    const sub = pool.filter(o => OMENS[o.id].kind === kind); if (!sub.length) return;
    const tot = sub.reduce((a, o) => a + o.w, 0); let r = Math.random() * tot, i = 0;
    for (; i < sub.length - 1; i++) { r -= sub[i].w; if (r <= 0) break; }
    out.push(pool.splice(pool.indexOf(sub[i]), 1)[0].id);
  };
  if (n >= 1) pickFrom('blessing');
  if (n >= 2) pickFrom('curse');
  while (out.length < n && pool.length) {
    const tot = pool.reduce((a, o) => a + o.w, 0); let r = Math.random() * tot, i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
    out.push(pool.splice(i, 1)[0].id);
  }
  for (let k = out.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [out[k], out[j]] = [out[j], out[k]]; }   // shuffle order
  return out;
}
function tileOmen(tile) {
  const o = tile && tile.omen;
  if (!o) return null;
  const m = tile.summonInstance;
  if (tile.ownerId == null || tile.ownerId !== o.ownerIdx || !m || m.iid !== o.iid) { tile.omen = null; return null; }
  return o;
}
const omenIs = (tile, id) => { const o = tileOmen(tile); return !!(o && o.id === id); };
function clearOmen(tile) { if (tile) tile.omen = null; }
// at the start of a player's turn (normal or Sanction): their Omens expire; Bleeding Sigil ticks
function omenTurnStart(playerIdx) {
  for (const t of G.board) {
    const o = tileOmen(t); if (!o) continue;
    if (o.byIdx === playerIdx) { log(`🔮 ${OMENS[o.id].name} fades from tile ${t.pos}`); t.omen = null; continue; }
    if (o.id === 'bleeding_sigil') {
      const m = t.summonInstance, b = m.hp; m.hp = Math.max(1, m.hp - 5);
      if (m.hp < b) log(`🩸 Bleeding Sigil: ${m.name} on tile ${t.pos} loses ${b - m.hp} HP (${m.hp}/${m.maxHp})`);
    }
  }
}

// ─── SANCTION TURN (v1.0.115) ────────────────────────────────────────────────
// Replaces a Sanctioned player's normal turn: no income, shop, roll or Wild Card.
// sanction:pick_tile → sanction:own   (Sacrifice / Redeem / pass; Wheel of Fortune in v1.0.116)
//                    → sanction:omen  (Omen offers arrive in v1.0.117 — skip only for now)
const SANCTION_TILE_OFFERS = 3;
function sanctionSellValue(m) { return m ? Math.floor(m.cost * (m.hp / m.maxHp)) : 0; }   // same as the shop sell refund
function startSanctionTurn() {
  const p = G.players[G.currentPlayer];
  tickDoom();   // v1.0.117
  omenTurnStart(G.currentPlayer);   // v1.0.119
  p.lastDice = null; p.lastDiceRoll = null;
  G.wcTable = null; G.lastBattle = null; G.pendingAttackerSummon = null;
  G.pendingWildCard = false;
  const claimed = G.board.filter(t => t.ownerId !== null && t.ownerId !== undefined && t.summonInstance).map(t => t.pos);
  for (let i = claimed.length - 1; i > 0; i--) { const j = rand(0, i); [claimed[i], claimed[j]] = [claimed[j], claimed[i]]; }
  G.sanction = {
    seq: ((G.sanction && G.sanction.seq) || 0) + 1,
    playerIdx: G.currentPlayer,
    offers: claimed.slice(0, SANCTION_TILE_OFFERS).sort((a, b) => a - b),
    pickedPos: null,
    previewPos: null,   // v1.0.116: tile the player is viewing in the detail sheet (board scales it up)
    omenOffers: [],
    result: null,
  };
  G.phase = 'sanction:pick_tile';
  log(`⛓ ${p.name}'s Sanction turn — choose a tile: ${G.sanction.offers.join(', ') || 'none'}`);
  if (!G.sanction.offers.length) { endSanctionTurn({ kind: 'pass', auto: true }); return; }
  broadcast();
}
function endSanctionTurn(result) {
  if (G.sanction) G.sanction.result = result;
  advanceTurn();
}
// v1.0.118: Sacrifice / Redeem / Wheel (and Omens later) are revealed on the board first.
// The turn waits in sanction:reveal until the board says it's done (or a safety timer fires).
const SANCTION_REVEAL_MAX_MS = 9000;
function startSanctionReveal(result) {
  G.sanction.result = result;
  G.sanction.revealSeq = (G.sanction.revealSeq || 0) + 1;
  G.phase = 'sanction:reveal';
  const code = G.roomCode, seq = G.sanction.seq, rseq = G.sanction.revealSeq;
  scheduleRoomAction(code, () => {
    if (G.phase === 'sanction:reveal' && G.sanction && G.sanction.seq === seq && G.sanction.revealSeq === rseq) {
      log('⏱ Sanction reveal timed out — moving on');
      advanceTurn();
    }
  }, SANCTION_REVEAL_MAX_MS);
  broadcast();
}

// v1.0.112: shared by setup_claim and autoSetup() so per-claim abilities (Radiant Strike…) fire the same way
function _doSetupClaim(pIdx, tilePos, m) {
  const p = G.players[pIdx];
  const tile = G.board[tilePos];
    // Free claim — no mana cost
    p.hand.splice(p.hand.indexOf(m), 1);
    tile.ownerId = pIdx;
    tile.summonId = m.iid;
    tile.summonInstance = m;
    tile.neverOwned = false; // Phase 1: mark tile as ever-claimed
    _updatePeakTiles(pIdx);
    log(`🌟 ${p.name} claimed tile ${tilePos} (${tile.element}) with ${m.name} [Setup]`);
    // Per-claim ability triggers (setup phase)
    // Feral Striker: Territorial is now dynamic (tile count) — no per-claim stack
    // Stoneback: Granite Hide is now dynamic (tile count) — no per-claim stack
    // Solar Knight — Radiant Strike: on claim, tile converts to Light element
    if (m.id === 'solar_knight') {
      _convertTile(tile, 'Light', 'Radiant Strike');
      log(`☀️ Radiant Strike: Solar Knight converts tile ${tilePos} to Light element (setup)!`);
    }
}

function startSetupPhase() {
  G.phase = 'setup';
  G.setupRound = 1;
  G.setupTurnIdx = 0;
  G.setupTotalTurns = 3 * G.players.length;
  G.currentPlayer = 0;
  if (G.skipSetup) { log(`⚡ Auto Setup — ${G.players.length} players · up to 3 placements each`); autoSetup(); return; }
  log(`🌟 Setup phase! ${G.players.length} players · ${G.setupTotalTurns} turns total.`);
  broadcast();
}

// v1.0.112: Auto Setup — plan every placement up front, then play them out ~0.3 s apart so the
// board's normal claim FX stagger. Round-robin in seat order, 3 rounds, free.
const AUTO_SETUP_ARCH_ORDER = { guardian: 0, vanguard: 1, assailant: 2 };
const AUTO_SETUP_STEP_MS = 300;
function _autoSetupMatch(m, el) {           // 0 = home, 1 = neutral, 2 = tile beats summon
  const types = [m.type, m.type2].filter(Boolean);
  if (types.includes(el)) return 0;
  if (types.length > 1) return 1;           // dual-element: never debuffed
  return TYPE_STRONG[el] === m.type ? 2 : 1;
}
function planAutoSetup() {
  const N = G.players.length;
  const taken = new Set();
  const owned = G.players.map(() => []);
  const hands = G.players.map(p => p.hand.slice());
  const elem = G.board.filter(t => t.kind === 'element').map(t => t.pos);
  // every run of 3 consecutive same-element tiles (circular) — no player may own a whole run
  const runs = [];
  for (let i = 0; i < 28; i++) {
    const a = G.board[i], b = G.board[(i + 1) % 28], c = G.board[(i + 2) % 28];
    if ([a, b, c].every(t => t.kind === 'element') && a.element === b.element && b.element === c.element) runs.push([a.pos, b.pos, c.pos]);
  }
  const dist = (x, y) => { const d = Math.abs(x - y) % 28; return Math.min(d, 28 - d); };
  const plan = [];
  for (let round = 0; round < 3; round++) {
    for (let pIdx = 0; pIdx < N; pIdx++) {
      const hand = hands[pIdx];
      const free = elem.filter(pos => !taken.has(pos));
      if (!hand.length || !free.length) continue;
      const scoreTile = (m, pos) => {
        const mine = owned[pIdx];
        const completesRun = runs.some(r => r.includes(pos) && r.every(q => q === pos || mine.includes(q)));
        const spread = mine.length ? Math.min(...mine.map(q => dist(q, pos))) : 14;
        return (completesRun ? 10000 : 0) + _autoSetupMatch(m, G.board[pos].element) * 100 - spread + Math.random() * 0.5;
      };
      const bestTile = m => free.reduce((b, pos) => { const sc = scoreTile(m, pos); return !b || sc < b.sc ? { pos, sc } : b; }, null);
      // summon: Guardian → Vanguard → Assailant; within an archetype, the one with the best tile
      const cands = hand.map(m => ({ m, t: bestTile(m), a: AUTO_SETUP_ARCH_ORDER[m.arch] ?? 3 }))
        .sort((x, y) => x.a - y.a || x.t.sc - y.t.sc);
      const pick = cands[0];
      hand.splice(hand.indexOf(pick.m), 1);
      taken.add(pick.t.pos);
      owned[pIdx].push(pick.t.pos);
      plan.push({ pIdx, iid: pick.m.iid, pos: pick.t.pos, round: round + 1 });
    }
  }
  return plan;
}
function autoSetup() {
  const plan = planAutoSetup();
  G.autoSetupRunning = true;
  G.setupTotalTurns = plan.length;
  G.setupTurnIdx = 0;
  const code = G.roomCode;
  const epoch = roomEpoch(code);   // v1.0.130 (S5)
  const finish = () => {
    G.autoSetupRunning = false;
    log(`✅ Auto Setup complete! Game begins.`);
    beginRound1();   // v1.0.127
    startShopPhase();
  };
  if (!plan.length) { finish(); return; }
  broadcast();
  plan.forEach((st, i) => {
    setTimeout(() => {   // own timer (not scheduleRoomAction) so a forfeit mid-setup doesn't cancel the rest
      if (roomEpoch(code) !== epoch) return;   // v1.0.130: room was reset since
      inRoom(code, () => {   // v1.0.140 (L1)
        if (!G || G.phase !== 'setup' || !G.autoSetupRunning) return;
        const p = G.players[st.pIdx];
        const m = p && p.hand.find(h => h.iid === st.iid);
        const tile = G.board[st.pos];
        G.currentPlayer = st.pIdx;
        G.setupRound = st.round;
        G.setupTurnIdx = i;
        if (m && tile && tile.kind === 'element' && (tile.ownerId === null || tile.ownerId === undefined) && !p.eliminated) {
          _doSetupClaim(st.pIdx, st.pos, m);
        }
        try { if (i === plan.length - 1) finish(); else broadcast(); }
        catch (err) { reportCrash('auto setup', err, code); }   // v1.0.134   // v1.0.127: same guard as scheduleRoomAction
      });
    }, 400 + i * AUTO_SETUP_STEP_MS);
  });
}

// v1.0.127: round 1 begins after setup — first seat still in the game, round counter reset
function beginRound1() {
  G.turnCount = 0;
  G.round = 1;
  let i = 0;
  while (i < G.players.length && G.players[i].eliminated) i++;
  G.currentPlayer = i < G.players.length ? i : 0;
}
function advanceSetupTurn() {
  G.setupTurnIdx++;
  if (G.setupTurnIdx >= G.setupTotalTurns) {
    // Setup done — start normal game
    log(`✅ Setup complete! Game begins.`);
    beginRound1();   // v1.0.127
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
  // v1.0.121: Omen notice for the tile's owner — after the board's reveal, never before
  if (G.sanction && G.sanction.notifyOmen) {
    const { targetIdx, n } = G.sanction.notifyOmen;
    G.sanction.notifyOmen = null;
    pushNotification(G.players[targetIdx], n);
  }

  // Wild card intercept — fires ONCE after turn resolves if player passed position 0
  // Skip if the current player was eliminated mid-turn (e.g. mana hit 0 in battle)
  if (G.pendingWildCard && G.wildCardDrawn === null) {
    const _wcPlayer = G.players[G.currentPlayer];
    if (_wcPlayer && !_wcPlayer.eliminated && !_wcPlayer.sanctioned) {   // v1.0.113: Sanctioned don't trigger Wild Cards
      G.pendingWildCard = false;
      // Draw one card randomly from each tier pool
      const drawFrom = pool => pool[rand(0, pool.length - 1)];
      G.wildCardDrawn = {
        low:  drawFrom(WILD_CARD_POOLS.low),
        mid:  drawFrom(WILD_CARD_POOLS.mid),
        high: drawFrom(WILD_CARD_POOLS.high),
      };
      G.phase = 'resolve:wildcard_cards';
      log(`🃏 ${_wcPlayer.name} rolled doubles — Wild Card event!`);
      broadcast();
      return; // don't advance turn yet
    }
    // Player eliminated — discard the pending wildcard silently
    log(`🃏 Wild Card skipped — ${_wcPlayer ? _wcPlayer.name : '?'} was eliminated mid-turn`);
    G.pendingWildCard = false;
    G.wcTable = null;   // v1.0.110: board clears the face-down cards
  }
  // Clear any lingering wildcard state
  G.pendingWildCard = false;
  G.wildCardDrawn = null;
  G.wildCardPending = null;

  // ── Elimination check (end of current player's turn) ──────────────────────
  checkElimination(G.currentPlayer);
  checkSanctionedTileLoss();   // v1.0.113
  if (checkLastStanding()) return; // game ended — don't advance further

  G.turnCount++;
  const _round = curRound();   // v1.0.127

  // Advance to next non-eliminated player
  let nextPlayer = (G.currentPlayer + 1) % G.players.length;
  let loopGuard = 0;
  // v1.0.115: Sanctioned seats take a Sanction turn (startShopPhase routes them)
  while (G.players[nextPlayer].eliminated) {
    nextPlayer = (nextPlayer + 1) % G.players.length;
    if (++loopGuard > G.players.length) {
      // All players eliminated somehow — just end the game
      endGame();
      return;
    }
  }
  // v1.0.127: a round ends when play wraps past the last seat back to the first seat still in.
  // Eliminated seats are skipped and don't count, so 20 rounds is always 20 rounds.
  const _wrapped = nextPlayer <= G.currentPlayer;
  G.currentPlayer = nextPlayer;
  if (_wrapped) {
    G.round = _round + 1;
    if (G.round > G.roundLimit) { G.round = G.roundLimit; endGame(); return; }
  }

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
  // v1.0.127: fires when a new round starts (play just wrapped); G.round is the round we're entering.
  if (_wrapped) {
    const upcomingRound = G.round;
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
  bumpRoomEpoch(G.roomCode);   // v1.0.130 (S5): nothing scheduled during the game runs after it ends
  G.phase = 'game_over';
  G.stalemateData = null; // clear any pending stalemate — game is over
  const finalTiles = p => G.board.filter(t => t.ownerId === p.idx).length;

  // Survivors sort by tiles → mana; eliminated sort by eliminatedRank descending
  // (higher eliminatedRank = survived longer = better placement among losers)
  // v1.0.113: three bands — active → Sanctioned (each by tiles, then Mana) → Eliminated
  const byTilesMana = (a, b) => {
    const ta = finalTiles(a), tb = finalTiles(b);
    if (tb !== ta) return tb - ta;
    return b.mana - a.mana;
  };
  const activeP    = G.players.filter(p => !p.eliminated && !p.sanctioned).sort(byTilesMana);
  const sanctioned = G.players.filter(p => !p.eliminated &&  p.sanctioned).sort(byTilesMana);
  const survivors  = [...activeP, ...sanctioned];
  const eliminated = G.players.filter(p => p.eliminated)
    .sort((a, b) => (b.eliminatedRank || 0) - (a.eliminatedRank || 0));
  const ranked = [...survivors, ...eliminated];

  // Last-standing win: if only 1 survivor remains, announce them as champion
  const champion = ranked[0];
  const wasLastStanding = activeP.length === 1 && (eliminated.length + sanctioned.length) > 0;
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
    sanctioned: !!p.sanctioned && !p.eliminated,   // v1.0.113
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
  let stumbled = false;   // v1.0.110: a Stumbled roll can never earn a Wild Card
  p.lastStumble = false;  // v1.0.111
  if (p.wcEffects.stumble) {
    stumbled = true; p.lastStumble = true;
    p.wcEffects.stumble = false;
    roll = 3;
    p.lastDice = [1, 2];   // v1.0.100: show the forced 3 on the dice
    log(`🃏 Stumble! ${p.name} is cursed — forced to move 3 spaces`);
  }

  // Minimum floor of 3 (2d6 min is 2; bump to 3)
  if (roll < 3) roll = 3;

  p.lastDiceRoll = roll;

  // v1.0.110: Wild Card eligibility — rolling doubles (snake eyes included). Replaces passing the Mana Well.
  // Stumble forces the move, so it never counts, whatever the dice show.
  if (!stumbled && d1 === d2) {
    G.pendingWildCard = true;
    G.wcSeq = (G.wcSeq || 0) + 1;
    G.wcTable = { seq: G.wcSeq, playerIdx, dice: [d1, d2], pick: null, skipped: false };
    log(`🎲 DOUBLES! ${p.name} rolled ${d1}–${d2} — Wild Card at the end of the turn`);
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
    if (p.totalManaEarned != null) p.totalManaEarned += 40;   // v1.0.144
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
  // v1.0.152: a wild monster (Sever) — fight it or retreat; nobody owns it, so no Toll or Veil
  if (isFeral(tile)) {
    log(`🐾 ${p.name} landed on a wild ${tile.summonInstance.name} — fight or retreat`);
    G.phase = 'resolve:battle';
    broadcast();
    return;
  }
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
    // v1.0.119: Toll of the Bell — the owner pays whenever a rival lands here
    if (omenIs(tile, 'toll_of_the_bell')) {
      const ow = G.players[tile.ownerId], pay = Math.min(5, ow.mana);
      ow.mana -= pay;
      log(`🔔 Toll of the Bell: ${ow.name} pays ${pay}✦ as ${p.name} lands on tile ${newPos}`);
      checkManaElimination(ow.idx);
    }
    // v1.0.119: Veil of Stillness — can't be attacked; the move just ends
    if (omenIs(tile, 'veil_of_stillness')) {
      log(`🌫 Veil of Stillness: tile ${newPos} can't be attacked — ${p.name}'s move ends`);
      G.phase = 'resolve:veil';
      broadcast();
      scheduleRoomAction(G.roomCode, advanceTurn, 1500);
      return;
    }
    G.phase = 'resolve:battle';
    broadcast();
  }
}

