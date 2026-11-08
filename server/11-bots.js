// Summoner's Gambit server · 11-bots.js · Bots (v1.0.142; v1.0.143 waits for the board's animations)
// Loaded last by server.js. Shares the global scope with the other parts.
//
// A bot is a normal seat (p.isBot, p.botId) with no phone. After every broadcast the server checks
// whether a bot has to act; if so it schedules one decision (after a short "thinking" pause so the
// board's animations play), then runs the same handler a phone would send. The handlers do all the
// rule checks, so a bot can never do anything a player couldn't.
//
// Personality = what a bot likes doing (weights below). Difficulty = how well it does it (easy / normal / hard).
// Both are fixed per bot, so players learn each bot as a character. Plan: project doc claude/BOTS_PLAN.md.
'use strict';

// ─── The pool ─────────────────────────────────────────────────────────────────
// Weights (0…1 unless noted):
//   aggr     fight eagerness (shifts the fight / retreat line)     reserve  Mana it tries to keep (✦)
//   shop     buying appetite                                         wc       Wild Card appetite
//   heal     healing appetite                                        chest / temple / well  landing likes
//   focus    'leader' (most tiles) | 'wounded' (low-HP defenders) | null
//   likes    { arch: bonus } for shop / claim                        mono / run   cares about Mastery / Synergy runs
//   tricks   likes Iron + Arcane player-target cards and Curse Omens
const BOTS = [
  { id: 'grimm',     name: 'Grimm',           style: 'Brute',      diff: 'easy',   set: 'B',
    w: { aggr: 0.9, reserve: 4,  shop: 0.7, wc: 0.4, heal: 0.1, chest: 0.3, temple: 0.2, well: 0.4, focus: null,      likes: { assailant: 4 } } },
  { id: 'thessaly',  name: 'Thessaly',        style: 'Turtle',     diff: 'normal', set: 'E',
    w: { aggr: 0.2, reserve: 12, shop: 0.5, wc: 0.3, heal: 0.9, chest: 0.4, temple: 0.3, well: 0.6, focus: null,      likes: { guardian: 5, vanguard: 1 } } },
  { id: 'locke',     name: 'Locke',           style: 'Strategist', diff: 'hard',   set: 'D',
    w: { aggr: 0.55, reserve: 14, shop: 0.6, wc: 0.6, heal: 0.6, chest: 0.4, temple: 0.6, well: 0.8, focus: 'leader',  likes: { guardian: 2, vanguard: 2 }, mono: true, run: true } },
  { id: 'sid',       name: 'Sid',             style: 'Gambler',    diff: 'easy',   set: 'F',
    w: { aggr: 0.7, reserve: 3,  shop: 0.6, wc: 1.0, heal: 0.2, chest: 1.0, temple: 0.3, well: 0.3, focus: null,      likes: {}, gamble: true } },
  { id: 'ashveil',   name: 'Ashveil',         style: 'Purist',     diff: 'normal', set: 'G',
    w: { aggr: 0.5, reserve: 10, shop: 0.6, wc: 0.4, heal: 0.5, chest: 0.4, temple: 0.5, well: 0.5, focus: null,      likes: {}, mono: true, purist: true } },
  { id: 'thorne',    name: 'Thorne',          style: 'Architect',  diff: 'hard',   set: 'H',
    w: { aggr: 0.45, reserve: 12, shop: 0.6, wc: 0.4, heal: 0.6, chest: 0.4, temple: 0.4, well: 0.6, focus: null,      likes: { guardian: 2, vanguard: 2 }, run: true, builder: true } },
  { id: 'seraphine', name: 'Seraphine',       style: 'Pilgrim',    diff: 'normal', set: 'C',
    w: { aggr: 0.45, reserve: 10, shop: 0.5, wc: 0.3, heal: 0.6, chest: 0.4, temple: 1.0, well: 0.6, focus: null,      likes: { vanguard: 1 }, pilgrim: true } },
  { id: 'hollander', name: 'Hollander',       style: 'Vulture',    diff: 'normal', set: 'A',
    w: { aggr: 0.6, reserve: 8,  shop: 0.5, wc: 0.4, heal: 0.3, chest: 0.4, temple: 0.3, well: 0.5, focus: 'wounded', likes: { assailant: 2 } } },
  { id: 'crowe',     name: 'Crowe',           style: 'Kingslayer', diff: 'normal', set: 'A',
    w: { aggr: 0.6, reserve: 8,  shop: 0.5, wc: 0.7, heal: 0.3, chest: 0.4, temple: 0.3, well: 0.5, focus: 'leader',  likes: { assailant: 1, vanguard: 1 } } },
  { id: 'jinks',     name: 'Jinks',           style: 'Trickster',  diff: 'easy',   set: 'B',
    w: { aggr: 0.45, reserve: 6,  shop: 0.5, wc: 0.9, heal: 0.3, chest: 0.6, temple: 0.2, well: 0.5, focus: 'leader',  likes: {}, tricks: true } },
  { id: 'quill',     name: 'Professor Quill', style: 'Collector',  diff: 'easy',   set: 'D',
    w: { aggr: 0.4, reserve: 4,  shop: 1.0, wc: 0.4, heal: 0.3, chest: 0.5, temple: 0.4, well: 0.6, focus: null,      likes: { rare: 8, support: 6 } } },
  { id: 'rook',      name: 'Rook',            style: 'Steady',     diff: 'normal', set: 'C',
    w: { aggr: 0.5, reserve: 10, shop: 0.5, wc: 0.5, heal: 0.5, chest: 0.5, temple: 0.4, well: 0.5, focus: null,      likes: {} } },
];
const BOT_BY_ID = Object.fromEntries(BOTS.map(b => [b.id, b]));

// ─── Pacing ───────────────────────────────────────────────────────────────────
// Normal-speed pauses (ms) before a bot acts in each phase — long enough for the board's animations.
const BOT_SPEEDS = { normal: 1, fast: 0.5, instant: 0 };
const BOT_DELAY = {
  setup: 1300, 'resolve:turn_summary': 3000, shop: 1500, stalemate: 1800, roll: 1100,
  'resolve:claim': 2200, 'resolve:own': 2200, 'resolve:battle': 2200, 'resolve:temple': 2200,
  'resolve:chest': 2400, 'resolve:heal_tile': 2000,
  'resolve:wildcard_cards': 2400, 'resolve:wildcard_target': 1800, 'resolve:wildcard_coup_tile': 1600,
  'resolve:wildcard_coup_summon': 1400, 'resolve:wildcard_shatter': 1400,
  'sanction:pick_tile': 3200, 'sanction:own': 2200, 'sanction:omen': 2400,
};
const BOT_ACT_PHASES = new Set([...Object.keys(BOT_DELAY), 'resolve:landing']);
function botDelay(phase) {
  const k = BOT_SPEEDS[G.botSpeed || 'normal'] ?? 1;
  if (k === 0) return 60;
  let ms = BOT_DELAY[phase] || 1500;
  if (phase === 'resolve:landing') {
    // dice tumble (~2.5 s) + token hops (230 ms each) before the bot "looks" at the three tiles
    const pl = G.pendingLanding;
    const steps = pl ? pl.roll : 8;
    ms = 2900 + steps * 230 + 700;
  }
  if (phase === 'resolve:battle' && G.pendingAttackerSummon) ms = 1600;   // attacker shown on the board — now strike
  return Math.round(ms * k + Math.random() * 300 * k);
}

// ─── Scheduling ───────────────────────────────────────────────────────────────
const _botPending = new Map();   // roomCode → key of the decision already scheduled (memory only)
const _botFails = new Map();     // roomCode → { key, n }
function botStateKey() {
  const wp = G.wildCardPending;
  return [G.phase, G.currentPlayer, G.turnCount, G.setupTurnIdx, G.sanction && G.sanction.seq,
    wp ? (wp.cardId + ':' + (wp.step || '') + ':' + ((wp.picks || []).length)) : '',
    G.pendingAttackerSummon ? G.pendingAttackerSummon.iid : ''].join('|');
}
function botWhoActs() {
  if (!G || G.phase === 'lobby' || G.phase === 'game_over' || G.pausedFor) return null;
  if (G.phase === 'setup' && G.autoSetupRunning) return null;
  if (!BOT_ACT_PHASES.has(G.phase)) return null;
  // nobody watching (board closed, phones gone) → bots wait instead of playing on alone
  if (![...clients.values()].some(c => c.roomCode === G.roomCode)) return null;
  const p = G.players[G.currentPlayer];
  return p && p.isBot && !p.eliminated ? p : null;
}
function botMaybeSchedule() {
  if (!G || !G.players.some(p => p.isBot)) return;
  // bots never see their phone notices — clear them so nothing waits on a bot
  for (const p of G.players) if (p.isBot && p.notification) { p.notification = null; p.notifQueue = []; }
  const p = botWhoActs();
  if (!p) return;
  const key = botStateKey();
  const code = G.roomCode;
  if (_botPending.get(code) === key) return;
  _botPending.set(code, key);
  scheduleRoomAction(code, function botStep() {
    if (botStateKey() !== key) { if (_botPending.get(code) === key) _botPending.delete(code); botMaybeSchedule(); return; }   // the game moved on — look again
    const bot = botWhoActs();
    if (!bot) { if (_botPending.get(code) === key) _botPending.delete(code); return; }
    // v1.0.143: one thing at a time — wait while the board is still animating (dice, battle, Wild Card, tally…)
    const wait = botBoardWait(code);
    if (wait > 0) { scheduleRoomAction(code, botStep, wait); return; }
    if (_botPending.get(code) === key) _botPending.delete(code);
    botAct(bot, key);
  }, botDelay(G.phase));
}

// ─── v1.0.143: board busy signal ─────────────────────────────────────────────
// The host board sends board_busy {busy} when its animations start / finish. A bot holds its next action
// until the board has been idle for a short beat (BOARD_IDLE_GAP × speed), at most BOARD_BUSY_MAX_MS.
const _boardBusy = new Map();   // roomCode → { busy, since, idleAt }
const BOARD_BUSY_MAX_MS = 15000, BOARD_IDLE_GAP = 700;
function botBoardWait(code) {
  const b = _boardBusy.get(code);
  if (!b) return 0;
  const now = Date.now();
  if (b.busy) return now - b.since > BOARD_BUSY_MAX_MS ? 0 : 200;
  const k = BOT_SPEEDS[G.botSpeed || 'normal'] ?? 1;
  const gap = Math.round(BOARD_IDLE_GAP * (k === 0 ? 0.3 : k));
  return now - b.idleAt < gap ? gap - (now - b.idleAt) : 0;
}
handlers.board_busy = function (ws, conn, data) {
  if (!conn.isBoard || conn.isSpectator || !G) return;
  const busy = !!data.busy, now = Date.now();
  const prev = _boardBusy.get(G.roomCode);
  if (prev && prev.busy === busy) return;
  _boardBusy.set(G.roomCode, busy ? { busy, since: now, idleAt: prev ? prev.idleAt : 0 } : { busy, since: prev ? prev.since : now, idleAt: now });
};

// A bot "socket": never written to; remembers the last error a handler sent so we can fall back.
function botSock() { return { destroyed: true, _bot: true, lastError: null }; }
const _sendErrorOrig = sendError;
sendError = function (socket, msg) {   // eslint-disable-line no-global-assign
  if (socket && socket._bot) { socket.lastError = msg; return; }
  return _sendErrorOrig(socket, msg);
};
function botDo(p, action, data = {}) {
  const ws = botSock();
  const conn = { playerIdx: p.idx, roomCode: G.roomCode, isBot: true, isBoard: false, isSpectator: false };
  trail(G.roomCode, `> ${p.name} 🤖: ${action} ${JSON.stringify(data).slice(0, 60)}`);
  glog(G.roomCode, `> ${p.name} 🤖: ${action} ${JSON.stringify(data).slice(0, 60)}`);
  handlers[action](ws, conn, data);
  if (ws.lastError) glog(G.roomCode, `  🤖 ${p.name}: ${action} refused — ${ws.lastError}`);
  return !ws.lastError;
}

function botAct(p, key) {
  const code = G.roomCode;
  let ok = false;
  try { ok = botDecide(p); }
  catch (err) { reportCrash(`bot ${p.name} (${G.phase})`, err, code); }
  // nothing changed → try the "do nothing" choice; if that fails too, end the turn like the host's Skip
  if (rooms.get(code) !== G) return;
  if (botStateKey() === key) {
    const f = _botFails.get(code);
    const n = f && f.key === key ? f.n + 1 : 1;
    _botFails.set(code, { key, n });
    try {
      if (n === 1) botFallback(p);
      if (botStateKey() === key && n >= 1) {
        glog(code, `  🤖 ${p.name} stuck in ${G.phase} — skipping the turn`);
        handlers.host_skip_turn(botSock(), { isBoard: true, isSpectator: false, roomCode: code }, {});
      }
    } catch (err) { reportCrash(`bot ${p.name} fallback`, err, code); }
  }
}

function botFallback(p) {
  const ph = G.phase;
  const F = {
    setup: 'setup_pass', 'resolve:turn_summary': 'dismiss_turn_summary', shop: 'skip_shop', stalemate: 'stalemate_continue',
    roll: 'roll', 'resolve:claim': 'skip_claim', 'resolve:own': 'skip_own', 'resolve:battle': 'retreat',
    'resolve:temple': 'temple_leave', 'resolve:chest': 'chest_skip', 'resolve:heal_tile': 'heal_tile_skip',
    'resolve:wildcard_cards': 'wildcard_skip', 'resolve:wildcard_coup_tile': 'wildcard_coup_cancel',
    'resolve:wildcard_coup_summon': 'wildcard_coup_cancel', 'sanction:pick_tile': 'sanction_pass',
    'sanction:own': 'sanction_pass', 'sanction:omen': 'sanction_omen_skip',
  };
  if (ph === 'resolve:landing' && G.pendingLanding) return botDo(p, 'choose_landing', { tilePos: G.pendingLanding.options[2] });
  if (F[ph]) return botDo(p, F[ph], {});
  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const _bp = p => BOT_BY_ID[p.botId] || BOT_BY_ID.rook;
const _w = p => _bp(p).w;
const _hard = p => _bp(p).diff === 'hard';
const _easy = p => _bp(p).diff === 'easy';
// Easy bots wander off the best move now and then — that's their charm
const _blunder = p => _easy(p) && Math.random() < 0.3;
const _rnd = arr => arr[Math.floor(Math.random() * arr.length)];
function _best(items, score) {
  let best = null, bs = -Infinity, found = false;   // items can be 0 (tile 0 = Mana Well) — track "found" separately
  for (const it of items) { const s = score(it); if (s > bs) { bs = s; best = it; found = true; } }
  return found ? { item: best, score: bs } : null;
}
const _tilesOf = idx => G.board.filter(t => t.ownerId === idx);
const _stationedOf = idx => G.board.filter(t => t.ownerId === idx && t.summonInstance);
const _setElements = p => (STARTER_SETS[p.starterSet] || STARTER_SETS.C).elements;
function _leaderIdx(excludeIdx) {
  let best = null, bt = -1;
  for (const pl of G.players) {
    if (pl.idx === excludeIdx || pl.eliminated) continue;
    const n = _tilesOf(pl.idx).length * 1000 + pl.mana;
    if (n > bt) { bt = n; best = pl.idx; }
  }
  return best;
}
function _myRank(p) {   // 0 = first
  const score = pl => _tilesOf(pl.idx).length * 1000 + pl.mana;
  return G.players.filter(pl => !pl.eliminated && score(pl) > score(p)).length;
}
function _spare(p, cost) { return p.mana - cost >= Math.max(3, _w(p).reserve * (curRound() <= 2 ? 0.5 : 1)); }
function _homeMatch(m, el) {   // 2 home, 1 neutral, 0 weak ground
  const ty = [m.type, m.type2].filter(Boolean);
  if (!el || !ty.length) return 1;
  if (ty.includes(el)) return 2;
  if (!m.type2 && TYPE_STRONG[el] === m.type) return 0;
  return 1;
}
// Would claiming this tile complete (or extend toward) a 3-run of my own same-element tiles?
function _runValue(p, pos, el) {
  let v = 0;
  for (let s = -2; s <= 0; s++) {
    const run = [0, 1, 2].map(k => G.board[(pos + s + k + 28) % 28]);
    if (!run.every(t => t.kind === 'element' && t.element === el)) continue;
    const mine = run.filter(t => t.pos !== pos && t.ownerId === p.idx).length;
    v = Math.max(v, mine === 2 ? 10 : mine === 1 ? 3 : 1);
  }
  return v;
}

// ─── Battle estimate ──────────────────────────────────────────────────────────
// Same formula as doStrike(), without side effects. Enumerates both damage rolls (0–3) → win / loss / stalemate odds.
function botBattleOdds(p, attM, tile) {
  const defM = tile.summonInstance;
  if (!defM) return { win: 1, loss: 0, stale: 0 };
  const owner = G.players[tile.ownerId];
  const aE = getEffectiveStats(attM, -1, p.idx), dE = getEffectiveStats(defM, tile.pos, tile.ownerId);
  const tEff = tileEffectOnDefender(tile, defM);
  const home = tEff > 1;
  let fort = 0; try { fort = tileFortune(tile) || 0; } catch {}
  const fortDef = fort ? 1 + 0.1 * fort : 1;
  let omenDef = 1; try { if (omenIs(tile, 'saints_ward')) omenDef = 1.2; if (omenIs(tile, 'withering_brand')) omenDef = 0.8; } catch {}
  const defStat = Math.round(dE.def * tEff * fortDef * omenDef);
  let aMul = 1; if (attM.charm) aMul *= 1.25; if (p.wcEffects && p.wcEffects.ambush) aMul *= 1.4;
  const aBase = Math.max(1, aE.atk - defStat), aType = typeMultiplier(attM, defM);
  let dAtk = home ? Math.round(dE.atk * HOME_ATK_BONUS) : dE.atk;
  if (owner && owner.wcEffects && owner.wcEffects.rattle) dAtk = Math.round(dAtk / 2);
  let dMul = 1; if (p.wcEffects && p.wcEffects.fortify) dMul *= 0.6; if (defM.charm) dMul *= 1.25;
  try { if (omenIs(tile, 'shackled_will')) dMul *= 0.5; } catch {}
  if (fort >= 2) dMul *= 1 + 0.1 * (fort - 1);
  const dBase = Math.max(1, dAtk - aE.def), dType = typeMultiplier(defM, attM);
  const hymn = (() => { try { return omenIs(tile, 'echoing_hymn') ? 8 : 0; } catch { return 0; } })();
  const attHp = Math.max(1, attM.hp - hymn);
  const stormFirst = defM.id === 'stormtalon';
  let win = 0, loss = 0, stale = 0;
  for (let ra = 0; ra <= 3; ra++) for (let rd = 0; rd <= 3; rd++) {
    const aD = Math.max(1, Math.round((Math.round(aBase * aType) + ra) * aMul));
    const dD = Math.max(1, Math.round((Math.round(dBase * dType) + rd) * dMul));
    if (stormFirst && dD >= attHp) { loss++; continue; }
    const attLeft = stormFirst ? attHp - dD : attHp;
    if (aD >= defM.hp) { win++; continue; }
    if (!stormFirst && dD >= attLeft) { loss++; continue; }
    stale++;
  }
  return { win: win / 16, loss: loss / 16, stale: stale / 16 };
}
// Expected value of attacking this tile with attM, in rough ✦ terms. Retreating costs about −8.
function botFightValue(p, attM, tile) {
  const o = botBattleOdds(p, attM, tile);
  const w = _w(p);
  const defM = tile.summonInstance;
  let tileWorth = 14 + (defM ? (defM.gen || 0) * 2 : 0);
  if (_hard(p) || w.run) tileWorth += _runValue(p, tile.pos, tile.element) * 0.8;
  if ((w.focus === 'leader' || _hard(p)) && tile.ownerId === _leaderIdx(p.idx)) tileWorth += 6;
  if (w.focus === 'wounded' && defM && defM.hp < defM.maxHp * 0.6) tileWorth += 8;
  if (_hard(p) && attM.isSpecial) tileWorth -= 4;   // don't throw an Ascendant at a coin flip
  let pWin = o.win;
  if (_easy(p)) pWin = Math.min(1, Math.max(0, pWin + (Math.random() - 0.5) * 0.4));
  const ev = pWin * (tileWorth + 4) + o.loss * (-(attM.cost || 8) - 8) + o.stale * (-4);
  return { ev: ev + (w.aggr - 0.5) * 16, odds: o };
}
function botBestAttacker(p, tile) {
  const opts = p.hand.filter(m => m.hp > 0);
  if (!opts.length) return null;
  const b = _best(opts, m => botFightValue(p, m, tile).ev);
  return b ? { m: b.item, ev: b.score } : null;
}

// ─── Decisions ────────────────────────────────────────────────────────────────
function botDecide(p) {
  const ph = G.phase, w = _w(p);
  switch (ph) {
    case 'setup': return botSetup(p);
    case 'resolve:turn_summary': return botDo(p, 'dismiss_turn_summary');
    case 'shop': return botShop(p);
    case 'roll': return botDo(p, 'roll');
    case 'resolve:landing': return botLanding(p);
    case 'resolve:claim': return botClaim(p);
    case 'resolve:own': return botOwn(p);
    case 'resolve:battle': return botBattle(p);
    case 'stalemate': {
      const sd = G.stalemateData, tile = sd && G.board[sd.tilePos];
      const b = tile && tile.summonInstance ? botBestAttacker(p, tile) : null;
      if (b && b.ev > -8) return botDo(p, 'stalemate_fight');
      return botDo(p, 'stalemate_continue');
    }
    case 'resolve:temple': return botTemple(p);
    case 'resolve:chest': return botChest(p);
    case 'resolve:heal_tile': {
      const missing = [..._stationedOf(p.idx).map(t => t.summonInstance), ...p.hand].reduce((s, m) => s + Math.min(10, m.maxHp - m.hp), 0);
      if (p.mana >= 10 && _spare(p, 10) && missing >= 25 - w.heal * 12) return botDo(p, 'heal_tile_apply');
      return botDo(p, 'heal_tile_skip');
    }
    case 'resolve:wildcard_cards': return botWildPick(p);
    case 'resolve:wildcard_target': return botWildTarget(p);
    case 'resolve:wildcard_coup_tile': {
      const tiles = G.board.filter(t => t.ownerId != null && t.ownerId !== p.idx && t.summonInstance && !G.players[t.ownerId].eliminated);
      const lead = _leaderIdx(p.idx);
      const b = _best(tiles, t => t.summonInstance.cost * 2 + t.summonInstance.hp / 5 + (t.ownerId === lead ? 8 : 0) + _runValue(p, t.pos, t.element));
      return b ? botDo(p, 'wildcard_coup_tile', { tilePos: b.item.pos }) : botDo(p, 'wildcard_coup_cancel');
    }
    case 'resolve:wildcard_coup_summon': {
      const b = _best(p.hand, m => -(m.cost * 3 + m.hp / 10) - (m.isSpecial ? 100 : 0));
      return b ? botDo(p, 'wildcard_coup_summon', { iid: b.item.iid }) : botDo(p, 'wildcard_coup_cancel');
    }
    case 'resolve:wildcard_shatter': {
      const picks = (G.wildCardPending && G.wildCardPending.picks) || [];
      const lead = _leaderIdx(p.idx);
      const cands = G.board.filter(t => t.summonInstance && !picks.includes(t.pos));
      const b = _best(cands, t => (t.ownerId === p.idx ? -100 : 0) + t.summonInstance.cost + (t.ownerId === lead ? 6 : 0));
      return b ? botDo(p, 'wildcard_shatter', { tilePos: b.item.pos }) : false;
    }
    case 'sanction:pick_tile': return botSanctionPick(p);
    case 'sanction:own': {
      if (!redeemBlockReason(p.idx)) return botDo(p, 'sanction_redeem');
      const tile = G.board[G.sanction.pickedPos];
      const myTiles = _tilesOf(p.idx).length;
      // a Sanctioned bot with spare tiles and almost enough to Redeem sells one off to get there
      if (!p.redeemUsed && myTiles > 1 && !isFinalRound() && tile && tile.summonInstance &&
          p.mana + sanctionSellValue(tile.summonInstance) >= REDEEM_COST && Math.random() < 0.7) return botDo(p, 'sanction_sacrifice');
      return botDo(p, 'sanction_wheel');
    }
    case 'sanction:omen': {
      const offers = G.sanction.omenOffers || [];
      const curses = offers.filter(id => OMENS[id] && OMENS[id].kind === 'curse');
      if (!curses.length) return botDo(p, 'sanction_omen_skip');
      const pref = { withering_brand: 5, shackled_will: 4, bleeding_sigil: 4, hollow_hunger: 3, toll_of_the_bell: 3, betrayers_mark: 2 };
      const b = _blunder(p) ? { item: _rnd(curses) } : _best(curses, id => (pref[id] || 1) + Math.random());
      return botDo(p, 'sanction_omen', { id: b.item });
    }
  }
  return false;
}

function botSetup(p) {
  const free = G.board.filter(t => t.kind === 'element' && (t.ownerId === null || t.ownerId === undefined));
  if (!p.hand.length || !free.length) return botDo(p, 'setup_pass');
  const w = _w(p);
  const order = { guardian: 0, vanguard: 1, assailant: 2 };
  const mine = _tilesOf(p.idx).map(t => t.pos);
  const dist = (x, y) => { const d = Math.abs(x - y) % 28; return Math.min(d, 28 - d); };
  const cands = [];
  for (const m of p.hand) for (const t of free) {
    let s = _homeMatch(m, t.element) * 10 - (order[m.arch] ?? 3) * 4;
    s += (mine.length ? Math.min(...mine.map(q => dist(q, t.pos))) : 7) * 0.3;   // spread out a little
    if (_hard(p) || w.run) s += _runValue(p, t.pos, t.element);
    s += Math.random() * (_easy(p) ? 8 : 1);
    cands.push({ m, t, s });
  }
  const b = _best(cands, c => c.s).item;
  return botDo(p, 'setup_claim', { tilePos: b.t.pos, iid: b.m.iid });
}

function botShop(p) {
  const w = _w(p), offers = G.shopOffers || [];
  const els = _setElements(p);
  // Purist sells an off-element card when the hand is full
  if (w.purist && p.hand.length >= 5) {
    const off = p.hand.find(m => m.type && !els.includes(m.type));
    if (off) return botDo(p, 'sell', { iid: off.iid });
  }
  if (p.hand.length >= 5 || !offers.length) return botDo(p, 'skip_shop');
  const scoreOffer = o => {
    if (!_spare(p, o.cost)) return -Infinity;
    let s = 0;
    if (o.type && els.includes(o.type)) s += 5;
    if (o.type2 && els.includes(o.type2)) s += 3;
    if (w.purist && !(o.type && els.includes(o.type))) return -Infinity;
    if ((_hard(p) || w.mono) && o.type && !els.includes(o.type)) s -= 4;
    s += (w.likes[o.rarity || o.arch] || 0);
    if (p.hand.length <= 1) s += 6;   // an empty hand can't claim or fight
    if (p.hand.length >= 4) s -= 3;
    s -= o.cost * 0.15;
    return s + Math.random() * 2;
  };
  if (_blunder(p)) {
    const ok = offers.filter(o => p.mana - o.cost >= 3);
    if (ok.length && Math.random() < 0.5) return botDo(p, 'buy', { iid: _rnd(ok).iid });
  }
  const b = _best(offers, scoreOffer);
  const bar = 6 - w.shop * 7;   // eager shoppers buy almost anything
  if (b && b.score > bar) return botDo(p, 'buy', { iid: b.item.iid });
  return botDo(p, 'skip_shop');
}

function botLandingScore(p, pos) {
  const w = _w(p), t = G.board[pos];
  const stationed = _stationedOf(p.idx).map(x => x.summonInstance);
  const missing = [...stationed, ...p.hand].reduce((s, m) => s + (m.maxHp - m.hp), 0);
  switch (t.kind) {
    case 'start': return 14 + w.well * 14 + (p.mana < 20 ? 10 : 0);
    case 'chest': return 6 + w.chest * 12;
    case 'heal':  return p.mana >= 10 ? Math.min(20, missing / 4) * (0.6 + w.heal) : 0;
    case 'temple': {
      if (p.mana < 20 + 3) return 0;
      const canTrade = p.hand.some(m => !m.isSpecial && m.type);
      return canTrade ? 4 + w.temple * 16 + (_hard(p) ? 4 : 0) : 0;
    }
  }
  if (t.ownerId === null || t.ownerId === undefined) {
    const aff = p.hand.filter(m => canUseSpecial(p.idx, m) && p.mana - m.cost >= 3);
    if (!aff.length) return 1;
    const best = Math.max(...aff.map(m => _homeMatch(m, t.element)));
    let s = 16 + best * 3;
    if (_hard(p) || w.run) s += _runValue(p, pos, t.element);
    if (w.mono && !aff.some(m => _homeMatch(m, t.element) === 2)) s -= 4;
    return s;
  }
  if (t.ownerId === p.idx) {
    const m = t.summonInstance;
    if (m && m.hp < m.maxHp * 0.7 && p.mana >= 5) return 5 + w.heal * 8;
    return 3;
  }
  try { if (omenIs(t, 'veil_of_stillness')) return 2; } catch {}
  const b = botBestAttacker(p, t);
  const retreat = -Math.min(8, p.mana) - (p.mana <= 8 ? 20 : 0);   // retreating to 0 = Sanctioned
  return Math.max(b ? b.ev : -99, retreat);
}
function botLanding(p) {
  const opts = (G.pendingLanding && G.pendingLanding.options) || [];
  if (!opts.length) return false;
  let pick = _blunder(p) ? _rnd(opts) : null;
  if (pick == null) {
    const b = _best(opts, pos => botLandingScore(p, pos) + Math.random() * 0.5);
    if (!b) glog(G.roomCode, `  🤖 ${p.name}: landing scores ${opts.map(pos => pos + '=' + botLandingScore(p, pos)).join(' ')}`);
    pick = b ? b.item : opts[2];
  }
  return botDo(p, 'choose_landing', { tilePos: pick });
}

function botClaim(p) {
  const w = _w(p), t = G.board[p.position];
  const cands = p.hand.filter(m => canUseSpecial(p.idx, m) && p.mana - m.cost >= 3);
  if (!cands.length) return botDo(p, 'skip_claim');
  const els = _setElements(p);
  const b = _best(cands, m => {
    let s = _homeMatch(m, t.element) * 8 + (w.likes[m.arch] || 0) - m.cost * 0.4 + m.hp / 12 + m.def / 3;
    if (m.arch === 'assailant') s -= 4;          // glass cannons are poor tile holders
    if (m.isSpecial) s += 10;
    if (w.mono && m.type && !els.includes(m.type)) s -= 3;
    if (!_spare(p, m.cost)) s -= 6;
    return s + Math.random();
  });
  if (_easy(p) && Math.random() < 0.15) return botDo(p, 'claim', { iid: _rnd(cands).iid });
  // keep Mana if every option is a poor fit and money is tight
  if (b.score < -6 && !_spare(p, b.item.cost)) return botDo(p, 'skip_claim');
  return botDo(p, 'claim', { iid: b.item.iid });
}

function botOwn(p) {
  const w = _w(p), t = G.board[p.position], m = t.summonInstance;
  if (m && m.hp < m.maxHp * (0.45 + w.heal * 0.35) && p.mana >= 5 && _spare(p, 5)) return botDo(p, 'heal_stationed');
  // Mana trouble: cash in a spare tile rather than be Sanctioned
  if (m && p.mana <= 4 && _tilesOf(p.idx).length >= 3) return botDo(p, 'sacrifice_tile');
  // A better holder in hand (home ground where the current one isn't)
  if (m && (!_easy(p))) {
    const cur = _homeMatch(m, t.element);
    const better = p.hand.filter(h => canUseSpecial(p.idx, h) && _spare(p, h.cost) && h.arch !== 'assailant' && _homeMatch(h, t.element) > cur);
    if (better.length && (cur === 0 || w.builder || _hard(p))) {
      const b = _best(better, h => h.hp + h.def * 2);
      return botDo(p, 'swap', { newSummonIid: b.item.iid });
    }
  }
  // Architect / hard: repaint the tile to the summon's element when it would build a run
  if (m && m.type && (w.builder || _hard(p)) && t.element !== m.type && p.mana >= CHANGE_ELEMENT_COST && _spare(p, CHANGE_ELEMENT_COST)) {
    if (_runValue(p, t.pos, m.type) >= 3 || (w.builder && _homeMatch(m, t.element) === 0)) return botDo(p, 'change_element', { element: m.type });
  }
  return botDo(p, 'skip_own');
}

function botBattle(p) {
  const t = G.board[p.position];
  if (!p.hand.length) return botDo(p, 'retreat');
  // v1.0.143: once an attacker is shown on the board, strike with it (Easy bots used to re-roll the choice and flip back and forth)
  const shown = G.pendingAttackerSummon && p.hand.find(m => m.iid === G.pendingAttackerSummon.iid);
  if (shown) return botDo(p, 'attack', { iid: shown.iid });
  const b = botBestAttacker(p, t);
  const retreatV = -Math.min(8, p.mana) - (p.mana <= 8 ? 20 : 0);
  if (!b || b.ev < retreatV) {
    return botDo(p, 'retreat');
  }
  // show the chosen attacker on the board first, then strike on the next step
  if (BOT_SPEEDS[G.botSpeed || 'normal'] !== 0) return botDo(p, 'preview_attacker', { iid: b.m.iid }) || true;
  return botDo(p, 'attack', { iid: b.m.iid });
}

function botTemple(p) {
  const w = _w(p), offers = (G.pendingTemple && G.pendingTemple.offers) || [];
  const trades = [];
  for (const o of offers) {
    if (p.mana < o.cost || !_spare(p, o.cost)) continue;
    const give = p.hand.filter(m => m.type === o.type && !m.isSpecial);
    if (!give.length) continue;
    const g = _best(give, m => -(m.cost + m.hp / 10)).item;
    let s = 6 + (o.hp + o.atk) / 10 - g.cost * 0.5;
    if (_setElements(p).includes(o.type)) s += 4;
    if (o.condition === 'mana40' && p.mana - o.cost >= 40) s += 3;
    trades.push({ o, g, s });
  }
  const b = _best(trades, x => x.s);
  if (b && (Math.random() < w.temple || _hard(p))) return botDo(p, 'temple_trade', { specialIid: b.item.o.iid, sacrificeIid: b.item.g.iid });
  return botDo(p, 'temple_leave');
}

function botChest(p) {
  const w = _w(p), c = G.pendingChest;
  if (!c) return botDo(p, 'chest_skip');
  if (c.kind === 'potion') {
    const all = [..._stationedOf(p.idx).map(t => t.summonInstance), ...p.hand];
    const b = _best(all, m => m.maxHp - m.hp);
    if (b && b.score >= 10) return botDo(p, 'chest_apply_potion', { iid: b.item.iid });
    return botDo(p, 'chest_skip');   // convert to Mana
  }
  if (c.kind === 'charm') {
    const h = _best(p.hand.filter(m => !m.charm), m => m.atk);
    if (h) return botDo(p, 'chest_assign_charm', { iid: h.item.iid });
    const s = _best(_stationedOf(p.idx).filter(t => !t.summonInstance.charm), t => t.summonInstance.atk);
    if (s) return botDo(p, 'chest_assign_charm', { tilePos: s.item.pos });
    return botDo(p, 'chest_discard');
  }
  if (c.kind === 'warp') return botDo(p, Math.random() < 0.35 + w.chest * 0.5 ? 'chest_warp' : 'chest_discard');
  return botDo(p, 'chest_skip');   // free summon already in hand
}

function botWildPick(p) {
  const w = _w(p), d = G.wildCardDrawn;
  if (!d) return botDo(p, 'wildcard_skip');
  const opp = G.players.filter(pl => pl.idx !== p.idx && !pl.eliminated);
  const active = opp.filter(pl => !pl.sanctioned);
  const enemyStationed = G.board.filter(t => t.ownerId != null && t.ownerId !== p.idx && t.summonInstance);
  const myHurt = _stationedOf(p.idx).some(t => t.summonInstance.maxHp - t.summonInstance.hp >= 15);
  const val = {
    mend: myHurt ? 6 : -9, stumble: active.length ? 4 : -9, delay: active.length ? 4 : -9, jinx: active.length ? 5 : -9,
    ambush: 6, fortify: 5, rattle: 4, poach: opp.some(pl => pl.hand.length) && p.hand.length < 5 ? 7 : -9,
    coup: p.hand.length && enemyStationed.length ? 14 : -9, plague: enemyStationed.length ? 10 : -9,
    windfall: 9, shatter: enemyStationed.length >= 2 ? 10 : -9,
  };
  if (w.tricks) { val.stumble += 5; val.delay += 5; val.jinx += 5; val.rattle += 5; val.poach += 4; }
  if (w.focus === 'leader') { val.plague += 3; val.coup += 2; val.rattle += 2; }
  if (w.aggr > 0.7) val.ambush += 4;
  if (w.aggr < 0.3) val.fortify += 4;
  if (w.gamble) { val.coup += 4; val.shatter += 4; val.windfall += 3; }
  const cards = ['low', 'mid', 'high'].map(tier => d[tier] && { tier, c: d[tier] }).filter(Boolean)
    .filter(x => p.mana >= x.c.cost && p.mana - x.c.cost >= Math.max(3, w.reserve * 0.6));
  const b = _best(cards, x => (val[x.c.id] ?? 0) - x.c.cost / 10 + Math.random() * 2);
  const bar = (1 - w.wc) * 6;
  if (b && b.score > bar) {
    if (botDo(p, 'wildcard_select', { tier: b.item.tier, cardId: b.item.c.id })) return true;
  }
  return botDo(p, 'wildcard_skip');
}

function botWildTarget(p) {
  const pend = G.wildCardPending;
  if (!pend) return false;
  if (pend.cardId === 'mend') {
    const b = _best(_stationedOf(p.idx), t => t.summonInstance.maxHp - t.summonInstance.hp);
    return b ? botDo(p, 'wildcard_target', { tilePos: b.item.pos }) : false;
  }
  let opp = G.players.filter(pl => pl.idx !== p.idx && !pl.eliminated);
  if (WC_NO_SANCTIONED.includes(pend.cardId)) opp = opp.filter(pl => !pl.sanctioned);
  if (pend.cardId === 'poach') opp = opp.filter(pl => pl.hand.length);
  if (pend.cardId === 'plague') opp = opp.filter(pl => _stationedOf(pl.idx).length);
  if (!opp.length) return false;
  const lead = _leaderIdx(p.idx);
  const b = _best(opp, pl => (pl.idx === lead ? 10 : 0) + _tilesOf(pl.idx).length + (pend.cardId === 'plague' ? _stationedOf(pl.idx).length * 3 : 0) + Math.random() * 3);
  return botDo(p, 'wildcard_target', { targetIdx: b.item.idx });
}

function botSanctionPick(p) {
  const offers = (G.sanction && G.sanction.offers) || [];
  if (!offers.length) return botDo(p, 'sanction_pass');
  const lead = _leaderIdx(p.idx);
  const canRedeem = !p.redeemUsed && !isFinalRound();
  const b = _best(offers, pos => {
    const t = G.board[pos];
    if (t.ownerId === p.idx) return canRedeem && p.mana >= REDEEM_COST ? 30 : 8 + Math.random() * 4;
    return 6 + (t.ownerId === lead ? 6 : 0) + Math.random() * 4;
  });
  return botDo(p, 'sanction_pick_tile', { tilePos: b.item });
}

// ─── Lobby actions + hooks ────────────────────────────────────────────────────
function addBotToRoom(botId) {
  if (G.players.length >= 6) return null;
  const inRoomIds = new Set(G.players.filter(p => p.isBot).map(p => p.botId));
  const pool = BOTS.filter(b => !inRoomIds.has(b.id));
  const def = botId ? BOT_BY_ID[botId] : _rnd(pool);
  if (!def || inRoomIds.has(def.id)) return null;
  const p = addPlayer(def.name, PLAYER_COLORS[G.players.length], def.set);
  p.isBot = true;
  p.botId = def.id;
  p.sessionKey = 'bot-' + p.sessionKey;   // never matches a phone's saved session
  G.players.push(p);
  if (G.players.length >= 5 && G.roundLimit === 20) { G.roundLimit = 10; log(`⏱ Round limit auto-set to 10 (${G.players.length} players)`); }
  log(`🤖 ${def.name} the ${def.style} joined (set ${def.set})`);
  return p;
}

handlers.add_bot = function (ws, conn, data) {
  if (!G || G.phase !== 'lobby') return sendError(ws, 'Bots can only be added in the lobby');
  if (!conn.isBoard || conn.isSpectator) return sendError(ws, 'Only the host can add bots');
  if (G.players.length >= 6) return sendError(ws, 'Game full (max 6 players)');
  if (!addBotToRoom()) return sendError(ws, 'No more bots available');
  broadcast();
};

handlers.remove_bot = function (ws, conn, data) {
  if (!G || G.phase !== 'lobby') return sendError(ws, 'Bots can only be removed in the lobby');
  if (!conn.isBoard || conn.isSpectator) return sendError(ws, 'Only the host can remove bots');
  const idx = Number(data.idx);
  const p = G.players[idx];
  if (!p || !p.isBot) return sendError(ws, 'That seat is not a bot');
  G.players.splice(idx, 1);
  G.players.forEach((pl, i) => { pl.idx = i; pl.color = PLAYER_COLORS[i]; });
  for (const [, c] of clients) {   // phones keep pointing at their own seat
    if (c.roomCode === G.roomCode && c.sessionKey) {
      const pl = G.players.find(x => x.sessionKey === c.sessionKey);
      c.playerIdx = pl ? pl.idx : null;
    }
  }
  if (G.players.length <= 4 && G.roundLimit === 10) G.roundLimit = 20;
  log(`🤖 ${p.name} left the lobby`);
  broadcast();
};

handlers.set_bot_speed = function (ws, conn, data) {
  if (!G) return;
  if (!conn.isBoard || conn.isSpectator) return sendError(ws, 'Only the host can change bot speed');
  const s = String(data.speed || '');
  if (!(s in BOT_SPEEDS)) return sendError(ws, 'Unknown speed');
  G.botSpeed = s;
  log(`🤖 Bot speed: ${s}`);
  broadcast();
};

// End game / New game reset the room — the same bots sit back down in the new lobby
for (const name of ['end_game', 'new_game']) {
  const orig = handlers[name];
  handlers[name] = function (ws, conn, data) {
    const bots = G ? G.players.filter(p => p.isBot).map(p => p.botId) : [];
    const speed = G && G.botSpeed;
    orig(ws, conn, data);
    if (!G || G.phase !== 'lobby' || !conn.isBoard) return;
    if (speed) G.botSpeed = speed;
    let added = 0;
    for (const id of bots) if (addBotToRoom(id)) added++;
    if (added || speed) broadcast();
  };
}

// publicState: tell screens which seats are bots
const _publicStateOrig = publicState;
publicState = function () {   // eslint-disable-line no-global-assign
  const s = _publicStateOrig();
  s.botSpeed = G.botSpeed || 'normal';
  for (const sp of s.players) {
    const p = G.players[sp.idx];
    if (p && p.isBot) sp.isBot = true;   // v1.0.143: style / difficulty stay secret (players learn them by playing)
  }
  return s;
};

// Every broadcast: if a bot has to act now, schedule it
const _broadcastOrig = broadcast;
broadcast = function (extra) {   // eslint-disable-line no-global-assign
  _broadcastOrig(extra);
  try { botMaybeSchedule(); } catch (err) { reportCrash('bot schedule', err, G && G.roomCode); }
};

// After a restart, rooms restored from game-state.json may be waiting on a bot
setTimeout(() => { for (const code of rooms.keys()) inRoom(code, () => { try { botMaybeSchedule(); } catch {} }); }, 3000);
