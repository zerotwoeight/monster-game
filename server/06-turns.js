// Summoner's Gambit server · 06-turns.js · Turn management: turn start, setup, advanceTurn, rounds, Wild Card triggers
// Loaded in order by server.js (v1.0.139, L2 split). All parts share one global scope, like <script> tags.
'use strict';

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
  if (p && p.sanctioned) { p.lastSummary = null; startSanctionTurn(); return; }   // v1.0.115 · v1.0.121: no summary while Sanctioned
  tickDoom();   // v1.0.117
  omenTurnStart(G.currentPlayer);   // v1.0.119
  p.lastDice = null;
  p.lastDiceRoll = null;  // reset so stale roll values don't trigger false animations
  G.wcTable = null;       // v1.0.110: last turn's wild-card table is done
  G.wcBackDrawn = null;   // v1.0.147
  G.wcBought = null;      // v1.0.148
  G.lastBattle = null;    // clear battle result so it doesn't persist across turns
  G.pendingAttackerSummon = null; // clear attacker preview

  // Round 1 grace period — summons placed during setup shouldn't immediately earn;
  // mana generation starts from round 2 onward (turnCount >= playerCount)
  const isRound1 = curRound() === 1;   // v1.0.127
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
    // v1.0.121: HP by summon iid (stationed + hand) so the summary can show what each one healed
    const _hpByIid = {};
    for (const tile of G.board) if (tile.ownerId === G.currentPlayer && tile.summonInstance) _hpByIid[tile.summonInstance.iid] = tile.summonInstance.hp;
    for (const m of p.hand) _hpByIid[m.iid] = m.hp;
    processTurnStartEffects(G.currentPlayer); // Phase 1 + 2: ability ticks before income
    collectPassiveIncome(G.currentPlayer);
    // Attach round tally for pre-round animation on the client
    if (G.turnSummary) {
      G.turnSummary.roundTally = computeRoundTally(G.currentPlayer, _hpSnapshot, _milestoneSnapshot);
      const hpGain = {}, genByIid = {};
      const _all = G.board.filter(t => t.ownerId === G.currentPlayer && t.summonInstance).map(t => t.summonInstance).concat(p.hand);
      for (const m of _all) { const b = _hpByIid[m.iid]; if (b !== undefined && m.hp > b) hpGain[m.iid] = m.hp - b; }
      for (const t of G.board) if (t.ownerId === G.currentPlayer && t.summonInstance) genByIid[t.summonInstance.iid] = 0;
      for (const e of G.turnSummary.roundTally) { const t = G.board[e.tilePos]; if (t && t.summonInstance) genByIid[t.summonInstance.iid] = (genByIid[t.summonInstance.iid] || 0) + e.netMana; }
      G.turnSummary.hpGain = hpGain;
      G.turnSummary.genByIid = genByIid;
    }
  } else {
    G.turnSummary = null; // no summary in round 1
    p.lastSummary = null;   // v1.0.121
    log(`⏳ ${p.name} — income starts Round 2`);
  }
  G.shopOffers = pickShopOffers(); // always generate offers (needed for stalemate buy option too)

  // Safety: if round limit already reached, end now rather than routing to stalemate
  if (curRound() > G.roundLimit) { endGame(); return; }   // v1.0.127

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

  // v1.0.132 (U5): Stumble announces itself as the turn starts (it applies when they roll)
  if (p.wcEffects.stumble) _wcTrigger('stumble', p);

  // Wild card: Delay — skip shop phase
  if (p.wcEffects.delay) {
    p.wcEffects.delay = false;
    _wcTrigger('delay', p);   // v1.0.132
    G.phase = 'roll';
    log(`🃏 Delay! ${p.name}'s shop phase is skipped`);
    broadcast();
    return;
  }

  G.phase = 'shop';
  if (p.wcEffects.levy) _wcTrigger('levy', p);   // v1.0.150: Levy lands as the shop opens
  log(`🛒 ${p.name}'s turn — shop open`);
  broadcast();
}

