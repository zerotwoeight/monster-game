
// ─── v0.6.52 (U3): Rules recap on the shared screen. 📜 Rules in the top bar or R; ← → to page, Esc to close ───
const RR_T = { Light:'#d4a937', Dark:'#5b4a8a', Arcane:'#3f6fd1', Undead:'#5f8a7a', Beast:'#b86a2c', Nature:'#3f8f4a' };
const RR_PAGES = [
  { k: 'On your turn', t: 'Your Turn', items: [
    ['✦', '<b>Collect Mana</b> from round 2: 5✦ plus your stationed summons\' Gen, minus 1✦ upkeep per tile. At 150✦ or more, income is halved.'],
    ['🛒', '<b>Shop</b>: one action only. Buy a summon, sell one from your hand, or skip. Your hand holds 5.'],
    ['🎲', '<b>Roll</b> two dice, then pick one of three landing tiles: the roll, one less, or two less.'],
    ['🃏', '<b>Doubles</b> earn a Wild Card at the end of your turn.'] ] },
  { k: 'Where you land', t: 'Landing', items: [
    ['⚑', '<b>Empty tile</b>: pay a summon\'s cost to station it and claim the tile.'],
    ['🏠', '<b>Your tile</b>: swap the summon, heal it (5✦ for 20 HP), sacrifice it (+15✦), or change the element (18✦).'],
    ['⚔', '<b>Enemy tile</b>: battle for it, or retreat for up to 8✦.'],
    ['💧', '<b>Mana Well</b> +40✦ · <b>Chest</b> random reward · <b>Healing Spring</b> 10✦ heals all your summons +10 HP · <b>Temple</b> trade for an Ascendant.'] ] },
  { k: 'Fighting', t: 'Battles', items: [
    ['⚔', '<b>Damage</b> = ATK minus DEF, times the type modifier, plus a small roll. Minimum 1.'],
    ['🔄', 'If the defender survives, it <b>counter-strikes</b>.'],
    ['🏰', '<b>Home ground</b>: a defender on its own element gets +15% ATK and DEF. On a tile that beats it, −15% DEF.'],
    ['✦', '<b>Mana</b>: attacker wins +4✦ (defender −4✦). Attacker loses or both fall: attacker −8✦, defender +4✦.'],
    ['🤝', '<b>Stalemate</b>: both survive. Next turn, fight again or walk away (up to 8✦).'] ] },
  { k: 'Who beats who', t: 'Element Wheel', wheel: true, items: [   // v0.6.53: same wheel as the phone's help sheet
    ['➜', 'Each element deals <b>2× damage</b> to the next one clockwise.'],
    ['↺', 'It takes <b>½× damage</b> from the one before it.'],
    ['✦', '<b>Dual-element Rares</b> use their better type and have no weakness.'],
    ['🏰', 'Defending on its <b>own element</b>: +15% ATK and DEF.'] ] },
  { k: 'Roll doubles', t: 'Wild Cards', items: [
    ['🃏', 'One card from each tier. Buy one or skip.'],
    ['⚙', '<b>Iron 15✦</b>: Mend · Stumble (move exactly 3) · Delay (skip their shop) · Jinx (halve their income)'],
    ['✶', '<b>Arcane 30✦</b>: Ambush (+40% attack) · Fortify · Rattle (their defender at half ATK) · Poach (steal from their hand)'],
    ['👑', '<b>Gilded 60✦</b>: Coup (take an enemy tile) · Plague (−20 HP) · Windfall (×3 income) · Shatter (destroy 2 summons)'] ] },
  { k: 'Winning and losing', t: 'Sanctioned & Winning', items: [
    ['⛓', '<b>Mana hits 0</b>: you\'re Sanctioned. No income, no shop or roll, but your summons still defend.'],
    ['🔮', '<b>Sanction turn</b>: pick a tile. A rival\'s tile gets an Omen. Your own: Wheel of Fortune, Sacrifice, or Redeem (15✦, once) to rejoin.'],
    ['💀', '<b>No tiles</b> at the end of your turn (after round 1): eliminated.'],
    ['🏆', '<b>Win</b>: most tiles when the round limit ends (Mana breaks ties), or be the last one standing.'] ] },
];
// v0.6.53: the phone help sheet's Element Wheel (player.html buildHelpWheel), drawn larger for the shared screen
function rrWheelSVG() {
  const W = 230, H = 230, cx = 115, cy = 117, R = 76, nr = 24;
  const types = ['Light','Undead','Arcane','Dark','Beast','Nature'];
  const angles = [-90,-30,30,90,150,210].map(d => d * Math.PI / 180);
  const pos = types.map((t, i) => ({ x: cx + R * Math.cos(angles[i]), y: cy + R * Math.sin(angles[i]), t, c: TYPE_COLOR[t] }));
  const defs = types.map((t, i) => `<marker id="rra${i}" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="${TYPE_COLOR[t]}" opacity=".9"/></marker>`).join('');
  const arrows = types.map((t, i) => {
    const from = pos[i], to = pos[types.indexOf(TYPE_STRONG[t])];
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy), nx = dx / len, ny = dy / len;
    return `<line x1="${(from.x + nx * (nr + 3)).toFixed(1)}" y1="${(from.y + ny * (nr + 3)).toFixed(1)}" x2="${(to.x - nx * (nr + 9)).toFixed(1)}" y2="${(to.y - ny * (nr + 9)).toFixed(1)}" stroke="${from.c}" stroke-width="2" opacity=".8" marker-end="url(#rra${i})"/>`;
  }).join('');
  const nodes = pos.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${nr}" fill="${p.c}28" stroke="${p.c}" stroke-width="2"/>
    <text x="${p.x.toFixed(1)}" y="${(p.y + 3.5).toFixed(1)}" text-anchor="middle" font-family="Cinzel,serif" font-size="9.5" font-weight="700" fill="${p.c}">${p.t}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Element wheel: each element beats the next one clockwise"><defs>${defs}</defs>${arrows}${nodes}
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.28)" font-family="Inter,sans-serif">2× clockwise</text></svg>`;
}
let _rrPage = 0;
function openRulesRecap(page) { if (typeof page === 'number') _rrPage = page; _rrRender(); }
function closeRulesRecap() { const o = document.getElementById('rules-recap'); if (o) o.remove(); }
function rrGo(d) { _rrPage = Math.max(0, Math.min(RR_PAGES.length - 1, _rrPage + d)); _rrRender(); }
function _rrRender() {
  let o = document.getElementById('rules-recap');
  if (!o) { o = document.createElement('div'); o.id = 'rules-recap'; o.onclick = e => { if (e.target === o) closeRulesRecap(); }; document.body.appendChild(o); }
  const P = RR_PAGES[_rrPage];
  const body = P.wheel
    ? `<div class="rr-wheelrow"><div class="rr-plaque">${rrWheelSVG()}</div>
       <ul>${P.items.map(([ic, tx]) => `<li><span class="ic">${ic}</span><span>${tx}</span></li>`).join('')}</ul></div>`
    : `<ul>${P.items.map(([ic, tx]) => `<li><span class="ic">${ic}</span><span>${tx}</span></li>`).join('')}</ul>`;
  o.innerHTML = `<div class="rr-card" role="dialog" aria-label="Rules recap">
    <div class="rr-top"><div><div class="rr-kicker">Rules recap · ${P.k}</div><h2>${P.t}</h2></div><div class="rr-count">${_rrPage + 1} / ${RR_PAGES.length}</div></div>
    ${body}
    <div class="rr-nav">
      <button class="rr-btn" onclick="rrGo(-1)" ${_rrPage === 0 ? 'disabled' : ''}>← Back</button>
      <div class="rr-dots">${RR_PAGES.map((_, i) => `<button class="rr-dot${i === _rrPage ? ' on' : ''}" aria-label="Page ${i + 1}" onclick="openRulesRecap(${i})"></button>`).join('')}</div>
      ${_rrPage === RR_PAGES.length - 1 ? `<button class="rr-btn close" onclick="closeRulesRecap()">Close</button>` : `<button class="rr-btn" onclick="rrGo(1)">Next →</button>`}
    </div></div>`;
}
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '') || e.ctrlKey || e.metaKey || e.altKey) return;
  const open = !!document.getElementById('rules-recap');
  if (e.key === 'r' || e.key === 'R') { open ? closeRulesRecap() : openRulesRecap(); }
  else if (open && e.key === 'ArrowRight') rrGo(1);
  else if (open && e.key === 'ArrowLeft') rrGo(-1);
  else if (open && e.key === 'Escape') closeRulesRecap();
});
