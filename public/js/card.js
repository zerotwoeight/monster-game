// v1.3: Support cards show ATK/DEF/DEPLOY/GEN like every other card (no ability text on the card).
// v1.2: Ascendant tag removed.
// v1.1: Rare + Support tags removed; Rare element pill uses shorthand (UND/BST).
const CARD_EL_SHORT = { Light:'LGT', Dark:'DRK', Arcane:'ARC', Undead:'UND', Beast:'BST', Nature:'NAT' };
// card.js v1.3 (2026-11-13) — the ONE summon card renderer, shared by the phone (player.html) and the board (board.html).
// Styles live in /css/card.css. Change the card here and both screens follow.
// Needs from the page: TYPE_COLOR + summonImg (common.js), artSVG (player-core.js / board-core.js).
// Options: size 'full'|'mini', selected, showCost, dim, onclick, typeAdvantage, typeWeak,
//          hpOverride (board battle: show HP before the hit), extraClass (e.g. 'board-summon-card').
// v0.5.61: broken-sword icon for Disarm (phone + board share the shape)
const WC_DISARM_SVG = '<svg width="11" height="11" viewBox="0 0 12 12" style="vertical-align:-1px"><path d="M10.5 1.5 6.8 5.2M5.2 6.8 3 9" stroke="#f0a0a0" stroke-width="1.6" stroke-linecap="round"/><path d="M2 8l2 2M1.5 10.5l1-1" stroke="#f0a0a0" stroke-width="1.4" stroke-linecap="round"/><path d="M6.2 4.3l1.5 3.4" stroke="#e05252" stroke-width="1.1"/></svg>';
// ─── CARD RENDERER ─────────────────────────────────────────────────────────
function renderCard(m, {size='full', selected=false, showCost=true, dim=false, onclick='', typeAdvantage=false, typeWeak=false, hpOverride, extraClass=''}={}) {
  if (!m) return '';
  const isRare    = m.rarity === 'rare';
  const isSupport = m.rarity === 'support';
  const SUPC = '#9aabbc';
  const c  = isSupport ? SUPC : (TYPE_COLOR[m.type] || '#9184d9');
  const c2 = m.type2 ? (TYPE_COLOR[m.type2] || '#9184d9') : null;
  const hpNow = hpOverride !== undefined ? Math.max(0, hpOverride) : m.hp;   // board battle: HP before the hit
  const pct = Math.max(0, Math.min(1, hpNow / m.maxHp));
  const hpColor = pct < .35 ? '#b05050' : c;
  const hpPct = Math.round(pct * 100);
  let borderColor, glowShadow;
  if (isSupport) {
    borderColor = SUPC;
    glowShadow = `box-shadow:0 0 0 2px ${SUPC}99,0 0 18px ${SUPC}33`;
  } else if (isRare) {
    borderColor = c;
    glowShadow = `box-shadow:0 0 0 2px ${c}99,0 0 0 3.5px ${c2}66,0 0 22px ${c}44,0 0 22px ${c2}22`;
  } else if (m.isSpecial) {
    borderColor = `${c}bb`;
    glowShadow = `box-shadow:0 0 0 2.5px ${c}44,0 0 20px ${c}44`;
  } else {
    borderColor = `${c}88`;
    glowShadow = `box-shadow:0 0 14px ${c}28`;
  }
  const classes = `summon-card ${size}${extraClass ? ' ' + extraClass : ''}${selected?' selected':''}${dim?' unaffordable':''}${m.isSpecial?' special-card':''}${isRare?' rare-card':''}${isSupport?' support-card':''}${typeAdvantage?' type-advantage':''}${typeWeak?' type-weak':''}`;
  const art = m.id ? summonImg(m.id, size === 'mini' ? '-mini' : '') : artSVG(m.type, size==='mini'?70:130, size==='mini'?100:186);
  const clickAttr = onclick ? ` onclick="${onclick}"` : '';
  // Dual-element type dots (not shown for support)
  const typeDots = !isSupport && isRare && c2
    ? `<div class="dual-type-dots"><div class="mc-ov-eldot" style="background:${c}"></div><div class="mc-ov-eldot" style="background:${c2}"></div></div>`
    : `<div class="mc-ov-eldot" style="background:${c}"></div>`;
  // Mini strip
  const miniStrip = isRare && c2
    ? `<div class="mc-mini-strip" style="background:linear-gradient(to right,${c} 50%,${c2} 50%)"></div>`
    : `<div class="mc-mini-strip" style="background:${c}"></div>`;

  // v0.5.61: Parry / Aegis / Disarm markers
  const wcMarks = (m.shield ? `<span class="mc-wc-mark ${m.shield}" title="${m.shield === 'aegis' ? 'Aegis: the next strike against it deals 0' : 'Parry: the next strike against it is halved'}">🛡${size === 'mini' ? '' : ` ${m.shield === 'aegis' ? 'Aegis' : 'Parry'}`}</span>` : '')
    + (m.disarmed ? `<span class="mc-wc-mark disarm" title="Disarmed: its next counter-strike deals 0">${WC_DISARM_SVG}${size === 'mini' ? '' : ' Disarmed'}</span>` : '');
  const wcMarksHTML = wcMarks ? `<div class="mc-wc-marks${size === 'mini' ? ' mini' : ''}">${wcMarks}</div>` : '';
  if (size === 'mini') {
    return `<div class="${classes}" style="border-color:${borderColor};${glowShadow}"${clickAttr}>
      ${wcMarksHTML}
      ${m.charm ? `<svg class="charm-badge-mini" width="17" height="17" viewBox="0 0 17 17" xmlns="http://www.w3.org/2000/svg" aria-label="Battle Charm"><circle cx="8.5" cy="8.5" r="7.5" fill="rgba(150,100,30,0.92)" stroke="#d4a843" stroke-width="1.4"/><path d="M9.5 3.5L6 9.5h3.5L8 13.5l4.5-6h-3.5z" fill="#fff8d0" stroke="#e8c060" stroke-width="0.5" stroke-linejoin="round"/></svg>` : ''}
      <div class="mc-art">${art}</div>
      ${miniStrip}
    </div>`;
  }
  // Element badge label (support cards show "Support" label)
  const elemBadgeLabel = isSupport ? 'Support' : (isRare && c2 ? `${CARD_EL_SHORT[m.type] || m.type}/${CARD_EL_SHORT[m.type2] || m.type2}` : (m.type || ''));
  const elemBadgeBg = isSupport ? SUPC : (isRare && c2 ? `linear-gradient(to right,${c},${c2})` : c);
  // Support effect line replaces stats row
  const statsRow = false   // v1.3: Support cards use the normal stat row; ability text lives in the detail view
    ? `<div style="font-size:7px;color:${SUPC};text-align:center;line-height:1.3;padding:0 2px;margin-top:1px;">${m.supportDesc}<br><b>Deploy ${m.claimFee ?? m.cost}✦</b></div>`
    : `<div class="mc-ov-stats">${['ATK','DEF','DEPLOY','GEN'].map((l,i)=>`<div class="mc-ov-sc"><span class="mc-ov-si">${l}</span><span class="mc-ov-sv">${[m.atk,m.def,(m.claimFee ?? m.cost),m.gen][i]}</span></div>`).join('')}</div>`;
  return `<div class="${classes}" style="border-color:${borderColor};${glowShadow}"${clickAttr}>
    ${m.charm ? `<svg class="charm-badge" width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-label="Battle Charm"><circle cx="14" cy="14" r="12" fill="rgba(150,100,30,0.92)" stroke="#d4a843" stroke-width="1.8"/><path d="M15.5 6.5L9.5 15.5h5.5L13 22l6.5-9.5h-5.5z" fill="#fff8d0" stroke="#e8c060" stroke-width="0.6" stroke-linejoin="round"/></svg>` : ''}
    ${elemBadgeLabel ? `<div class="mc-element-badge" style="background:${elemBadgeBg}">${elemBadgeLabel}</div>` : ''}
    ${wcMarksHTML}
    ${m.isSpecial && dim && m.conditionDesc ? `<div class="special-lock-overlay"><span class="special-lock-icon">🔒</span><div class="special-lock-text">${m.conditionDesc}</div></div>` : ''}
    <!-- v0.5.10: matchup shown by border/tint + sheet banner only (no on-card ribbon) -->
    ${showCost ? `<div class="mc-cost-strip"><span class="mc-cost-val" style="color:${c}">${m.cost}</span><span class="mc-cost-lbl">✦</span></div>` : ''}
    <div class="mc-art">${art}</div>
    <div class="mc-overlay">
      <div class="mc-ov-name" style="color:#fff"><span>${m.name}</span></div>
      <div class="mc-ov-hp-row"><div class="mc-hp-track"><div class="mc-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div><span class="mc-hp-num">${hpNow}/${m.maxHp}</span></div>
      ${statsRow}
    </div>
  </div>`;
}
