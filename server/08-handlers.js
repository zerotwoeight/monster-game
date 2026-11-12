// Summoner's Gambit server · 08-handlers.js · Action handlers (every message a phone or board can send)
// Loaded in order by server.js (v1.0.139, L2 split). All parts share one global scope, like <script> tags.
'use strict';

// ─── ACTION HANDLERS ─────────────────────────────────────────────────────────

const handlers = {

  // ── Lobby ──────────────────────────────────────────────────────────────────

  // Board opens and claims (or creates) a room
  board_connect(ws, conn, data) {
    // v1.0.126 (S3): the board is the host. A room's host key is made when the room is created and
    // saved by that board; reconnecting to an existing room needs it, so nobody can take over a game
    // by typing its code. Rooms restored from before v1.0.126 have no key — the first board claims it.
    const code = String(data.roomCode || '').toUpperCase().trim().slice(0, 8);
    const key = String(data.hostKey || '');
    let room = code ? rooms.get(code) : null;
    if (room) {
      if (room.hostKey && key !== room.hostKey) {
        wsSend(ws, { type: 'host_denied', roomCode: room.roomCode,
          message: 'This room is already hosted from another screen. Open it as a spectator, or ask the admin to reset the host.' });
        return;
      }
    } else {
      // v1.0.133 (S7): a board screen that already hosts a room keeps it instead of making another
      const mine = conn.isBoard && conn.roomCode && rooms.get(conn.roomCode);
      if (mine) room = mine;
      else {
        if (rooms.size >= MAX_ROOMS) return sendError(ws, 'The server is full right now. Try again in a few minutes.');
        room = freshGame(undefined);   // v1.0.126: unknown codes get a fresh random room, not the typed code
        rooms.set(room.roomCode, room);
      }
    }
    if (!room.hostKey) room.hostKey = crypto.randomBytes(12).toString('hex');
    conn.roomCode = room.roomCode;
    conn.isBoard = true;
    G = room;
    wsSend(ws, { type: 'host_key', roomCode: room.roomCode, hostKey: room.hostKey });
    broadcast();
  },

  // Spectator connects to an existing room (read-only, no actions)
  spectate_connect(ws, conn, data) {
    const code = String(data.roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return sendError(ws, 'Room not found — check the room code');
    conn.roomCode = room.roomCode;
    conn.isSpectator = true;
    G = room;
    // Send current state directly to this spectator
    wsSend(ws, { type: 'state', game: publicState() });
  },

  join(ws, conn, data) {
    const code = String(data.roomCode || '').toUpperCase().trim();
    const name  = String(data.name  || 'Player').slice(0, 18);

    // v1.0.133 (S7): a real room code is required (the old "no code + one room → join it" fallback is gone)
    if (!/^[A-Z0-9]{4}$/.test(code)) return sendError(ws, 'Enter the 4-character room code');
    let room = rooms.get(code);
    if (!room) return sendError(ws, 'Room not found — ask the host for the room code');

    // If the room is not in lobby phase, check whether it's still active.
    // An abandoned room (no live WebSocket connections) is reset to a fresh lobby
    // so new players aren't permanently locked out by a stale session.
    if (room.phase !== 'lobby') {
      const hasActiveConn = [...clients.values()].some(c => c.roomCode === room.roomCode);
      if (!hasActiveConn) {
        log(`🔄 Player joining abandoned room ${room.roomCode} (phase: ${room.phase}) — reset to lobby`);
        room = resetRoom(room.roomCode);   // v1.0.130
      }
    }

    G = room;
    conn.roomCode = room.roomCode;

    // During an active game: allow name-based manual rejoin for disconnected players
    if (G.phase !== 'lobby') {
      const disc = G.players.find(p => !p.isConnected && !p.forfeited && p.name.toLowerCase() === name.toLowerCase());
      if (disc) {
        conn.playerIdx = disc.idx;
        conn.sessionKey = disc.sessionKey;
        disc.isConnected = true;
        if (G.pausedFor && G.pausedFor.idx === disc.idx) G.pausedFor = null;
        log(`🔄 ${disc.name} manually rejoined`);
        wsSend(ws, { type: 'session', sessionKey: disc.sessionKey });
        broadcast();
        return;
      }
      return sendError(ws, 'Game already in progress');
    }

    // In lobby: if this name matches a disconnected slot, reclaim it (handles lost sessionKey)
    const discLobby = G.players.find(p => !p.isConnected && p.name.toLowerCase() === name.toLowerCase());
    if (discLobby) {
      discLobby.isConnected = true;
      conn.playerIdx = discLobby.idx;
      conn.sessionKey = discLobby.sessionKey;
      log(`🔄 ${discLobby.name} reclaimed lobby slot`);
      wsSend(ws, { type: 'session', sessionKey: discLobby.sessionKey });
      broadcast();
      return;
    }

    if (G.players.length >= 6) return sendError(ws, 'Game full (max 6 players)');
    const set   = STARTER_SET_KEYS.includes(data.starterSet) ? data.starterSet : 'C';
    const color = PLAYER_COLORS[G.players.length];
    const p = addPlayer(name, color, set);
    G.players.push(p);
    conn.playerIdx = p.idx;
    conn.sessionKey = p.sessionKey;
    // Auto-adjust default round limit for large groups
    if (G.players.length >= 5 && G.roundLimit === 20) {
      G.roundLimit = 10;
      log(`⏱ Round limit auto-set to 10 (${G.players.length} players)`);
    } else if (G.players.length <= 4 && G.roundLimit === 10) {
      G.roundLimit = 20;
      log(`⏱ Round limit auto-set to 20 (${G.players.length} players)`);
    }
    log(`👤 ${name} joined with set ${set}`);
    wsSend(ws, { type: 'session', sessionKey: p.sessionKey });
    broadcast();
  },

  rejoin(ws, conn, data) {
    const key = String(data.sessionKey || '');
    // Search all rooms for this session key
    let foundRoom = null, foundPlayer = null;
    for (const [, room] of rooms) {
      const pl = room.players.find(p => p.sessionKey === key);
      if (pl) { foundRoom = room; foundPlayer = pl; break; }
    }
    if (!foundRoom || !foundPlayer) return sendError(ws, 'Session expired — please rejoin');
    if (foundPlayer.forfeited) { wsSend(ws, { type: 'left_game' }); return; } // v1.0.96: out for good
    G = foundRoom;
    conn.roomCode = foundRoom.roomCode;
    conn.playerIdx = foundPlayer.idx;
    conn.sessionKey = foundPlayer.sessionKey;
    foundPlayer.isConnected = true;
    if (G.pausedFor && G.pausedFor.idx === foundPlayer.idx) {
      G.pausedFor = null;
      log(`✅ ${foundPlayer.name} reconnected — game resumed`);
    } else {
      log(`🔄 ${foundPlayer.name} reconnected`);
    }
    broadcast();
  },

  set_round_limit(ws, conn, data) {
    if (!G || G.phase !== 'lobby') return sendError(ws, 'Not in lobby');
    const limit = Number(data.limit);
    if (![10, 20, 30].includes(limit)) return sendError(ws, 'Invalid round limit');
    G.roundLimit = limit;
    log(`⏱ Round limit set to ${limit} rounds per player`);
    broadcast();
  },

  // ── Sanction turn (v1.0.115) ────────────────────────────────────────────────
  sanction_pick_tile(ws, conn, data) {
    if (!guardTurn(ws, conn, ['sanction:pick_tile'], 'Not choosing a tile')) return;
    const pos = parseInt(data.tilePos, 10);
    if (!G.sanction || !G.sanction.offers.includes(pos)) return sendError(ws, 'Pick one of the offered tiles');
    G.sanction.pickedPos = pos;
    G.sanction.previewPos = pos;
    const own = G.board[pos].ownerId === G.currentPlayer;
    G.phase = own ? 'sanction:own' : 'sanction:omen';
    G.sanction.omenOffers = own ? [] : drawOmens(3);   // v1.0.119
    log(`⛓ ${G.players[G.currentPlayer].name} picks tile ${pos} (${own ? 'own tile' : 'opponent tile'})`);
    broadcast();
  },
  // v1.0.116: mirror of preview_attacker — which offered tile the player is looking at (null = none)
  sanction_preview(ws, conn, data) {
    if (!G || G.phase !== 'sanction:pick_tile' || !G.sanction) return;
    if (conn.playerIdx !== G.currentPlayer) return;
    const pos = data.tilePos == null ? null : parseInt(data.tilePos, 10);
    if (pos !== null && !G.sanction.offers.includes(pos)) return;
    if (G.sanction.previewPos === pos) return;
    G.sanction.previewPos = pos;
    broadcast();
  },
  sanction_sacrifice(ws, conn, data) {
    if (!guardTurn(ws, conn, ['sanction:own'], 'Not on your own tile')) return;
    const p = G.players[G.currentPlayer];
    const tile = G.board[G.sanction.pickedPos];
    if (!tile || tile.ownerId !== G.currentPlayer || !tile.summonInstance) return sendError(ws, 'No summon to sacrifice');
    const m = tile.summonInstance;
    const gain = sanctionSellValue(m);
    tile.ownerId = null; tile.summonId = null; tile.summonInstance = null;
    clearFortune(tile);
    p.mana += gain;
    if (p.totalManaEarned != null) p.totalManaEarned += gain;
    p.destroyedCount++;
    const lastTile = !G.board.some(t => t.ownerId === G.currentPlayer);
    log(`💀 ${p.name} sacrificed ${m.name} for +${gain}✦ — tile ${tile.pos} goes neutral${lastTile ? ' (last tile)' : ''}`);
    startSanctionReveal({ kind: 'sacrifice', pos: tile.pos, summonId: m.id, summonName: m.name, gain, lastTile });   // 0 tiles → Eliminated at turn end
  },
  // v1.0.117: Wheel of Fortune — upright (Blessing) or reversed (Curse), 50/50
  sanction_wheel(ws, conn, data) {
    if (!guardTurn(ws, conn, ['sanction:own'], 'Not on your own tile')) return;
    const p = G.players[G.currentPlayer];
    const tile = G.board[G.sanction.pickedPos];
    if (!tile || tile.ownerId !== G.currentPlayer || !tile.summonInstance) return sendError(ws, 'No summon on this tile');
    const before = tileFortune(tile);
    const upright = Math.random() < 0.5;
    let after = before, jackpot = 0;
    if (upright && before >= 3)       jackpot = WHEEL_JACKPOT;
    else if (!upright && before <= -3) jackpot = WHEEL_JACKPOT;
    else after = before + (upright ? 1 : -1);
    tile.fortune = after;
    tile.fortuneOwner = after ? tile.ownerId : null;
    tile.fortuneIid = after ? tile.summonInstance.iid : null;
    if (jackpot) { p.mana += jackpot; if (p.totalManaEarned != null) p.totalManaEarned += jackpot; }
    const lvl = after ? FORTUNE[after].name : 'Neutral';
    log(`🎡 ${p.name} turns the Wheel on tile ${tile.pos}: ${upright ? 'UPRIGHT (Blessing)' : 'REVERSED (Curse)'} → ${jackpot ? `already at ${lvl} — JACKPOT +${jackpot}✦` : `${lvl} (${after > 0 ? '+' : ''}${after})`}`);
    G.lastWheel = { seq: ((G.lastWheel && G.lastWheel.seq) || 0) + 1, playerIdx: p.idx, pos: tile.pos, upright, before, after, jackpot };
    startSanctionReveal({ kind: 'wheel', pos: tile.pos, upright, before, after, jackpot });
  },
  sanction_redeem(ws, conn, data) {
    if (!guardTurn(ws, conn, ['sanction:own'], 'Not on your own tile')) return;
    const why = redeemPlayer(G.currentPlayer);
    if (why) return sendError(ws, why);
    startSanctionReveal({ kind: 'redeem', pos: G.sanction.pickedPos, mana: G.players[G.currentPlayer].mana });
  },
  // v1.0.118: the board finished revealing — end the turn (host board only)
  sanction_reveal_done(ws, conn, data) {
    if (!G || G.phase !== 'sanction:reveal' || !conn.isBoard || conn.isSpectator) return;
    if (!G.sanction || data.seq !== G.sanction.revealSeq) return;
    advanceTurn();
  },
  // v1.0.119: place one of the three offered Omens on the rival's tile
  sanction_omen(ws, conn, data) {
    if (!guardTurn(ws, conn, ['sanction:omen'], 'Not choosing an Omen')) return;
    const id = String(data.id || '');
    if (!G.sanction.omenOffers.includes(id) || !OMENS[id]) return sendError(ws, 'Pick one of the offered Omens');
    const p = G.players[G.currentPlayer], tile = G.board[G.sanction.pickedPos];
    if (!tile || tile.ownerId == null || tile.ownerId === G.currentPlayer || !tile.summonInstance) return sendError(ws, 'No rival summon on this tile');
    const prev = tileOmen(tile);
    tile.omen = { id, byIdx: p.idx, ownerIdx: tile.ownerId, iid: tile.summonInstance.iid, placedTurn: G.turnCount };
    let healed = 0;
    if (id === 'mercys_touch') { const m = tile.summonInstance; healed = Math.min(15, m.maxHp - m.hp); m.hp += healed; }
    const owner = G.players[tile.ownerId];
    log(`🔮 ${p.name} places ${OMENS[id].name} (${OMENS[id].kind}) on ${owner ? owner.name + "'s" : 'a'} tile ${tile.pos}${prev ? ` — replaces ${OMENS[prev.id].name}` : ''}${healed ? ` · heals ${healed} HP` : ''}`);
    // v1.0.121: the tile's owner gets a notice once the board has revealed it (delivered in advanceTurn)
    G.sanction.notifyOmen = { targetIdx: tile.ownerId, n: { kind: 'omen', cardId: id, cardName: OMENS[id].name, cardDesc: OMENS[id].desc,
      omenKind: OMENS[id].kind, pos: tile.pos, summonName: tile.summonInstance.name, summonHp: tile.summonInstance.hp, summonMaxHp: tile.summonInstance.maxHp,
      healed, replaced: prev ? OMENS[prev.id].name : null, castByName: p.name, castByColor: p.color } };
    startSanctionReveal({ kind: 'omen', id, name: OMENS[id].name, omenKind: OMENS[id].kind, desc: OMENS[id].desc, pos: tile.pos, ownerIdx: tile.ownerId, healed, replaced: prev ? prev.id : null });
  },
  sanction_omen_skip(ws, conn, data) {
    if (!guardTurn(ws, conn, ['sanction:omen'], 'Not choosing an Omen')) return;
    log(`⛓ ${G.players[G.currentPlayer].name} passes on the Omens`);
    endSanctionTurn({ kind: 'pass', pos: G.sanction.pickedPos });
  },
  sanction_pass(ws, conn, data) {
    if (!guardTurn(ws, conn, ['sanction:pick_tile', 'sanction:own', 'sanction:omen'], 'Not your Sanction turn')) return;
    log(`⛓ ${G.players[G.currentPlayer].name} passes their Sanction turn`);
    endSanctionTurn({ kind: 'pass', pos: G.sanction ? G.sanction.pickedPos : null });
  },
  // Host safety net (someone stepped away) — no timer on Sanction turns
  sanction_skip(ws, conn, data) {
    if (!G || !String(G.phase).startsWith('sanction:')) return sendError(ws, 'No Sanction turn in progress');
    if (!conn.isBoard || conn.isSpectator) return sendError(ws, 'Only the host can skip a Sanction turn');
    if (G.phase === 'sanction:reveal') { advanceTurn(); return; }   // already acted — just finish
    log(`⏭ Host skipped ${G.players[G.currentPlayer].name}'s Sanction turn`);
    endSanctionTurn({ kind: 'skipped' });
  },

  // v1.0.113: test hook — only exists when the server is started with SG_DEBUG=1 (never on Railway)
  ...(process.env.SG_DEBUG === '1' ? { debug(ws, conn, data) {
    if (!G) return;
    const p = G.players[data.idx];
    let res = null;
    switch (data.op) {
      case 'mana':      p.mana = data.v; res = checkManaElimination(p.idx); break;
      case 'drop_tiles':for (const t of G.board) if (t.ownerId === p.idx) { t.ownerId = null; t.summonId = null; t.summonInstance = null; } break;
      case 'redeem':    res = redeemPlayer(p.idx); break;
      case 'turn':      G.turnCount = data.v; break;
      case 'round':     G.round = data.v; break;   // v1.0.127
      case 'income':    res = collectPassiveIncome(p.idx); break;
      case 'advance':   advanceTurn(); break;
      case 'end':       endGame(); break;
      case 'cur':       G.currentPlayer = data.v; break;
      case 'land':      G.currentPlayer = p.idx; p.position = data.pos; resolveLandingTile(p.idx); break;
      case 'give':      p.hand.push(makeSummon(data.v || 'dawnguard')); break;
      case 'omen':      { const t = G.board[data.pos]; t.omen = { id: data.v, byIdx: data.by, ownerIdx: t.ownerId, iid: t.summonInstance && t.summonInstance.iid, placedTurn: G.turnCount }; } break;
      case 'fortune':   { const t = G.board[data.pos]; t.fortune = data.v; t.fortuneOwner = t.ownerId; t.fortuneIid = t.summonInstance && t.summonInstance.iid; } break;
      case 'setbattle': G.currentPlayer = p.idx; p.position = data.pos; G.phase = 'resolve:battle'; break;
      case 'wcdraw':    {   // v1.0.147: put the current player straight into a Wild Card pick — data.v = { low, mid, high } card ids
        const pick = (tier, id) => WILD_CARD_POOLS[tier].find(c => c.id === id) || WILD_CARD_POOLS[tier][0];
        const v = data.v || {};
        G.wcSeq = (G.wcSeq || 0) + 1;
        G.wcTable = { seq: G.wcSeq, playerIdx: G.currentPlayer, dice: [3, 3], pick: null, skipped: false };
        G.wildCardDrawn = { low: pick('low', v.low), mid: pick('mid', v.mid), high: pick('high', v.high) };
        G.wildCardPending = null; G.phase = 'resolve:wildcard_cards';
      } break;
      case 'hpset':     G.board[data.pos].summonInstance.hp = data.v; break;
      case 'phase':     G.phase = data.v; if (data.pos != null && G.sanction) G.sanction.pickedPos = data.pos; break;
      case 'hp':        { const t = G.board.find(t => t.ownerId === p.idx && t.summonInstance); if (t) t.summonInstance.hp = data.v; res = t && t.pos; } break;
    }
    wsSend(ws, { type: 'debug', res });
    broadcast();
  } } : {}),

  // v1.0.112: host-only lobby toggle
  set_skip_setup(ws, conn, data) {
    if (!G || G.phase !== 'lobby') return sendError(ws, 'Not in lobby');
    if (!conn.isBoard || conn.isSpectator) return sendError(ws, 'Only the host can change setup mode');
    G.skipSetup = !!(data && data.on);
    log(`⚙ Setup mode: ${G.skipSetup ? 'Auto (skip setup phase)' : 'Normal'}`);
    broadcast();
  },

  start_game(ws, conn, data) {
    if (!G || G.phase !== 'lobby') return sendError(ws, 'Not in lobby');
    if (!conn.isBoard) return sendError(ws, 'Only the host can start the game'); // v1.0.89
    // Remove lobby slots that disconnected and never came back before game start
    const before = G.players.length;
    G.players = G.players.filter(p => p.isConnected);
    if (G.players.length < before) {
      G.players.forEach((p, i) => { p.idx = i; p.color = PLAYER_COLORS[i]; });
      // Update any lingering connections' playerIdx references
      for (const [, c] of clients) {
        if (c.roomCode === G.roomCode && c.sessionKey) {
          const pl = G.players.find(p => p.sessionKey === c.sessionKey);
          if (pl) c.playerIdx = pl.idx; else c.playerIdx = null;
        }
      }
    }
    if (G.players.length < 2) return sendError(ws, 'Need at least 2 players');
    if (data && data.roundLimit && [10,20,30].includes(Number(data.roundLimit))) {
      G.roundLimit = Number(data.roundLimit);
    }
    log(`🎮 Game started! ${G.roundLimit} rounds per player`);
    startSetupPhase();
  },

  // v1.0.96: player voluntarily leaves mid-game (permanent)
  leave_game(ws, conn, data) {
    if (!G) return;
    if (conn.playerIdx === null || conn.playerIdx === undefined) return;
    const idx = conn.playerIdx;
    if (G.phase === 'lobby' || G.phase === 'game_over') return sendError(ws, 'No game in progress');
    forfeitPlayer(idx, 'left');
    wsSend(ws, { type: 'left_game' });
  },

  // v1.0.96: host removes a player (board only, not spectators). v1.0.131: connected players too (G3)
  remove_player(ws, conn, data) {
    if (!G) return;
    if (!conn.isBoard || conn.isSpectator) return sendError(ws, 'Only the host can remove players');
    if (G.phase === 'lobby' || G.phase === 'game_over') return sendError(ws, 'No game in progress');
    const idx = Number(data.idx);
    const p = G.players[idx];
    if (!p || p.eliminated) return;
    const code = G.roomCode;
    // v1.0.131: tell the removed player's phone, then drop it from the room
    for (const [sock, c] of clients) {
      if (c.roomCode === code && c.playerIdx === idx && !c.isBoard) { wsSend(sock, { type: 'left_game', removed: true }); c.playerIdx = null; c.sessionKey = null; }
    }
    forfeitPlayer(idx, 'removed');
  },

  // v1.0.135: a page reports a slow render, a page stall, or its renders-per-minute — goes to the live log only
  client_perf(ws, conn, data) {
    conn._perfN = (conn._perfN || 0) + 1;
    if (conn._perfN > 400) return;
    const who = conn.isBoard ? 'BOARD' : conn.isSpectator ? 'spectator' : (G && G.players[conn.playerIdx] ? G.players[conn.playerIdx].name + "'s phone" : 'phone');
    const kind = String(data.kind || '').slice(0, 30), ms = Number(data.ms) || 0;
    const warn = kind === 'renders/min' ? '📊' : '⚠';
    glog(conn.roomCode, `${warn} ${who}: ${kind} ${ms}${kind === 'renders/min' ? '' : 'ms'}${data.extra ? ' (' + String(data.extra).slice(0, 80) + ')' : ''} · phase ${String(data.phase || '').slice(0, 30)}`);
  },

  // v1.0.134: a phone or board page hit a script error — print it with the room's trail
  client_error(ws, conn, data) {
    conn._errN = (conn._errN || 0) + 1;
    if (conn._errN > 20) return;
    const who = conn.isBoard ? 'board' : conn.isSpectator ? 'spectator' : (G && G.players[conn.playerIdx] ? G.players[conn.playerIdx].name + "'s phone" : 'phone');
    const e = { message: String(data.message || '').slice(0, 300), stack: `${String(data.message || '').slice(0, 300)}\n${String(data.stack || '').slice(0, 1500)}\n  page: ${String(data.where || '').slice(0, 60)} · screen phase ${String(data.phase || '').slice(0, 40)}` };
    reportCrash(`${who} page error`, e, conn.roomCode);
  },

  // v1.0.131 (G3): host nudges a player — their phone buzzes, replays the turn sound and shows a card
  host_nudge(ws, conn, data) {
    if (!G) return;
    if (!conn.isBoard || conn.isSpectator) return sendError(ws, 'Only the host can nudge');
    if (G.phase === 'lobby' || G.phase === 'game_over') return;
    const idx = Number(data.idx);
    const p = G.players[idx];
    if (!p || p.eliminated) return;
    G._nudgeAt = G._nudgeAt || {};
    if (Date.now() - (G._nudgeAt[idx] || 0) < NUDGE_COOLDOWN_MS) return sendError(ws, `Wait a few seconds before nudging ${p.name} again`);
    G._nudgeAt[idx] = Date.now();
    const yourTurn = idx === G.currentPlayer;
    for (const [sock, c] of clients) {
      if (c.roomCode === G.roomCode && c.playerIdx === idx && !c.isBoard) wsSend(sock, { type: 'nudge', yourTurn, name: p.name });
    }
    G.nudgeSeq = (G.nudgeSeq || 0) + 1;
    G.lastNudge = { seq: G.nudgeSeq, idx };
    log(`🔔 Host nudged ${p.name}`);
    broadcast();
  },

  // v1.0.131 (G3): host ends the current player's turn safely — the "do nothing" choice wherever they are
  host_skip_turn(ws, conn, data) {
    if (!G) return;
    if (!conn.isBoard || conn.isSpectator) return sendError(ws, 'Only the host can skip a turn');
    const block = hostSkipBlockReason();
    if (block) return sendError(ws, block);
    const idx = G.currentPlayer;
    const p = G.players[idx];
    const phase = G.phase;
    const asPlayer = { playerIdx: idx };   // run the player's own skip actions on their behalf
    G.skipSeq = (G.skipSeq || 0) + 1;
    G.lastHostSkip = { seq: G.skipSeq, idx, name: p.name, phase };
    log(`⏭ Host skipped ${p.name}'s turn`);
    // the turn ends here — a doubles Wild Card earned this turn is dropped (the cards slide away)
    const dropWildCard = () => { G.pendingWildCard = false; G.wildCardDrawn = null; if (G.wcTable && !G.wcTable.pick) G.wcTable.skipped = true; };
    if (phase === 'setup') return handlers.setup_pass(ws, asPlayer, {});
    if (phase.startsWith('sanction:')) return handlers.sanction_skip(ws, conn, {});
    if (phase === 'resolve:wildcard_cards') return handlers.wildcard_skip(ws, asPlayer, {});
    if (['resolve:wildcard_reveal', 'resolve:wildcard_target', 'resolve:wildcard_coup_tile', 'resolve:wildcard_coup_summon', 'resolve:wildcard_shatter'].includes(phase)) {
      // the card was already paid for but not played — refund it in full (the host skipped, not the player)
      const id = (G.wildCardPending && G.wildCardPending.cardId) || (G.wcBought && G.wcBought.cardId);   // v1.0.148
      G.wcBought = null;
      const card = id && Object.values(WILD_CARD_POOLS).flat().find(c => c.id === id);
      if (card) { p.mana += card.cost; log(`🃏 ${card.name} refunded (${card.cost}✦) — turn skipped by the host`); }
      G.wildCardPending = null;
      if (G.wcTable) G.wcTable.skipped = true;
      advanceTurn(); return;
    }
    dropWildCard();
    if (phase === 'resolve:claim')     return handlers.skip_claim(ws, asPlayer, {});
    if (phase === 'resolve:own')       return handlers.skip_own(ws, asPlayer, {});
    if (phase === 'resolve:temple')    return handlers.temple_leave(ws, asPlayer, {});
    if (phase === 'resolve:heal_tile') return handlers.heal_tile_skip(ws, asPlayer, {});
    if (phase === 'resolve:chest')     return handlers.chest_skip(ws, asPlayer, {});
    // turn summary, shop, roll, landing choice, battle-or-retreat (free — no retreat cost), stalemate choice
    G.turnSummary = null; G.pendingLanding = null; G.pendingAttackerSummon = null; G.stalemateData = null;
    advanceTurn();
  },

  end_game(ws, conn, data) {
    if (!G) return;
    // v1.0.89: host (board) only — phones cannot reset a game in progress
    if (!conn.isBoard) return sendError(ws, 'Only the host can end the game');
    const code = G.roomCode;
    log(`🔄 Game ended by host — returning to lobby`);
    G = resetRoom(code);   // v1.0.130: cancels old timers, keeps the host key
    broadcast();
  },

  new_game(ws, conn, data) {
    if (!G) return;
    // v1.0.89: host (board) only — player view has no new-game control
    if (!conn.isBoard) return sendError(ws, 'Only the host can start a new game');
    const code = G.roomCode;
    log(`🔄 New game — returning to lobby`);
    G = resetRoom(code);   // v1.0.130: cancels old timers, keeps the host key
    // Update all room-member connections to the new G
    for (const [, c] of clients) {
      if (c.roomCode === code) {
        c.playerIdx = null;
        c.sessionKey = null;
      }
    }
    broadcast();
  },

  // ── Turn Summary ───────────────────────────────────────────────────────────

  dismiss_turn_summary(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:turn_summary'])) return;
    G.turnSummary = null;
    _startActualTurn();
  },

  // Board signals players that the pre-round tally animation is done — players can now show their summary
  tally_complete(ws, conn, data) {
    if (!conn.isBoard) return; // only board can signal this
    const roomCode = G ? G.roomCode : conn.roomCode;
    // v1.0.137: remember it in the state too — phones that get a later update (a notice dismissed, a reconnect)
    // see the tally already finished instead of waiting for a signal that won't come again
    if (G && G.phase === 'resolve:turn_summary' && G.turnSummary && !G.turnSummary.tallyDone) { G.turnSummary.tallyDone = true; broadcast(); }
    for (const [socket, c] of clients) {
      if (socket.destroyed) continue;
      if (c.roomCode !== roomCode) continue;
      if (c.isBoard || c.isSpectator) continue; // players only
      wsSend(socket, { type: 'tally_complete' });
    }
  },

  // Board signals that the round callout overlay animation is complete — resume to shop
  round_callout_complete(ws, conn, data) {
    if (!conn.isBoard) return; // only board can signal this
    if (!G || G.phase !== 'resolve:round_callout') return;
    const roomCode = G.roomCode;
    // Relay to all player sockets (informational — triggers re-render via next state broadcast)
    for (const [socket, c] of clients) {
      if (socket.destroyed) continue;
      if (c.roomCode !== roomCode) continue;
      if (c.isBoard || c.isSpectator) continue;
      wsSend(socket, { type: 'round_callout_complete' });
    }
    G.roundCallout = null;
    startShopPhase();
  },

  // ── Shop ───────────────────────────────────────────────────────────────────

  buy(ws, conn, data) {
    if (!guardTurn(ws, conn, ['shop'], 'Not shop phase')) return;
    const p = G.players[G.currentPlayer];
    if (p.hand.length >= 5) return sendError(ws, 'Hand full');
    const offer = G.shopOffers.find(o => o.iid === data.iid);
    if (!offer) return sendError(ws, 'Invalid offer');
    const price = shopPrice(p, offer);   // v1.0.150
    if (p.mana < price) return sendError(ws, 'Not enough Mana');
    p.mana -= price;
    const m = makeSummon(offer.id);
    p.hand.push(m);
    G.shopOffers = G.shopOffers.filter(o => o.iid !== offer.iid);
    log(`🛒 ${p.name} bought ${m.name} (−${price}✦${price !== m.cost ? `, list ${m.cost}✦` : ''})`);
    shopClosed(p, true);
    G.phase = 'roll';
    broadcast();
  },

  sell(ws, conn, data) {
    if (!guardTurn(ws, conn, ['shop'], 'Not shop phase')) return;
    const p = G.players[G.currentPlayer];
    const idx = p.hand.findIndex(m => m.iid === data.iid);
    if (idx === -1) return sendError(ws, 'Summon not in hand');
    const m = p.hand[idx];
    const refund = Math.floor(m.cost * (m.hp / m.maxHp));
    p.hand.splice(idx, 1);
    p.mana += refund;
    log(`💰 ${p.name} sold ${m.name} for ${refund}✦`);
    shopClosed(p, false);   // v1.0.150
    G.phase = 'roll';
    broadcast();
  },

  skip_shop(ws, conn, data) {
    if (!guardTurn(ws, conn, ['shop'], 'Not shop phase')) return;
    shopClosed(G.players[G.currentPlayer], false);   // v1.0.150
    G.phase = 'roll';
    broadcast();
  },

  // ── Stalemate ──────────────────────────────────────────────────────────────

  // Player chooses to fight — enters normal resolve:battle so they pick attacker via select_attacker/attack
  stalemate_fight(ws, conn, data) {
    if (!guardTurn(ws, conn, ['stalemate'], 'Not stalemate phase')) return;
    const p = G.players[G.currentPlayer];
    if (!p.hand || p.hand.length === 0) return sendError(ws, 'No summons in hand');
    const sd = G.stalemateData;
    // Verify the tile is still contested (defender's summon still there)
    const tile = G.board[sd.tilePos];
    if (!tile || !tile.summonInstance) {
      // Defender monster gone somehow — just clear and advance
      G.stalemateData = null;
      advanceTurn();
      return;
    }
    G.stalemateData = null;
    G.pendingAttackerSummon = null;
    G.phase = 'resolve:battle';
    log(`⚔️ ${p.name} chooses to battle again on tile ${sd.tilePos}!`);
    broadcast();
  },

  // Player retreats from stalemate — pays 5 Mana, skips rolling, goes straight to shop
  stalemate_continue(ws, conn, data) {
    if (!guardTurn(ws, conn, ['stalemate'], 'Not stalemate phase')) return;
    const p = G.players[G.currentPlayer];
    const RETREAT_COST = 8;
    const paid = Math.min(p.mana, RETREAT_COST);
    p.mana -= paid;
    if (paid > 0) _trackBattleMana(p, -paid);
    log(`🚶 ${p.name} retreats from stalemate${paid > 0 ? ` — paid ${paid}✦` : ''}`);
    checkManaElimination(G.currentPlayer);
    if (checkLastStanding()) return; // game ended
    G.stalemateData = null;
    // Jump straight to shop (passive income already collected at turn start)
    G.phase = 'shop';
    broadcast();
  },

  // Legacy aliases — kept for old clients
  stalemate_attack(ws, conn, data) { return handlers.stalemate_fight(ws, conn, data); },
  stalemate_skip(ws, conn, data)   { return handlers.stalemate_continue(ws, conn, data); },
  stalemate_move(ws, conn, data)   { return handlers.stalemate_continue(ws, conn, data); },
  stalemate_buy(ws, conn, data)    { return handlers.stalemate_continue(ws, conn, data); },
  stalemate_sell(ws, conn, data)   { return handlers.stalemate_continue(ws, conn, data); },

  // ── Setup phase ────────────────────────────────────────────────────────────

  setup_claim(ws, conn, data) {
    if (!guardTurn(ws, conn, ['setup'], 'Not setup phase')) return;
    if (G.autoSetupRunning) return sendError(ws, 'Auto Setup in progress');
    const p = G.players[G.currentPlayer];
    const tilePos = parseInt(data.tilePos, 10);
    if (isNaN(tilePos) || tilePos < 0 || tilePos >= 28) return sendError(ws, 'Invalid tile number (0–27)');
    const tile = G.board[tilePos];
    if (!tile) return sendError(ws, 'Invalid tile');
    if (tile.kind !== 'element') return sendError(ws, 'Can only claim elemental tiles during setup');
    if (tile.ownerId !== null && tile.ownerId !== undefined) return sendError(ws, 'Tile already claimed');
    const m = p.hand.find(h => h.iid === data.iid);
    if (!m) return sendError(ws, 'Summon not in hand');
    _doSetupClaim(G.currentPlayer, tilePos, m);
    advanceSetupTurn();
  },

  setup_pass(ws, conn, data) {
    if (!guardTurn(ws, conn, ['setup'], 'Not setup phase')) return;
    if (G.autoSetupRunning) return sendError(ws, 'Auto Setup in progress');
    log(`⏭ ${G.players[G.currentPlayer].name} passed setup turn`);
    advanceSetupTurn();
  },

  // ── Roll ───────────────────────────────────────────────────────────────────

  roll(ws, conn, data) {
    if (!guardTurn(ws, conn, ['roll'], 'Not roll phase')) return;
    resolveRoll(G.currentPlayer);
  },

  // ── Landing tile choice ────────────────────────────────────────────────────

  choose_landing(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:landing'], 'Not landing phase')) return;
    const tilePos = parseInt(data.tilePos);
    if (!Number.isInteger(tilePos) || !G.pendingLanding || !G.pendingLanding.options.includes(tilePos)) {
      return sendError(ws, 'Invalid landing choice');
    }
    const p = G.players[G.currentPlayer];
    p.position = tilePos;
    G.pendingLanding = null;
    // Track well landing for next turn's summary
    p.lastTurnLandedOnWell = (tilePos === 0);
    log(`🎯 ${p.name} chooses tile ${tilePos}`);
    resolveLandingTile(G.currentPlayer);
  },

  // ── Claim empty tile ───────────────────────────────────────────────────────

  claim(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:claim'])) return;
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    const m = p.hand.find(h => h.iid === data.iid);
    if (!m) return sendError(ws, 'Summon not in hand');
    if (!canUseSpecial(G.currentPlayer, m)) return sendError(ws, 'Special condition not met');
    if (tile.summonInstance) return sendError(ws, 'A wild monster holds this tile — fight it');   // v1.0.152
    if (p.mana < m.cost) return sendError(ws, 'Not enough Mana');
    p.mana -= m.cost;
    const mIdx = p.hand.indexOf(m);
    p.hand.splice(mIdx, 1);
    tile.ownerId = G.currentPlayer;
    tile.summonId = m.iid;
    tile.summonInstance = m;
    tile.neverOwned = false; // Phase 1: mark tile as ever-claimed
    log(`🚩 ${p.name} claimed tile ${p.position} with ${m.name}`);
    _voice(m.id, 'claim');

    // ── Per-claim ability triggers ──────────────────────────────────────────
    // Feral Striker: Territorial is now dynamic (tile count) — no per-claim stack
    // Stoneback: Granite Hide is now dynamic (tile count) — no per-claim stack
    // Grave Specter: Necrotic Claim — tile converts to Undead on BATTLE WIN only (not free claim)
    // Solar Knight — Radiant Strike: on claim, tile converts to Light element
    if (m.id === 'solar_knight') {
      _convertTile(tile, 'Light', 'Radiant Strike');
      log(`☀️ Radiant Strike: Solar Knight converts tile ${p.position} to Light element!`);
    }

    advanceTurn();
  },

  skip_claim(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:claim'])) return;
    advanceTurn();
  },

  // ── Battle ─────────────────────────────────────────────────────────────────

  attack(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:battle'])) return;
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    const defOwner = G.players[tile.ownerId] || _wildOwner();   // v1.0.152: a wild monster fights for nobody
    const defM = tile.summonInstance;
    if (!defM) return sendError(ws, 'No defender on tile');
    const attM = p.hand.find(m => m.iid === data.iid);
    if (!attM) return sendError(ws, 'Summon not in hand');
    // Note: Ascendants can always be used in battle — condition only gates tile claiming

    // v1.0.94: start recording battle effects
    _fx = []; _fxAttM = attM; _fxDefM = defM;

    // Wild card effects before battle
    if (p.wcEffects.ambush) { p.wcEffects.ambush = false; attM._ambush = true; }
    if (p.wcEffects.flurry) { p.wcEffects.flurry = false; attM._flurry = true; attM._flurryAmbush = !!attM._ambush; }   // v1.0.151
    if (p.wcEffects.fortify) { p.wcEffects.fortify = false; attM._fortify = true; }
    const defOwnerP = G.players[tile.ownerId];
    const rattled = !!(defOwnerP && defOwnerP.wcEffects && defOwnerP.wcEffects.rattle);
    _rattleBy = null;
    if (rattled) { defOwnerP.wcEffects.rattle = false; _rattleBy = _wcTrigger('rattle', defOwnerP); }   // v1.0.132

    // ── Aura buffs via getEffectiveStats ──────────────────────────────────────
    // Attacker: apply aura modifiers (Sunfire Herald +ATK, Vine Stalker aura, etc.)
    const attTile = G.board.find(t => t.ownerId === p.idx && t.summonInstance && t.summonInstance.iid === attM.iid);
    const attTilePos = attTile ? attTile.pos : -1;
    const attEffective = getEffectiveStats(attM, attTilePos, p.idx);
    const origAttAtk = attM.atk;
    const origAttDef = attM.def;
    attM.atk = attEffective.atk;
    attM.def = attEffective.def;
    if (attEffective.atk !== origAttAtk) { log(`✨ Aura: ${attM.name} ATK ${origAttAtk} → ${attEffective.atk}`); fx('att', 'Auras', `ATK ${origAttAtk} → ${attEffective.atk}`, `${attEffective.atk > origAttAtk ? '+' : '−'}${Math.abs(attEffective.atk - origAttAtk)} ATK`, attEffective.atk > origAttAtk ? 'good' : 'bad'); }
    if (attEffective.def !== origAttDef) { log(`✨ Aura: ${attM.name} DEF ${origAttDef} → ${attEffective.def}`); fx('att', 'Auras', `DEF ${origAttDef} → ${attEffective.def}`, `${attEffective.def > origAttDef ? '+' : '−'}${Math.abs(attEffective.def - origAttDef)} DEF`, attEffective.def > origAttDef ? 'good' : 'bad'); }

    // Defender: apply aura modifiers (Dawnguard +DEF, Umbral Stalker −DEF, etc.)
    const defTilePos = tile.pos;
    const defEffective = getEffectiveStats(defM, defTilePos, tile.ownerId);
    const origDefAtk = defM.atk;
    const origDefDef = defM.def;
    defM.atk = defEffective.atk;
    defM.def = defEffective.def;
    if (defEffective.atk !== origDefAtk) { log(`✨ Aura: ${defM.name} ATK ${origDefAtk} → ${defEffective.atk}`); fx('def', 'Auras', `ATK ${origDefAtk} → ${defEffective.atk}`, `${defEffective.atk > origDefAtk ? '+' : '−'}${Math.abs(defEffective.atk - origDefAtk)} ATK`, defEffective.atk > origDefAtk ? 'good' : 'bad'); }
    if (defEffective.def !== origDefDef) { log(`✨ Aura: ${defM.name} DEF ${origDefDef} → ${defEffective.def}`); fx('def', 'Auras', `DEF ${origDefDef} → ${defEffective.def}`, `${defEffective.def > origDefDef ? '+' : '−'}${Math.abs(defEffective.def - origDefDef)} DEF`, defEffective.def > origDefDef ? 'good' : 'bad'); }

    // Weapon Smith aura — +5 ATK to attacker per copy IN HAND of attacker (stacks, per xlsx)
    const weaponSmithCount = p.hand.filter(m => m.id === 'weapon_smith').length;
    if (weaponSmithCount > 0) {
      attM.atk += weaponSmithCount * 5;
      log(`⚒️ Weapon Smith ×${weaponSmithCount}: ${attM.name} ATK → ${attM.atk}`);
      fx('att', 'Weapon Smith', `${weaponSmithCount} in hand: +${weaponSmithCount * 5} ATK`, `+${weaponSmithCount * 5} ATK`, 'good');
    }

    // Forge aura — +5 DEF to defender per copy stationed by defending player (stacks)
    const forgeCount = G.board.filter(t => t.ownerId === tile.ownerId && t.summonInstance && t.summonInstance.id === 'forge').length;
    if (forgeCount > 0) {
      defM.def += forgeCount * 5;
      log(`🔩 Forge ×${forgeCount}: ${defM.name} DEF → ${defM.def}`);
      fx('def', 'Forge', `${forgeCount} stationed: +${forgeCount * 5} DEF`, `+${forgeCount * 5} DEF`, 'good');
    }

    // v1.0.119: Omens on the defending tile
    const _om = tileOmen(tile);
    if (_om) {
      const O = OMENS[_om.id];
      if (_om.id === 'saints_ward' || _om.id === 'withering_brand') {
        const d0 = defM.def, up = _om.id === 'saints_ward';
        defM.def = Math.max(0, Math.round(defM.def * (up ? 1.2 : 0.8)));
        log(`🔮 ${O.name}: ${defM.name} DEF ${d0} → ${defM.def}`);
        fx('def', `${O.name} (Omen)`, `${up ? '+' : '−'}20% DEF on this tile`, `${up ? '+' : '−'}20% DEF`, up ? 'good' : 'bad');
      }
      if (_om.id === 'kindled_blade') { defM._kindled = true; }
      if (_om.id === 'shackled_will') { defM._shackled = true; }
      if (_om.id === 'echoing_hymn') {
        const h0 = attM.hp; attM.hp = Math.max(1, attM.hp - 8);
        log(`🎶 Echoing Hymn: ${attM.name} takes ${h0 - attM.hp} damage before the battle`);
        fx('att', 'Echoing Hymn (Omen)', `Took ${h0 - attM.hp} damage before the battle`, `−${h0 - attM.hp} HP`, 'bad');
      }
    }
    // v1.0.117: Wheel of Fortune on the defending tile
    const _fLvl = tileFortune(tile), _fInfo = _fLvl ? FORTUNE[_fLvl] : null;
    if (_fInfo) {
      const d0 = defM.def;
      defM.def = Math.max(0, Math.round(defM.def * (1 + _fInfo.def)));
      const pct = Math.round(_fInfo.def * 100);
      log(`🎡 ${_fInfo.name}: ${defM.name} DEF ${d0} → ${defM.def}`);
      fx('def', `${_fInfo.name} (Wheel)`, `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% DEF on this tile`, `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% DEF`, pct > 0 ? 'good' : 'bad');
      if (_fInfo.counter) defM._fortuneCounter = { name: _fInfo.name, pct: _fInfo.counter };
    }

    const _attHpBefore = attM.hp, _defHpBefore = defM.hp;   // v1.0.138: phones animate HP from these
    const { atkDmg, defDmg, outcome } = resolveBattle(attM, defM, tile, rattled);
    delete attM._flurry; delete attM._flurryAmbush; delete attM._ambush;   // v1.0.151
    delete defM._fortuneCounter;
    if (defM._kindledUsed && tileOmen(tile) && tileOmen(tile).id === 'kindled_blade') clearOmen(tile);   // one strike only
    delete defM._kindled; delete defM._kindledUsed; delete defM._shackled;

    // Restore temporarily boosted stats after battle
    attM.atk = origAttAtk;
    attM.def = origAttDef;
    defM.atk = origDefAtk;
    defM.def = origDefDef;

    log(`⚔️ ${p.name}(${attM.name}) attacks ${defOwner.name}(${defM.name}) on tile ${p.position}`);
    log(`   ATK dealt ${atkDmg}, DEF struck back ${defDmg} — ${outcome}`);

    // snapshot both monsters before _applyBattleOutcome mutates them
    // mana deltas: attacker_wins(+4/−4), defender_wins(−8/+4), mutual(−8/+4), stalemate(−4/+4)
    const _manaDeltaMap = { attacker_wins:[+4,-4], defender_wins:[-8,+4], mutual:[-8,+4], stalemate:[-4,+4] };
    const [_attDelta, _defDelta] = _manaDeltaMap[outcome] || [0,0];
    G.lastBattle = {
      attackerIdx: G.currentPlayer,
      defOwnerIdx: tile.ownerId,
      attM: { name:attM.name, type:attM.type, atk:attM.atk, def:attM.def, id:attM.id, isSpecial:attM.isSpecial||false, hp:attM.hp, maxHp:attM.maxHp, cost:attM.cost, gen:attM.gen },
      defM: { name:defM.name, type:defM.type, atk:defM.atk, def:defM.def, id:defM.id, isSpecial:defM.isSpecial||false, hp:defM.hp, maxHp:defM.maxHp, cost:defM.cost, gen:defM.gen },
      atkDmg, defDmg, outcome,
      attHpBefore: _attHpBefore, defHpBefore: _defHpBefore,
      attManaDelta: _attDelta,
      defManaDelta: _defDelta,
    };
    _applyBattleOutcome(outcome, p, attM, defOwner, defM, tile, p.position);
    // v1.0.117: Fortune payouts — Curse bounty to the taker, Blessing payout (+ Exaltation heal) to the holder
    if (_fInfo && outcome === 'attacker_wins' && _fInfo.bounty) {
      p.mana += _fInfo.bounty; if (p.totalManaEarned != null) p.totalManaEarned += _fInfo.bounty;
      log(`🎡 ${_fInfo.name} bounty: ${p.name} gains +${_fInfo.bounty}✦ for taking the cursed tile`);
      fx('att', `${_fInfo.name} bounty`, 'Took a cursed tile', `+${_fInfo.bounty}✦`, 'good');
    }
    if (_fInfo && outcome === 'defender_wins' && _fInfo.payout) {
      defOwner.mana += _fInfo.payout; if (defOwner.totalManaEarned != null) defOwner.totalManaEarned += _fInfo.payout;
      log(`🎡 ${_fInfo.name}: ${defOwner.name} gains +${_fInfo.payout}✦ for holding the blessed tile`);
      fx('def', _fInfo.name, 'Held a blessed tile', `+${_fInfo.payout}✦`, 'good');
      if (_fInfo.heal && defM.hp > 0) {
        const h = Math.min(_fInfo.heal, defM.maxHp - defM.hp);
        defM.hp += h;
        if (h > 0) { log(`🎡 Exaltation: ${defM.name} heals ${h} HP`); fx('def', 'Exaltation', `${defM.name} healed after holding`, `+${h} HP`, 'good'); }
      }
    }
    if (_om && _om.id === 'betrayers_mark' && outcome === 'attacker_wins') {
      p.mana += 5; if (p.totalManaEarned != null) p.totalManaEarned += 5;
      log(`🔮 Betrayer's Mark: ${p.name} gains +5✦ for taking the marked tile`);
      fx('att', "Betrayer's Mark (Omen)", 'Took the marked tile', '+5✦', 'good');
    }
    if (outcome === 'attacker_wins' || outcome === 'mutual') { clearFortune(tile); clearOmen(tile); }
    G.lastBattle.effects = _fx || [];
    _fx = null; _fxAttM = null; _fxDefM = null;
    G.pendingAttackerSummon = null;
    // Track stalemate — resolved on this player's next turn
    if (outcome === 'stalemate') {
      G.stalemateData = { attackerIdx: G.currentPlayer, tilePos: p.position };
    }
    G.phase = 'resolve:battle_result';
    broadcast();
    // v1.0.94: hold the result a little longer so the board can show effect callouts
    const _nFx = Math.min(8, G.lastBattle.effects.length);
    scheduleRoomAction(G.roomCode, advanceTurn, _nFx ? 5500 + _nFx * 600 : 3500);
  },

  // Preview which attacker the player is hovering — broadcasts to board in real-time
  preview_attacker(ws, conn, data) {
    if (G.phase !== 'resolve:battle') return;
    if (conn.playerIdx !== G.currentPlayer) return;
    const p = G.players[G.currentPlayer];
    if (data.iid == null) {
      G.pendingAttackerSummon = null;
    } else {
      const m = p.hand.find(m => m.iid === data.iid);
      if (m) G.pendingAttackerSummon = { iid:m.iid, id:m.id, name:m.name, type:m.type,
        hp:m.hp, maxHp:m.maxHp, atk:m.atk, def:m.def, cost:m.cost, gen:m.gen,
        isSpecial:m.isSpecial||false, charm:m.charm||false };
    }
    broadcast();
  },

  retreat(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:battle'])) return;
    const p = G.players[G.currentPlayer];
    const penalty = Math.min(p.mana, MANA_PENALTY);
    p.mana -= penalty;
    if (penalty > 0) _trackBattleMana(p, -penalty);
    log(`🏃 ${p.name} retreated — paid ${penalty}✦ penalty`);
    checkManaElimination(G.currentPlayer);
    G.pendingAttackerSummon = null;
    advanceTurn();
  },

  // ── Own tile ───────────────────────────────────────────────────────────────

  swap(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:own'])) return;
    const p = G.players[G.currentPlayer];
    // Hand-full check removed: swap is net-zero (stationed comes back to hand),
    // so a full hand of 5 is always valid for a swap.
    const tile = G.board[p.position];
    const oldM = tile.summonInstance;
    const newM = p.hand.find(m => m.iid === data.newSummonIid);
    if (!newM) return sendError(ws, 'Summon not in hand');
    if (!canUseSpecial(G.currentPlayer, newM)) return sendError(ws, 'Special condition not met');
    // Cost to deploy new summon
    if (p.mana < newM.cost) return sendError(ws, 'Not enough Mana');
    p.mana -= newM.cost;
    const idx = p.hand.indexOf(newM);
    p.hand.splice(idx, 1);
    if (oldM) p.hand.push(oldM);
    tile.summonInstance = newM;
    tile.summonId = newM.iid;
    log(`🔄 ${p.name} swapped ${oldM ? oldM.name : 'empty'} → ${newM.name} on tile ${p.position}`);
    _voice(newM.id, 'swap');
    advanceTurn();
  },

  // Flat heal: 5✦ → +20 HP (capped at maxHp)
  heal_stationed(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:own'])) return;
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    const m = tile.summonInstance;
    if (!m) return sendError(ws, 'No summon to heal');
    if (m.hp >= m.maxHp) return sendError(ws, 'Already at full HP');
    if (p.mana < 5) return sendError(ws, 'Need 5✦ to heal');
    const healed = Math.min(20, m.maxHp - m.hp);
    p.mana -= 5;
    m.hp += healed;
    p.healCount++;
    log(`💚 ${p.name} healed ${m.name} for ${healed} HP (−5✦)`);
    checkManaElimination(G.currentPlayer);
    advanceTurn();
  },

  // Sacrifice stationed summon for +15✦ — tile goes neutral
  sacrifice_tile(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:own'])) return;
    const p = G.players[G.currentPlayer];
    const tile = G.board[p.position];
    if (!tile.summonInstance) return sendError(ws, 'No summon to sacrifice');
    const sacrificed = tile.summonInstance;
    tile.ownerId = null;
    tile.summonId = null;
    tile.summonInstance = null;
    p.mana += 15;
    if (p.totalManaEarned != null) p.totalManaEarned += 15;   // v1.0.144
    p.destroyedCount++;
    log(`💀 ${p.name} sacrificed ${sacrificed.name} for +15✦ — tile ${p.position} goes neutral`);
    advanceTurn();
  },

  change_element(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:own'])) return;
    const p = G.players[G.currentPlayer];
    if (p.mana < CHANGE_ELEMENT_COST) return sendError(ws, `Need ${CHANGE_ELEMENT_COST}✦`);
    if (!TYPES.includes(data.element)) return sendError(ws, 'Invalid element');
    const tile = G.board[p.position];
    const old = tile.element;
    tile.element = data.element;
    tile.label = data.element;
    p.mana -= CHANGE_ELEMENT_COST;
    p.elementChangeCount++;
    if (data.element === 'Arcane') p.arcaneChangeCount++;
    log(`🌀 ${p.name} changed tile ${p.position}: ${old} → ${data.element} (−${CHANGE_ELEMENT_COST}✦)`);
    advanceTurn();
  },

  skip_own(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:own'])) return;
    advanceTurn();
  },

  // ── Temple ─────────────────────────────────────────────────────────────────

  temple_trade(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:temple'])) return;
    const p = G.players[G.currentPlayer];
    const special = G.pendingTemple.offers.find(o => o.iid === data.specialIid);
    if (!special) return sendError(ws, 'Invalid special offer');
    const sacrifice = p.hand.find(m => m.iid === data.sacrificeIid);
    if (!sacrifice) return sendError(ws, 'Sacrifice not in hand');
    if (sacrifice.type !== special.type) return sendError(ws, 'Type mismatch');
    if (p.mana < special.cost) return sendError(ws, 'Not enough Mana');
    p.mana -= special.cost;
    const sIdx = p.hand.indexOf(sacrifice);
    p.hand.splice(sIdx, 1);
    const gained = makeSummon(special.id);
    p.hand.push(gained);
    log(`🏛 ${p.name} traded ${sacrifice.name} for ${gained.name}!`);
    _voice(gained.id, 'temple');
    G.pendingTemple = null;
    advanceTurn();
  },

  temple_leave(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:temple'])) return;
    G.pendingTemple = null;
    log(`${G.players[G.currentPlayer].name} left the Temple`);
    advanceTurn();
  },

  // ── Heal tile ──────────────────────────────────────────────────────────────

  heal_tile_apply(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:heal_tile'])) return;
    const p = G.players[G.currentPlayer];
    const SHRINE_COST = 10;
    const SHRINE_HEAL = 10;
    if (p.mana < SHRINE_COST) return sendError(ws, 'Not enough Mana (need 10 ✦)');
    p.mana -= SHRINE_COST;
    let healed = 0;
    // Heal all stationed monsters on owned tiles
    G.board.forEach(tile => {
      if (tile.ownerId === G.currentPlayer && tile.summonInstance) {
        const gain = Math.min(SHRINE_HEAL, tile.summonInstance.maxHp - tile.summonInstance.hp);
        tile.summonInstance.hp += gain;
        if (gain > 0) healed++;
      }
    });
    // Heal all hand monsters
    p.hand.forEach(m => {
      const gain = Math.min(SHRINE_HEAL, m.maxHp - m.hp);
      m.hp += gain;
      if (gain > 0) healed++;
    });
    p.healCount++;
    log(`💚 ${p.name} used Healing Shrine — all monsters +${SHRINE_HEAL} HP (${healed} healed, −${SHRINE_COST}✦)`);
    G.phase = 'resolve:heal_tile';
    broadcast();
    scheduleRoomAction(G.roomCode, advanceTurn, 800);
  },

  heal_tile_skip(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:heal_tile'])) return;
    advanceTurn();
  },

  // ── Chest ──────────────────────────────────────────────────────────────────

  chest_apply_potion(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:chest'])) return;
    if (!G.pendingChest || G.pendingChest.kind !== 'potion') return sendError(ws, 'No potion');
    const p = G.players[G.currentPlayer];
    // Find by iid in hand OR stationed tiles (supports hand + stationed monsters)
    let m = p.hand.find(h => h.iid === data.iid);
    if (!m) {
      const tile = G.board.find(t => t.ownerId === G.currentPlayer && t.summonInstance && t.summonInstance.iid === data.iid);
      if (tile) m = tile.summonInstance;
    }
    if (!m) return sendError(ws, 'Summon not found');
    const missing = m.maxHp - m.hp;
    if (missing <= 0) return sendError(ws, 'Summon already at full HP');
    const chest = G.pendingChest;
    let healed = 0;
    if (chest.tier === 'Minor')       healed = Math.min(missing, 15);
    else if (chest.tier === 'Major')  healed = Math.floor(missing * 0.5);
    else                              healed = missing;
    m.hp += healed;
    p.healCount++;
    log(`🧪 ${chest.tier} Potion healed ${m.name} for ${healed} HP`);
    G.pendingChest = null;
    advanceTurn();
  },

  chest_assign_charm(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:chest'])) return;
    if (!G.pendingChest || G.pendingChest.kind !== 'charm') return sendError(ws, 'No charm');
    const p = G.players[G.currentPlayer];
    // data.iid = hand monster, data.tilePos = stationed monster's tile
    let m = p.hand.find(h => h.iid === data.iid);
    if (!m && data.tilePos !== undefined) {
      const tile = G.board[data.tilePos];
      if (tile && tile.ownerId === G.currentPlayer) m = tile.summonInstance;
    }
    if (!m) return sendError(ws, 'No summon selected');
    if (m.charm) return sendError(ws, 'Already has a charm');
    m.charm = true;
    log(`⚡ Battle Charm assigned to ${m.name}`);
    G.pendingChest = null;
    advanceTurn();
  },

  chest_warp(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:chest'])) return;
    if (!G.pendingChest || G.pendingChest.kind !== 'warp') return sendError(ws, 'No warp');
    G.pendingChest = null;
    // Warp to random non-special tile
    const eligible = G.board.filter(t => t.kind === 'element');
    const dest = eligible[rand(0, eligible.length - 1)];
    G.players[G.currentPlayer].position = dest.pos;
    log(`🌀 ${G.players[G.currentPlayer].name} warped to tile ${dest.pos} (${dest.element})`);
    // Resolve the landing
    resolveRoll_fromPos(G.currentPlayer, dest.pos);
  },

  chest_discard(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:chest'])) return;
    G.pendingChest = null;
    log(`${G.players[G.currentPlayer].name} skipped chest reward`);
    advanceTurn();
  },

  chest_skip(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:chest'])) return;
    const p = G.players[G.currentPlayer];
    const chest = G.pendingChest;
    if (chest && chest.kind === 'potion') {
      const POTION_MANA = { Minor: 3, Major: 6, Full: 10 };
      const bonus = POTION_MANA[chest.tier] || 3;
      p.mana += bonus;
      if (p.totalManaEarned != null) p.totalManaEarned += bonus;   // v1.0.144
      log(`🧪 ${p.name} converted ${chest.tier} Potion for ${bonus}✦`);
    }
    G.pendingChest = null;
    advanceTurn();
  },

  // ── Wild Card ──────────────────────────────────────────────────────────────

  wildcard_skip(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_cards'])) return;
    G.wildCardDrawn = null;
    if (G.wcTable) G.wcTable.skipped = true;   // v1.0.110: board slides the cards away face-down
    log(`🃏 ${G.players[G.currentPlayer].name} skipped the Wild Card`);
    advanceTurn();
  },

  // v1.0.148: buying is blind — pay for a tier's face-down card (Mana taken now), then the player taps to turn it over (wildcard_reveal).
  // The phone only ever sees tier + cost before buying (publicState hides the drawn cards).
  wildcard_select(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_cards'])) return;
    const p = G.players[G.currentPlayer];
    const { tier, cardId } = data;
    const drawn = G.wildCardDrawn;
    if (!drawn) return sendError(ws, 'No wild cards drawn');
    const card = drawn[tier];
    if (!card || (cardId && card.id !== cardId)) return sendError(ws, 'Invalid card selection');
    if (p.mana < card.cost) return sendError(ws, 'Not enough Mana');

    p.mana -= card.cost;
    G.wcBackDrawn = G.wildCardDrawn;   // v1.0.147: kept so the player can back out (wildcard_back)
    G.wildCardDrawn = null;
    G.wcBought = { tier, cardId: card.id };
    if (G.wcTable) G.wcTable.view = tier;   // board keeps this card front and centre, still face-down
    G.phase = 'resolve:wildcard_reveal';
    log(`🃏 ${p.name} bought the ${tier === 'low' ? 'Iron' : tier === 'mid' ? 'Arcane' : 'Gilded'} card (−${card.cost}✦)`);
    broadcast();
  },

  // v1.0.148: the player turned the bought card over — the board flips it, then the card plays as before.
  // If it can't be used right now, the Mana comes back and the three cards return (the player now knows what it was).
  wildcard_reveal(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_reveal'])) return;
    const p = G.players[G.currentPlayer];
    const b = G.wcBought;
    const card = b && G.wcBackDrawn && G.wcBackDrawn[b.tier];
    if (!card) return sendError(ws, 'No card to reveal');
    G.wcBought = null;

    let why = null;
    // v1.0.136: Jinx / Delay / Stumble do nothing to a Sanctioned player — need an active opponent to aim at
    if (WC_NO_SANCTIONED.includes(card.id) && !G.players.some((pl, i) => i !== G.currentPlayer && !pl.eliminated && !pl.sanctioned))
      why = `needs an active opponent (Sanctioned players have no ${card.id === 'jinx' ? 'income' : card.id === 'delay' ? 'shop' : 'roll'})`;
    if (card.id === 'poach') {
      if (!G.players.some((pl, i) => i !== G.currentPlayer && !pl.eliminated && pl.hand.length > 0)) why = 'needs an opponent with a summon in hand';
      else if (p.hand.length >= 5) why = 'your hand is full (5)';   // v1.0.145
    }
    if (card.id === 'plague' && !G.players.some((pl, i) => i !== G.currentPlayer && !pl.eliminated && G.board.some(t => t.ownerId === i && t.summonInstance)))
      why = 'needs an opponent with a stationed summon';
    if (card.id === 'coup') {
      if (p.hand.length === 0) why = 'needs a summon in your hand to sacrifice';
      else if (!G.board.some(t => t.ownerId !== null && t.ownerId !== G.currentPlayer && !G.players[t.ownerId]?.eliminated && t.summonInstance))
        why = 'needs an occupied enemy tile';
    }
    if (card.id === 'shatter' && !G.board.some(t => t.summonInstance)) why = 'needs a stationed summon on the board';
    // v1.0.150 — batch 1
    if (card.id === 'keen_edge' && !p.hand.some(m => !m.charm) && !G.board.some(t => t.ownerId === G.currentPlayer && t.summonInstance && !t.summonInstance.charm))
      why = 'needs a summon without a charm';
    if (card.id === 'bane_ground' && !G.board.some(t => _baneOk(t))) why = 'needs an enemy single-element summon on a tile';
    if (card.id === 'bargain' && p.wcShop && p.wcShop.kind === 'patronage') why = 'does nothing while you have Patronage';
    // v1.0.151 — batch 2
    if ((card.id === 'parry' || card.id === 'aegis') && !G.board.some(t => _shieldOk(t, card.id))) why = 'needs one of your stationed summons to protect';
    if (card.id === 'disarm' && !G.board.some(_disarmOk)) why = 'needs an enemy stationed summon';
    if (card.id === 'flurry' && p.wcEffects.flurry) why = 'is already waiting on your next attack';
    // v1.0.152 — batch 3
    if (card.id === 'sever' && !G.board.some(_severOk)) why = 'needs an enemy stationed summon';
    if (card.id === 'phoenix_pact' && p.wcEffects.phoenix) why = 'is already protecting you';
    // (Mend always works — with nothing to heal it converts to Mana)
    if (why) {
      p.mana += card.cost;
      G.wildCardDrawn = G.wcBackDrawn; G.wcBackDrawn = null;
      G.phase = 'resolve:wildcard_cards';
      if (G.wcTable) { G.wcTable.pick = null; G.wcTable.view = null; G.wcTable.backSeq = (G.wcTable.backSeq || 0) + 1; }
      log(`🃏 ${card.name} can't be used (${why}) — ${p.name} refunded ${card.cost}✦`);
      sendError(ws, `${card.name} ${why} — ${card.cost}✦ refunded`);
      broadcast();
      return;
    }

    // v1.0.110: tell the board which card was picked so it flips face-up
    if (G.wcTable) { G.wcTable.pick = { tier: card.tier, id: card.id, name: card.name, desc: card.desc }; G.wcTable.view = null; }
    log(`🃏 ${p.name} played ${card.name}`);

    if (card.target === 'self') {
      // v1.0.150
      if (card.id === 'flurry') p.wcEffects.flurry = true;   // v1.0.151
      if (card.id === 'phoenix_pact') p.wcEffects.phoenix = true;   // v1.0.152
      if (card.id === 'wellspring') { p.mana += WELLSPRING_MANA; log(`🃏 Wellspring — ${p.name} +${WELLSPRING_MANA}✦`); }
      if (card.id === 'bargain')    p.wcShop = { kind: 'bargain', left: 1 };
      if (card.id === 'patronage')  p.wcShop = { kind: 'patronage', left: PATRONAGE_SHOPS };
      if (card.id === 'ambush')   p.wcEffects.ambush   = true;
      if (card.id === 'fortify')  p.wcEffects.fortify  = true;
      if (card.id === 'windfall') p.wcEffects.windfall = true;
      log(`🃏 ${card.name} — effect active for ${p.name}`);
      _wcPlayed(card.id);
      advanceTurn();
    } else if (card.target === 'own_station' || card.target === 'player' || card.target === 'own_summon' || card.target === 'enemy_station') {
      G.wildCardPending = { cardId: card.id, cost: card.cost };
      G.phase = 'resolve:wildcard_target';
      broadcast();
    } else if (card.target === 'coup') {
      G.wildCardPending = { cardId: 'coup', step: 'tile', cost: card.cost };
      G.phase = 'resolve:wildcard_coup_tile';
      broadcast();
    } else if (card.target === 'shatter') {
      const totalStationed = G.board.filter(t => t.summonInstance).length;
      G.wildCardPending = { cardId: 'shatter', step: 'pick', picks: [], minPicks: Math.min(2, totalStationed), cost: card.cost };
      G.phase = 'resolve:wildcard_shatter';
      broadcast();
    }
  },

  // v1.0.147: the phone is viewing one tier's card (swipe) — the board brings that card forward. null = back to the three cards.
  wildcard_preview(ws, conn, data) {
    if (!G || G.phase !== 'resolve:wildcard_cards' || !G.wcTable || !G.wildCardDrawn) return;
    if (conn.playerIdx !== G.currentPlayer) return;
    const tier = data.tier == null ? null : String(data.tier);
    if (tier !== null && !['low', 'mid', 'high'].includes(tier)) return;
    if (G.wcTable.view === tier) return;
    G.wcTable.view = tier;
    broadcast();
  },

  // v1.0.147: back out of a bought card before it resolves — full refund, back to the three cards.
  wildcard_back(ws, conn, data) {
    // v1.0.149: only while the bought card is still face-down — once it's turned over, backing out would be a free peek (see wildcard_discard)
    if (!guardTurn(ws, conn, ['resolve:wildcard_reveal'])) return;
    const p = G.players[G.currentPlayer];
    const id = G.wcBought && G.wcBought.cardId;
    G.wcBought = null;
    const card = id && Object.values(WILD_CARD_POOLS).flat().find(c => c.id === id);
    if (!card || !G.wcBackDrawn) return sendError(ws, 'Nothing to back out of');
    p.mana += card.cost;
    G.wildCardDrawn = G.wcBackDrawn;
    G.wcBackDrawn = null;
    G.wildCardPending = null;
    G.phase = 'resolve:wildcard_cards';
    if (G.wcTable) { G.wcTable.pick = null; G.wcTable.view = null; G.wcTable.backSeq = (G.wcTable.backSeq || 0) + 1; }
    log(`🃏 ${p.name} backed out of ${card.name} (+${card.cost}✦ refunded)`);
    broadcast();
  },

  // v1.0.149: throw away a revealed card instead of playing it — no refund (a refund here let players peek at Wild Cards for free)
  wildcard_discard(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_target', 'resolve:wildcard_coup_tile', 'resolve:wildcard_coup_summon', 'resolve:wildcard_shatter'])) return;
    const p = G.players[G.currentPlayer];
    const id = G.wildCardPending && G.wildCardPending.cardId;
    const card = id && Object.values(WILD_CARD_POOLS).flat().find(c => c.id === id);
    G.wildCardPending = null;
    G.wcBackDrawn = null;
    if (G.wcTable) { G.wcTable.skipped = true; G.wcTable.discarded = true; }
    log(`🃏 ${p.name} discarded ${card ? card.name : 'their Wild Card'} (${card ? card.cost : '?'}✦ lost)`);
    advanceTurn();
  },

  // v1.0.146: Mend → Convert to Mana (all summons at full HP, or the player would rather have Mana). Like a chest potion.
  wildcard_mend_convert(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_target'])) return;
    const p = G.players[G.currentPlayer];
    if (!G.wildCardPending || G.wildCardPending.cardId !== 'mend') return sendError(ws, 'No Mend to convert');
    const MEND_MANA = 10;
    p.mana += MEND_MANA;
    if (p.totalManaEarned != null) p.totalManaEarned += MEND_MANA;
    log(`🃏 ${p.name} converted Mend to ${MEND_MANA}✦`);
    _wcPlayed('mend', { converted: true, mana: MEND_MANA });
    G.wildCardPending = null;
    advanceTurn();
  },

  wildcard_target(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_target'])) return;
    const p = G.players[G.currentPlayer];
    const pending = G.wildCardPending;
    if (!pending) return sendError(ws, 'No pending wild card');

    // v1.0.150: Keen Edge — a charm on one of your summons (hand: data.iid, stationed: data.tilePos)
    if (pending.cardId === 'keen_edge') {
      let m = data.iid != null ? p.hand.find(h => h.iid === data.iid) : null;
      if (!m && data.tilePos != null) { const t = G.board[data.tilePos]; if (t && t.ownerId === G.currentPlayer) m = t.summonInstance; }
      if (!m) return sendError(ws, 'Pick one of your summons');
      if (m.charm) return sendError(ws, `${m.name} is already charmed`);
      m.charm = true;
      log(`🃏 Keen Edge — ${m.name} strikes +25% next time`);
      _wcPlayed('keen_edge', data.tilePos != null && data.iid == null ? { tilePos: data.tilePos } : {});
      G.wildCardPending = null;
      advanceTurn();
      return;
    }
    // v1.0.150: Bane Ground — the enemy summon's tile becomes the element that beats it (permanent)
    if (pending.cardId === 'bane_ground') {
      const tile = G.board[data.tilePos];
      if (!_baneOk(tile)) return sendError(ws, 'Pick an enemy single-element summon');
      const m = tile.summonInstance, old = tile.element, nu = TYPE_WEAK[m.type];
      tile.element = nu; tile.label = nu;   // never counts toward Arcane Arbiter's unlock
      const owner = G.players[tile.ownerId];
      pushNotification(owner, { cardId: 'bane_ground', cardName: 'Bane Ground', cardDesc: `Tile ${tile.pos} (${m.name}) turned ${old} → ${nu}. ${m.name} is now on weak ground.`, castByName: p.name, castByColor: p.color, tier: 'low' });
      log(`🃏 Bane Ground — tile ${tile.pos} ${old} → ${nu} (${m.name} on weak ground)`);
      _wcPlayed('bane_ground', { tilePos: tile.pos, targetIdx: tile.ownerId, from: old, to: nu });
      G.wildCardPending = null;
      advanceTurn();
      return;
    }

    // v1.0.151: Parry / Aegis — shield one of your stationed summons (a new shield replaces the old)
    if (pending.cardId === 'parry' || pending.cardId === 'aegis') {
      const tile = G.board[data.tilePos];
      if (!_shieldOk(tile, pending.cardId)) return sendError(ws, pending.cardId === 'parry' && tile && tile.summonInstance && tile.summonInstance.shield === 'aegis' ? 'That summon already has Aegis' : 'Pick one of your stationed summons');
      tile.summonInstance.shield = pending.cardId;
      log(`🃏 ${pending.cardId === 'aegis' ? 'Aegis' : 'Parry'} — ${tile.summonInstance.name} on tile ${tile.pos} is shielded`);
      _wcPlayed(pending.cardId, { tilePos: tile.pos });
      G.wildCardPending = null;
      advanceTurn();
      return;
    }
    // v1.0.152: Sever — the enemy summon breaks free: the tile becomes ownerless and the monster stays as a wild hazard
    if (pending.cardId === 'sever') {
      const tile = G.board[data.tilePos];
      if (!_severOk(tile)) return sendError(ws, 'Pick an enemy stationed summon');
      const owner = G.players[tile.ownerId], m = tile.summonInstance, ownerIdx = tile.ownerId;
      m.shield = null; m.disarmed = false; m.charm = false;
      clearOmen(tile); clearFortune(tile);
      tile.ownerId = null;
      pushNotification(owner, { cardId: 'sever', cardName: 'Sever', cardDesc: `${m.name} on tile ${tile.pos} broke free and went wild. You lost the tile.`, castByName: p.name, castByColor: p.color, tier: 'mid' });
      log(`🃏 Sever — ${owner.name}'s ${m.name} on tile ${tile.pos} breaks free and goes wild!`);
      _wcPlayed('sever', { tilePos: tile.pos, targetIdx: ownerIdx });
      _voice(m.id, 'claim');
      G.wildCardPending = null;
      advanceTurn();   // a Sanctioned owner who just lost their last tile is Eliminated here
      return;
    }
    // v1.0.151: Disarm — an enemy summon's next counter-strike deals 0
    if (pending.cardId === 'disarm') {
      const tile = G.board[data.tilePos];
      if (!_disarmOk(tile)) return sendError(ws, 'Pick an enemy stationed summon');
      tile.summonInstance.disarmed = true;
      pushNotification(G.players[tile.ownerId], { cardId: 'disarm', cardName: 'Disarm', cardDesc: `${tile.summonInstance.name} on tile ${tile.pos} is disarmed: its next counter-strike deals 0.`, castByName: p.name, castByColor: p.color, tier: 'mid' });
      log(`🃏 Disarm — ${tile.summonInstance.name} on tile ${tile.pos} is disarmed`);
      _wcPlayed('disarm', { tilePos: tile.pos, targetIdx: tile.ownerId });
      G.wildCardPending = null;
      advanceTurn();
      return;
    }

    if (pending.cardId === 'mend') {
      const tile = G.board[data.tilePos];
      if (!tile || tile.ownerId !== G.currentPlayer || !tile.summonInstance) return sendError(ws, 'Invalid tile');
      const m = tile.summonInstance;
      const healed = Math.min(20, m.maxHp - m.hp);
      m.hp += healed;
      log(`🃏 Mend healed ${m.name} for ${healed} HP`);
      _wcPlayed('mend', { tilePos: data.tilePos });
      G.wildCardPending = null;
      advanceTurn();
    } else {
      const targetIdx = data.targetIdx;
      if (targetIdx === undefined || targetIdx === G.currentPlayer) return sendError(ws, 'Invalid target');
      const target = G.players[targetIdx];
      if (!target) return sendError(ws, 'Target not found');
      if (target.sanctioned && WC_NO_SANCTIONED.includes(pending.cardId)) return sendError(ws, `${target.name} is Sanctioned, so ${pending.cardId === 'jinx' ? 'Jinx' : pending.cardId === 'delay' ? 'Delay' : 'Stumble'} would have no effect. Pick someone else.`);   // v1.0.136

      // Helper: set a notification on the targeted player
      function notifyTarget(cardId, cardName, desc, tier) {
        pushNotification(target, {
          cardId, cardName, cardDesc: desc,
          castByName: p.name, castByColor: p.color, tier
        });
      }

      if (pending.cardId === 'stumble') {
        target.wcEffects.stumble = true;
        (target.wcBy = target.wcBy || {}).stumble = p.idx;   // v1.0.132: remember who played it
        notifyTarget('stumble', 'Stumble', 'You\'re cursed — your dice roll is skipped next turn and you\'ll move exactly 3 spaces.', 'low');
        log(`🃏 Stumble — ${target.name} is cursed, moves 3 next turn`);
      }
      if (pending.cardId === 'delay') {
        target.wcEffects.delay = true;
        (target.wcBy = target.wcBy || {}).delay = p.idx;   // v1.0.132: remember who played it
        notifyTarget('delay', 'Delay', 'Your shop phase is skipped next turn.', 'low');
        log(`🃏 Delay — ${target.name}'s next shop is skipped`);
      }
      if (pending.cardId === 'jinx') {
        target.wcEffects.jinx = true;
        (target.wcBy = target.wcBy || {}).jinx = p.idx;   // v1.0.132: remember who played it
        notifyTarget('jinx', 'Jinx', 'Your passive Mana income next turn is halved.', 'low');
        log(`🃏 Jinx — ${target.name}'s next income is halved`);
      }
      if (pending.cardId === 'levy') {   // v1.0.150 — a second Levy just replaces the first
        target.wcEffects.levy = true;
        (target.wcBy = target.wcBy || {}).levy = p.idx;
        notifyTarget('levy', 'Levy', 'Your next shop buy costs +50%.', 'low');
        log(`🃏 Levy — ${target.name}'s next shop buy costs +50%`);
      }
      if (pending.cardId === 'rattle') {
        target.wcEffects.rattle = true;
        (target.wcBy = target.wcBy || {}).rattle = p.idx;   // v1.0.132: remember who played it
        notifyTarget('rattle', 'Rattle', 'Your next battle summon fights at half ATK.', 'mid');
        log(`🃏 Rattle — ${target.name}'s next battle at half ATK`);
      }
      if (pending.cardId === 'plague') {
        let hit = 0;
        for (const t of G.board) {
          if (t.ownerId === targetIdx && t.summonInstance) {
            t.summonInstance.hp = Math.max(1, t.summonInstance.hp - 20);   // v1.0.103: was 15
            hit++;
          }
        }
        if (hit > 0) notifyTarget('plague', 'Plague', `All ${hit} of your stationed summon${hit!==1?'s':''} each lost 20 HP.`, 'high');
        log(`🃏 Plague — ${target.name}'s ${hit} summon${hit!==1?'s':''} each lose 20 HP`);
      }
      if (pending.cardId === 'poach') {
        if (target.hand.length === 0) {
          // Target has no hand cards — refund the mana cost and block the action
          const poachCard = (WILD_CARD_POOLS.mid || []).find(c => c.id === 'poach');
          if (poachCard) p.mana += poachCard.cost;
          G.wildCardPending = null;
          log(`🃏 Poach blocked — ${target.name} has no summons in hand (mana refunded)`);
          sendError(ws, `${target.name} has no summons in hand — Poach refunded`);
          advanceTurn();   // v1.0.145: end the turn cleanly instead of leaving it hanging
          return;
        }
        if (p.hand.length >= 5) {
          log(`🃏 Poach failed — ${p.name}'s hand is full`);
          _wcPlayed('poach', { targetIdx, failed: true });
          G.wildCardPending = null;
          advanceTurn();
          return;
        }
        const idx = rand(0, target.hand.length - 1);
        const stolen = target.hand.splice(idx, 1)[0];
        p.hand.push(stolen);
        notifyTarget('poach', 'Poach', `${p.name} stole ${stolen.name} from your hand!`, 'mid');
        log(`🃏 Poach — ${p.name} stole ${stolen.name} from ${target.name}`);
      }
      _wcPlayed(pending.cardId, { targetIdx });
      G.wildCardPending = null;
      advanceTurn();
    }
  },

  wildcard_coup_cancel(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_coup_tile', 'resolve:wildcard_coup_summon'])) return;
    const p = G.players[G.currentPlayer];
    // 50% refund — escape hatch when game forces a dead-end (no valid target tiles)
    const coupCard = (WILD_CARD_POOLS.high || []).find(c => c.id === 'coup');
    const refund = coupCard ? Math.floor(coupCard.cost / 2) : 30;
    p.mana += refund;
    G.wildCardPending = null;
    if (G.wcTable) G.wcTable.skipped = true;   // v1.0.110: card slides away
    log(`🃏 Coup cancelled — ${p.name} received ${refund}✦ refund (50%)`);
    advanceTurn();
  },

  wildcard_coup_tile(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_coup_tile'])) return;
    const p = G.players[G.currentPlayer];
    const tilePos = parseInt(data.tilePos, 10);
    if (isNaN(tilePos)) return sendError(ws, 'Invalid tile');
    const tile = G.board[tilePos];
    if (!tile || tile.ownerId === null || tile.ownerId === G.currentPlayer) return sendError(ws, 'Must pick an enemy-owned tile');
    if (!tile.summonInstance) return sendError(ws, 'Coup requires an occupied tile — pick a tile with a stationed summon');
    G.wildCardPending.tilePos = tilePos;
    G.wildCardPending.step = 'summon';
    G.phase = 'resolve:wildcard_coup_summon';
    broadcast();
  },

  wildcard_coup_summon(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_coup_summon'])) return;
    const p = G.players[G.currentPlayer];
    const sacrifice = p.hand.find(h => h.iid === data.iid);
    if (!sacrifice) return sendError(ws, 'Summon not in hand');
    const tilePos = G.wildCardPending.tilePos;
    const tile = G.board[tilePos];
    if (!tile || !tile.summonInstance) return sendError(ws, 'Target tile is no longer occupied');
    const prevOwner = G.players[tile.ownerId];
    const stolen = tile.summonInstance;

    // Sacrifice the chosen hand monster (destroyed permanently)
    const sacrificeIdx = p.hand.indexOf(sacrifice);
    p.hand.splice(sacrificeIdx, 1);

    // Transfer tile ownership — stationed monster stays on tile, now fights for new owner
    tile.ownerId = G.currentPlayer;
    tile.neverOwned = false; // Phase 1: mark tile as ever-claimed
    // summonInstance and summonId remain unchanged — the monster defects in place

    // Notify previous owner
    pushNotification(prevOwner, {
      cardId: 'coup', cardName: 'Coup',
      cardDesc: `${p.name} executed a Coup! They sacrificed ${sacrifice.name} to seize your tile — ${stolen.name} now fights for them.`,
      castByName: p.name, castByColor: p.color, tier: 'high'
    });

    log(`🃏 Coup — ${p.name} sacrificed ${sacrifice.name} to seize tile ${tilePos} and steal ${stolen.name} from ${prevOwner.name}`);
    _updatePeakTiles(G.currentPlayer);
    _wcPlayed('coup', { targetIdx: prevOwner ? prevOwner.idx : null, tilePos });
    G.wildCardPending = null;
    advanceTurn();
  },

  wildcard_shatter(ws, conn, data) {
    if (!guardTurn(ws, conn, ['resolve:wildcard_shatter'])) return;
    const p = G.players[G.currentPlayer];
    const picks = G.wildCardPending.picks || [];
    const tilePos = parseInt(data.tilePos, 10);
    if (isNaN(tilePos)) return sendError(ws, 'Invalid tile');
    const tile = G.board[tilePos];
    if (!tile || !tile.summonInstance) return sendError(ws, 'No summon on that tile');
    if (picks.includes(tilePos)) return sendError(ws, 'Already selected');
    picks.push(tilePos);
    G.wildCardPending.picks = picks;
    const minPicks = G.wildCardPending.minPicks || 2;
    if (picks.length < minPicks) {
      broadcast();
      return;
    }
    for (const pos of picks) {
      const t = G.board[pos];
      if (t.summonInstance) {
        const owner = G.players[t.ownerId];
        log(`🃏 Shatter — ${t.summonInstance.name} destroyed on tile ${pos}`);
        if (owner) {
          owner.destroyedCount++;
          pushNotification(owner, {
            cardId: 'shatter', cardName: 'Shatter',
            cardDesc: `${p.name} shattered your ${t.summonInstance.name} on tile ${pos}!`,
            castByName: p.name, castByColor: p.color, tier: 'high'
          });
        }
        t.summonInstance = null;
        t.summonId = null;
        t.ownerId = null;
      }
    }
    _wcPlayed('shatter', { picks: picks.slice() });
    G.wildCardPending = null;
    advanceTurn();
  },

  dismiss_notification(ws, conn, data) {
    if (!G || conn.playerIdx === null) return;
    const p = G.players[conn.playerIdx];
    if (!p) return;
    p.notification = (p.notifQueue && p.notifQueue.shift()) || null;   // v1.0.121: next queued notice
    broadcast();
  },

};

