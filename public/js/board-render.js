// board-render.js: split from the inline page script (L2). Loaded in order by board.html; all files share one global scope.
// ─── Render entry ───────────────────────────────────────────────────────────────────────────
let _tsExiting = false; // guard to prevent re-entry during exit animation
// v0.6.55 (live log): render timing + stall reports go to the server's game log
const _perfRenders = { n: 0, skipped: 0, slow: 0 };
function _perfReport(kind, ms, extra) {
  try { if (typeof ws !== 'undefined' && ws && ws.readyState === 1) ws.send(JSON.stringify({ action: 'client_perf', kind, ms: Math.round(ms), phase: (G && G.phase) || '', extra: extra || '' })); } catch (_) {}
}
let _roundCalloutTriggered = null; // tracks which callout has been fired (prevents double-fire)
let _goFanfareTriggered = false;   // tracks whether game-over fanfare has fired this session

function render(){
  const app = document.getElementById('app');
  if (window.SGNews) SGNews.setContext(!G || G.phase === 'lobby' ? 'lobby' : 'game');   // v0.6.44: news banner only in the lobby

  // Exit animation interception: if .ts-callout is present but phase has moved on, animate it out first
  if (!_tsExiting && G && G.phase !== 'resolve:turn_summary') {
    const existingOv = app.querySelector('.ts-callout');
    if (existingOv && !existingOv.classList.contains('ts-callout-exit')) {
      _tsExiting = true;
      existingOv.classList.add('ts-callout-exit');
      setTimeout(() => {
        _tsExiting = false;
        render();
      }, 370);
      return;
    }
  }
  _tsExiting = false;

  // v0.6.55: while the income tally plays, don't rebuild the board — a rebuild threw the tally away and showed
  // the summary on top. The tally's own onDone calls render() with the newest state.
  if (_tallyRunning) { _perfRenders.skipped++; return; }

  app.innerHTML = '';
  updateDisconnectOverlay();
  if (!G) { renderConnecting(app); return; }
  if (G.phase === 'lobby') { renderLobby(app); _fxPrev = null; return; }
  _fxDiff();
  // v0.6.37: during a Sacrifice reveal, draw the tile as it was until the card lands
  const _th = window.BoardFX && BoardFX.sxTileHold && BoardFX.sxTileHold();
  if (_th && G.board[_th.pos]) { const real = G.board[_th.pos]; G.board[_th.pos] = _th.tile; try { renderGame(app); } finally { G.board[_th.pos] = real; } }
  else renderGame(app);
  _wctSync();   // v0.6.26: after renderGame so the wheel centre exists to measure
  _sxSync();    // v0.6.33
  _fxPump();
}

// ─── v0.6.10: Tier 2 board effects — state diff → queued BoardFX calls ────────────────
// Effects wait (queue) while the die / token animation is running, then play once it settles.
let _fxPrev = null, _fxQ = [];
let _battleOv = null;   // v0.6.64: {key, el, at} — the battle overlay survives redraws
// v0.6.26: Wild Card table state sync (grey / live / picked / passed / hidden under overlays)
let _wctInstant = false;
function _wctSync() {
  if (!window.BoardFX || !BoardFX.wcTable || !G) return;
  const inst = _wctInstant; _wctInstant = false;
  try { BoardFX.wcTable(G.wcTable, G.phase, { instant: inst, sfx: _wctSfx }); } catch (e) { console.warn('wct', e); }
}
const _wctSfx = { deal: i => SFX.wildCardDeal(i), live: () => SFX.wildCardLive(), reveal: t => SFX.wildCardReveal(t), skip: () => SFX.wildCardPass() };   // v0.6.26
function _fxBusy() { return !!(boardTokenAnim || boardRollAnimating || boardShowIdleDie || (window.BoardFX && BoardFX.sxBusy && BoardFX.sxBusy()) || (window.BoardFX && BoardFX.curseBusy && BoardFX.curseBusy())); }   // v0.6.50: + curse moment
function _fxTile(pos) { const c = tileElCache.get(pos); return c ? c.el.querySelector('.tile-inner') : null; }
function _fxChip(idx) { return document.querySelector(`.player-chip[data-pidx="${idx}"] .chip-mana-val`); }
function _fxPl(idx) { return G && G.players.find(p => p.idx === idx); }
function _fxChipEl(idx) { return document.querySelector(`.player-chip[data-pidx="${idx}"]`); }
// v0.6.20: tile leader = most tiles; ties keep the current leader if they're still tied at the top, else nobody
let _leaderIdx = null;
function _computeLeader() {
  if (!G || G.phase === 'lobby' || G.phase === 'setup') return null;
  const alive = G.players.filter(p => !p.eliminated);
  const top = Math.max(0, ...alive.map(p => p.tileCount || 0));
  if (top <= 0) return null;
  const c = alive.filter(p => (p.tileCount || 0) === top);
  if (c.length === 1) return c[0].idx;
  return c.some(p => p.idx === _leaderIdx) ? _leaderIdx : null;
}
function _fxDiff() {
  if (!window.BoardFX || !G) return;
  const snap = {
    phase: G.phase, lb: G.lastBattle || null, chest: G.pendingChest || null,
    mana: G.players.map(p => p.mana),
    wc: G.lastWildCard ? G.lastWildCard.seq : 0,
    wct: G.wcTable ? G.wcTable.seq : 0,          // v0.6.26: doubles → Wild Card table
    voice: G.lastVoice ? G.lastVoice.seq : 0,   // v0.6.22
    elim: G.players.map(p => !!p.eliminated),
    sanc: G.players.map(p => !!p.sanctioned && !p.eliminated),   // v0.6.33
    wheel: G.lastWheel ? G.lastWheel.seq : 0,                     // v0.6.35
    hp: G.board.map(t => (t.summon && t.ownerId != null) ? { o: t.ownerId, id: t.summon.iid ?? t.summon.id, hp: t.summon.hp } : null),
  };
  const P = _fxPrev; _fxPrev = snap;
  const newLeader = _computeLeader();
  if (!P) { _leaderIdx = newLeader; _wctInstant = true; return; }        // first state after (re)connect: baseline only
  // 👑 leader change
  if (newLeader !== _leaderIdx) {
    const was = _leaderIdx; _leaderIdx = newLeader;
    if (newLeader != null && P.phase !== 'setup') {
      const L = _fxPl(newLeader);
      _fxQ.push(() => { BoardFX.crown(_fxChipEl(newLeader), { name: L ? L.name : '', color: L ? L.color : '#ffd77a' }); SFX.crownFanfare(); });
    }
  }
  // ☠ eliminations / leaves
  G.players.forEach((p, i) => {
    if (snap.elim[i] && P.elim[i] === false) {
      _fxQ.push(() => { BoardFX.eliminated(_fxChipEl(p.idx), { name: p.name, color: p.color, left: !!p.forfeited }); p.forfeited ? SFX.playerLeft() : SFX.playerFallen(); });
    }
  });
  // 🎡 Wheel of Fortune flip (v0.6.35)
  // v0.6.36: the Wheel is revealed by the Sanction card table (BoardFX.sxTable) — no separate flip
  // ⛓ Sanctioned / ✨ Redeemed (v0.6.33 — simple banner; full moments come later)
  G.players.forEach((p, i) => {
    if (!P.sanc) return;
    if (snap.sanc[i] && P.sanc[i] === false) {   // v0.6.40: chip holds its old look until the card lands
      _sxChipHold[p.idx] = false;
      if (_sxBattleShowing(snap.phase)) _sxAfterBattle.push(p.idx);   // v0.6.42: not until the battle has played out
      else _fxQ.push(() => _sxMoment('sanc', p));
    }
    else if (!snap.sanc[i] && P.sanc[i] === true && !snap.elim[i]) { _sxChipHold[p.idx] = true; _fxQ.push(() => _sxMoment('redeem', p)); }
  });
  // v0.6.42: battle over → now play the Sanctioned moments it caused (after the takeover / held effect)
  if (_sxAfterBattle.length && !_sxBattleShowing(snap.phase)) {
    const ids = _sxAfterBattle; _sxAfterBattle = [];
    _fxQ.push(() => setTimeout(() => ids.forEach(idx => { const pl = _fxPl(idx); if (pl && pl.sanctioned && !pl.eliminated) _sxMoment('sanc', pl); else { delete _sxChipHold[idx]; render(); } }), SX_AFTER_BATTLE_MS));
  }
  // 🃏 wild card played
  if (snap.wc && snap.wc !== P.wc && G.lastWildCard) {
    const wc = G.lastWildCard, caster = _fxPl(wc.casterIdx), tgt = wc.targetIdx != null ? _fxPl(wc.targetIdx) : null;
    const ownedTiles = (idx) => G.board.map((t, i) => (t.ownerId === idx && t.summon) ? i : -1).filter(i => i >= 0);
    _fxQ.push(() => {
      const from = _fxChipEl(wc.casterIdx);
      let targets = [], onImpact = null;
      if (wc.id === 'mend' && wc.tilePos != null) targets = [_fxTile(wc.tilePos)];
      else if (wc.id === 'coup' && wc.tilePos != null) {
        targets = [_fxTile(wc.tilePos)];
        onImpact = () => { BoardFX.takeover(_fxTile(wc.tilePos), { from: tgt ? tgt.color : '#9397ab', to: caster ? caster.color : '#e05252', name: caster ? caster.name : '' }); SFX.takeover(); };
      } else if (wc.id === 'shatter' && Array.isArray(wc.picks)) {
        targets = wc.picks.map(_fxTile);
        onImpact = () => { wc.picks.forEach((pos, j) => setTimeout(() => BoardFX.shatterTile(_fxTile(pos)), j * 150)); SFX.shatterBurst(); };
      } else if (tgt) {
        targets = [_fxChipEl(tgt.idx)];
        if (wc.id === 'plague') { const tiles = ownedTiles(tgt.idx); targets = targets.concat(tiles.map(_fxTile));
          onImpact = () => tiles.forEach((pos, j) => setTimeout(() => BoardFX.plague(_fxTile(pos)), j * 90)); }
        if (wc.id === 'poach' && !wc.failed) onImpact = () => { BoardFX.flow(_fxChipEl(tgt.idx), from, { color: '#c07fd8', n: 5 }); SFX.wildCardDeal(0); setTimeout(() => SFX.wildCardDeal(1), 260); };   // v0.6.30: card flick as the summon is stolen
      } else targets = [from];                       // self cards: Ambush / Fortify / Windfall
      // v0.6.26: if the card is face-up on the Wild Card table, fly it from the centre instead
      const go = (ft) => { SFX.wildCardFly(); return BoardFX.wildCard(wc, from, targets, { onReveal: () => SFX.wildCardReveal(wc.tier), onImpact, fromTable: ft }); };
      _fxHold((BoardFX.wcTableConsume ? BoardFX.wcTableConsume(wc).then(go) : go(false)), 500);   // v0.6.51 (U6): the next tally waits for the card
    });
  }
  // 🎲 v0.6.26: doubles — deal three face-down Wild Cards once the dice and token have settled
  if (snap.wct && snap.wct !== P.wct && BoardFX.wcTable) {
    _fxQ.push(() => BoardFX.wcTable(G.wcTable, G.phase, { deal: true, sfx: _wctSfx }));
  }
  // 🗣 v0.6.22: summon voice — after the claim / temple / chest effect has started
  if (snap.voice && snap.voice !== P.voice && G.lastVoice && G.phase !== 'setup') {
    const v = G.lastVoice, delay = (v.moment === 'temple' || v.moment === 'chest') ? 900 : 650;
    _fxQ.push(() => setTimeout(() => _playVoice(v.id, v.moment), delay));
  }
  // 🗣 v0.6.23: battle start — attacker's voice as the clash begins (stalemate re-fights included)
  if (snap.phase === 'resolve:battle_result' && P.phase !== 'resolve:battle_result' && G.lastBattle && G.lastBattle.attM) {
    const aid = G.lastBattle.attM.id;
    _fxQ.push(() => setTimeout(() => _playVoice(aid, 'battle_start'), 300));
  }
  const cur = _fxPl(G.currentPlayer);
  if (snap.phase !== P.phase) {
    if (snap.phase === 'resolve:battle' && cur) {
      const pos = cur.position, def = _fxPl(G.board[pos]?.ownerId);
      _fxQ.push(() => { BoardFX.challenge(_fxTile(pos), { att: cur.color, def: def ? def.color : '#9397ab', attName: cur.name, defName: def ? def.name : '' }); });
    }
    if (snap.phase === 'resolve:heal_tile' && cur) { const pos = cur.position; _fxQ.push(() => { BoardFX.heal(_fxTile(pos), 0); SFX.healChime(); }); }
    if (snap.phase === 'resolve:well') _fxQ.push(() => { BoardFX.well(_fxTile(0), 40); SFX.wellFountain(); _fxHold(null, 2000); });   // v0.6.51 (U6)
    if (snap.phase === 'resolve:temple' && cur) { const pos = cur.position; _fxQ.push(() => { BoardFX.temple(_fxTile(pos)); SFX.templeChoir(); }); }
    if (snap.phase === 'resolve:chest' && snap.chest) {
      const ch = snap.chest, pos = ch.tilePos ?? (cur ? cur.position : 7);
      const RC = { Common: '#9aabbc', Uncommon: '#5dc97d', Rare: '#c07fd8' };
      const info = ch.kind === 'potion' ? { icon: '🧪', title: `${ch.tier} Potion` }
        : ch.kind === 'charm' ? { icon: '⚡', title: 'Battle Charm' }
        : ch.kind === 'warp' ? { icon: '🌀', title: 'Warp' }
        : { icon: '🎁', title: ch.summon ? `Free Summon · ${ch.summon.name}` : 'Free Summon' };
      _fxQ.push(() => { BoardFX.chest(_fxTile(pos), { ...info, sub: ch.rarity || '', color: RC[ch.rarity] || '#c9a05a' }); SFX.chestOpen(); });
    }
    if (P.phase === 'resolve:battle_result' && P.lb) {
      const lb = P.lb, att = _fxPl(lb.attackerIdx), def = _fxPl(lb.defOwnerIdx);
      const pos = att ? att.position : null;
      if (pos != null) _fxQ.push(() => setTimeout(() => {
        const ti = _fxTile(pos);
        const ac = att ? att.color : '#e05252', dc = def ? def.color : '#5ca8e0';
        if (lb.outcome === 'attacker_wins') { BoardFX.takeover(ti, { from: dc, to: ac, name: att ? att.name : '' }); SFX.takeover(); }
        else if (lb.outcome === 'defender_wins') { BoardFX.held(ti, { color: dc, name: def ? def.name : '' }); SFX.shieldHeld();
          if (lb.defM && lb.defM.id) setTimeout(() => _playVoice(lb.defM.id, 'battle_won'), 450); }   // v0.6.23: defender held — its voice
        else if (lb.outcome === 'mutual') { BoardFX.clash(ti, { a: ac, b: dc, text: 'DOUBLE KO' }); SFX.takeover(); }
        else BoardFX.clash(ti, { a: ac, b: dc, text: 'STALEMATE' });
      }, 250));
    }
  }
  // Mana changes → floating deltas + coin flow from the biggest loser to the biggest gainer
  const deltas = G.players.map((p, i) => ({ idx: p.idx, d: (P.mana[i] != null ? p.mana - P.mana[i] : 0) })).filter(x => x.d);
  if (deltas.length) _fxQ.push(() => {
    deltas.forEach(x => BoardFX.manaFloat(_fxChip(x.idx), x.d));
    const lo = deltas.reduce((a, b) => (b.d < a.d ? b : a)), hi = deltas.reduce((a, b) => (b.d > a.d ? b : a));
    if (lo.d < 0 && hi.d > 0) BoardFX.flow(_fxChip(lo.idx), _fxChip(hi.idx));
  });
  // HP gains on stationed summons (Healing Spring, potions, regen, Lay on Hands…)
  if (snap.phase !== 'resolve:battle_result') {
    const heals = [];
    snap.hp.forEach((t, i) => { const o = P.hp[i]; if (t && o && t.o === o.o && t.id === o.id && t.hp > o.hp) heals.push([i, t.hp - o.hp]); });
    if (heals.length) _fxQ.push(() => { heals.forEach(([i, n], j) => setTimeout(() => BoardFX.heal(_fxTile(i), n), j * 90)); SFX.healChime(); });
  }
}
// v0.6.51 (U6): effects that keep playing after the server has moved on (Wild Card flight, Mana Well burst)
// hold the next player's income tally until they finish. _fxHold(promise, extraMs) or _fxHold(null, ms).
let _fxHolding = 0, _fxHoldUntil = 0, _fxHoldTimer = null;
function _fxHold(promise, extraMs = 0) {
  if (!promise || typeof promise.then !== 'function') { _fxHoldUntil = Math.max(_fxHoldUntil, Date.now() + extraMs); return; }
  _fxHolding++;
  let released = false;
  const release = () => { if (released) return; released = true; _fxHolding = Math.max(0, _fxHolding - 1); _fxHoldUntil = Math.max(_fxHoldUntil, Date.now() + extraMs); };
  promise.then(release, release);
  setTimeout(release, 9000);   // watchdog — never hold the tally forever
}
function _fxHeld() { return _fxHolding > 0 || Date.now() < _fxHoldUntil || _fxBusy(); }   // v0.6.55: queued-but-not-started effects no longer hold the tally
// v0.6.55: poll the hold cheaply and redraw ONCE when it clears (v0.6.51 redrew the whole board every 250 ms while waiting)
function _fxRetryRender() {
  if (_fxHoldTimer) return;
  const t0 = Date.now();
  _fxHoldTimer = setInterval(() => {
    if (_fxQ.length && !_fxBusy()) _fxPump();
    if (!_fxHeld() || Date.now() - t0 > 10000) { clearInterval(_fxHoldTimer); _fxHoldTimer = null; render(); }
  }, 200);
}

function _fxPump() {
  if (!_fxQ.length || _fxBusy()) return;
  const q = _fxQ; _fxQ = [];
  setTimeout(() => q.forEach(fn => { try { fn(); } catch (e) { console.warn('fx', e); } }), 60);
}

function updateDisconnectOverlay(){
  const ov = document.getElementById('disconnect-overlay');
  if (!ov) return;
  if (!G || !G.pausedFor) { ov.classList.remove('visible'); return; }
  const pf = G.pausedFor;
  ov.querySelector('.dco-title').innerHTML = `<span style="color:${pf.color}">${pf.name}</span> has left`;
  ov.querySelector('.dco-code').textContent = G.roomCode;
  ov.querySelector('.dco-wait span').textContent = `Waiting for ${pf.name} to rejoin…`;
  // v0.5.04: Remove Player (host only — hidden on spectator screens)
  const rb = document.getElementById('dco-remove-btn');
  if (rb) {
    rb.style.display = isSpectator ? 'none' : '';
    if (rb._forIdx !== pf.idx) { rb._forIdx = pf.idx; _dcoDisarm(rb); }
  }
  // QR code pointing to /player
  const playerUrl = `${location.protocol}//${location.host}/player`;
  const qrUrlEl = document.getElementById('dco-qr-url');
  if (qrUrlEl) qrUrlEl.textContent = playerUrl;
  const qrEl = document.getElementById('dco-qr');
  if (qrEl && !qrEl._qrDone) {
    qrEl.innerHTML = '';
    try {
      new QRCode(qrEl, { text: playerUrl, width: 120, height: 120,
        colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      qrEl._qrDone = true;
    } catch(e) { /* QR lib not ready */ }
  }
  ov.classList.add('visible');
}

// v0.6.33: two-tap host Skip Sanction turn
let _sxSkipArmed = 0;
function sxSkipClick() {
  const b = document.getElementById('sx-skip-btn');
  if (!b || isSpectator) return;
  if (Date.now() - _sxSkipArmed > 4000) {
    _sxSkipArmed = Date.now();
    b.classList.add('armed'); b.textContent = 'Tap again to skip';
    setTimeout(() => { const bb = document.getElementById('sx-skip-btn'); if (bb && Date.now() - _sxSkipArmed >= 4000) { bb.classList.remove('armed'); bb.textContent = 'Skip Sanction turn'; } }, 4100);
    return;
  }
  _sxSkipArmed = 0;
  try { ws.send(JSON.stringify({ action: 'sanction_skip' })); } catch (e) {}
}
// v0.6.33: offered tiles pulse; the picked one glows
let _sxTableSeen = false;   // v0.6.36: first sxTable call after (re)connect builds without the deal
function _fortuneSync() {   // v0.6.35: big glowing Fortune number centred on each tile
  for (let i = 0; i < 28; i++) {
    const c = tileElCache.get(i); const inner = c && c.el.querySelector('.tile-inner');
    if (!inner) continue;
    const hold = window.BoardFX && BoardFX.sxFortuneHold && BoardFX.sxFortuneHold();   // v0.6.36: old value until the card lands
    const f = (hold && hold.pos === i && !hold.omenHold) ? (hold.val || 0) : ((G.board[i] && G.board[i].fortune) || 0);
    let el = inner.querySelector(':scope > .fortune-num');
    inner.classList.toggle('has-fortune', !!f);
    // v0.6.38: Omen pinned on the tile (held back during its own reveal until the card lands)
    const om = (hold && hold.pos === i && hold.omenHold) ? hold.omen : (G.board[i] && G.board[i].omen);
    let pin = inner.querySelector(':scope > .omen-pin');
    if (!om) { if (pin) pin.remove(); }
    else {
      if (!pin) { pin = document.createElement('div'); inner.appendChild(pin); }
      const curse = /withering|hollow|bleeding|shackled|toll|betrayer/.test(om.id);
      pin.className = 'omen-pin ' + (curse ? 'c' : 'b');
      pin.style.backgroundImage = `url('/img/omens/omen-${om.id}.webp')`;
      pin.style.setProperty('--fr', '0deg');   // v0.6.59: pin = the landed Sanction card (50%, tile angle, centred)
    }
    if (!f) { if (el) el.remove(); continue; }
    if (!el) { el = document.createElement('div'); inner.appendChild(el); }
    el.className = `fortune-num ${f > 0 ? 'b' : 'c'} l${Math.abs(f)}`;
    el.style.setProperty('--fr', `${-(i / 28) * 360}deg`);   // stay upright on the wheel
    el.textContent = (f > 0 ? '+' : '−') + Math.abs(f);
  }
}
function _sxSync() {
  if (!G) return;
  _fortuneSync();
  // v0.6.36: the card table itself lives in BoardFX.sxTable (board-fx.js)
  if (window.BoardFX && BoardFX.sxTable) {
    try {
      BoardFX.sxTable(G, {
        instant: !_sxTableSeen, tileEl: _fxTile, onHold: () => setTimeout(render, 0),   // v0.6.37: holds released → redraw tiles
        sfx: k => _sxSfx(k),   // v0.6.39
        onRevealDone: seq => { if (!isSpectator) send('sanction_reveal_done', { seq }); },
      });
    } catch (e) { console.warn('sxTable', e); }
    _sxTableSeen = true;
  }
  const on = G.phase && G.phase.startsWith('sanction:') && G.sanction;
  for (let i = 0; i < 28; i++) {
    const c = tileElCache.get(i); const inner = c && c.el.querySelector('.tile-inner');
    if (!inner) continue;
    inner.classList.toggle('sx-offer', !!(on && G.phase === 'sanction:pick_tile' && G.sanction.offers.includes(i)));
    inner.classList.toggle('sx-picked', !!(on && G.phase !== 'sanction:pick_tile' && G.sanction.pickedPos === i));
  }
}
// v0.6.35: tarot card flips in the board centre — upright (gold) or reversed (red) — then drops onto its tile
function _wheelFlipFX(w) {
  const wcEl = document.querySelector('.wheel-center'); if (!wcEl) return;
  const r = wcEl.getBoundingClientRect();
  const wh = document.querySelector('.wheel'), k = wh ? wh.getBoundingClientRect().width / 720 : 1;   // board scale
  const W = 128 * k, H = W * 532 / 300, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const reduced = window.BoardFX && BoardFX.level === 'reduced';
  const col = w.upright ? '#ffd77a' : '#ff6b6b';
  const el = document.createElement('div');
  el.className = 'wheel-flip';
  Object.assign(el.style, { left: (cx - W / 2) + 'px', top: (cy - H / 2 - 20 * k) + 'px', width: W + 'px', height: H + 'px' });
  el.innerHTML = `<div class="wf-in"><div class="wf-face" style="background-image:url('/img/omens/omen-back-wheel.webp')"></div>
    <div class="wf-face wf-front" style="background-image:url('/img/omens/omen-wheel-of-fortune.webp');box-shadow:0 0 0 3px ${col},0 0 40px ${col}aa"></div></div>`;
  document.body.appendChild(el);
  const lvl = w.after ? ({1:'Glimmer',2:'Radiance',3:'Exaltation','-1':'Tarnish','-2':'Blight','-3':'Doom'})[w.after] : 'Neutral';
  const cap = document.createElement('div');
  cap.className = 'wheel-flip-cap';
  Object.assign(cap.style, { left: cx + 'px', top: (cy + H / 2 - 4 * k) + 'px', color: col, fontSize: Math.round(22 * k) + 'px', textShadow: `0 0 18px ${col}88, 0 2px 4px #000` });
  cap.innerHTML = w.jackpot ? `JACKPOT +${w.jackpot}✦` : `${w.upright ? 'BLESSING' : 'CURSE'}<div style="font-size:.6em;letter-spacing:.16em;margin-top:4px;color:#f5efe0">Tile ${w.pos} · ${lvl} ${w.after > 0 ? '+' + w.after : w.after}</div>`;
  document.body.appendChild(cap);
  const inner = el.querySelector('.wf-in');
  const endRot = w.upright ? 'rotateY(180deg)' : 'rotateY(180deg) rotateZ(180deg)';
  if (reduced) { inner.style.transform = endRot; el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); }
  else {
    el.animate([{ transform: 'translateY(-240px) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.25,.7,.3,1)' });
    inner.animate([{ transform: 'rotateY(0)' }, { transform: (w.upright ? 'rotateY(90deg)' : 'rotateY(90deg) rotateZ(90deg)') + ' scale(1.15)', offset: .5 }, { transform: endRot }],
      { duration: 900, delay: 450, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'both' });
  }
  setTimeout(() => {
    cap.style.opacity = '1';
    if (window.BoardFX) {
      try { BoardFX.ring && BoardFX.ring(cx, cy, 130 * k, col, { dur: 800, grow: 2.2, width: 4 }); } catch (e) {}
      if (w.jackpot) { try { BoardFX.sparks && BoardFX.sparks(cx, cy, '#ffd77a', 24, 170 * k, { dur: 900, size: 6 }); } catch (e) {} }
    }
  }, reduced ? 200 : 1300);
  // drop onto the tile
  setTimeout(() => {
    cap.style.opacity = '0';
    const t = typeof _fxTile === 'function' ? _fxTile(w.pos) : null;
    if (t && !reduced) {
      const tr = t.getBoundingClientRect(), dx = tr.left + tr.width / 2 - cx, dy = tr.top + tr.height / 2 - (cy - 20 * k);
      el.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.18)`, opacity: .2 }], { duration: 550, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' });
      setTimeout(() => { try { window.BoardFX && BoardFX.ring && BoardFX.ring(tr.left + tr.width / 2, tr.top + tr.height / 2, 50 * k, col, { dur: 600, grow: 2, width: 3 }); } catch (e) {} }, 520);
    } else el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
  }, reduced ? 1800 : 2900);
  setTimeout(() => { el.remove(); cap.remove(); }, reduced ? 2300 : 3600);
}
// v0.6.39: Sanction-turn sound effects (/audio/sx-*.mp3)
const _SX_SFX = { sanctioned: .75, redeem: .7, fanfare: .6, blessing: .6, curse: .65, jackpot: .6, fly: .5 };
const _sxSfxPool = {};
Object.keys(_SX_SFX).forEach(k => { const a = new Audio('/audio/sx-' + k + '.mp3'); a.preload = 'auto'; _sxSfxPool[k] = a; });
function _sxSfx(k) {
  const L = _sfxLvl(), base = _SX_SFX[k]; if (!base || L <= 0) return;
  try { const a = _sxSfxPool[k].cloneNode(); a.volume = Math.min(1, base * L); a.play().catch(() => {}); } catch (e) {}
}
// v0.6.40: tarot Sanctioned / Redeemed moment (BoardFX.sxMoment); placeholder banner kept as a fallback
const _sxChipHold = {};
// v0.6.42: a Sanction caused by a battle waits until the battle overlay is gone, then plays after the tile effect
let _sxAfterBattle = [];
const SX_AFTER_BATTLE_MS = 1600;
const _sxBattleShowing = (ph) => ph === 'resolve:battle' || ph === 'resolve:battle_result';
function _sxMoment(kind, p) {
  const release = () => { delete _sxChipHold[p.idx]; setTimeout(render, 0); };
  if (window.BoardFX && BoardFX.sxMoment) {
    BoardFX.sxMoment(kind, p, { sfx: k => _sxSfx(k), chipEl: () => _fxChipEl(p.idx), onLand: release, onDone: () => { if (p.idx in _sxChipHold) release(); _fxPump(); } });
    return;
  }
  _sxSfx(kind === 'sanc' ? 'sanctioned' : 'redeem'); release();
  const el = document.createElement('div');
  el.className = 'sx-moment ' + kind;
  el.innerHTML = kind === 'sanc' ? `⛓ <span style="color:${p.color}">${p.name.toUpperCase()}</span> IS SANCTIONED` : `✨ <span style="color:${p.color}">${p.name.toUpperCase()}</span> IS REDEEMED`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.classList.remove('show'), 2600);
  setTimeout(() => el.remove(), 3100);
}

// v0.5.04: two-tap Remove Player — first tap arms (4s), second tap sends remove_player.
let _dcoArmTimer = null;
function _dcoDisarm(rb){
  clearTimeout(_dcoArmTimer); _dcoArmTimer = null;
  rb.classList.remove('armed');
  const n = (G && G.pausedFor) ? G.pausedFor.name : 'Player';
  rb.textContent = `Remove ${n}`;
}
function dcoRemoveClick(){
  const rb = document.getElementById('dco-remove-btn');
  if (!rb || !G || !G.pausedFor || isSpectator) return;
  if (!rb.classList.contains('armed')) {
    rb.classList.add('armed');
    rb.textContent = `Tap again to remove ${G.pausedFor.name} for good`;
    _dcoArmTimer = setTimeout(() => _dcoDisarm(rb), 4000);
    return;
  }
  const idx = G.pausedFor.idx;
  _dcoDisarm(rb);
  try { ws.send(JSON.stringify({ action: 'remove_player', idx })); } catch(e) {}
}

function renderConnecting(app){
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
  d.innerHTML = `<div style="font-family:'Cinzel',serif;font-size:32px;font-weight:700;letter-spacing:.12em;color:#b5abfc;">Summon Board</div>
    <div style="font-size:13px;color:#9397ab;">Waiting for server connection…</div>
    <div style="display:flex;gap:8px;margin-top:4px;">
      <div style="width:8px;height:8px;border-radius:50%;background:#9184d9;animation:bounce 1.2s ease-in-out infinite;"></div>
      <div style="width:8px;height:8px;border-radius:50%;background:#9184d9;animation:bounce 1.2s ease-in-out infinite .2s;"></div>
      <div style="width:8px;height:8px;border-radius:50%;background:#9184d9;animation:bounce 1.2s ease-in-out infinite .4s;"></div>
    </div>`;
  app.appendChild(d);
}

function doStartGame(){
  if(ws && ws.readyState === WebSocket.OPEN){
    _playSfx(_sfxTitle);
    send('start_game', { roundLimit: selectedRoundLimit });
  }
}

// ─── About modal ─────────────────────────────────────────────────────────────
function openAboutModal(showHowToPlay = true) {
  if (document.getElementById('about-modal-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'about-modal-backdrop';
  backdrop.id = 'about-modal-backdrop';

  const howToPlayHTML = showHowToPlay ? `
    <div class="about-modal-section">
      <h3>How to Play</h3>
      <p>One person hosts the server and screen-shares the board on a video call — Discord, Zoom, whatever you use. Everyone else opens the game on their phone, no download required. Enter the room code and pick your starter set to join.</p>
      <p><strong style="color:var(--accent-pale)">Your turn:</strong> From round 2, collect Mana (5✦ plus your stationed summons' Gen, minus 1✦ upkeep per tile), then visit the shop to buy or sell one summon. Roll the dice and move around the 28-tile board. What happens next depends on where you land.</p>
      <p><strong style="color:var(--accent-pale)">Empty tile:</strong> Station one of your hand summons to claim it. That tile now generates Mana for you each round.</p>
      <p><strong style="color:var(--accent-pale)">Enemy tile:</strong> Fight! Pick one of your hand summons to attack. Damage is based on ATK vs DEF, modified by elemental type matchups — there are 6 types in a cycle, each strong against one and weak against another. A summon defending its own element's tile gets +15% ATK and DEF. Winner takes the tile; loser's summon is destroyed.</p>
      <p><strong style="color:var(--accent-pale)">Special tiles:</strong> The Mana Well gives +40 Mana when you land on it. Roll doubles and you get a Wild Card at the end of your turn — one face-down card from each tier, buy one or pass. The Treasure Chest gives a random reward — a heal potion, a battle charm, a warp, or a free summon. The Temple lets you trade a normal summon for a powerful Ascendant. The Healing Spring heals all your summons +10 HP for 10✦.</p>
      <p><strong style="color:var(--accent-pale)">Winning:</strong> Two ways to win. Hold the most tiles when the round limit runs out — or be the last player standing. If you end your turn owning zero tiles (after round 1), you're eliminated. Last one standing wins immediately.</p>
      <p><strong style="color:var(--accent-pale)">Sanctioned:</strong> Hit 0 Mana and you're Sanctioned, not out. You get no income and don't roll, but each turn you can place an Omen on a rival's tile, flip the Wheel of Fortune or Sacrifice on your own, or pay 15✦ once to Redeem and rejoin the game.</p>
    </div>` : '';

  backdrop.innerHTML = `
    <div class="about-modal-card">
      <button class="about-modal-close" id="about-modal-close-btn">✕</button>
      <div class="about-modal-eyebrow">About the Game</div>
      <div class="about-modal-title">Summoner's Gambit</div>
      <div class="about-modal-section">
        <p>This game was born out of a few things, and if you clicked the about button, you probably want to know what they are.</p>
        <p>The first was a lack of things I could actually do online with friends and family over Discord or a video call, quizzes only go so far. The second was board games. It always struck me that a proper board game as a videogame should just work, yet every game I came across made it near impossible to actually play with friends. The hardest part of any board game is convincing people to try it, and then you get gatekept by asking everyone to buy it. The third was simpler: I've always wanted to make a video game and just throw it out there. See if the idea would stick.</p>
        <p>So here it is! my first, and hopefully not my last, board game: Summoner's Gambit. It's a bit of an abomination of past video games and board games I've loved, ideas taken and tweaked into something I hope is a unique and fun experience for a crew of friends or family to try in an afternoon.</p>
      </div>
      ${howToPlayHTML}
      <div class="about-modal-section">
        <h3>Credits</h3>
        <p>This game was vibe coded with Claude. I'm not a developer, I just have ideas, and Claude has made them a reality. The art is all AI generated via Comfy-UI with Kera2, animated with LTX 2.5 and Min Max H3. Sound was made with Claude and Yue2 via Comfy-UI. Without them I would not have been able to do any of this.</p>
        <p>I'm not saying I don't need artists, or that I'd replace them with AI. I'm one person with no budget and very little time, and people with skills need to be paid. If I ever ask an artist to help, I want to be able to pay them. Without artists the world would be a pale shade of what it is, so if you find one you like, please go support them, it's ruff out there.</p>
        <p>That said, none of that is the point of this game. I just wanted to make something fun and share it. I hope you find some joy in it.</p>
      </div>
      <div class="about-modal-section">
        <h3>Support &amp; Links</h3>
        <div class="about-modal-links">
          <a class="about-modal-link" href="https://ko-fi.com/fortyonethoughts" target="_blank" rel="noopener">☕ Buy me a coffee</a>
        </div>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeAboutModal(); });
  document.getElementById('about-modal-close-btn').addEventListener('click', closeAboutModal);
}

function closeAboutModal() {
  const el = document.getElementById('about-modal-backdrop');
  if (el) el.remove();
}

function renderLobby(app){
  const root = document.createElement('div');
  root.id = 'scale-root';
  scaleRoot(root);

  // Background image
  const bg = document.createElement('div');
  // v0.6.25: new splash art behind the lobby (summoning circle glow pulses beneath the panels)
  bg.style.cssText = `position:absolute;inset:0;background:url(/img/backgrounds/splash.webp) center/cover no-repeat;z-index:0;`;
  root.appendChild(bg);
  const glow = document.createElement('div');
  glow.className = 'lobby-circle-glow';
  root.appendChild(glow);

  // Overlay: light at the top so the art shows, darker behind the panels
  const ov = document.createElement('div');
  ov.style.cssText = 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,6,16,.15) 0%,rgba(8,6,16,.05) 28%,rgba(8,6,16,.55) 55%,rgba(8,6,16,.88) 100%);z-index:1;';
  root.appendChild(ov);

  const splash = document.createElement('div');
  splash.className = 'lobby-splash';

  const playerCount = G.players.length;
  const canStart = playerCount >= 2;
  const code = G.roomCode || '????';
  const playerURL = `${location.protocol}//${location.host}/player`;
  const spectatorURL = `${location.protocol}//${location.host}/spectate`;
const SET_NAMES = {A:'The Cabal',B:'The Warpack',C:'The Order',D:'The Arcane Watch',E:'Divine Guard',F:'Chaos Legion',G:'Dead Covenant',H:'Ancient Guard'};

  // ── Brand
  const brand = document.createElement('div');
  brand.className = 'lobby-brand';
  brand.innerHTML = `
    <img class="lobby-brand-logo" src="/img/logos/logo-main.webp" alt="Summoner's Gambit">
    <div class="lobby-brand-sub"><button class="about-inline-btn" onclick="openAboutModal(true)">About</button> &nbsp;·&nbsp; Host View &nbsp;·&nbsp; Lobby &nbsp;·&nbsp; v0.6.64 &nbsp;·&nbsp; srv ${G.serverVersion||'?'} &nbsp;·&nbsp; player v0.5.53</div>`;  // v0.6.31: Sound Settings moved to the bottom-left row
  splash.appendChild(brand);

  // ── Two panels
  const panels = document.createElement('div');
  panels.className = 'lobby-panels';

  // Left: Join info
  const leftPanel = document.createElement('div');
  leftPanel.className = 'lobby-panel';
  leftPanel.style.cssText = 'width:300px;flex-shrink:0;';
  leftPanel.innerHTML = `
    <div class="lobby-panel-title">Room Code</div>
    <div class="lobby-code-box">
      <div class="lobby-code-value">${code}</div>
      <div class="lobby-code-hint">Share with players</div>
    </div>
    <div style="margin-top:10px;">
      <div class="lobby-url-lbl">Player URL</div>
      <div class="lobby-url-box">${playerURL}</div>
    </div>
    <div style="margin-top:6px;">
      <div class="lobby-url-lbl" style="color:#9b8dc8;">Spectator URL</div>
      <div class="lobby-url-box" style="color:#9b8dc8;border-color:#9b8dc8;">${spectatorURL}</div>
    </div>
    <div class="lobby-qr-wrap">
      <div class="lobby-qr-lbl">Scan to Join</div>
      <div class="lobby-qr-box"><div id="lobby-qr-canvas"></div></div>
      <div class="lobby-qr-hint">Point your phone camera at this code</div>
    </div>
    <div class="lobby-count-ring">
      <div class="lobby-count-num">${playerCount}<span style="font-size:20px;color:var(--text-dim);"> / 6</span></div>
      <div class="lobby-count-sub">Players joined</div>
    </div>`;
  panels.appendChild(leftPanel);

  // Right: Player roster
  const rightPanel = document.createElement('div');
  rightPanel.className = 'lobby-panel';
  rightPanel.style.cssText = 'flex:1;';
  rightPanel.innerHTML = `<div class="lobby-panel-title">Players</div>`;

  const grid = document.createElement('div');
  grid.className = 'lobby-slot-grid';

  for(let i = 0; i < 6; i++){
    const p = G.players[i];
    const slot = document.createElement('div');
    slot.className = `lobby-slot ${p ? 'filled' : 'empty'}`;
    if(p){
      const setLabel = p.starterSet ? `Set ${p.starterSet} — ${SET_NAMES[p.starterSet]||''}` : '';
      const dcBadge = p.isConnected === false
        ? `<span style="font-size:9px;color:#e87;letter-spacing:.05em;margin-left:6px;">⚠ reconnecting…</span>` : '';
      slot.style.opacity = p.isConnected === false ? '0.45' : '';
      // v0.6.63: bots; the host can remove them (✕)
      const botTag = '';   // v0.6.64: no bot tag or play style — how a bot plays is for players to discover
      slot.innerHTML = `
        <div style="flex-shrink:0;">${playerSigilSVG(p, 30)}</div>
        <div class="lobby-slot-name" style="color:${p.color};">${p.name}${botTag}${dcBadge}</div>
        <div class="lobby-slot-set">${setLabel}</div>`;
      if (p.isBot && !isSpectator) {
        slot.style.position = 'relative';
        const rm = document.createElement('button');
        rm.title = `Remove ${p.name}`; rm.textContent = '✕';
        rm.style.cssText = 'position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#e8dcc0;font-size:11px;cursor:pointer;line-height:1;padding:0;';
        rm.onclick = (e) => { e.stopPropagation(); send('remove_bot', { idx: p.idx }); };
        slot.appendChild(rm);
      }
    } else if (!isSpectator && i === playerCount) {
      // v0.6.63: first open slot = Add Bot (a random bot from the pool joins)
      slot.innerHTML = `
        <div style="width:30px;height:30px;border-radius:50%;border:1px dashed rgba(255,200,64,.5);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:14px;">🤖</span>
        </div>
        <div class="lobby-slot-empty-text" style="color:#ffc840;opacity:.9;">+ Add Bot</div>`;
      slot.style.cursor = 'pointer';
      slot.title = 'Add a bot to this game';
      slot.onclick = () => send('add_bot');
    } else {
      slot.innerHTML = `
        <div style="width:30px;height:30px;border-radius:50%;border:1px dashed rgba(255,255,255,.18);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:14px;color:rgba(255,255,255,.18);">+</span>
        </div>
        <div class="lobby-slot-empty-text">Open Slot</div>`;
    }
    grid.appendChild(slot);
  }

  // Waiting dots if no players yet
  if(playerCount === 0){
    const dots = document.createElement('div');
    dots.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;';
    dots.innerHTML = `<div class="lobby-dot-row"><div class="lobby-dot"></div><div class="lobby-dot"></div><div class="lobby-dot"></div></div>
      <span style="font-size:11px;color:var(--text-mute);">Waiting for players to connect…</span>`;
    rightPanel.appendChild(dots);
  }

  rightPanel.appendChild(grid);

  panels.appendChild(rightPanel);
  splash.appendChild(panels);

  // ── Ko-fi link — flush under right panel
  const kofiRow = document.createElement('div');
  kofiRow.style.cssText = 'width:100%;max-width:960px;display:flex;justify-content:space-between;align-items:center;margin-top:4px;';
  const sndBtn = document.createElement('button');   // v0.6.31: Sound Settings bottom-left, opposite Ko-fi
  sndBtn.className = 'mute-btn'; sndBtn.id = 'mute-btn'; sndBtn.title = 'Sound settings';
  sndBtn.onclick = openAudioSettings;
  sndBtn.style.cssText = 'width:auto;padding:0 14px;gap:6px;display:inline-flex;align-items:center;font-size:14px;';
  sndBtn.innerHTML = (_musicLvl()<=0 && _sfxLvl()<=0 ? '🔇' : '⚙') + '&nbsp;Sound Settings';
  kofiRow.appendChild(sndBtn);
  const fsBtn = document.createElement('button');   // v0.6.43: Full screen
  fsBtn.className = 'mute-btn'; fsBtn.title = 'Full screen (F)'; fsBtn.onclick = toggleFullscreen;
  // v0.6.59: plain ⛶ button in the top-right corner (same as the game top bar), out of the Sound row so Start stays put
  fsBtn.id = 'fs-btn'; fsBtn.textContent = '⛶';
  fsBtn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:50;';
  splash.appendChild(fsBtn);
  const kofiLink = document.createElement('a');
  kofiLink.className = 'kofi-corner';
  kofiLink.href = 'https://ko-fi.com/fortyonethoughts';
  kofiLink.target = '_blank';
  kofiLink.rel = 'noopener';
  kofiLink.textContent = '☕ Buy me a coffee';
  kofiRow.appendChild(kofiLink);
  // v0.6.44: lobby news ticker (filled by news.js) sits between the panels and the Sound / Ko-fi row
  const newsSlot = document.createElement('div');
  newsSlot.id = 'sg-news-ticker';
  newsSlot.style.cssText = 'width:100%;max-width:960px;display:flex;justify-content:center;';
  splash.appendChild(newsSlot);
  splash.appendChild(kofiRow);
  if (window.SGNews) { SGNews.mountTicker(newsSlot); SGNews.refresh(); }

  // ── Round limit selector (host only) — sync to server's current value (handles auto-switch)
  if (G.roundLimit && [10,20,30].includes(G.roundLimit)) selectedRoundLimit = G.roundLimit;
  if (!isSpectator) {
    const rlWrap = document.createElement('div');
    rlWrap.className = 'round-limit-wrap';
    rlWrap.innerHTML = `<div class="round-limit-lbl">Rounds per Player</div>
      <div class="round-limit-btns">
        ${[10,20,30].map(n=>`<button class="round-limit-btn${selectedRoundLimit===n?' selected':''}" data-limit="${n}">${n}</button>`).join('')}
      </div>`;
    rlWrap.querySelectorAll('.round-limit-btn').forEach(btn => {
      btn.onclick = () => {
        selectedRoundLimit = Number(btn.dataset.limit);
        rlWrap.querySelectorAll('.round-limit-btn').forEach(b => b.classList.toggle('selected', Number(b.dataset.limit) === selectedRoundLimit));
      };
    });
    // v0.6.32: Skip setup toggle (host only) — server holds G.skipSetup so phones can show it
    const ssWrap = document.createElement('div');
    ssWrap.className = 'round-limit-wrap';
    ssWrap.innerHTML = `<div class="round-limit-lbl">Setup Phase</div>
      <div class="round-limit-btns">
        <button class="round-limit-btn${!G.skipSetup?' selected':''}" data-skip="0">Normal</button>
        <button class="round-limit-btn${G.skipSetup?' selected':''}" data-skip="1">Auto (skip)</button>
      </div>`;
    ssWrap.querySelectorAll('.round-limit-btn').forEach(btn => {
      btn.onclick = () => {
        const on = btn.dataset.skip === '1';
        ssWrap.querySelectorAll('.round-limit-btn').forEach(b => b.classList.toggle('selected', b === btn));
        send('set_skip_setup', { on });
      };
    });
    // v0.6.63: Bot speed (host only) — Normal waits for the board's animations, Fast halves the pauses, Instant is for testing
    const bsWrap = document.createElement('div');
    bsWrap.className = 'round-limit-wrap';
    const bs = G.botSpeed || 'normal';
    bsWrap.innerHTML = `<div class="round-limit-lbl">Bot Speed</div>
      <div class="round-limit-btns">
        ${['normal','fast','instant'].map(k=>`<button class="round-limit-btn${bs===k?' selected':''}" data-bs="${k}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}
      </div>`;
    bsWrap.querySelectorAll('.round-limit-btn').forEach(btn => {
      btn.onclick = () => {
        bsWrap.querySelectorAll('.round-limit-btn').forEach(b => b.classList.toggle('selected', b === btn));
        send('set_bot_speed', { speed: btn.dataset.bs });
      };
    });
    // v0.6.60: Rounds and Setup side by side on one line so Start sits higher (nothing below the splash art)
    const optRow = document.createElement('div');
    optRow.style.cssText = 'display:flex;justify-content:center;align-items:flex-start;gap:48px;width:100%;max-width:960px;margin-top:8px;';
    rlWrap.style.cssText = 'width:auto;margin-top:0;'; ssWrap.style.cssText = 'width:auto;margin-top:0;';
    optRow.appendChild(rlWrap); optRow.appendChild(ssWrap);
    if (G.players.some(pl => pl.isBot)) { bsWrap.style.cssText = 'width:auto;margin-top:0;'; optRow.appendChild(bsWrap); }
    // v0.6.61: options sit in the Sound Settings / Ko-fi row (between them) — one row less under the panels
    optRow.style.cssText = 'display:flex;justify-content:center;align-items:flex-start;gap:40px;width:auto;margin:0;';
    kofiRow.style.alignItems = 'center';
    kofiRow.insertBefore(optRow, kofiLink);
  }

  // ── Start button (host only) / spectator waiting notice
  const startWrap = document.createElement('div');
  startWrap.className = 'lobby-start-wrap';
  if (isSpectator) {
    startWrap.innerHTML = `<div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.25em;color:var(--text-mute);text-transform:uppercase;padding:12px 0;">👁 Watching — waiting for host to start</div>`;
  } else {
    const startBtn = document.createElement('button');
    startBtn.className = 'lobby-start-btn';
    startBtn.disabled = !canStart;
    startBtn.textContent = canStart ? 'Start Game' : 'Waiting for Players…';
    startBtn.onclick = doStartGame;
    startWrap.appendChild(startBtn);
  }
  if (!isSpectator) {
    const hint = document.createElement('div');
    hint.className = 'lobby-start-hint';
    hint.textContent = canStart
      ? `${playerCount} player${playerCount!==1?'s':''} ready — ${selectedRoundLimit} rounds per player`
      : 'Need at least 2 players to start';
    startWrap.appendChild(hint);
  }
  splash.appendChild(startWrap);

  root.appendChild(splash);

  app.appendChild(root);

  // Generate QR code after DOM is ready
  const qrEl = document.getElementById('lobby-qr-canvas');
  if(qrEl && typeof QRCode !== 'undefined'){
    try{
      new QRCode(qrEl, {
        text: playerURL,
        width: 110,
        height: 110,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }catch(e){ qrEl.textContent = playerURL; }
  }
}

function renderGame(app){
  const root = document.createElement('div');
  root.id = 'scale-root';

  const curPlayer = G.players[G.currentPlayer];
  const isSetup = G.phase === 'setup';
  const setupTurnDisplay = G.setupTotalTurns > 0
    ? ` · Turn ${(G.setupTurnIdx || 0) + 1}/${G.setupTotalTurns}`
    : '';
  const phaseLabel = isSetup && G.autoSetupRunning
    ? `Auto Setup — placing summons${setupTurnDisplay}`   // v0.6.32
    : isSetup
    ? `Setup Phase — Round ${G.setupRound || 1} of 3${setupTurnDisplay}`
    : (PHASE_LABELS[G.phase] || G.phase);
  const roundLabel = isSetup
    ? `Setup R${G.setupRound || 1}/3`
    : `Round ${G.round != null ? G.round : Math.floor(G.turnCount / G.players.length) + 1} of ${G.roundLimit || 20}`;   // v0.6.46: real round
  const lastRoll = curPlayer ? curPlayer.lastDiceRoll : null;

  // ── Topbar
  const tb = document.createElement('div');
  tb.className = 'topbar';
  tb.innerHTML = `
    <div class="logo">⚔️</div>
    <div class="room-block">
      <span class="room-lbl">Board <span style="color:var(--text-mute);font-size:8px;letter-spacing:.1em;">· v0.6.64</span> <span style="color:var(--text-mute);font-size:8px;letter-spacing:.05em;">srv ${G.serverVersion||'?'}</span></span>
      <span class="room-code" style="color:var(--accent-lit);">${G.roomCode || '????'}</span>
    </div>
    <div class="tb-center">
      <div class="turn-lbl">${roundLabel}</div>
      <div class="active-name" style="color:${curPlayer ? curPlayer.color : 'var(--text)'}">${curPlayer ? curPlayer.name : '—'}</div>
      <div class="phase-lbl">${phaseLabel}</div>
    </div>
    <div class="tb-right">
      <div class="roll-block">
        <span class="roll-lbl">Last Roll</span>
        <span class="roll-val">${lastRoll != null ? lastRoll : '—'}</span>
      </div>
      <div class="vdiv"></div>
      <button class="mute-btn" id="rules-btn" onclick="openRulesRecap()" title="Rules recap (R)" style="font-family:'Cinzel',serif;font-size:13px;width:auto;padding:0 12px;font-weight:700;letter-spacing:.06em">📜 Rules</button>
      <div class="vdiv"></div>
      <button class="mute-btn" id="fs-btn" onclick="toggleFullscreen()" title="Full screen (F)">⛶</button>
      <div class="vdiv"></div>
      <button class="mute-btn" id="mute-btn" onclick="openAudioSettings()" title="Sound settings">${_musicLvl()<=0 && _sfxLvl()<=0 ? '🔇' : '⚙'}</button>
      <div class="vdiv"></div>
      ${isSpectator
        ? `<div style="font-family:'Cinzel',serif;font-size:8px;letter-spacing:.22em;color:#9184d9;background:rgba(145,132,217,.14);border:1px solid rgba(145,132,217,.3);border-radius:5px;padding:5px 10px;text-transform:uppercase;">👁 Spectating</div>`
        : `<button class="tb-end-btn" onclick="showEndGameModal()">End Game</button>`}
    </div>`;
  root.appendChild(tb);

  // ── Main
  const main = document.createElement('div');
  main.className = 'main';
  root.appendChild(main);

  // ── Board area
  const boardArea = document.createElement('div');
  boardArea.className = 'board-area';

  // Background image layer
  const boardBg = document.createElement('div');
  boardBg.className = 'board-bg';
  boardBg.style.backgroundImage = `url(${BKG_SRC})`;
  boardArea.appendChild(boardBg);

  main.appendChild(boardArea);

  // ── Wheel
  const wheel = document.createElement('div');
  wheel.className = 'wheel';

  // Board art overlay (the circular board image behind tiles)
  const boardArt = document.createElement('div');
  boardArt.className = 'board-art';
  boardArt.style.backgroundImage = `url(${BKG_SRC})`;
  wheel.appendChild(boardArt);

  const N = 28, R = 316;

  // Pre-compute effective position for every player (accounts for hop animation)
  const effPos = G.players.map((p, pi) => getEffectivePosition(pi));

  // Build set of bonus tile positions for this render pass
  const bonusTilePositions = new Set((G.bonusRuns || []).flatMap(r => r.tiles));

  G.board.forEach((tile, i) => {
    const angleDeg = (i / N) * 360;
    const isBonus = bonusTilePositions.has(i);

    const isSpecial = tile.kind !== 'element';
    const color = isSpecial ? '#c0392b' : (TYPE_COLOR[tile.element] || '#9397ab');
    const label = tile.label || tile.element || tile.kind;
    const bg = isSpecial
      ? 'linear-gradient(160deg,#4a1a1a,#2a0e0e)'
      : `linear-gradient(160deg,color-mix(in srgb,${color} 62%,#10111e 38%),color-mix(in srgb,${color} 40%,#0c0d1a 60%))`;
    const border = `1px solid ${color}cc`;

    // Classify tile state for animation (changes every move)
    const animHere = boardTokenAnim && boardTokenAnim.path[boardTokenAnim.step] === i;
    const settledHere = G.players.some((p, pi) =>
      effPos[pi] === i && !(boardTokenAnim && boardTokenAnim.playerIdx === pi)
    );
    const isActiveTile = effPos[G.currentPlayer] === i;

    // Content key — only changes when tile ownership/summon/HP actually changes.
    // Token moves and animation flags are NOT included so they don't trigger rebuilds.
    const contentKey = `${tile.element}|${tile.kind}|${tile.ownerId}|${tile.summon?.id}|${tile.summon?.hp}|${tile.summon?.charm}|${isBonus}`;

    const cached = tileElCache.get(i);
    let div;

    if (cached && cached.contentKey === contentKey) {
      // Reuse existing element — img/GIF elements survive, no flicker
      div = cached.el;
    } else {
      // Content changed (or first render) — rebuild this tile
      const imgSrc = isSpecial ? TILE_IMG[tile.kind] : TILE_IMG[tile.element];
      const artHTML = imgSrc
        ? `<div class="tile-art-icon"><img src="${imgSrc}" class="tile-art-img" alt=""></div>`
        : isSpecial
          ? `<div class="tile-art-special" style="color:${color};">${SPECIAL_ICONS[tile.kind] || '❖'}</div>`
          : `<div class="tile-art-icon" style="color:#fff;">${TYPE_ICON[tile.element] || '✦'}</div>`;

      let badgeHTML = '';
      if (tile.summon && tile.ownerId !== null && tile.ownerId !== undefined) {
        const owner = G.players.find(p => p.idx === tile.ownerId);
        if (owner) badgeHTML = `<div class="tile-badge">${tileSummonCard(tile.summon, owner.color)}</div>`;
      } else if (tile.ownerId !== null && tile.ownerId !== undefined) {
        const owner = G.players.find(p => p.idx === tile.ownerId);
        if (owner) badgeHTML = `<div class="tile-badge"><svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="${owner.color}55" stroke="${owner.color}" stroke-width="1.5"/></svg></div>`;
      }

      div = document.createElement('div');
      div.style.cssText = `transform:rotate(${angleDeg}deg) translateY(-${R}px);`;
      const synergyBadge = isBonus ? `<span class="tile-synergy-badge">🔥</span>` : '';
      div.innerHTML = `<span class="tile-idx">${i}</span>
      ${badgeHTML}
      <div class="tile-body">
        <div class="tile-inner" style="background:${bg};border:${isBonus ? `2px solid ${color}` : border};">
          ${artHTML}
          ${synergyBadge}
          <span class="tile-name" style="color:${color};font-size:9px;">${label}</span>
        </div>
      </div>`;
      div.onclick = () => { selectedTile = selectedTile === i ? null : i; render(); };
      // v0.6.00: claim fanfare — an unowned tile just gained an owner + summon
      if (cached && window.BoardFX && tile.summon && tile.ownerId != null && G.phase !== 'resolve:battle_result') {
        const prevOwner = cached.contentKey.split('|')[2];
        if (prevOwner === 'null' || prevOwner === 'undefined') {
          const owner = G.players.find(p => p.idx === tile.ownerId);
          const elemCol = TYPE_COLOR[tile.summon.type] || TYPE_COLOR[tile.element] || '#c9a05a';
          setTimeout(() => {
            BoardFX.claim(div.querySelector('.tile-inner'), { owner: owner ? owner.color : '#9184d9', elem: elemCol, name: owner ? owner.name : '', badge: div.querySelector('.tile-badge') });
            SFX.claimFanfare();
          }, 40);
        }
      }
      tileElCache.set(i, { el: div, contentKey });
    }

    // Always update classes — these change with every token move
    div.className = 'tile'
      + (selectedTile === i ? ' selected' : '')
      + (isActiveTile ? ' active-tile' : '')
      + (animHere ? ' is-visiting' : '')
      + (settledHere ? ' is-settled' : '')
      + (isBonus ? ' bonus-tile' : '');

    wheel.appendChild(div);
  });

  // Render player tokens — absolute layer INSIDE the wheel (wheel-space coordinates).
  // No getBoundingClientRect needed: the wheel is still being built (not yet in DOM),
  // and scale-root handles all viewport scaling automatically.
  // Art-center ring: tile outer edge = R+51; art center 30.5px inward → R+20.5 = 336.5px.
  // board-area overflow:hidden doesn't clip tile-0 tokens because the wheel is centered
  // with a 50px margin above (topbar=80px → board-area=820px → (820-720)/2 = 50px margin),
  // and the token at tile-0 only reaches 46.5px above the wheel top edge.
  const TOKEN_RING_R = R + 20.5; // 336.5px from wheel center (wheel-space, unscaled)

  // Clean up any old body-level overlay from a prior approach
  const _oldLayer = document.getElementById('board-token-layer');
  if (_oldLayer) _oldLayer.remove();

  const tokLayer = document.createElement('div');
  tokLayer.id = 'wheel-token-layer';
  tokLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;overflow:visible;';

  G.players.forEach((p, pi) => {
    const tileIdx = effPos[pi];
    const angleRad = (tileIdx / N) * 2 * Math.PI;

    // Spread tokens that share the same tile
    const tokensAtTile = G.players.filter((q, qi) => effPos[qi] === tileIdx);
    const ti = tokensAtTile.findIndex(q => q.idx === p.idx);
    const offsetX = (ti - (tokensAtTile.length - 1) / 2) * 15;

    const isHopping = boardTokenAnim && boardTokenAnim.playerIdx === pi;

    // Token center in wheel coords (360,360 = wheel center) — flag up, pin at art center
    const cx = 360 + TOKEN_RING_R * Math.sin(angleRad) + offsetX;
    const cy = 380 - TOKEN_RING_R * Math.cos(angleRad);

    const tok = document.createElement('div');
    tok.className = 'player-token' + (isHopping ? ' hopping' : '');
    tok.style.cssText = `left:${cx - 70}px;top:${cy - 140}px;`; // anchor BOTTOM of token box to ring (base at cy)
    tok.innerHTML = playerTokenSVG(p, 140)
      + (p.idx === _leaderIdx && !p.eliminated ? `<div style="position:absolute;left:50%;top:6px;transform:translateX(-50%);font-size:24px;filter:drop-shadow(0 0 6px #ffd77a) drop-shadow(0 2px 2px rgba(0,0,0,.6));">👑</div>` : '');
    if (p.eliminated) tok.style.cssText += 'opacity:.28;filter:grayscale(1);';   // v0.6.20
    else if (p.sanctioned) tok.style.cssText += 'opacity:.75;filter:saturate(.5) drop-shadow(0 0 3px #e0565b) drop-shadow(0 0 8px rgba(224,86,91,.8));';   // v0.6.33
    tokLayer.appendChild(tok);
  });
  wheel.appendChild(tokLayer); // append layer to wheel after tiles

  // Wheel center — idle die or battle overlay
  const wc = document.createElement('div');
  wc.className = 'wheel-center';

  if (G.phase === 'resolve:battle_result' && G.lastBattle) {
    // ── Full-area clash result overlay (appended to boardArea after wheel) ──
    // wc stays as idle die placeholder — actual content goes in a rect overlay
    wc.innerHTML = `<div class="center-idle">
      <div class="arcane-die" id="board-anim-die">
        <div class="die-pip pip-tl"></div><div class="die-pip pip-tr"></div>
        <div class="die-pip pip-bl"></div><div class="die-pip pip-br"></div>
        <div class="die-face" id="board-die-face">⚔</div>
      </div>
    </div>`;
  } else if (G.phase === 'resolve:battle' && !boardShowIdleDie && !boardTokenAnim) {  // v0.6.11: die stays up while the token hops in
    const tile = G.board[curPlayer ? curPlayer.position : 0];
    const defOwner = tile && tile.ownerId != null ? G.players.find(p => p.idx === tile.ownerId) : null;
    const defM = tile ? tile.summon : null;
    const attM = G.pendingAttackerSummon || null;
    const attSlot = attM
      ? `${renderBoardCard(attM)}`
      : `<div style="width:90px;height:128px;border-radius:8px;border:2px dashed var(--border2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:10px;color:var(--text-mute);">
           <span style="font-size:20px;opacity:.4;">⚔</span>choosing…
         </div>`;
    wc.innerHTML = `<div class="battle-center visible">
      <div class="battle-eyebrow">Battle Engaged</div>
      <div style="display:flex;align-items:center;gap:14px;margin:6px 0;">
        <div style="text-align:center;">
          <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-mute);margin-bottom:5px;font-family:'Cinzel',serif;">Attacker</div>
          ${attSlot}
          <div style="font-size:10px;color:${curPlayer ? curPlayer.color : 'var(--text-dim)'};margin-top:5px;font-weight:600;">${curPlayer ? curPlayer.name : '?'}</div>
        </div>
        <div class="battle-nums">
          <div class="battle-dmg">⚔</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-mute);margin-bottom:5px;font-family:'Cinzel',serif;">Defending</div>
          ${renderBoardCard(defM)}
          ${defOwner ? `<div style="font-size:10px;color:${defOwner.color};margin-top:5px;font-weight:600;">${defOwner.name}</div>` : ''}
        </div>
      </div>
      <div class="battle-foot">Tile ${curPlayer ? curPlayer.position : '?'}</div>
    </div>`;
  } else if (G.phase && G.phase.startsWith('sanction:') && G.sanction && curPlayer) {   // v0.6.36: centre left clear — BoardFX.sxTable draws the card table
    wc.innerHTML = `<div class="center-idle"></div>`;
  } else {
    wc.innerHTML = `<div class="center-idle">
      <div class="arcane-die" id="board-anim-die" style="position:relative;overflow:visible;">
        <div class="die-pip pip-tl"></div><div class="die-pip pip-tr"></div>
        <div class="die-pip pip-bl"></div><div class="die-pip pip-br"></div>
        <div class="die-face" id="board-die-face">${boardShowIdleDie ? '?' : (lastRoll != null ? lastRoll : '?')}</div>
        <div class="die-hit-lottie" id="board-die-hit-lottie"></div>
      </div>
      <div class="center-title">Summoners Gambit</div>
      <div class="center-sub">${curPlayer ? curPlayer.name + ' — ' + phaseLabel : 'Waiting…'}</div>
    </div>`;
  }
  wheel.appendChild(wc);

  // Game over — full screen winners overlay injected into boardArea after wheel is added

  boardArea.appendChild(wheel);
  processTileFlashes(); // v0.5.03

  // ── Battle result full overlay — 5-beat sequential animation ──
  // v0.6.64: the overlay is kept across redraws — before, every update during a battle rebuilt it and restarted
  // the animation (looked like the battle was glitching, worst with bots on Fast)
  if (G.phase === 'resolve:battle_result' && G.lastBattle) {
    const lb = G.lastBattle;
    const bKey = [G.turnCount, lb.attackerIdx, lb.defOwnerIdx, lb.attM && lb.attM.iid, lb.defM && lb.defM.iid, lb.atkDmg, lb.defDmg, lb.outcome].join('|');
    if (_battleOv && _battleOv.key === bKey) {
      boardArea.appendChild(_battleOv.el);
    } else {
      const attPlayer = G.players[lb.attackerIdx];
      const defPlayer = lb.defOwnerIdx != null ? G.players.find(p => p.idx === lb.defOwnerIdx) : null;
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute;inset:0;z-index:15;background:rgba(8,8,20,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;';
      boardArea.appendChild(overlay);
      _battleOv = { key: bKey, el: overlay, at: Date.now() };
      runBattleAnimation(lb, attPlayer, defPlayer, overlay);
    }
  } else _battleOv = null;

  // ── v0.6.33: host-only Skip Sanction turn (no timer on Sanction turns)
  if (G.phase && G.phase.startsWith('sanction:') && !isSpectator) {
    const sk = document.createElement('button');
    sk.className = 'sx-skip';
    sk.id = 'sx-skip-btn';
    sk.textContent = 'Skip Sanction turn';
    sk.onclick = sxSkipClick;
    boardArea.appendChild(sk);
  }

  // ── Wild Card banner overlay ──
  if (G.phase && G.phase.startsWith('resolve:wildcard')) {
    const wcBanner = document.createElement('div');
    wcBanner.style.cssText = 'position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:20;background:rgba(20,15,40,.92);border:1.5px solid rgba(201,146,42,.6);border-radius:12px;padding:12px 28px;display:flex;align-items:center;gap:12px;box-shadow:0 0 24px rgba(201,146,42,.25);';
    const wcP = G.players[G.currentPlayer];
    const wcPhaseText = { 'resolve:wildcard_cards':'choosing a Wild Card', 'resolve:wildcard_target':'targeting...', 'resolve:wildcard_coup_tile':'selecting a tile to seize', 'resolve:wildcard_coup_summon':'deploying a summon', 'resolve:wildcard_shatter':'selecting summons to shatter' };
    const wcMsg = wcPhaseText[G.phase] || 'Wild Card';
    wcBanner.innerHTML = `<span style="font-size:22px">🃏</span><div><div style="font-family:'Cinzel',serif;font-size:12px;letter-spacing:.12em;color:#c9922a;">WILD CARD</div><div style="font-size:11px;color:var(--text-lo);margin-top:2px;"><span style="color:${wcP?.color||'#c9a05a'};font-weight:600">${wcP?.name||'?'}</span> is ${wcMsg}</div></div>`;
    boardArea.appendChild(wcBanner);
  }

  // ── Right rail (must be appended before any early-return so it's visible during tally)
  const rail = document.createElement('div');
  rail.className = 'right-rail';
  rail.appendChild(renderPaper());
  main.appendChild(rail);

  // ── Round tally animation (fires before turn summary callout)
  if (G.phase === 'resolve:turn_summary' && G.turnSummary) {
    const _rt = G.turnSummary.roundTally;
    const _tKey = `${G.round}|${G.turnCount}|${G.currentPlayer}`;   // v0.6.55: was the turnSummary object, which is new on every update → the tally replayed
    if (_rt && _rt.length > 0 && _tallyPlayedFor !== _tKey && !_tallyRunning) {
      if (_curseHoldTally()) { scaleRoot(root); app.appendChild(root); return; }   // v0.6.50
      if (_fxHeld()) { scaleRoot(root); app.appendChild(root); _fxPump(); _fxRetryRender(); return; }   // v0.6.51 (U6): let the last turn's effects finish first: Jinx card lands before the income tally
      _tallyPlayedFor = _tKey; // mark immediately — prevents re-trigger on subsequent renders
      scaleRoot(root);       // commit board to DOM before returning — overlay positions against in-tree tiles
      app.appendChild(root); // fix: app.innerHTML='' cleared screen; root was never inserted before tally fired
      requestAnimationFrame(() => runRoundTally(_rt, boardArea, () => { send('tally_complete'); render(); }));
      return; // board is now rendered; tally overlays it; ts-callout shows after
    }
  }

  // ── Turn summary callout (compact — player name + net mana + total)
  if (G.phase === 'resolve:turn_summary' && G.turnSummary) {
    const ts = G.turnSummary;
    const p = G.players[ts.playerIdx];
    const netMana = (ts.baseline + ts.summonGen + ts.wellBonus + (ts.battleManaGain||0)) - ts.intimidateLoss - ts.upkeep - (ts.battleManaLoss||0);
    const netIsNeg = netMana < 0;
    const netSign = netMana >= 0 ? '+' : '−';
    const netAbs = Math.abs(netMana);
    const roundsRemLabel = ts.roundsRemaining === 1 ? 'Round 1 remaining' : `Round ${ts.round} · ${ts.roundsRemaining} remaining`;
    const dotColor = p ? p.color : '#9184d9';

    const ov = document.createElement('div');
    ov.className = 'ts-callout';
    ov.innerHTML = `<div class="ts-card">
      <div class="ts-player-row">
        <div class="ts-dot" style="background:${dotColor}"></div>
        <div class="ts-name">${ts.playerName}</div>
      </div>
      <div class="ts-divider"></div>
      <div class="ts-net-row">
        <span class="ts-net-sign${netIsNeg?' neg':''}">${netSign}</span>
        <span class="ts-net-val${netIsNeg?' neg':''}">${netAbs}</span>
        <span class="ts-net-unit${netIsNeg?' neg':''}">✦</span>
      </div>
      <div class="ts-total-pill">
        <span class="ts-total-lbl">Total</span>
        <span class="ts-total-val">${ts.manaAfter}</span>
        <span class="ts-total-unit">✦</span>
      </div>
      <div class="ts-round-lbl">${roundsRemLabel}</div>
    </div>`;
    boardArea.appendChild(ov);
  }

  // ── Winners screen (full overlay)
  if (G.phase === 'game_over') {
    const rankings = G.rankings || [...G.players].sort((a,b)=>{
      const ta = G.board.filter(t=>t.ownerId===a.idx).length;
      const tb = G.board.filter(t=>t.ownerId===b.idx).length;
      return tb !== ta ? tb - ta : b.mana - a.mana;
    }).map(p=>({...p, tiles: G.board.filter(t=>t.ownerId===p.idx).length}));

    const champ = rankings[0];

    // Awards: find who has the most of each stat
    const statMax = (fn) => {
      const vals = rankings.map(fn);
      const max = Math.max(...vals);
      return rankings.filter((p,i)=>vals[i]===max).map(p=>p.name);
    };
    const awards = {};
    const addAward = (names, label) => names.forEach(n => { if(!awards[n]) awards[n]=[]; awards[n].push(label); });
    addAward(statMax(p=>p.tiles||p.tileCount||0), '🏆 Most Tiles');
    addAward(statMax(p=>p.mana||0), '💎 Most Mana');
    addAward(statMax(p=>p.battlesWon||0), '⚔ Most Wins');
    addAward(statMax(p=>p.totalManaEarned||0), '✨ Top Earner');
    addAward(statMax(p=>p.peakTiles||0), '📍 Peak Tiles');

    const wo = document.createElement('div');
    wo.className = 'winners-overlay' + ((window._goEnterUntil && Date.now() < window._goEnterUntil) ? ' go-enter' : '');
    wo.style.setProperty('--n', rankings.length);
    wo.style.cssText = 'position:absolute;inset:0;z-index:30;';

    const wasLastStanding = rankings[0]?.wasLastStanding || false;
    const tableRows = rankings.map((p,rank) => {
      const tiles = p.tiles ?? p.tileCount ?? 0;
      const isElim = p.eliminated || false;
      const playerAwards = awards[p.name] || [];
      const awardBadge = playerAwards.length ? `<span class="wt-award">${playerAwards.join(' · ')}</span>` : '';
      const elimBadge = isElim ? `<span class="wt-award" style="color:#e05252">${p.forfeited ? '🏳 Left' : '💀 Eliminated'}</span>` : p.sanctioned ? `<span class="wt-award" style="color:#e0565b">⛓ Sanctioned</span>` : '';   // v0.6.33
      const medal = rank===0 ? '🥇' : rank===1 ? '🥈' : rank===2 ? '🥉' : `${rank+1}.`;
      let rowStyle = isElim ? `color:${p.color};padding-left:16px;opacity:.5;` : `color:${p.color};padding-left:16px;`;
      rowStyle += `--r:${rank};`;
      const rv = `--r:${rank};`;
      return `<div class="wt-cell wt-row-${rank+1}" style="${rowStyle}">${medal} ${p.name}${awardBadge}${elimBadge}</div>
        <div class="wt-cell wt-row-${rank+1}" style="${rv}${isElim?'opacity:.5':''}">${tiles}</div>
        <div class="wt-cell wt-row-${rank+1}" style="${rv}${isElim?'opacity:.5':''}">${p.mana ?? '—'}</div>
        <div class="wt-cell wt-row-${rank+1}" style="${rv}${isElim?'opacity:.5':''}">${p.battlesWon ?? '—'}</div>
        <div class="wt-cell wt-row-${rank+1}" style="${rv}${isElim?'opacity:.5':''}">${p.battlesLost ?? '—'}</div>
        <div class="wt-cell wt-row-${rank+1}" style="${rv}${isElim?'opacity:.5':''}">${p.peakTiles ?? '—'}</div>
        <div class="wt-cell wt-row-${rank+1}" style="${rv}${isElim?'opacity:.5':''}">${p.totalManaEarned ?? '—'}</div>`;
    }).join('');

    wo.innerHTML = `
      <div class="winners-bg-art"></div>
      <img class="winners-logo" src="/img/logos/logo-gameover.webp" alt="Game Over">
      <div class="winners-eyebrow">${wasLastStanding ? '⚔️ Last Player Standing' : 'Final Standings'}</div>
      <div class="winners-title">Champion</div>
      <div class="winners-champion" style="color:${champ?.color||'var(--gold-glow)'}">
        ${champ?.name||'—'}
      </div>
      <div class="winners-champion-sub">${wasLastStanding ? 'All other players eliminated' : champ ? (champ.tiles??champ.tileCount??0) + ' tiles · ' + (champ.mana??0) + ' mana' : ''}</div>
      <div class="winners-table">
        <div class="wt-head" style="text-align:left;padding-left:16px;">Player</div>
        <div class="wt-head">Tiles</div>
        <div class="wt-head">Mana</div>
        <div class="wt-head">Wins</div>
        <div class="wt-head">Losses</div>
        <div class="wt-head">Peak</div>
        <div class="wt-head">Earned</div>
        ${tableRows}
      </div>
      <div class="winners-actions" style="margin-top:24px;display:flex;gap:12px;position:relative;align-items:center;">
        <button onclick="doNewGame()" style="
          font-family:'Cinzel',serif;font-size:13px;letter-spacing:.12em;text-transform:uppercase;
          background:linear-gradient(135deg,#3a2e5e,#2a1e4e);
          color:#c4b5f4;border:1.5px solid #7060b8;border-radius:8px;
          padding:12px 36px;cursor:pointer;
          box-shadow:0 0 18px rgba(145,132,217,.25);transition:all .2s;">
          ⚔ New Game
        </button>
        <button onclick="openAboutModal(false)" style="
          font-family:'Cinzel',serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;
          background:none;color:var(--text-mute);border:1px solid rgba(255,255,255,.1);border-radius:8px;
          padding:12px 24px;cursor:pointer;transition:all .2s;">
          About
        </button>
      </div>`;
    boardArea.appendChild(wo);
  }

  scaleRoot(root);
  app.appendChild(root);
}

function renderPaper(){
  const paper = document.createElement('div');
  paper.className = 'paper';
  paper.innerHTML = `<span class="paper-corner corner-tl">✦</span><span class="paper-corner corner-tr">✦</span>
    <span class="paper-corner corner-bl">✦</span><span class="paper-corner corner-br">✦</span>`;

  // Players section
  const plbl = document.createElement('div');
  plbl.className = 'paper-lbl';
  plbl.textContent = 'Adventurers';
  paper.appendChild(plbl);

  const plist = document.createElement('div');
  plist.className = 'players-list';
  const monoElementPlayers = new Map((G.monoElementBonus||[]).map(r=>[r.playerIdx, r.element]));
  G.players.forEach(p => {
    const isActive = p.idx === G.currentPlayer;
    const isElim = p.eliminated || false;
    const chip = document.createElement('div');
    chip.className = 'player-chip' + (isActive ? ' active' : '');
    chip.dataset.pidx = p.idx;
    if (isElim) chip.style.cssText = 'opacity:.38;filter:grayscale(.7);';
    const isSanc = !isElim && (p.idx in _sxChipHold ? _sxChipHold[p.idx] : !!p.sanctioned);   // v0.6.33 (v0.6.40: held during the moment)
    if (isSanc) chip.classList.add('sanctioned');
    const monoEl = monoElementPlayers.get(p.idx);
    const monoTag = monoEl ? `<span class="chip-mono-badge" title="Mono-Element Mastery: ${monoEl}">⭐</span><span class="chip-mono-label" style="color:${TYPE_COLOR[monoEl]||'#ffc840'}">${monoEl}</span>` : '';
    chip.innerHTML = `<div class="chip-dot${isSanc ? ' sanc' : ''}">${isElim ? `<span style="font-size:16px">${p.forfeited ? '🏳' : '💀'}</span>` : playerSigilSVG(p, 18)}</div>
      <div class="chip-info">
        <div class="chip-name" style="color:${isElim ? 'var(--text-mute)' : (isActive ? p.color : 'var(--parch-ink)')}">
          ${p.idx === _leaderIdx && !isElim ? '<span title="Most tiles" style="margin-right:3px">👑</span>' : ''}${p.name}${isActive ? ' ◄' : ''}${isElim ? ` <span style="font-size:9px;color:#e05252;font-family:Inter,sans-serif">${p.forfeited ? 'LEFT' : 'ELIMINATED'}</span>` : isSanc ? '<span class="chip-sanc-tag">⛓ SANCTIONED</span>' : monoTag}
        </div>
        <div class="chip-sub">${isElim ? 'Out of the game' : `${p.tileCount} tiles · ${p.stationedCount} stationed · <span style="color:#5dc97d">⚔${p.battlesWon??0}W</span> <span style="color:#e05252">${p.battlesLost??0}L</span>`}</div>
      </div>
      <div class="chip-mana">
        <div class="chip-mana-val">${isElim ? '—' : p.mana}</div>
        <div class="chip-mana-lbl">Mana</div>
      </div>`;
    plist.appendChild(chip);
    // v0.6.10: rolling mana counter (holds the old number while the die/token is animating)
    if (window.BoardFX && !isElim) BoardFX.manaRoll(p.idx, chip.querySelector('.chip-mana-val'), (_fxBusy() || p.idx in _sxChipHold) ? null : p.mana);   // v0.6.41: held during the Sanction moment
  });
  paper.appendChild(plist);

  // Scroll area
  const scroll = document.createElement('div');
  scroll.className = 'paper-scroll';

  if (selectedTile !== null) {
    // Tile inspector
    const back = document.createElement('button');
    back.className = 'inspector-back';
    back.textContent = '← Back to log';
    back.onclick = () => { selectedTile = null; render(); };
    scroll.appendChild(back);

    const tile = G.board[selectedTile];
    const isSpecial = tile.kind !== 'element';
    const color = isSpecial ? '#c0392b' : (TYPE_COLOR[tile.element] || '#9397ab');
    const label = tile.label || tile.element || tile.kind;

    const box = document.createElement('div');
    box.className = 'inspector-box';

    let ownerHTML = '';
    if (tile.ownerId !== null && tile.ownerId !== undefined) {
      const owner = G.players.find(p => p.idx === tile.ownerId);
      if (owner) ownerHTML = `<div style="font-size:11px;margin-bottom:4px;">Owned by <span style="color:${owner.color};font-weight:600;">${owner.name}</span></div>`;
    }

    let monsterHTML = '';
    if (tile.summon) {
      const m = tile.summon;
      const isSupport = m.rarity === 'support';
      const mc = isSupport ? '#9aabbc' : (TYPE_COLOR[m.type] || '#9397ab');
      const pct = Math.max(0, m.hp / m.maxHp * 100).toFixed(0);
      const supportLine = isSupport && m.supportDesc ? `<div style="font-size:9px;color:#9aabbc;margin-top:2px;">${m.supportDesc}</div>` : '';
      monsterHTML = `
        <div style="margin-top:8px;border-top:1px solid rgba(103,69,30,.2);padding-top:8px;">
          <div class="inspector-summon-hdr">Stationed Summon</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
            <div style="width:32px;height:32px;border-radius:6px;overflow:hidden;flex-shrink:0;">${m.id ? summonImg(m.id,'-mini') : artSVG(m.type,32,32)}</div>
            <div style="flex:1;">
              <div style="font-size:12px;font-weight:600;color:${mc};">${m.name}</div>
              <div style="font-size:10px;color:var(--parch-dim);">HP ${m.hp}/${m.maxHp} · ATK ${m.atk} · DEF ${m.def}</div>
              ${supportLine}
              <div style="height:4px;background:rgba(0,0,0,.1);border-radius:2px;margin-top:3px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${mc};border-radius:2px;transition:width .3s;"></div>
              </div>
            </div>
          </div>
        </div>`;
    }

    box.innerHTML = `<div class="inspector-tile-num">Tile ${selectedTile}</div>
      <div class="inspector-tile-name" style="color:${color};">${label}</div>
      ${ownerHTML}${monsterHTML}`;
    scroll.appendChild(box);
  } else {
    // Event log
    const elbl = document.createElement('div');
    elbl.className = 'paper-lbl';
    elbl.textContent = 'Event Log';
    scroll.appendChild(elbl);

    if (!G.events || G.events.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:var(--parch-dim);font-style:italic;padding:4px 0;';
      empty.textContent = 'No events yet.';
      scroll.appendChild(empty);
    } else {
      // v0.6.64: only the latest few events, each at most 2 lines, no scrollbar — the log no longer
      // grows and shrinks (that resized the side panel and made the board look like it was redrawing)
      scroll.style.overflow = 'hidden';
      G.events.slice(-7).reverse().forEach(ev => {
        const row = document.createElement('div');
        row.className = 'log-row';
        const txt = typeof ev === 'string' ? ev : (ev.text || String(ev));
        row.innerHTML = `<span class="log-icon">·</span><span class="log-text" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${txt}</span>`;
        row.style.flexShrink = '0';
        scroll.appendChild(row);
      });
    }
  }

  paper.appendChild(scroll);
  return paper;
}


// ─── v0.6.64: tell the server when the board is busy animating, so bots wait their turn ───
// Busy = dice / token hop / queued or running effects / Wild Card flight / income tally / battle overlay
// (first 7 s) / big moments. The server holds the next bot action until the board reports idle (15 s cap).
let _boardBusySent = null;
function _boardBusyNow() {
  try {
    if (typeof isSpectator !== 'undefined' && isSpectator) return false;
    if (_fxHeld() || _fxQ.length || _tallyRunning) return true;
    if (_battleOv && _battleOv.el.isConnected && Date.now() - _battleOv.at < 7000) return true;
    if (document.getElementById('sg-moment')) return true;
    if (window.BoardFX && BoardFX.wcBusy && BoardFX.wcBusy()) return true;
  } catch (_) {}
  return false;
}
setInterval(() => {
  if (!G || G.phase === 'lobby' || !G.players || !G.players.some(p => p.isBot)) { _boardBusySent = null; return; }
  if (typeof isSpectator !== 'undefined' && isSpectator) return;
  const b = _boardBusyNow();
  if (b !== _boardBusySent) { _boardBusySent = b; try { send('board_busy', { busy: b }); } catch (_) {} }
}, 150);
