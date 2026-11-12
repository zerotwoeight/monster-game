// Summoner's Gambit server · 03-combat.js · Combat: tile effects, strikes, battle resolution, effect recorder, tile synergy, mono-element
// Loaded in order by server.js (v1.0.139, L2 split). All parts share one global scope, like <script> tags.
'use strict';

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

// v1.0.128: homeAtk = this strike is by the stationed defender (counter-strike / Stormtalon first strike).
// On its own element tile it hits with +15% ATK, on top of the +15% DEF it already gets there.
const HOME_ATK_BONUS = 1.15;
function doStrike(attacker, defender, tile, nullify = false, bonusRun = false, monoBuff = false, homeAtk = false) {
  // v1.0.129: homeAtk = the defender is striking, so the one being hit is the visiting attacker —
  // the tile is not its home, so the tile's DEF bonus / penalty never applies to it.
  const tileEffect = homeAtk ? 1 : tileEffectOnDefender(tile, defender);
  const defStat = Math.round(defender.def * tileEffect);
  let atkStat = attacker.atk;
  if (homeAtk && tileEffectOnDefender(tile, attacker) > 1) {
    atkStat = Math.round(attacker.atk * HOME_ATK_BONUS);
    fxM(attacker, 'Home Ground', `${attacker.name} fights on its own element: +15% ATK`, '+15% ATK', 'good');
  }
  const baseDmg = Math.max(1, atkStat - defStat);
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
  if (attacker._kindled && !attacker._kindledUsed) {   // v1.0.119: Kindled Blade — next strike +20%
    dmg = Math.round(dmg * 1.20); attacker._kindledUsed = true;
    fxM(attacker, 'Kindled Blade (Omen)', 'Strike deals +20% damage', '+20%', 'good');
  }
  if (attacker._shackled) {   // v1.0.119: Shackled Will — counter-strike at half damage
    dmg = Math.round(dmg * 0.5);
    fxM(attacker, 'Shackled Will (Omen)', 'Counter-strike deals half damage', '½ dmg', 'bad');
  }
  if (attacker._fortuneCounter) {   // v1.0.117: Radiance / Exaltation counter-strike bonus
    const fc = attacker._fortuneCounter;
    dmg = Math.round(dmg * (1 + fc.pct));
    fxM(attacker, `${fc.name} counter`, `Counter-strike +${Math.round(fc.pct * 100)}%`, `+${Math.round(fc.pct * 100)}%`, 'good');
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
let _rattleBy = null;   // v1.0.132: who played the Rattle that's going off in this battle
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

// v1.0.151: Parry / Aegis — the first battle strike against a shielded summon is halved / blocked. Used up either way.
function _shieldHit(m, dmg) {
  if (!m || !m.shield || dmg <= 0) return dmg;
  const kind = m.shield; m.shield = null;
  if (kind === 'aegis') {
    log(`🛡 Aegis! ${m.name} blocks the strike (${dmg} → 0)`);
    fxM(m, 'Aegis (Wild Card)', `Blocked a ${dmg}-damage strike`, '0 dmg', 'good');
    return 0;
  }
  const half = Math.floor(dmg / 2);
  log(`🛡 Parry! ${m.name} halves the strike (${dmg} → ${half})`);
  fxM(m, 'Parry (Wild Card)', `Halved a ${dmg}-damage strike`, '½ dmg', 'good');
  return half;
}
// v1.0.151: Disarm — this summon's next counter-strike (or Stormtalon's first strike) deals 0. Used up.
function _disarmHit(m, dmg) {
  if (!m || !m.disarmed) return dmg;
  m.disarmed = false;
  log(`🗡 Disarm! ${m.name}'s counter-strike deals 0`);
  fxM(m, 'Disarm (Wild Card)', `${m.name} was disarmed: its strike dealt 0`, '0 dmg', 'bad');
  return 0;
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
    stormtalonPreemptiveDmg = doStrike(defenderM, attackerM, tile, nullify, false, false, true);   // v1.0.128 home ATK
    stormtalonPreemptiveDmg = _shieldHit(attackerM, _disarmHit(defenderM, stormtalonPreemptiveDmg));   // v1.0.151
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

  let actualAtkDmg = _shieldHit(defenderM, atkDmg);   // v1.0.151: Parry / Aegis
  defenderM.hp -= actualAtkDmg;

  // Death Knight — Death Sentence: 20% chance (v1.0.152, was 10%) to instantly kill defender on any damage dealt
  if (attackerM.id === 'death_knight' && actualAtkDmg > 0 && defenderM.hp > 0) {
    if (Math.random() < DEATH_SENTENCE_CHANCE) {
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
      defDmg = doStrike(defenderM, attackerM, tile, nullify, defBonus, defMonoBuff, true);   // v1.0.128 home ATK
      defenderM.atk = savedAtk;
      log(`🃏 Rattle! ${defenderM.name} fights at half ATK`);
      fxM(defenderM, 'Rattle (Wild Card)', `${defenderM.name} countered at half ATK${_rattleBy ? ` — courtesy of ${_rattleBy}` : ''}`, '½ ATK', 'bad');
    } else {
      defDmg = doStrike(defenderM, attackerM, tile, nullify, defBonus, defMonoBuff, true);   // v1.0.128 home ATK
    }

    // Restore counter Piercing Light
    if (defenderM.id === 'radiant_lancer') attackerM.def = counterPierceRestore;

    // High Paladin defending — no more Divine Retribution; Lay on Hands is reactive above

    // Fortify: reduce damage dealt to the attacker
    if (attackerM._fortify) { defDmg = Math.round(defDmg * 0.60); attackerM._fortify = false; log(`🃏 Fortify! damage reduced 40%`); fxM(attackerM, 'Fortify (Wild Card)', 'Counter damage reduced 40%', '−40%', 'good'); }
    defDmg = _shieldHit(attackerM, _disarmHit(defenderM, defDmg));   // v1.0.151: Disarm on the defender, Parry / Aegis on the attacker
    attackerM.hp -= defDmg;

    // Death Knight — Death Sentence on counter-strike: 10% chance to instantly kill attacker
    if (defenderM.id === 'death_knight' && defDmg > 0 && attackerM.hp > 0) {
      if (Math.random() < DEATH_SENTENCE_CHANCE) {
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

    // v1.0.151: Flurry — the attacker strikes again after the counter, if both are still standing
    if (attackerM._flurry && attackerM.hp > 0 && defenderM.hp > 0) {
      if (attackerM._flurryAmbush) attackerM._ambush = true;   // Ambush boosts both strikes
      let extra = doStrike(attackerM, defenderM, tile, nullify);
      extra = _shieldHit(defenderM, extra);
      defenderM.hp -= extra;
      actualAtkDmg += extra;
      log(`⚔️ Flurry! ${attackerM.name} strikes again for ${extra}`);
      fxM(attackerM, 'Flurry (Wild Card)', `Struck a second time for ${extra} damage`, `+${extra} dmg`, 'good');
      if (attackerM.id === 'death_knight' && extra > 0 && defenderM.hp > 0 && Math.random() < DEATH_SENTENCE_CHANCE) {
        defenderM.hp = 0;
        log(`💀 Death Sentence: Death Knight instant kill triggers! ${defenderM.name} slain!`);
        fxM(attackerM, 'Death Sentence', `Instantly slew ${defenderM.name}`, 'KO', 'good');
      }
      if (defenderM.id === 'void_sentinel' && defenderM.hp > 0 && defenderM.hp <= Math.floor(defenderM.maxHp * 0.30) && defenderM.atk !== 36) {
        defenderM.atk = 36;
        fxM(defenderM, 'Last Darkness', 'HP critical — ATK surged to 36', 'ATK 36', 'good');
      }
      if (defenderM.id === 'high_paladin' && defenderM.abilityData && !defenderM.abilityData.layOnHandsUsed && defenderM.hp > 0 && defenderM.hp <= Math.floor(defenderM.maxHp * 0.30)) {
        const healed = Math.min(15, defenderM.maxHp - defenderM.hp);
        defenderM.hp = Math.min(defenderM.maxHp, defenderM.hp + 15);
        defenderM.abilityData.layOnHandsUsed = true;
        fxM(defenderM, 'Lay on Hands', `Healed ${healed} HP below 30%`, `+${healed} HP`, 'good');
      }
      if (defenderM.hp <= 0 && defenderM.id === 'demon_lord' && !defenderM.lastRiteUsed) {
        defenderM.hp = 15;
        defenderM.lastRiteUsed = true;
        log('💀 Last Rite triggers! Demon Lord survives at 15 HP!');
        fxM(defenderM, 'Last Rite', 'Survived a lethal blow at 15 HP', '15 HP', 'good');
      }
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

