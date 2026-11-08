// Summoner's Gambit server · 04-abilities-income.js · Abilities, passive income, special tiles, chest draws
// Loaded in order by server.js (v1.0.139, L2 split). All parts share one global scope, like <script> tags.
'use strict';

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
  if (p && p.sanctioned) return 0;   // v1.0.113: no income while Sanctioned
  let earned = 5; // baseline
  let summonGen = 0;
  const _omensUsed = [];   // v1.0.121: Golden Tithe / Hollow Hunger spent at this income (for the summary)

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

    // v1.0.119: Omens on this tile — applied once, at this income
    const _om = tileOmen(tile);
    if (_om && (_om.id === 'golden_tithe' || _om.id === 'hollow_hunger')) _omensUsed.push({ id: _om.id, pos: tile.pos, byIdx: _om.byIdx, summonName: mi.name, gen: _om.id === 'golden_tithe' ? gen : -gen });
    if (_om && _om.id === 'golden_tithe') { _tallyBreakdown.push({ label: '🔮 Golden Tithe', bonus: gen }); gen *= 2; log(`🔮 Golden Tithe: ${mi.name}'s Gen doubled to ${gen}✦`); tile.omen = null; }
    else if (_om && _om.id === 'hollow_hunger') { _tallyBreakdown.push({ label: '🔮 Hollow Hunger', bonus: -gen }); log(`🔮 Hollow Hunger: ${mi.name} earns nothing this turn`); gen = 0; tile.omen = null; }

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
      if (G.players[wt.ownerId] && G.players[wt.ownerId].sanctioned) continue;   // v1.0.113: Sanctioned owners earn no drain
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
  if (p.wcEffects.jinx)    { const _before = earned; earned = Math.floor(earned * 0.5); p.wcEffects.jinx = false; log(`🃏 Jinx! ${p.name}'s income halved`); _wcTrigger('jinx', p, { before: _before, after: earned }); }   // v1.0.132

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

  const round = curRound();   // v1.0.127
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
    omensUsed: _omensUsed,   // v1.0.121
  };
  p.lastSummary = G.turnSummary;   // v1.0.121: kept for the phone's recall button until the next summary

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

