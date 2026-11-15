// board-summary.js v1.1 (2026-11-14; v1.1 = IN THE GAME from board v0.6.92) — CENTRE-STAGE TURN SUMMARY for Polish Plan stage 5.
// The start-of-turn summary as a centre-stage moment in the player's colour: the card arrives first, the income
// sweep runs around the board, each tile's Mana flies into the big number, which counts up; then the breakdown
// and the new total. Wired into the turn start in board-render.js (resolve:turn_summary): the card goes up first and
// the tally runs inside it; the card then stays until the player taps on their phone. Tuned in /hop-lab.html.
const SUMMARY_STAGE = {
  mode: 'stage',        // 'stage' = new centre-stage card · 'classic' = the game today (small dark box after the tally)
  scale: 1.1,           // card size
  numberSize: 78,       // the income number
  tint: 0.55,           // how strongly the player's colour washes the card
  showToken: true,      // the player's banner beside the name
  motes: true,          // Mana flies from each tile into the number
  flyMs: 480,           // flight time
  chips: true,          // breakdown under the number (Base, Summons, extras)
  inMs: 420,            // card arrival
  totalMs: 600,         // total counts up
  timeScale: 1
};
(function () {
  const S = SUMMARY_STAGE;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function hexA(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return `rgba(145,132,217,${a})`;
    const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  // ts: {playerIdx, playerName, playerColor, round, roundLimit, roundsRemaining, baseline, manaBefore, manaAfter, net, tileCount, stationedCount, extras:[{label, val}]}
  function play(ts, tally, boardArea, onDone) {
    const k = S.timeScale || 1, col = ts.playerColor || '#9184d9';
    const timers = []; const later = (fn, ms) => timers.push(setTimeout(fn, ms * k));
    const ov = document.createElement('div'); ov.className = 'tss';
    ov.style.cssText = `position:absolute;top:50%;left:50%;z-index:27;transform:translate(-50%,-50%) scale(${S.scale});pointer-events:none;`;
    const p = (G.players || [])[ts.playerIdx] || {};
    const rounds = ts.roundsRemaining === 0 ? 'Final round' : ts.roundsRemaining === 1 ? `Round ${ts.round} of ${ts.roundLimit} · 1 left` : `Round ${ts.round} of ${ts.roundLimit} · ${ts.roundsRemaining} left`;
    ov.innerHTML = `
    <div class="tss-card" style="position:relative;width:400px;padding:20px 26px 18px;border-radius:18px;text-align:center;
      background:radial-gradient(120% 90% at 50% 0%, ${hexA(col, 0.42 * S.tint)}, rgba(10,11,24,0) 62%), rgba(12,12,26,.93);
      border:1.5px solid ${hexA(col, 0.35 + 0.5 * S.tint)};box-shadow:0 0 0 1px rgba(0,0,0,.5), 0 0 ${Math.round(46 * S.tint)}px ${hexA(col, 0.45 * S.tint)}, 0 18px 50px rgba(0,0,0,.6);">
      <div style="position:absolute;left:18px;right:18px;top:0;height:3px;border-radius:0 0 3px 3px;background:linear-gradient(90deg,transparent,${col},transparent)"></div>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
        ${S.showToken ? `<div style="width:46px;height:46px;flex:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">${playerTokenSVG(p, 46)}</div>` : ''}
        <div style="text-align:left">
          <div style="font:700 28px/1 Cinzel,serif;letter-spacing:.08em;text-transform:uppercase;color:${col};text-shadow:0 0 18px ${hexA(col, 0.5)},0 2px 3px rgba(0,0,0,.7)">${esc(ts.playerName)}</div>
          <div style="font:600 10.5px Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#a7a3c2;margin-top:5px">${rounds}</div>
        </div>
      </div>
      <div style="height:1px;margin:14px 0 6px;background:linear-gradient(90deg,transparent,${hexA(col, 0.55)},transparent)"></div>
      <div style="font:600 10px Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#8f8aa8">Income</div>
      <div class="tss-num" style="font:700 ${S.numberSize}px/1.05 Cinzel,serif;color:#f1c66a;text-shadow:0 0 26px rgba(241,198,106,.45),0 3px 4px rgba(0,0,0,.7);font-variant-numeric:tabular-nums;transform-origin:50% 60%">+0<span style="font-size:.5em;margin-left:.12em;color:#c89f50">✦</span></div>
      <div class="tss-chips" style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;min-height:26px;margin-top:6px"></div>
      <div class="tss-battles" style="display:none;margin-top:10px;font:600 12px Inter,sans-serif;color:#a7a3c2"></div>
      <div style="height:1px;margin:12px 0 10px;background:linear-gradient(90deg,transparent,rgba(145,132,217,.3),transparent)"></div>
      <div style="display:flex;align-items:baseline;justify-content:center;gap:8px;font-family:Inter,sans-serif">
        <span style="font:600 10px Inter;letter-spacing:.2em;text-transform:uppercase;color:#8f8aa8">Mana</span>
        <span class="tss-total" style="font:700 24px Inter;color:#ece6d8;font-variant-numeric:tabular-nums">${ts.manaBefore}</span><span style="color:#c89f50;font-size:15px">✦</span>
        <span style="color:#6b6983;font-size:11px;margin-left:10px">${ts.tileCount} tiles · ${ts.stationedCount} summons</span>
      </div>
    </div>`;
    boardArea.appendChild(ov);
    const card = ov.firstElementChild, numEl = ov.querySelector('.tss-num'), chips = ov.querySelector('.tss-chips'), totEl = ov.querySelector('.tss-total');
    card.animate([{ opacity: 0, transform: 'translateY(26px) scale(.86)' }, { opacity: 1, transform: 'translateY(-4px) scale(1.03)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: S.inMs * k, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });

    let cur = 0, summons = 0, sumChip = null;
    const setNum = v => { numEl.firstChild.nodeValue = (v >= 0 ? '+' : '−') + Math.abs(v); numEl.style.color = v < 0 ? '#e2685f' : '#f1c66a'; };
    const pulse = big => { try { numEl.animate([{ scale: '1' }, { scale: big ? '1.16' : '1.08' }, { scale: '1' }], { duration: 220 * k, easing: 'ease-out' }); } catch (e) {} };
    function chip(label, val, neg) {
      if (!S.chips) return null;
      const c = document.createElement('div'), cc = neg ? '#e2685f' : '#bfe3bf';
      c.style.cssText = `font:600 11.5px Inter,sans-serif;padding:4px 10px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#c9c7e0;white-space:nowrap`;
      c.innerHTML = `${esc(label)} <b style="color:${cc};font-variant-numeric:tabular-nums">${esc(val)}</b>`;
      chips.appendChild(c);
      try { c.animate([{ opacity: 0, transform: 'translateY(6px) scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 220 * k, easing: 'ease-out' }); } catch (e) {}
      return c;
    }
    function mote(x, y, val) {
      const area = boardArea.getBoundingClientRect(), sc = boardArea.offsetWidth > 0 ? area.width / boardArea.offsetWidth : 1, r = numEl.getBoundingClientRect();
      const tx = (r.left - area.left + r.width / 2) / sc, ty = (r.top - area.top + r.height / 2) / sc;
      const c = val < 0 ? '#e2685f' : '#ffd77a', m = document.createElement('div');
      m.style.cssText = `position:absolute;left:${x - 7}px;top:${y - 7}px;width:14px;height:14px;border-radius:50%;z-index:28;pointer-events:none;background:radial-gradient(circle,#fff 0%,${c} 45%,transparent 72%);box-shadow:0 0 14px 4px ${c}99;`;
      boardArea.appendChild(m);
      const dx = tx - x, dy = ty - y, bx = -dy * 0.22, by = dx * 0.22;   // sideways bulge so the path curves
      const a = m.animate([{ translate: '0px 0px', scale: '0.5', opacity: 0 }, { translate: `${dx * 0.45 + bx}px ${dy * 0.45 + by}px`, scale: '1.25', opacity: 1, offset: 0.45 }, { translate: `${dx}px ${dy}px`, scale: '0.6', opacity: 1 }],
        { duration: S.flyMs * k, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' });
      a.onfinish = () => m.remove();
    }
    function add(v) { cur += v; summons += v; setNum(cur); pulse(false); if (sumChip) sumChip.lastElementChild.textContent = (summons >= 0 ? '+' : '−') + Math.abs(summons); }

    function finishUp() {
      window._sweepOnPop = null;
      if (ts.summons != null && summons !== ts.summons) { cur += ts.summons - summons; summons = ts.summons; setNum(cur); if (sumChip) sumChip.lastElementChild.textContent = (summons >= 0 ? '+' : '−') + Math.abs(summons); }   // v1.2: the chip ends on the server's Summons figure
      (ts.extras || []).forEach((x, i) => later(() => { chip(x.label, x.val, x.neg); }, i * 140));
      // v1.3: battles since their last turn, under the income and kept out of it (same as the phone)
      const bw = ts.battleGain || 0, bl = ts.battleLoss || 0;
      if (bw || bl) later(() => {
        const el = ov.querySelector('.tss-battles'), n = bw - bl, c = n < 0 ? '#e2685f' : '#bfe3bf';
        const det = bw && bl ? ` <span style="color:#6b6983;font-weight:500">(+${bw} won, −${bl} lost)</span>` : '';
        el.innerHTML = `<span style="font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:#8f8aa8">Since last turn</span>&nbsp;&nbsp;Battles <b style="color:${c};font-variant-numeric:tabular-nums">${n < 0 ? '−' : '+'}${Math.abs(n)}</b>${det}`;
        el.style.display = 'block';
        try { el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260 * k, easing: 'ease-out' }); } catch (e) {}
      }, (ts.extras || []).length * 140);
      later(() => {
        if (cur !== ts.net) { cur = ts.net; setNum(cur); }
        pulse(true);
        const from = ts.manaBefore, to = ts.manaAfter, t0 = performance.now(), D = S.totalMs * k;
        (function tick() { const u = Math.min(1, (performance.now() - t0) / D), e = 1 - Math.pow(1 - u, 3); totEl.textContent = Math.round(from + (to - from) * e); if (u < 1) requestAnimationFrame(tick); else { try { totEl.animate([{ color: '#ffd77a', scale: '1.2' }, { color: '#ece6d8', scale: '1' }], { duration: 350 * k }); } catch (e2) {} } })();
        later(() => onDone && onDone(), S.totalMs);
      }, (ts.extras || []).length * 140 + 120);
    }

    later(() => {
      cur = ts.baseline; setNum(cur); pulse(false); chip('Base', '+' + ts.baseline);
      sumChip = chip('Summons', '+0');
      const hasSweep = typeof INCOME_SWEEP !== 'undefined' && INCOME_SWEEP.mode === 'sweep';
      if (tally && tally.length) {
        let fin = false; const finOnce = () => { if (!fin) { fin = true; finishUp(); } };
        if (hasSweep) window._sweepOnPop = (e, x, y, i, n) => {
          const fly = S.motes ? S.flyMs * k : 0;
          if (e.netMana) { if (S.motes) { mote(x, y, e.netMana); setTimeout(() => add(e.netMana), fly); } else add(e.netMana); }
          if (i === n - 1) setTimeout(finOnce, fly + 150 * k);   // wrap up as the last Mana lands, while the tile numbers are still fading
        };
        else { const tot = tally.reduce((a, e) => a + (e.netMana || 0), 0); later(() => add(tot), 300); }
        runRoundTally(tally, boardArea, finOnce);
      } else finishUp();
    }, S.inMs);

    return { el: ov, close() { timers.forEach(clearTimeout); window._sweepOnPop = null; try { const a = ov.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(-50%,-46%) scale(${S.scale * 0.94})` }], { duration: 280, fill: 'forwards' }); a.onfinish = () => ov.remove(); } catch (e) { ov.remove(); } } };
  }
  window.BoardSummary = { play };
})();
