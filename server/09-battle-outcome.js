// Summoner's Gambit server · 09-battle-outcome.js · Shared helpers and battle-outcome helpers
// Loaded in order by server.js (v1.0.139, L2 split). All parts share one global scope, like <script> tags.
'use strict';

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

