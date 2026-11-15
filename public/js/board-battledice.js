// board-battledice.js v1.1 (2026-11-15, board v0.7.6): Rolling… sits under the name, absolute, no layout shift · v1.0 (2026-11-14, board v0.6.94, server v1.0.159) — BATTLE DICE on the board.
// Each player rolls a black die (the hit they deal) and a white die (the hit they take). While they roll, the
// dice sit under the two cards in the battle preview; in the fight they ride beside the names with their modifiers.
// Self-contained: wraps render() to add the dice after each redraw; board-battle.js calls _bdFight() for the fight.
(function () {
  const TBL = () => (G && G.diceTables) || { black: [0.5, 0.9, 1, 1.1, 1.2, 1.5], white: [1.25, 1.1, 1, 0.9, 0.8, 0.6] };
  const seenAt = {};   // 'seq|side' → when that side's roll first showed (for the tumble)
  function pct(m, white) {
    const d = Math.round((m - 1) * 100);
    if (d === 0) return white ? 'no change' : 'no change';
    return (white ? 'takes ' : '') + (d > 0 ? '+' : '−') + Math.abs(d) + '%';
  }
  const word = (v, white) => white ? (v === 6 ? 'Braced' : v === 1 ? 'Exposed' : '') : (v === 6 ? 'Critical' : v === 1 ? 'Glancing' : '');
  function dieHtml(v, white, size, extra) {
    const hot = v === 6, cold = v === 1;
    const glow = v == null ? 'none' : white ? (hot ? '0 0 14px #7ee0a0' : cold ? '0 0 14px #e2685f' : 'none') : (hot ? '0 0 14px #ffd77a' : cold ? '0 0 14px #8f8aa8' : 'none');
    return `<span class="bd-die${v == null ? ' bd-wait' : ''}" data-v="${v == null ? '' : v}" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${Math.round(size * .22)}px;`
      + `font:800 ${Math.round(size * .62)}px/1 Inter,system-ui,sans-serif;${white ? 'background:#f2efe6;color:#15131f;border:2px solid #c9c4b4;' : 'background:#15131f;color:#f2efe6;border:2px solid #5d5294;'}`
      + `box-shadow:${glow},0 2px 6px rgba(0,0,0,.6);${extra || ''}">${v == null ? '?' : v}</span>`;
  }
  function pairHtml(d, size, labels) {
    const t = TBL();
    const lab = (v, white) => !labels || v == null ? '' : `<div style="font:700 10px Inter,sans-serif;letter-spacing:.04em;margin-top:3px;white-space:nowrap;color:${white ? (v >= 4 ? '#7ee0a0' : v <= 2 ? '#e2685f' : '#b9b4d2') : (v >= 4 ? '#ffd77a' : v <= 1 ? '#e2685f' : '#b9b4d2')}">${word(v, white) ? word(v, white) + ' · ' : ''}${pct((white ? t.white : t.black)[v - 1], white)}</div>`;
    const cell = (v, white) => `<div style="display:flex;flex-direction:column;align-items:center;min-width:${size + 26}px">${dieHtml(v, white, size)}${lab(v, white)}</div>`;
    return `<div class="bd-pair" style="display:flex;justify-content:center;gap:8px;margin-top:8px">${cell(d ? d.b : null, false)}${cell(d ? d.w : null, true)}</div>`;
  }
  function tumble(wrap, key) {   // numbers flicker for a moment, then settle on the roll
    const now = Date.now(); if (!seenAt[key]) { seenAt[key] = now; try { if (typeof SFX !== 'undefined' && SFX.diceClack) SFX.diceClack(0); } catch (e) {} }
    const left = 650 - (now - seenAt[key]); if (left <= 0) return;
    wrap.querySelectorAll('.bd-die').forEach(el => {
      const v = el.dataset.v, t0 = Date.now();
      const iv = setInterval(() => { if (!el.isConnected || Date.now() - t0 > left) { clearInterval(iv); el.textContent = v; return; } el.textContent = 1 + Math.floor(Math.random() * 6); }, 60);
      try { el.animate([{ transform: 'rotate(-14deg) scale(.8)' }, { transform: 'rotate(10deg) scale(1.12)', offset: .5 }, { transform: 'none' }], { duration: left, easing: 'ease-out' }); } catch (e) {}
    });
  }

  // preview: dice under each card while the roll is open
  function preview() {
    const R = G && G.battleRoll; if (!R || G.phase !== 'resolve:battle') return;
    const a = document.querySelector('.bs-prev-att'), d = document.querySelector('.bs-prev-def'); if (!a || !d) return;
    [['att', a], ['def', d]].forEach(([side, host]) => {
      const box = document.createElement('div'); box.className = 'bd-prev';
      box.innerHTML = pairHtml(R[side], 34, true) + (R[side] ? '' : `<div style="font:600 10px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#a99fe0;margin-top:4px;text-align:center">Rolling…</div>`);
      // v1.1: sits under the player's name, out of the layout (absolute), so cards and names never move when it comes and goes
      const col = host.parentElement, name = host.nextElementSibling;
      if (getComputedStyle(col).position === 'static') col.style.position = 'relative';
      box.style.cssText = 'position:absolute;left:-20px;right:-20px;top:100%;margin-top:2px;pointer-events:none;';
      col.insertBefore(box, name ? name.nextSibling : null);
      if (R[side]) tumble(box, R.seq + '|' + side);
      else { try { box.querySelectorAll('.bd-die').forEach(el => el.animate([{ opacity: .45 }, { opacity: 1 }, { opacity: .45 }], { duration: 900, iterations: Infinity })); } catch (e) {} }
    });
  }
  const origRender = render;
  render = function () { const r = origRender.apply(this, arguments); try { preview(); } catch (e) { console.warn('[dice]', e); } return r; };

  // fight: small dice beside each name, with what they do
  window._bdFight = function (overlay, lb) {
    const dz = lb && lb.dice; if (!dz || !overlay) return;
    const t = TBL();
    const strip = (b, w) => `<span style="display:inline-flex;align-items:center;gap:5px;margin-left:8px;vertical-align:middle;letter-spacing:0;text-transform:none">`
      + dieHtml(b, false, 20) + `<span style="font:700 10px Inter,sans-serif;color:${b >= 4 ? '#ffd77a' : b === 1 ? '#e2685f' : '#b9b4d2'}">${pct(t.black[b - 1], false)}</span>`
      + dieHtml(w, true, 20) + `<span style="font:700 10px Inter,sans-serif;color:${w >= 4 ? '#7ee0a0' : w <= 2 ? '#e2685f' : '#b9b4d2'}">${pct(t.white[w - 1], true)}</span></span>`;
    const an = overlay.querySelector('#baAttSide > div'), dn = overlay.querySelector('#baDefSide > div');
    if (an) an.insertAdjacentHTML('beforeend', strip(dz.ab, dz.aw));
    if (dn) dn.insertAdjacentHTML('beforeend', strip(dz.db, dz.dw));
  };
  window.BoardBattleDice = { pairHtml };
})();
