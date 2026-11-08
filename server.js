// ─── Summon Board Game — Local Multiplayer Server ────────────────────────────
// Run: node server.js
// Players connect to http://<your-ip>:3000/player
// Board view:  http://<your-ip>:3000/board
// ─────────────────────────────────────────────────────────────────────────────

// v1.0.139 (L2): the server code now lives in server/ in ten files, loaded in order below.
// They share one global scope (like <script> tags in a page), so everything behaves exactly as when it was one file.
// Version bumps still go here.

'use strict';

globalThis.SERVER_VERSION = 'v1.0.143';   // v1.0.143: bots wait for the board's animations (board_busy), keep the attacker they showed, style hidden from screens
// prev: v1.0.142;   // v1.0.142: bots — server-side seats with 12 named personalities (server/11-bots.js), Add/Remove Bot + Bot speed in the lobby
// prev: v1.0.141;   // v1.0.141: HP buff for 3 Ascendants + 3 Rares. v1.0.140: L1 — every entry point runs inside inRoom(code); G is null between calls; stale-room broadcasts refused
// v1.0.139: L2 — server split into server/01…10 (no behaviour change)
// prev: v1.0.125;   // v1.0.125: Lobby news — /admin News editor, news.json on DATA_DIR, live push to boards + phones
// prev: v1.0.124;   // v1.0.124: Omen draws always include 1 Blessing + 1 Curse (third random)
// prev: v1.0.138;   // v1.0.138: lastBattle carries attHpBefore/defHpBefore (phone HP animation); join sting on board
// // v1.0.137: turn summary remembers the tally finished (turnSummary.tallyDone) so a phone that gets an update mid-summary doesn't wait forever
// prev: v1.0.136;   // v1.0.136: Jinx / Delay / Stumble can't target a Sanctioned player (no income, shop or roll to affect); board tally plays all at once
// prev: v1.0.135;   // v1.0.135: live game log (terminal + logs/game-<date>.log): every action with timing and update size, timers, connects, page stalls/slow renders from clients; second server on a busy port now exits
// prev: v1.0.134;   // v1.0.134: crash reporting (action trail per room, phone/board errors reported to the server, crash-log.txt) + ADMIN_KEY fallback
// prev: v1.0.133;   // v1.0.133: S7 — only real actions run, join needs a real room code, room creation capped (one per board screen, 100 total)
// prev: v1.0.132;   // v1.0.132: Wild Card curses announce when they land (U5) — G.wcTriggers {seq, id, idx, byIdx, byName, …}, caster remembered in p.wcBy
// prev: v1.0.131;   // v1.0.131: host tools (G3) — Nudge any player, Skip the current turn, Remove connected players
// prev: v1.0.130;   // v1.0.130: old timers can't fire into a reset room (S5); host key kept through End/New game; WebSocket messages capped at 64 KB (S6)
// prev: v1.0.129;   // v1.0.129: tile element only affects the stationed defender (no tile DEF change on the attacker during counter-strikes)
// prev: v1.0.128;   // v1.0.128: home tile gives the defender +15% ATK as well as +15% DEF
// prev: v1.0.127;   // v1.0.127: real round counter (G.round) — eliminated seats no longer stretch the game or shift the round callouts (G2)
// prev: v1.0.126;   // v1.0.126: hardening — bad URLs can't crash the server (S1), admin needs ADMIN_KEY + POST (S2), host key + no room-code leaks (S3), timer errors contained (S4)
// prev: v1.0.122;   // v1.0.122: version bump — clients reload for board v0.6.42 / player v0.5.39 (Sanction moment + notice wait for the battle to finish; phone battle music primed)
// prev: v1.0.121;   // v1.0.121: Omen notices on the target's phone; turn summary gets Omens, per-summon Gen/heal, recallable per player (mySummary)
// prev: v1.0.120;   // v1.0.120: version bump — clients reload for board v0.6.41 / board-fx v0.6.35 / battle-tester v1.0.104 (Sanction SFX + tarot moments)
// prev: v1.0.119;   // v1.0.119: Omens — 12 one-round Blessings/Curses a Sanctioned player places on a rival's tile
// prev: v1.0.118;   // v1.0.118: sanction:reveal phase — the turn holds while the board reveals the result (card-game flow)
// prev: v1.0.117;   // v1.0.117: Wheel of Fortune — tile Fortune meter, battle effects, bounties, jackpot, Doom
// prev: v1.0.116;   // v1.0.116: sanction_preview — board mirrors the tile the Sanctioned player is looking at
// prev: v1.0.115;   // v1.0.115: Sanction turn — pick 1 of 3 claimed tiles → own: Sacrifice / Redeem / pass; opponent: Omen (pass only until Omens land)
// prev: v1.0.114;   // v1.0.114: Redeem refunds a 5✦ base (card shows 15✦, net cost 10✦)
// prev: v1.0.113;   // v1.0.113: Sanctioned (Mana 0 no longer eliminates) — rules only
// prev: v1.0.112;   // v1.0.112: Skip Setup lobby toggle (G.skipSetup) + autoSetup()
// prev: v1.0.111;   // v1.0.111: players[].lastStumble for the phone dice tray (player v0.5.30)
// prev: v1.0.110;   // v1.0.110: Wild Cards trigger on rolling doubles (replaces passing the Mana Well) + board wild-card table signals
// prev: v1.0.109;   // v1.0.109: randomised starter sets (8 pools, 1 Guardian + 4 random) + sets G Dead Covenant / H Ancient Guard
// prev: v1.0.108   // v1.0.108: version bump — player v0.5.27 (Ascendant unlock condition on detail sheet)
// prev: v1.0.107   // v1.0.107: version bump — player v0.5.26 (starter-set banner art)
// prev: v1.0.106   // v1.0.106: version bump — board v0.6.25 / player v0.5.25 (new art + big-moment animations)


const vm   = require('vm');
const fs   = require('fs');
const path = require('path');
globalThis.require   = require;     // the parts use require(), __dirname like the old single file
globalThis.__dirname = __dirname;

const SERVER_PARTS = [
  '01-data.js',   // Monster data, starter sets, Wild Card pools, helpers
  '02-rooms-log.js',   // Game state, room registry, crash reporting, live log, room epochs
  '03-combat.js',   // Combat: tile effects, strikes, battle resolution, effect recorder, tile synergy, mono-element
  '04-abilities-income.js',   // Abilities, passive income, special tiles, chest draws
  '05-state-elimination.js',   // State broadcasting helpers, publicState, elimination, forfeit
  '06-turns.js',   // Turn management: turn start, setup, advanceTurn, rounds, Wild Card triggers
  '07-sanction.js',   // Wheel of Fortune, Omens, Sanction turn
  '08-handlers.js',   // Action handlers (every message a phone or board can send)
  '09-battle-outcome.js',   // Shared helpers and battle-outcome helpers
  '10-network.js',   // HTTP + WebSocket server, lobby news, admin, static files, persistence, startup
  '11-bots.js',   // v1.0.142: bots — personalities, decisions, lobby Add/Remove Bot, bot speed
];
for (const part of SERVER_PARTS) {
  const file = path.join(__dirname, 'server', part);
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });   // errors show server/<part>:<line>
}
