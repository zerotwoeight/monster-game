// board-review.js v1.0 (2026-11-13, board v0.6.87 / server v1.0.156) — REVIEW LOG.
// Open the board with ?review=1 (stays on for that browser tab; ?review=0 turns it off). While on, the board
// timestamps what it shows and plays — phase changes, every board effect, sound, voice, animation, banner,
// chip change, Mana roll, frame-rate health — and sends the lines to the server (action client_review), which
// writes them to logs/review-YYYY-MM-DD-<ROOM>.log. Nothing is logged, hooked or sent unless review is on.
// Line format:  HH:MM:SS.mmm +<ms since page load> [phase] <kind> <detail>
(function () {
  let on = false;
  try {
    const q = new URLSearchParams(location.search).get('review');
    if (q === '1') sessionStorage.setItem('sg_review', '1');
    if (q === '0') sessionStorage.removeItem('sg_review');
    on = sessionStorage.getItem('sg_review') === '1';
  } catch (e) {}
  window.SGReview = { on, version: '1.0', mark() {} };
  if (!on) return;
  if (typeof isSpectator !== 'undefined' && isSpectator) return;   // the server only takes review lines from the host board

  // ── buffer, repeat-collapsing, sending ──
  const buf = [];
  let rep = null, sent = 0;
  const pad = (n, w) => String(n).padStart(w, '0');
  function stamp(now) {
    const d = new Date();
    const ph = (typeof G !== 'undefined' && G && G.phase) || '-';
    return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}.${pad(d.getMilliseconds(), 3)} +${pad(Math.round(now), 7)} [${ph}]`;
  }
  function flushRep() {
    if (!rep) return;
    buf.push((rep.n > 1 ? `${rep.line} ×${rep.n} over ${Math.round(rep.last - rep.t0)}ms` : rep.line).slice(0, 380));
    rep = null;
    if (buf.length > 6000) buf.splice(0, buf.length - 6000);
  }
  function log(kind, detail) {
    try {
      const key = kind + (detail ? ' ' + detail : ''), now = performance.now();
      if (rep && rep.key === key && now - rep.last < 700) { rep.n++; rep.last = now; return; }
      flushRep();
      rep = { key, n: 1, t0: now, last: now, line: stamp(now) + ' ' + key };
    } catch (e) {}
  }
  function flush() {
    try {
      if (rep && performance.now() - rep.last > 700) flushRep();
      if (!buf.length || typeof ws === 'undefined' || !ws || ws.readyState !== 1) return;
      const lines = buf.splice(0, 150);
      ws.send(JSON.stringify({ action: 'client_review', lines }));
      sent += lines.length;
    } catch (e) {}
  }
  setInterval(flush, 500);
  window.addEventListener('pagehide', () => { flushRep(); flush(); });
  SGReview.mark = (text) => log('MARK', String(text));
  SGReview.stats = () => ({ sent, waiting: buf.length });

  // ── describing things ──
  function tileOf(el) {
    try { if (typeof tileElCache !== 'undefined') for (const [pos, c] of tileElCache) if (c && c.el && (c.el === el || c.el.contains(el))) return 'tile' + pos; } catch (e) {}
    return '';
  }
  function desc(el) {
    try {
      if (!el || el.nodeType !== 1) return String(el);
      const chip = el.closest && el.closest('.player-chip[data-pidx]');
      const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      let s = el.id ? '#' + el.id : (cls ? '.' + cls : el.tagName.toLowerCase());
      const t = tileOf(el); if (t) s += '@' + t;
      if (chip) s += '@chip' + chip.dataset.pidx;
      if (!el.children.length) { const tx = (el.textContent || '').replace(/\s+/g, ' ').trim(); if (tx && tx.length <= 28) s += ' "' + tx + '"'; }
      return s;
    } catch (e) { return '?'; }
  }
  function sum(a, depth) {
    try {
      if (a == null) return String(a);
      if (typeof a === 'function') return 'fn';
      if (typeof a === 'string') return a.length > 40 ? a.slice(0, 40) + '…' : a;
      if (typeof a !== 'object') return String(a);
      if (a.nodeType === 1) return desc(a);
      if (Array.isArray(a)) return '[' + a.slice(0, 6).map(x => sum(x, 1)).join(',') + (a.length > 6 ? ',…' : '') + ']';
      if (typeof a.then === 'function') return 'promise';
      if (depth > 1) return '{…}';
      const parts = [];
      for (const k of Object.keys(a)) {
        const v = a[k];
        if (v == null || typeof v === 'function') continue;
        if (typeof v === 'object') { if (v.nodeType === 1 || Array.isArray(v) || !depth) parts.push(k + '=' + sum(v, (depth || 0) + 1)); continue; }
        parts.push(k + '=' + (typeof v === 'string' && v.length > 30 ? v.slice(0, 30) + '…' : v));
        if (parts.length >= 9) break;
      }
      return '{' + parts.join(' ') + '}';
    } catch (e) { return '?'; }
  }
  const args = (list) => Array.prototype.slice.call(list, 0, 4).map(a => sum(a, 0)).join(', ');

  // ── 1. synth sound effects (SFX.*) ──
  try {
    if (typeof SFX !== 'undefined') Object.keys(SFX).forEach(k => {
      const f = SFX[k]; if (typeof f !== 'function' || k === 'unlock' || k === 'has') return;
      SFX[k] = function () { log('sfx', k + (arguments.length && typeof arguments[0] !== 'object' ? '(' + arguments[0] + ')' : '')); return f.apply(this, arguments); };
    });
  } catch (e) {}

  // ── 2. board effects (BoardFX.*) ──
  const SYNC = { wcTable: 1, sxTable: 1 };                    // called on every redraw: log only when what they show changes
  const QUIET = /Busy$|Hold$|^level$|^manaRoll$|^wcTableConsume$/;   // state checks + the Mana counter (handled below)
  const lastSync = {}, manaLast = {}; let manaHeld = null;
  try {
    if (window.BoardFX) Object.keys(BoardFX).forEach(k => {
      const f = BoardFX[k]; if (typeof f !== 'function') return;
      if (k === 'manaRoll') {
        BoardFX[k] = function (idx, el, value) {
          const held = value == null;
          if (held !== manaHeld) { manaHeld = held; log('mana-counter', held ? 'HELD (board busy or battle result hidden)' : 'released'); }
          if (!held && manaLast[idx] !== value) { if (manaLast[idx] != null) log('mana', `p${idx} ${manaLast[idx]}→${value}`); manaLast[idx] = value; }
          return f.apply(this, arguments);
        };
        return;
      }
      if (QUIET.test(k)) return;
      BoardFX[k] = function () {
        // sxTable is handed the whole game state: log only its Sanction part
        const d = k === 'sxTable' ? (arguments[0] && arguments[0].sanction ? sum(arguments[0].sanction, 0) + ', ' + arguments[0].phase : 'no Sanction turn') : args(arguments);
        if (SYNC[k]) { if (lastSync[k] === d) return f.apply(this, arguments); lastSync[k] = d; }
        log('fx', k + '(' + d + ')');
        return f.apply(this, arguments);
      };
    });
  } catch (e) {}

  // ── 3. named board functions ──
  function wrapG(name, fmt) {
    try {
      const f = window[name]; if (typeof f !== 'function') return;
      window[name] = function () { try { const d = fmt ? fmt.apply(null, arguments) : args(arguments); if (d !== false) log(name, d); } catch (e) {} return f.apply(this, arguments); };
    } catch (e) {}
  }
  wrapG('runBattleAnimation', (lb, att, def) => `START ${att ? att.name : '?'}(${lb.attM && lb.attM.name}) vs ${def ? def.name : 'wild'}(${lb.defM && lb.defM.name}) → ${lb.outcome} · dealt ${lb.atkDmg} / took ${lb.defDmg} · ${(lb.effects || []).length} callouts`);
  wrapG('_battleReveal', () => 'outcome shown → side panel released');
  wrapG('playCardHitAnim', (card, file) => String(file));
  wrapG('animateHpBar', (card, m, hp) => `${m && m.name} → ${hp}/${m && m.maxHp}`);
  wrapG('_playVoice', (id, moment) => `${id} (${moment})`);
  wrapG('_playDiceRoll', () => '');
  wrapG('_fireRoundCallout', (type) => String(type));
  wrapG('_fireGameOverFanfare', () => '');
  wrapG('startBoardDieAnimation', () => '');
  wrapG('runRoundTally', () => 'income tally START');
  wrapG('flashTile', (f) => sum(f, 0));
  wrapG('openRulesRecap', () => '');

  // ── 4. every audio file that plays (music, voices, sampled effects) ──
  try {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      try { log('audio', decodeURIComponent((this.currentSrc || this.src || '').split('/').slice(-2).join('/')) + ' vol=' + (Math.round(this.volume * 100) / 100) + (this.loop ? ' loop' : '')); } catch (e) {}
      return play.apply(this, arguments);
    };
  } catch (e) {}

  // ── 5. every scripted animation (element.animate): what moved, how long, which properties ──
  let animN = 0, animDropped = 0, animSec = 0;
  try {
    const anim = Element.prototype.animate;
    Element.prototype.animate = function (kf, opt) {
      try {
        const sec = Math.floor(performance.now() / 1000);
        if (sec !== animSec) { if (animDropped) log('anim-skipped', animDropped + ' more in that second'); animSec = sec; animN = 0; animDropped = 0; }
        if (++animN > 30) animDropped++;
        else {
          const o = typeof opt === 'number' ? { duration: opt } : (opt || {});
          const frames = Array.isArray(kf) ? kf : [kf || {}];
          const props = {}; frames.forEach(fr => Object.keys(fr || {}).forEach(p => { if (p !== 'offset' && p !== 'easing' && p !== 'composite') props[p] = 1; }));
          log('anim', `${desc(this)} ${Math.round(o.duration || 0)}ms${o.delay ? ' delay ' + Math.round(o.delay) : ''} ${o.easing || 'linear'}${o.iterations && o.iterations !== 1 ? ' ×' + o.iterations : ''} [${Object.keys(props).join(',')}]`);
        }
      } catch (e) {}
      return anim.apply(this, arguments);
    };
  } catch (e) {}

  // ── 6. things appearing on the effects layer and over the page (banners, stamps, overlays) ──
  let addN = 0, addSec = 0;
  function watchAdds(root, label) {
    try {
      new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        const sec = Math.floor(performance.now() / 1000); if (sec !== addSec) { addSec = sec; addN = 0; }
        if (++addN > 25) return;
        const tx = (n.textContent || '').replace(/\s+/g, ' ').trim();
        log('show', `${label} ${desc(n)}${tx && tx.length <= 60 && n.children.length ? ' "' + tx + '"' : ''}`);
      }))).observe(root, { childList: true });
    } catch (e) {}
  }
  watchAdds(document.body, 'page');
  (function findLayer() { const l = document.getElementById('fx-layer'); if (l) watchAdds(l, 'fx-layer'); else setTimeout(findLayer, 1000); })();

  // ── 7. phase / turn changes, slow redraws, side-panel changes (wraps render) ──
  let lastPhase = null, lastCur = null, lastRound = null, lastChips = {};
  try {
    const r0 = render;
    render = function () {
      const t0 = performance.now();
      try {
        if (typeof G !== 'undefined' && G) {
          const cur = G.players && G.players[G.currentPlayer];
          if (G.phase !== lastPhase || G.currentPlayer !== lastCur || G.round !== lastRound) {
            const unl = (typeof PHASE_LABELS !== 'undefined' && !(G.phase in PHASE_LABELS)) ? ' · NO LABEL for this phase' : '';
            log('PHASE', `${lastPhase || '-'} → ${G.phase} · ${cur ? cur.name : '-'} · round ${G.round ?? '-'}/${G.roundLimit ?? '-'}${lastPhase == null ? ' · srv ' + G.serverVersion + ' room ' + G.roomCode : ''}${unl}`);
            lastPhase = G.phase; lastCur = G.currentPlayer; lastRound = G.round;
          }
        }
      } catch (e) {}
      const out = r0.apply(this, arguments);
      try {
        const ms = performance.now() - t0; if (ms > 40) log('slow-redraw', Math.round(ms) + 'ms');
        document.querySelectorAll('.player-chip[data-pidx]').forEach(c => {
          const sub = c.querySelector('.chip-sub'), name = c.querySelector('.chip-name');
          const s = (sub ? sub.textContent.replace(/\s+/g, ' ').trim() : '') + (name && name.textContent.includes('👑') ? ' 👑' : '') + (c.classList.contains('sanctioned') ? ' ⛓' : '');
          const i = c.dataset.pidx;
          if (lastChips[i] !== s) { if (lastChips[i] != null) log('chip', `p${i} "${lastChips[i]}" → "${s}"`); lastChips[i] = s; }
        });
      } catch (e) {}
      return out;
    };
  } catch (e) {}

  // ── 8. frame-rate health (also shows when the page is hidden: no frames) ──
  let frames = 0, longF = 0, maxGap = 0, lastF = performance.now(), quiet = 0, wasDead = false;
  (function tick(t) { const g = t - lastF; lastF = t; frames++; if (g > 50) longF++; if (g > maxGap) maxGap = g; requestAnimationFrame(tick); })(performance.now());
  setInterval(() => {
    const fps = Math.round(frames / 5), dead = frames === 0;
    if (dead) { if (!wasDead) log('FRAMES', `NONE — the board is not being drawn (tab hidden or minimised; visibility=${document.visibilityState}). Animations and bots will stall.`); }
    else if (wasDead) log('FRAMES', 'drawing again');
    else if (fps < 50 || longF > 2 || ++quiet >= 6) { log('frames', `${fps} fps · longest gap ${Math.round(maxGap)}ms · ${longF} frames over 50ms`); quiet = 0; }
    wasDead = dead; frames = 0; longF = 0; maxGap = 0;
  }, 5000);

  // ── 9. errors + start line + on-screen tag ──
  window.addEventListener('error', e => log('ERROR', String(e.message).slice(0, 160)));
  document.addEventListener('visibilitychange', () => log('visibility', document.visibilityState));
  const ver = (document.querySelector('script[src*="board-render.js"]') || { src: '' }).src.split('v=')[1] || '?';
  log('REVIEW-LOG', `on · board v${ver} · review v${SGReview.version} · ${innerWidth}×${innerHeight} · effects ${window.BoardFX && BoardFX.level || 'full'}`);
  try {
    const tag = document.createElement('div');
    tag.id = 'sg-review-tag';
    tag.textContent = '● REVIEW LOG';
    tag.title = 'This screen is writing a review log (opened with ?review=1). Add ?review=0 to the address to turn it off.';
    tag.style.cssText = 'position:fixed;left:8px;bottom:6px;z-index:9999;font:600 10px/1 system-ui,sans-serif;letter-spacing:.12em;color:#ffb0b0;background:rgba(40,8,8,.72);border:1px solid rgba(255,120,120,.45);border-radius:6px;padding:4px 7px;pointer-events:none;';
    document.body.appendChild(tag);
  } catch (e) {}
})();
