// board-tilepanel.js v1.0 (2026-11-16) — Active tile panel for the board's right rail (TILE_PANEL_PLAN.md).
// Pure renderer: TilePanel.html(G, pos, opts) → HTML string; TilePanel.fit(root) collapses overflow chips into "+N".
// Needs from common.js: TYPE_COLOR, TYPE_STRONG, TILE_IMG, summonImg. Styles: /css/tilepanel.css.
// opts: { viewerIdx (active player idx), setup:true (Free placement pill), passed:'Name' (pass card) }
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BEATEN_BY = t => Object.keys(TYPE_STRONG).find(k => TYPE_STRONG[k] === t);   // the type that beats t
  const SPECIAL = {
    start: ['Mana Well', '+40✦ for landing here'], well: ['Mana Well', '+40✦ for landing here'],
    chest: ['Treasure Chest', 'Draw one: Potion · Battle Charm · Warp · Free Summon'],
    heal: ['Healing Spring', 'Pay 10✦: heal all your summons +10 HP'], healing: ['Healing Spring', 'Pay 10✦: heal all your summons +10 HP'],
    temple: ['Temple', 'Offer a summon + 15✦ for its Ascendant'],
  };
  const SPECIAL_COL = { start: '#c6f2ff', well: '#c6f2ff', chest: '#ffdf95', heal: '#c8f5e0', healing: '#c8f5e0', temple: '#f2e3b8' };
  const FORTUNE = { 1: 'Glimmer', 2: 'Radiance', 3: 'Exaltation', '-1': 'Tarnish', '-2': 'Blight', '-3': 'Doom' };
  const CURSE_RE = /withering|hollow|bleeding|shackled|toll|betrayer/;
  const title = id => String(id).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const light = c => `color-mix(in srgb,${c} 45%,#ffffff 55%)`;   // element colour, lifted for dark art

  function chips(tile) {
    const out = [], m = tile.summon, el = tile.kind === 'element' ? tile.element : null;
    const add = (txt, k) => out.push(`<span class="tp-chip ${k}">${esc(txt)}</span>`);
    if (!m) {
      if (el) { add(`Home boost: ${el}`, 'good'); const w = TYPE_STRONG[el]; if (w) add(`Weak ground: ${w}`, 'bad'); }
      return out;
    }
    const sup = m.rarity === 'support';
    if (el && !sup) {
      const types = [m.type, m.type2].filter(Boolean);
      if (types.includes(el)) add('Home ground +15%', 'good');
      else if (!m.type2 && TYPE_STRONG[el] === m.type) add('Weak ground −15%', 'bad');
    }
    if (!sup && !m.type2) { const b = BEATEN_BY(m.type); if (b) add(`Weak to ${b}`, 'bad'); }
    if (m.shield === 'aegis') add('Aegis', 'info'); else if (m.shield === 'parry') add('Parry', 'info');
    if (m.disarmed) add('Disarmed', 'bad');
    if (m.charm) add('Charged +25%', 'good');
    if (tile.omen && tile.omen.id) add(title(tile.omen.id), CURSE_RE.test(tile.omen.id) ? 'bad' : 'gold');
    const f = tile.fortune || 0;
    if (f) add(`Fortune: ${FORTUNE[f]}`, f > 0 ? 'gold' : 'bad');
    if (tile.feral) add('Severed', 'grey');
    return out;
  }

  function html(G, pos, opts = {}) {
    const tile = G.board[pos];
    if (!tile) return '<div class="tp-hero"></div>';
    const isEl = tile.kind === 'element';
    const sp = SPECIAL[tile.kind];
    const name = isEl ? tile.element : (sp ? sp[0] : (tile.label || tile.kind));
    const nameCol = isEl ? light(TYPE_COLOR[tile.element] || '#fff') : (SPECIAL_COL[tile.kind] || '#fff');
    const img = isEl ? TILE_IMG[tile.element] : TILE_IMG[tile.kind];
    const m = tile.summon;
    const owner = tile.ownerId != null ? G.players.find(p => p.idx === tile.ownerId) : null;
    let h = `<div class="tp-hero" style="background-image:url('${img}')"><div class="tp-scrim"></div>`;
    h += `<div class="tp-top"><div class="tp-el" style="color:${nameCol}">${esc(name)}</div>`;
    if (m) h += `<div class="tp-own">${owner ? `Owned by <b style="color:${owner.color}">${esc(owner.name)}</b>` : 'No owner'}</div>`;
    h += `</div>`;
    let pill = null;
    if (opts.setup) pill = ['Free placement', 'gold'];
    else if (m && tile.feral) pill = ['Wild', 'grey'];
    else if (m && owner) pill = owner.idx === opts.viewerIdx ? ['Friendly', 'good'] : ['Enemy', 'bad'];
    if (pill) h += `<div class="tp-pill tp-chip ${pill[1]}">${pill[0]}</div>`;
    const ch = chips(tile).join('');
    if (m) {
      h += `<div class="tp-card" data-sid="${esc(m.id)}">${m.id ? summonImg(m.id) : ''}</div>`;
      const pct = Math.max(0, Math.min(100, m.hp / m.maxHp * 100));
      h += `<div class="tp-bot"><div class="tp-chips">${ch}</div><div class="tp-name">${esc(m.name)}</div>`
        + `<div class="tp-stats"><span>HP ${m.hp}/${m.maxHp}</span><span>ATK ${m.atk}</span><span>DEF ${m.def}</span></div>`
        + `<div class="tp-hp"><i style="width:${pct}%"></i></div></div>`;
    } else {
      const line = isEl ? 'Unclaimed · claim from 6✦' : (sp ? sp[1] : '');
      h += `<div class="tp-bot"><div class="tp-chips">${ch}</div><div class="tp-line">${esc(line)}</div></div>`;
    }
    if (opts.passed) h += `<div class="tp-passed"><div style="color:${opts.passedColor || '#fff'}">${esc(opts.passed)}</div><span>passed</span></div>`;
    return h + '</div>';
  }

  // Collapse chips past 2 rows into "+N" (call after the HTML is in the page).
  function fit(root) {
    root.querySelectorAll('.tp-chips').forEach(box => {
      const all = [...box.children];
      if (!all.length) return;
      all.forEach(c => (c.style.display = ''));
      const old = box.querySelector('.tp-more'); if (old) old.remove();
      const rowTop = [...new Set(all.map(c => c.offsetTop))].sort((a, b) => a - b);
      if (rowTop.length <= 2) return;
      const more = document.createElement('span'); more.className = 'tp-chip grey tp-more';
      box.appendChild(more);
      let hidden = 0;
      for (let i = all.length - 1; i >= 0; i--) {
        const rows = new Set([...box.children].filter(c => c.style.display !== 'none').map(c => c.offsetTop)).size;
        if (rows <= 2) break;
        all[i].style.display = 'none'; hidden++; more.textContent = `+${hidden}`;
      }
    });
  }

  window.TilePanel = { html, fit, chips, version: '1.0' };
})();
