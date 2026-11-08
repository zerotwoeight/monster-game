
// ─── v0.6.49 (G3): host tools — tap a player chip → Nudge / Skip turn / Remove ─────────────
let _hmIdx = null, _hmArmed = { skip: 0, remove: 0 }, _hmSeenNudge = null, _hmSeenSkip = null;
function _hmHostActive() { return !isSpectator && G && G.phase !== 'lobby' && G.phase !== 'game_over'; }
function _hostToast(text) {
  if (isSpectator) return;
  let t = document.getElementById('host-toast');
  if (!t) { t = document.createElement('div'); t.id = 'host-toast'; document.body.appendChild(t); }
  t.textContent = text; t.style.opacity = '1';
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, 3200);
}
function openHostMenu(idx) { _hmIdx = idx; _hmArmed = { skip: 0, remove: 0 }; _hmRender(); }
function closeHostMenu() { _hmIdx = null; const m = document.getElementById('host-menu'); if (m) m.remove(); }
function _hmRender() {
  let m = document.getElementById('host-menu');
  const p = G && G.players && G.players[_hmIdx];
  if (_hmIdx === null || !_hmHostActive() || !p || p.eliminated) { if (m) m.remove(); _hmIdx = null; return; }
  const chip = document.querySelector(`.player-chip[data-pidx="${_hmIdx}"]`);
  if (!chip) { if (m) m.remove(); return; }
  if (!m) { m = document.createElement('div'); m.id = 'host-menu'; document.body.appendChild(m); }
  const isCur = p.idx === G.currentPlayer;
  const now = Date.now();
  const skipArmed = now - _hmArmed.skip < 4000, remArmed = now - _hmArmed.remove < 4000;
  const canSkip = isCur && G.hostSkippable;
  m.innerHTML = `
    <div class="hm-title"><span style="width:10px;height:10px;border-radius:50%;background:${p.color}"></span>${p.name}</div>
    <div class="hm-sub">${isCur ? 'Their turn now' : 'Waiting for their turn'}${p.sanctioned ? ' · Sanctioned' : ''}${p.isConnected === false ? ' · disconnected' : ''}</div>
    <button id="hm-nudge" onclick="hmNudge()">🔔 Nudge ${p.name}</button>
    ${isCur ? `<button id="hm-skip" class="${skipArmed ? 'armed' : ''}" ${canSkip ? '' : 'disabled'} onclick="hmSkip()">${skipArmed ? `Tap again to skip ${p.name}'s turn` : `⏭ Skip ${p.name}'s turn`}</button>
      ${canSkip ? '' : `<div class="hm-note">${G.pausedFor ? 'Game is paused — use Remove for a disconnected player.' : 'Wait for the current animation to finish.'}</div>`}` : ''}
    <button id="hm-remove" class="${remArmed ? 'armed' : ''}" onclick="hmRemove()">${remArmed ? `Tap again to remove ${p.name}` : `🚪 Remove ${p.name} from the game`}</button>
    <button class="hm-close" onclick="closeHostMenu()">Close</button>`;
  // place beside the chip, kept on screen
  const r = chip.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let left = r.left - mw - 10; if (left < 8) left = Math.min(window.innerWidth - mw - 8, r.right + 10);
  let top = Math.max(8, Math.min(window.innerHeight - mh - 8, r.top + r.height / 2 - mh / 2));
  m.style.left = left + 'px'; m.style.top = top + 'px';
}
function hmNudge() { if (_hmIdx === null) return; send('host_nudge', { idx: _hmIdx }); }
function hmSkip() {
  if (Date.now() - _hmArmed.skip > 4000) { _hmArmed.skip = Date.now(); _hmRender(); setTimeout(_hmRender, 4100); return; }
  _hmArmed.skip = 0; send('host_skip_turn'); closeHostMenu();
}
function hmRemove() {
  if (Date.now() - _hmArmed.remove > 4000) { _hmArmed.remove = Date.now(); _hmRender(); setTimeout(_hmRender, 4100); return; }
  const idx = _hmIdx; _hmArmed.remove = 0; send('remove_player', { idx }); closeHostMenu();
}
document.addEventListener('pointerdown', e => {
  if (_hmIdx === null) return;
  if (e.target.closest('#host-menu') || e.target.closest('.player-chip')) return;
  closeHostMenu();
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeHostMenu(); });
function _hostSync() {
  if (!G) return;
  // chips are rebuilt every render — re-attach the tap
  if (_hmHostActive()) {
    document.querySelectorAll('.player-chip[data-pidx]').forEach(ch => {
      const idx = Number(ch.dataset.pidx), p = G.players[idx];
      if (!p || p.eliminated) return;
      ch.classList.add('host-chip-tap'); ch.title = 'Host: nudge, skip or remove';
      ch.onclick = () => (_hmIdx === idx ? closeHostMenu() : openHostMenu(idx));
    });
  }
  _hmRender();
  // 🔔 on the nudged player's chip (board + spectators)
  const n = G.lastNudge;
  if (_hmSeenNudge === null) _hmSeenNudge = n ? n.seq : 0;
  else if (n && n.seq !== _hmSeenNudge) {
    _hmSeenNudge = n.seq;
    const ch = document.querySelector(`.player-chip[data-pidx="${n.idx}"]`);
    if (ch) { ch.style.position = 'relative'; const b = document.createElement('span'); b.className = 'chip-nudge'; b.textContent = '🔔'; ch.appendChild(b); setTimeout(() => b.remove(), 1700); }
  }
  // "Host skipped Ann's turn"
  const k = G.lastHostSkip;
  if (_hmSeenSkip === null) _hmSeenSkip = k ? k.seq : 0;
  else if (k && k.seq !== _hmSeenSkip) {
    _hmSeenSkip = k.seq;
    const old = document.getElementById('host-skip-banner'); if (old) old.remove();
    const b = document.createElement('div'); b.id = 'host-skip-banner'; b.textContent = `⏭ Host skipped ${k.name}'s turn`;
    document.body.appendChild(b); setTimeout(() => b.remove(), 2700);
  }
}
// (rules recap: see the script block below)
// ─── v0.6.50 (U5): a delayed Wild Card goes off — "curse lands" card in the centre ─────────
const _CURSE = {
  jinx:    { name: 'Jinx',    tier: 'low', cap: 'JINXED',    sub: t => `${t.name}'s income halved${t.before != null ? ` — ${t.before} → ${t.after}✦` : ''}` },
  delay:   { name: 'Delay',   tier: 'low', cap: 'DELAYED',   sub: t => `${t.name} skips the shop this turn` },
  stumble: { name: 'Stumble', tier: 'low', cap: 'STUMBLED',  sub: t => `${t.name} moves exactly 3 this turn` },
};   // Rattle goes off mid-battle — it keeps the battle's own ½ ATK callout (with "courtesy of")
let _curseSeen = null, _curseQ = [], _cursePlaying = null;
function _curseCollect() {
  const list = (G && G.wcTriggers) || [];
  const max = list.reduce((m, t) => Math.max(m, t.seq), 0);
  if (_curseSeen === null) { _curseSeen = max; return; }   // first state after (re)connect = baseline, never replay
  for (const t of list) if (t.seq > _curseSeen && _CURSE[t.id]) _curseQ.push(t);
  _curseSeen = Math.max(_curseSeen, max);
}
function _cursePlayNext(force) {
  if (_cursePlaying || !_curseQ.length || !window.BoardFX || !BoardFX.curseLand) return false;
  if (!force && _fxBusy()) return false;
  const t = _curseQ.shift(), c = _CURSE[t.id], by = t.byIdx != null && G.players[t.byIdx];
  _cursePlaying = t;
  BoardFX.curseLand({ id: t.id, name: c.name, tier: c.tier }, _fxChipEl(t.idx), c.cap, c.sub(t),
    { by: by ? by.name : null, byColor: by ? by.color : null, onStamp: () => { try { SFX.wildCardReveal(c.tier); } catch (e) {} } })
    .then(() => { _cursePlaying = null; render(); });
  return true;
}
// Jinx is found while the turn's income is worked out — play it before the board's income tally
function _curseHoldTally() {
  _curseCollect();
  const cur = G.currentPlayer;
  const isJinx = t => t && t.id === 'jinx' && t.idx === cur;
  if (isJinx(_cursePlaying)) return true;
  const i = _curseQ.findIndex(isJinx);
  if (i < 0) return false;
  if (i > 0) _curseQ.unshift(_curseQ.splice(i, 1)[0]);
  _cursePlayNext(true);
  return true;
}
function _curseSync() { if (!G) return; _curseCollect(); _cursePlayNext(false); }
{ const _renderBase = render; render = function () {
  const t0 = performance.now();
  const r = _renderBase.apply(this, arguments);
  try { _hostSync(); } catch (e) { console.warn('[host tools]', e); }
  try { _curseSync(); } catch (e) { console.warn('[curse]', e); }
  const ms = performance.now() - t0; _perfRenders.n++;
  if (ms > 120 && !isSpectator) { _perfRenders.slow++; _perfReport('slow render', ms); }   // v0.6.55 live log
  return r; }; }
// v0.6.55: event-loop stall watch — if the page freezes for over half a second, say so in the server log
(function () { let last = performance.now();
  setInterval(() => { const now = performance.now(), lag = now - last - 500; last = now; if (lag > 500 && !isSpectator && !document.hidden) _perfReport('page stall', lag); }, 500);
  setInterval(() => { if (!isSpectator && _perfRenders.n) { _perfReport('renders/min', _perfRenders.n, `skipped during tally ${_perfRenders.skipped}, slow ${_perfRenders.slow}`); _perfRenders.n = _perfRenders.skipped = _perfRenders.slow = 0; } }, 60000);
})();
window.addEventListener('resize', () => { if (_hmIdx !== null) _hmRender(); });
