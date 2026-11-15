// board-sweep.js v1.2 (2026-11-14; v1.1 = per-tile hook for the centre-stage summary; v1.2 = IN THE GAME from board v0.6.92, end sound from the user's picks) — INCOME SWEEP for Polish Plan stage 5.
// The start-of-turn income tally as a wave: it starts at the summon closest to the active player's token and
// runs outward, one combined number per tile, pops overlapping, one soft rising tick per tile.
// Same total length as the all-at-once burst (board v0.6.56); nothing waits its turn.
// It replaces runRoundTally(). With INCOME_SWEEP.mode = 'burst' (or Board Effects "Reduced") the game's own tally runs.
// In the game since board v0.6.92 (loaded by board.html) with the user's settings below. Tuned in /hop-lab.html.
const INCOME_SWEEP = {
  mode: 'sweep',        // 'sweep' = new wave · 'burst' = the game today (all at once, 45 ms apart, one sound)
  order: 'ripple',      // 'ripple' = outward both ways from the token · 'around' = clockwise from the closest summon
  staggerMs: 110,       // gap between one tile and the next
  maxSpreadMs: 650,     // the wave never takes longer than this to reach the last tile (the gap shrinks on big boards)
  popMs: 1400,          // how long each number stays
  popSize: 24,          // number size
  tileKick: true,       // each tile bumps as its number lands
  tick: true,           // soft tick per tile
  tickRise: 0.6,        // pitch rise from the first tile to the last
  endSound: true,       // the usual Positive / Negative clip when the wave finishes
  timeScale: 1          // lab slow motion, never pinned
};
(function () {
  const S = INCOME_SWEEP, origTally = runRoundTally;
  let _ac = null;
  function tick(k, up) {
    try {
      const L = _sfxLvl(); if (L <= 0) return;
      _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
      const f = (up ? 520 : 300) * (1 + (up ? 1 : -0.3) * S.tickRise * k), now = _ac.currentTime;
      [[f, 'sine', 0.07], [f * 1.5, 'triangle', 0.025]].forEach(([fr, type, vol]) => {
        const o = _ac.createOscillator(), g = _ac.createGain(); o.connect(g); g.connect(_ac.destination);
        o.type = type; o.frequency.setValueAtTime(fr, now);
        g.gain.setValueAtTime(0.001, now); g.gain.linearRampToValueAtTime(vol * L, now + 0.005); g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        o.start(now); o.stop(now + 0.18);
      });
    } catch (e) {}
  }

  // tiles in wave order, starting from the summon closest to the active player's token
  function waveOrder(items) {
    const N = 28, p = (G && G.players && G.players[G.currentPlayer] ? G.players[G.currentPlayer].position : 0) || 0;
    const dist = t => Math.min((t - p + N) % N, (p - t + N) % N);
    if (!items.length) return items;
    if (S.order === 'around') {
      const first = items.slice().sort((a, b) => dist(a.tilePos) - dist(b.tilePos) || ((a.tilePos - p + N) % N) - ((b.tilePos - p + N) % N))[0].tilePos;
      return items.slice().sort((a, b) => ((a.tilePos - first + N) % N) - ((b.tilePos - first + N) % N));
    }
    return items.slice().sort((a, b) => dist(a.tilePos) - dist(b.tilePos) || ((a.tilePos - p + N) % N) - ((b.tilePos - p + N) % N));
  }

  function sweep(tally, boardArea, onDone) {
    if (S.mode !== 'sweep' || (window.BoardFX && BoardFX.level === 'reduced')) return origTally(tally, boardArea, onDone);
    if (_tallyRunning) return;
    _tallyRunning = true;
    const ts = S.timeScale || 1;
    const ov = document.createElement('div'); ov.id = 'tally-overlay'; boardArea.appendChild(ov);
    const skipBtn = document.createElement('button'); skipBtn.className = 'tally-skip-btn'; skipBtn.textContent = 'Skip ⏭'; boardArea.appendChild(skipBtn);
    let done = false; const timers = [];
    function end() { if (done) return; done = true; timers.forEach(clearTimeout); ov.remove(); skipBtn.remove(); _tallyRunning = false; onDone(); }
    skipBtn.onclick = end;

    const areaRect = boardArea.getBoundingClientRect();
    const scale = boardArea.offsetWidth > 0 ? areaRect.width / boardArea.offsetWidth : 1;
    const items = waveOrder(tally.filter(e => tileElCache.get(e.tilePos)).map(e => {
      const parts = [];
      if (e.netMana) parts.push((e.netMana > 0 ? '+' : '') + e.netMana + '✦');
      if (e.netHp)   parts.push((e.netHp > 0 ? '+' : '') + e.netHp + ' HP');
      if (e.netAtk)  parts.push((e.netAtk > 0 ? '+' : '') + e.netAtk + ' ATK');
      if (e.netDef)  parts.push((e.netDef > 0 ? '+' : '') + e.netDef + ' DEF');
      return { tilePos: e.tilePos, netMana: e.netMana || 0, parts, pos: (e.netMana || e.netHp || e.netAtk || e.netDef) > 0 };
    }).filter(e => e.parts.length));
    const n = items.length;
    const gap = (n > 1 ? Math.min(S.staggerMs, S.maxSpreadMs / (n - 1)) : 0) * ts;
    let up = 0, down = 0;
    items.forEach((e, i) => {
      e.pos ? up++ : down++;
      const cached = tileElCache.get(e.tilePos), r = cached.el.getBoundingClientRect();
      const x = (r.left - areaRect.left + r.width * 0.5) / scale, y = (r.top - areaRect.top + r.height * 0.42) / scale;
      const col = e.pos ? '#58e068' : '#e05252';
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(0.4);text-align:center;pointer-events:none;z-index:26;white-space:nowrap;opacity:0;`;
      el.innerHTML = `<div style="font-family:'Cinzel',serif;font-size:${S.popSize}px;font-weight:700;letter-spacing:.05em;color:${col};text-shadow:0 0 14px ${col}aa,0 2px 5px rgba(0,0,0,.85)">${e.parts[0]}</div>`
        + (e.parts.length > 1 ? `<div style="font:700 ${Math.round(S.popSize * 0.46)}px Inter,sans-serif;color:#f2e6c8;text-shadow:0 2px 4px rgba(0,0,0,.9);margin-top:1px">${e.parts.slice(1).join(' · ')}</div>` : '');
      ov.appendChild(el);
      el.animate([
        { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.45)', opacity: 1, offset: 0.12 },
        { transform: 'translate(-50%,-55%) scale(1.15)', opacity: 1, offset: 0.7 },
        { transform: 'translate(-50%,-100%) scale(1.0)', opacity: 0 }
      ], { duration: S.popMs * ts, delay: i * gap, easing: 'ease', fill: 'both' });
      timers.push(setTimeout(() => {
        if (done) return;
        if (window._sweepOnPop) { try { window._sweepOnPop(e, x, y, i, n); } catch (e3) {} }   // centre-stage summary: Mana flies to the middle
        if (S.tick) tick(n > 1 ? i / (n - 1) : 0, e.pos);
        if (S.tileKick) { try { const b = cached.el.querySelector('.tile-body') || cached.el; b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.09)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 300 * ts, easing: 'ease-out', composite: 'add' }); } catch (e2) {} }
      }, i * gap));
    });
    const last = Math.max(0, n - 1) * gap;
    if (S.endSound && (up || down)) timers.push(setTimeout(() => {
      const L = _sfxLvl(); if (L <= 0 || done) return;
      if (up >= down && typeof sfxSample === 'function' && sfxSample('income')) return;   // v1.2: the picked income sound
      try { const a = new Audio('/audio/' + (up >= down ? 'Positive.mp3' : 'Negitive.mp3')); a.volume = 0.6 * L; a.play().catch(() => {}); } catch (e) {}
    }, last + 120 * ts));
    timers.push(setTimeout(end, last + S.popMs * ts + 100));
  }
  runRoundTally = sweep;
  window.BoardSweep = { waveOrder };
})();
