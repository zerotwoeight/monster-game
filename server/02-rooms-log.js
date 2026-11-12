// Summoner's Gambit server · 02-rooms-log.js · Game state, room registry, crash reporting, live log, room epochs
// Loaded in order by server.js (v1.0.139, L2 split). All parts share one global scope, like <script> tags.
'use strict';

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
    turnCount: 0,            // turns played since round 1 (used for per-turn keys, not for rounds)
    round: 1,                // v1.0.127: real round number after setup — +1 each time play wraps past the last seat
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
    pendingWildCard: false,  // v1.0.110: set true when the player rolls doubles
    wcTable: null,           // v1.0.110: { seq, playerIdx, dice, pick, skipped } — drives the board's wild-card table
    skipSetup: false,        // v1.0.112: host lobby toggle — replace setup phase with Auto Setup
    autoSetupRunning: false, // v1.0.112: true while autoSetup() is placing (setup actions blocked)
    pendingLanding: null,    // { roll, options:[pos,pos,pos] } — set after roll, cleared on choose_landing
    wildCardDrawn: null,     // { low: card, mid: card, high: card }
    wildCardPending: null,   // { cardId, step } for multi-step cards (coup/shatter)
    turnSummary: null,       // snapshot of this turn's income/effects for the summary screen
    roundCallout: null,      // null | 'penultimate' | 'final' — set at round boundary, cleared after callout
    lastActivityAt: Date.now(), // timestamp of last broadcast — used for stale room cleanup
  };
}

// Defer a room-scoped action — safe across async gaps (setTimeout loses G closure)
// ─── v1.0.134: crash reporting ────────────────────────────────────────────────
// Every action and game event goes into a short per-room trail (memory only). When something fails — an
// action, a timer, an uncaught error, or an error a phone/board reports — the trail is printed to the
// terminal and appended to crash-log.txt (DATA_DIR) so the moment before the crash can be read back.
// v1.0.135: live game log. Every action, game event, timer, connect/disconnect and client slow-down is printed to the
// terminal and appended to DATA_DIR/logs/game-YYYY-MM-DD.log. Turn off with SG_LOG=0.
const LIVE_LOG = process.env.SG_LOG !== '0';
let _bstat = { n: 0, bytes: 0, ms: 0 };
function glog(code, line) {
  if (!LIVE_LOG) return;
  const d = new Date(), ts = d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  const text = `${ts} [${code || '----'}] ${line}`;
  console.log(text);
  try {
    const dir = path.join(DATA_DIR, 'logs'); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, `game-${d.toISOString().slice(0, 10)}.log`), text + '\n', 'utf8');
  } catch {}
}
function _bsum() { const b = _bstat; _bstat = { n: 0, bytes: 0, ms: 0 }; return b.n ? ` · ${b.n} update${b.n > 1 ? 's' : ''} ${Math.round(b.bytes / 1024)}KB ${b.ms.toFixed(0)}ms` : ''; }
const _trails = new Map();
function trail(code, line) {
  if (!code) return;
  let t = _trails.get(code); if (!t) { t = []; _trails.set(code, t); }
  t.push(new Date().toISOString().slice(11, 19) + '  ' + String(line).slice(0, 220));
  if (t.length > 60) t.shift();
}
function reportCrash(where, err, code) {
  const head = `[crash] ${new Date().toISOString()} · ${SERVER_VERSION} · ${where}${code ? ' · room ' + code : ''}`;
  const msg = err && (err.stack || err.message) ? (err.stack || err.message) : String(err);
  const room = code && rooms.get(code);
  const state = room ? `phase ${room.phase} · round ${room.round} · turn ${room.turnCount} · current ${room.players[room.currentPlayer] ? room.players[room.currentPlayer].name : room.currentPlayer}` : '';
  const t = (code && _trails.get(code)) || [];
  const text = `${head}\n${msg}\n` + (state ? '  state: ' + state + '\n' : '') + `  last ${t.length} actions/events:\n${t.map(l => '    ' + l).join('\n')}\n\n`;
  console.error(text);
  try { fs.appendFileSync(path.join(DATA_DIR, 'crash-log.txt'), text, 'utf8'); } catch {}
}

// v1.0.130 (S5): a room's epoch goes up whenever its game is reset or ended (End game, New game,
// abandoned-room reset, game over, admin clear). Timers remember the epoch they were made in and
// do nothing if it has moved on, so a step left over from the old game can't run in the new one.
// Kept outside the room object (which End/New game replace) and keyed by room code.
const roomEpochs = new Map();
function roomEpoch(code) { return roomEpochs.get(code) || 0; }
function bumpRoomEpoch(code) { if (code) roomEpochs.set(code, roomEpoch(code) + 1); }
// v1.0.130: reset a room to a fresh lobby, keeping its host key (S3) and cancelling old timers
function resetRoom(code) {
  const old = rooms.get(code);
  bumpRoomEpoch(code);
  const room = freshGame(code);
  if (old && old.hostKey) room.hostKey = old.hostKey;
  rooms.set(code, room);
  return room;
}

// v1.0.140 (L1): every way into the game (a phone or board message, a timer, a disconnect) runs through
// inRoom(). It points G at that one room for the call and puts it back afterwards, so G is null between
// calls and nothing can ever act on a room left over from an earlier call.
function inRoom(code, fn) {
  const prev = G;
  G = (code && rooms.get(code)) || null;
  try { return fn(G); } finally { G = prev; }
}

function scheduleRoomAction(roomCode, fn, ms) {
  // v1.0.96: capture the forfeit generation — if the active player forfeits before this
  // fires, the turn was already advanced by forfeitPlayer() and this timer must not run.
  const _r = rooms.get(roomCode);
  const gen = _r ? (_r._forfeitGen || 0) : 0;
  const epoch = roomEpoch(roomCode);   // v1.0.130 (S5)
  setTimeout(() => {
    if (roomEpoch(roomCode) !== epoch) return;   // v1.0.130: the game was reset/ended since — drop this step
    inRoom(roomCode, () => {   // v1.0.140 (L1)
      if (!G) return;
      if ((G._forfeitGen || 0) !== gen) return;
      // v1.0.126 (S4): a bug in one room's delayed step must not crash every game
      const _t0 = Date.now(); _bstat = { n: 0, bytes: 0, ms: 0 };
      try { fn(); }
      catch (err) { reportCrash('timer step', err, roomCode); }   // v1.0.134
      glog(roomCode, `⏱ timer ${fn.name || 'step'} (after ${ms}ms) · ${Date.now() - _t0}ms${_bsum()}`);   // v1.0.135
    });
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
    wcEffects: { stumble:false, delay:false, jinx:false, ambush:false, fortify:false, rattle:false, windfall:false, levy:false, flurry:false, phoenix:false },
    wcShop: null,   // v1.0.150: { kind:'bargain'|'patronage', left }
    // Phase 1: per-player ability state
    hemorrhageStacks: 0,       // Plague Herald: turns remaining of HP drain
    hemorrhageAmt: 0,          // Plague Herald: HP drained per tick
    lastTurnLandedOnWell: false,  // true if player landed on tile 0 (Mana Well) last turn
    notification: null,  // { cardId, cardName, cardDesc, castByName, castByColor, tier }
    eliminated: false,   // true once player owns 0 tiles at end of their own turn (post-setup)
    eliminatedRank: null, // set when eliminated — higher = survived longer (e.g. last eliminated = 1)
    sanctioned: false,    // v1.0.113: Mana hit 0 — sub-player, no income, can Redeem once
    sanctionedAt: null,   // v1.0.113: turnCount when last Sanctioned
    redeemUsed: false,    // v1.0.113: Redeem is once per game
    lastTurnBattleManaGain: 0,   // mana received from battle outcomes last turn
    lastTurnBattleManaLoss: 0,   // mana paid/lost from battle outcomes last turn
  };
}

function log(text) {
  if (!G) return;
  trail(G.roomCode, text);   // v1.0.134: game events also go into the crash trail
  glog(G.roomCode, '  · ' + text);   // v1.0.135
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

