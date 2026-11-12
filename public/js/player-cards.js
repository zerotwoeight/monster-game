// v0.5.61: broken-sword icon for Disarm (phone + board share the shape)
const WC_DISARM_SVG = '<svg width="11" height="11" viewBox="0 0 12 12" style="vertical-align:-1px"><path d="M10.5 1.5 6.8 5.2M5.2 6.8 3 9" stroke="#f0a0a0" stroke-width="1.6" stroke-linecap="round"/><path d="M2 8l2 2M1.5 10.5l1-1" stroke="#f0a0a0" stroke-width="1.4" stroke-linecap="round"/><path d="M6.2 4.3l1.5 3.4" stroke="#e05252" stroke-width="1.1"/></svg>';
// player-cards.js: split from the inline page script (L2). Loaded in order by player.html; all files share one global scope.
// ─── CARD RENDERER ─────────────────────────────────────────────────────────
function renderCard(m, {size='full', selected=false, showCost=true, dim=false, onclick='', typeAdvantage=false, typeWeak=false}={}) {
  const isRare    = m.rarity === 'rare';
  const isSupport = m.rarity === 'support';
  const SUPC = '#9aabbc';
  const c  = isSupport ? SUPC : (TYPE_COLOR[m.type] || '#9184d9');
  const c2 = m.type2 ? (TYPE_COLOR[m.type2] || '#9184d9') : null;
  const pct = Math.max(0, Math.min(1, m.hp / m.maxHp));
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
  const classes = `summon-card ${size}${selected?' selected':''}${dim?' unaffordable':''}${m.isSpecial?' special-card':''}${isRare?' rare-card':''}${isSupport?' support-card':''}${typeAdvantage?' type-advantage':''}${typeWeak?' type-weak':''}`;
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
  const elemBadgeLabel = isSupport ? 'Support' : (isRare && c2 ? `${m.type}/${m.type2}` : (m.type || ''));
  const elemBadgeBg = isSupport ? SUPC : (isRare && c2 ? `linear-gradient(to right,${c},${c2})` : c);
  // Support effect line replaces stats row
  const statsRow = isSupport && m.supportDesc
    ? `<div style="font-size:7px;color:${SUPC};text-align:center;line-height:1.3;padding:0 2px;margin-top:1px;">${m.supportDesc}</div>`
    : `<div class="mc-ov-stats">${['ATK','DEF','✦','GEN'].map((l,i)=>`<div class="mc-ov-sc"><span class="mc-ov-si">${l}</span><span class="mc-ov-sv">${[m.atk,m.def,m.cost,m.gen][i]}</span></div>`).join('')}</div>`;
  return `<div class="${classes}" style="border-color:${borderColor};${glowShadow}"${clickAttr}>
    ${m.charm ? `<svg class="charm-badge" width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-label="Battle Charm"><circle cx="14" cy="14" r="12" fill="rgba(150,100,30,0.92)" stroke="#d4a843" stroke-width="1.8"/><path d="M15.5 6.5L9.5 15.5h5.5L13 22l6.5-9.5h-5.5z" fill="#fff8d0" stroke="#e8c060" stroke-width="0.6" stroke-linejoin="round"/></svg>` : ''}
    ${elemBadgeLabel ? `<div class="mc-element-badge" style="background:${elemBadgeBg}">${elemBadgeLabel}</div>` : ''}
    ${wcMarksHTML}
    ${m.isSpecial && dim && m.conditionDesc ? `<div class="special-lock-overlay"><span class="special-lock-icon">🔒</span><div class="special-lock-text">${m.conditionDesc}</div></div>` : ''}
    <!-- v0.5.10: matchup shown by border/tint + sheet banner only (no on-card ribbon) -->
    ${showCost ? `<div class="mc-cost-strip"><span class="mc-cost-val" style="color:${c}">${m.cost}</span><span class="mc-cost-lbl">Mana</span></div>` : ''}
    <div class="mc-art">${art}</div>
    <div class="mc-overlay">
      ${m.isSpecial ? `<div class="special-badge">✦ Ascendant</div>` : ''}
      ${isRare ? `<div class="rare-badge">★ Rare</div>` : ''}
      ${isSupport ? `<div class="rare-badge" style="color:${SUPC};background:rgba(154,171,188,.15);border-color:${SUPC}66;">◈ Support</div>` : ''}
      <div class="mc-ov-name" style="color:${c}"><span>${m.name}</span>${typeDots}</div>
      <div class="mc-ov-hp-row"><div class="mc-hp-track"><div class="mc-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div><span class="mc-hp-num">${m.hp}/${m.maxHp}</span></div>
      ${statsRow}
    </div>
  </div>`;
}

// ─── SIGIL ─────────────────────────────────────────────────────────────────
function sigilShape(idx, cx, cy, r, color) {
  const sw = `stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" fill="none"`;
  switch(idx % 6) {
    case 0: return `<circle ${sw} cx="${cx}" cy="${cy}" r="${r}"/>`;
    case 1: return `<polygon ${sw} points="${cx},${cy-r} ${cx+r},${cy} ${cx},${cy+r} ${cx-r},${cy}"/>`;
    case 2: return `<polygon ${sw} points="${cx},${cy-r} ${cx+r*.87},${cy+r*.5} ${cx-r*.87},${cy+r*.5}"/>`;
    case 3: { const a=2*Math.PI/5; const pts=Array.from({length:5},(_,i)=>{const t=-Math.PI/2+i*a;return`${cx+r*Math.cos(t)},${cy+r*Math.sin(t)}`;}).join(' '); return`<polygon ${sw} points="${pts}"/>`; }
    case 4: return `<line ${sw} x1="${cx}" y1="${cy-r}" x2="${cx}" y2="${cy+r}"/><line ${sw} x1="${cx-r}" y1="${cy}" x2="${cx+r}" y2="${cy}"/>`;
    case 5: { const pts=[0,1,2,3,4,5].map(i=>{const t=-Math.PI/2+i*Math.PI/3;const rr=i%2===0?r*.5:r;return`${cx+rr*Math.cos(t)},${cy+rr*Math.sin(t)}`;}).join(' ');return`<polygon ${sw} points="${pts}"/>`; }
    default: return `<circle ${sw} cx="${cx}" cy="${cy}" r="${r}"/>`;
  }
}

// ─── MINI BOARD ─────────────────────────────────────────────────────────────
function miniBoardSVG(w=220, h=220) {
  if (!G) return '';
  const cx=w/2, cy=h/2, R=88, N=28;
  let tiles='', tokens='';
  const me = G.players[myIdx];
  for (let i=0; i<N; i++) {
    const a = (i/N)*2*Math.PI - Math.PI/2;
    const tx=cx+R*Math.cos(a), ty=cy+R*Math.sin(a);
    const tile = G.board[i];
    let col = tile.element ? TYPE_COLOR[tile.element] : '#a97b40';
    if (tile.ownerId !== null && tile.ownerId !== undefined) {
      col = G.players[tile.ownerId]?.color || col;
    }
    tiles += `<circle cx="${tx}" cy="${ty}" r="7" fill="${col}33" stroke="${col}" stroke-width="1.2" opacity=".8"/>`;
    G.players.forEach(p => {
      if (p.position === i) {
        const isMe = p.idx === myIdx;
        tokens += `<circle cx="${tx}" cy="${ty}" r="${isMe?5.5:4}" fill="${p.color}" stroke="${isMe?'white':'transparent'}" stroke-width="${isMe?1.5:0}" opacity=".9"/>`;
      }
    });
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <circle cx="${cx}" cy="${cy}" r="${R+10}" fill="none" stroke="#272a38" stroke-width=".5"/>
    ${tiles}${tokens}
    ${me ? `<text x="${cx}" y="${cy+5}" text-anchor="middle" fill="${me.color}" font-family="Cinzel,serif" font-size="11" font-weight="700">YOU</text>` : ''}
  </svg>`;
}

// ─── TILE CARD (player-view) ─────────────────────────────────────────────────
function renderPlayerTileCard(tile) {
  if (!tile) return '';
  const isSpecial = tile.kind !== 'element';
  const color = isSpecial ? '#c0392b' : (TYPE_COLOR[tile.element] || '#9397ab');
  const label = tile.label || tile.element || tile.kind;
  // Match board.html gradient formula exactly
  const bg = isSpecial
    ? 'linear-gradient(160deg,#4a1a1a,#2a0e0e)'
    : `linear-gradient(160deg,color-mix(in srgb,${color} 62%,#10111e 38%),color-mix(in srgb,${color} 40%,#0c0d1a 60%))`;
  const border = `1px solid ${color}cc`;
  // Art: image if available, else glyph fallback (matching board art logic)
  const imgSrc = isSpecial ? TILE_IMG[tile.kind] : TILE_IMG[tile.element];
  const artHTML = imgSrc
    ? `<div style="display:flex;align-items:center;justify-content:center;width:100%;flex:1;min-height:0;">
         <img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;display:block;" alt="">
       </div>`
    : isSpecial
      ? `<div style="display:flex;align-items:center;justify-content:center;font-size:26px;width:100%;flex:1;color:${color};">${SPECIAL_ICONS[tile.kind] || '❖'}</div>`
      : `<div style="display:flex;align-items:center;justify-content:center;width:100%;flex:1;min-height:0;font-size:24px;line-height:1;text-shadow:0 0 8px currentColor;color:#fff;">${TYPE_ICON[tile.element] || '✦'}</div>`;
  // 20% bigger than before (was 120×150 → now 144×180), board card style
  return `<div style="display:inline-flex;flex-direction:column;align-items:center;justify-content:flex-start;
      width:144px;height:180px;border-radius:8px;border:${border};
      background:${bg};overflow:hidden;padding:5px 4px 5px;">
    ${artHTML}
    <div style="font-size:11px;font-weight:500;letter-spacing:.03em;text-transform:uppercase;text-align:center;line-height:1.2;margin-top:4px;color:${color};">${label}</div>
  </div>`;
}

// ─── TYPE EFFECTIVENESS ─────────────────────────────────────────────────────
// atkMon can be a monster object (with optional .type2) or a plain type string.
// defType is always a plain type string (we only check defender's primary type, matching server logic).
function typeEff(atkMon, defType) {
  const t1 = (typeof atkMon === 'string') ? atkMon : atkMon.type;
  const t2 = (typeof atkMon === 'object' && atkMon.type2) ? atkMon.type2 : null;
  const mod1 = TYPE_STRONG[t1]===defType ? 2 : TYPE_WEAK[t1]===defType ? 0.5 : 1;
  const mod2 = t2 ? (TYPE_STRONG[t2]===defType ? 2 : TYPE_WEAK[t2]===defType ? 0.5 : 1) : mod1;
  const best = Math.max(mod1, mod2); // mirrors server typeMultiplier Math.max() logic
  if (best >= 2)   return {label:'2× Strong', cls:'strong'};
  if (best <= 0.5) return {label:'½× Weak',   cls:'weak'};
  return {label:'1× Neutral', cls:'neutral'};
}

// ─── TOAST ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1c1e2b;border:1px solid #3f424d;border-radius:8px;padding:10px 16px;font-size:13px;color:#e9e9ed;z-index:9999;pointer-events:none;max-width:300px;text-align:center';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ─── TILE SYNERGY HELPERS ────────────────────────────────────────────────────
function getMyBonusRuns() {
  if (!G || !G.bonusRuns || myIdx === null) return [];
  return G.bonusRuns.filter(r => r.playerIdx === myIdx);
}

function synergyBannerHTML() {
  const runs = getMyBonusRuns();
  const monoBonus = G && G.monoElementBonus ? G.monoElementBonus.find(r => r.playerIdx === myIdx) : null;
  if (!runs.length && !monoBonus) return '';
  let html = '';
  if (runs.length) {
    const labels = runs.map(r => {
      const c = TYPE_COLOR[r.element] || 'var(--gold-glow)';
      return `<span style="color:${c};font-weight:700;">${r.element}</span>`;
    }).join(', ');
    html += `<div class="synergy-banner">
      <span class="synergy-banner-icon">🔥</span>
      <div class="synergy-banner-body">
        <div class="synergy-banner-title">Tile Synergy Active!</div>
        <div class="synergy-banner-desc">${labels} chain — +1 HP/round · +20% counter-damage</div>
      </div>
    </div>`;
  }
  if (monoBonus) {
    const c = TYPE_COLOR[monoBonus.element] || 'var(--gold-glow)';
    html += `<div class="synergy-banner" style="border-color:rgba(255,215,0,.45);background:rgba(255,215,0,.07);">
      <span class="synergy-banner-icon">⭐</span>
      <div class="synergy-banner-body">
        <div class="synergy-banner-title" style="color:#ffd700;">Mono-Element Mastery!</div>
        <div class="synergy-banner-desc"><span style="color:${c};font-weight:700;">${monoBonus.element}</span> — +1 HP/round · +20% counter-damage</div>
      </div>
    </div>`;
  }
  return html;
}

// ─── STATUS BAR ─────────────────────────────────────────────────────────────
function updateStatusBar(showIt = true) {
  const sb = document.getElementById('status-bar');
  _syncMenuFab(showIt);
  if (!showIt || !G || myIdx === null) { sb.style.display = 'none'; return; }
  sb.style.display = 'flex';
  const me = G.players[myIdx];
  if (!me) return;
  const isMyTurn = G.currentPlayer === myIdx;
  document.getElementById('sb-name').textContent = me.name;
  document.getElementById('sb-turn-info').textContent = `Turn ${G.turnCount + 1} · Tile ${me.position}`;
  document.getElementById('sb-badge').innerHTML = me.sanctioned   // v0.5.33
    ? `<span class="turn-badge sanctioned">⛓ Sanctioned</span>`
    : `<span class="turn-badge ${isMyTurn ? 'yours' : 'waiting'}">${isMyTurn ? 'Your Turn' : 'Waiting'}</span>`;
  document.getElementById('sb-mana-val').textContent = me.mana;
  document.getElementById('sb-sigil-svg').innerHTML = sigilShape(myIdx, 15, 15, 6, me.color);
  // v0.5.38: summary recall button sits left of ☰
  const _sb = document.getElementById('sb-sum-btn'), _avail = _summaryRecallAvailable();
  _sb.style.display = _avail ? 'flex' : 'none';
  document.getElementById('sb-menu-btn').style.marginLeft = _avail ? '6px' : '';
  _refreshSummaryRecall();
}

// v0.5.12: optional mode → { label, tap:'fnName' (called with hand index), opts:(m)=>renderCard opts }
function updateHandStrip(show = true, mode = null) {
  const ha = document.getElementById('hand-area');
  const hs = document.getElementById('hand-scroll');
  const lbl = document.getElementById('hand-label');
  if (lbl) { lbl.innerHTML = mode ? mode.label : 'Your Hand'; lbl.classList.toggle('hand-label-cta', !!mode); }
  if (!show || !myHand.length) { ha.classList.remove('visible'); return; }
  ha.classList.add('visible');
  hs.innerHTML = `<div class="scroll-inner">${myHand.map((m, i) => {
    const card = renderCard(m, Object.assign({size:'mini'}, mode && mode.opts ? mode.opts(m) : {}));
    const tap = mode ? `${mode.tap}(${i})` : `showCardDetail(${m.iid})`;
    return `<div onclick="${tap}" style="cursor:pointer;position:relative;flex-shrink:0;">${card}</div>`;
  }).join('')}</div>`;
}

// v0.5.12: home-field effect of a tile element on a summon (defender boost/debuff rule)
function homeField(m, el) {
  if (!m || !el || m.rarity === 'support' || !m.type) return 'neutral';
  const types = [m.type, m.type2].filter(Boolean);
  if (types.includes(el)) return 'boost';
  if (!m.type2 && TYPE_STRONG[el] === m.type) return 'weak';   // mirrors server tileEffectOnDefender (no debuff for dual-element)
  return 'neutral';
}

// ─── MONSTER LORE ───────────────────────────────────────────────────────────
// v0.5.27: fallback unlock text (server sends conditionDesc for hand cards; this covers any view that doesn't)
const ASCENDANT_CONDITIONS = {
  'Ardent Saint':'Healed 2+ summons this game',
  'Succubus':'Have at least 40✦ Mana',
  'Arcane Arbiter':'Changed 1+ tile to Arcane element this game',
  'Demon Lord':'Had 2+ summons destroyed in battle this game',
  'Red Dragon':'Have 3+ summons stationed on board',
  'World Tree':'Own 2+ Nature tiles currently',
};
const MONSTER_LORE = {
  // ── LIGHT ──
  'Solar Knight':   { role:'Assailant',lore:'A warrior wreathed in living sunfire, the Solar Knight charges into battle with reckless brilliance. Their armor blazes so brightly that enemies are blinded before the blade even lands — but the intensity that makes them lethal also burns through their endurance fast.', ability:'Radiant Strike — on claim or battle win, tile converts to Light element.' },
  'Dawnguard':      { role:'Guardian',lore:'The Dawnguard were founded to hold the line at the world\'s edge, and they have done so for a thousand years. Slow but unyielding, a Dawnguard unit doesn\'t retreat. Ever. Their shields are blessed to turn aside blows that would fell lesser warriors, and their patience outlasts nearly any assault.', ability:'Bulwark Aura — grants +5 DEF to the friendly summon on each adjacent tile.' },
  'High Paladin':   { role:'Vanguard',lore:'Chosen from among the bravest and most disciplined of the Light orders, the High Paladin combines martial skill with divine judgment. They are neither the fastest nor the most powerful, but their balance of offense and defense makes them reliable in almost any engagement.', ability:'Lay on Hands — once per game, heals itself for 15 HP when HP drops below 30%.' },
  'Ardent Saint':   { role:'Ascendant · Temple Only',lore:'Legends say the Ardent Saint ascended to the Light after taking a wound that should have been fatal — and stood back up anyway. Now she radiates a gentle healing aura that sustains all friendly summons on the field, turning attrition into advantage over a long game.', ability:'Aura of Renewal — heals all your stationed summons 5 HP each turn.' },

  // ── DARK ──
  'Nightshard':     { role:'Assailant',lore:'Crystallized shadow given lethal purpose, the Nightshard moves like a rumor and hits like a verdict. What they lack in durability they make up for in aggression — a summon that lives or dies in the opening exchange.', ability:'Soul Siphon — on kill, steals 4✦ from the defeated monster\'s owner.' },
  'Void Sentinel':  { role:'Guardian',lore:'The Void Sentinel was carved from the space between stars and set to guard a gateway that no longer exists. It protects tiles with the same impassive resolve regardless of what crosses its path, drawing on an endless reservoir of shadow to endure.', ability:'Last Darkness — when HP drops below 30%, ATK transforms to 36.' },
  'Shadow Paladin': { role:'Vanguard',lore:'Where Light Paladins serve order, Shadow Paladins serve inevitability. They have studied every fighting style and countered every tactic, making them adaptable soldiers who can hold ground or push forward depending on what the moment demands.', ability:'Dark Pact — gains +1 ATK per friendly Dark summon currently stationed on tiles.' },
  'Succubus':       { role:'Ascendant · Temple Only',lore:'Beautiful, ruthless, and economically devastating. The Succubus doesn\'t just win battles — she taxes them. Every victory drains the loser\'s treasury, turning combat into a Mana siphon that compounds with every fight.', ability:'Mana Drain — when it attacks and wins or stalemates, steal 10✦ from the defending player.' },

  // ── ARCANE ──
  'Sorcerer':       { role:'Assailant',lore:'Pure channeled spellfire in a mortal frame. The Sorcerer can disintegrate enemies in seconds, but maintaining those output levels leaves almost nothing for self-defense. High risk, high reward — one wrong trade ends them.', ability:'Arcane Ascent — on win, permanently gains +1 ATK and +1 Gen (stacks).' },
  'Rune Priestess': { role:'Guardian',lore:'She inscribed every ward she knows onto her own body, and now each rune absorbs a measure of incoming force. Attacking a Rune Priestess is an exercise in frustration — the damage just keeps getting absorbed, layer by layer.', ability:'Runic Amplification — Gen is doubled while stationed on an Arcane tile.' },
  'Arch Mage':      { role:'Vanguard',lore:'The Arch Mage has spent decades mastering not just destruction, but efficiency. Every spell is precisely calibrated for the situation. Not flashy, but rarely caught off-guard, and never wasteful.', ability:'Mana Infusion — generates +2✦ bonus income per turn while stationed.' },
  'Arcane Arbiter': { role:'Ascendant · Temple Only',lore:'Once a judge in the Great Arcane Courts, the Arbiter discovered that type advantages were being exploited as legal loopholes. They devised a countermeasure: a field-disruption technique that collapses elemental affinities to neutral, leveling any fight.', ability:'Chaos Flux — after any battle or stalemate against it, one random attacker-owned tile changes to a random element.' },

  // ── UNDEAD ──
  'Bone Wraith':    { role:'Assailant',lore:'What it lacks in flesh it makes up for in fury. The Bone Wraith is animated by spite and propelled by the memory of every grievance it suffered in life. It hits hard and disintegrates fast — exactly as planned.', ability:'Death Rattle — on death, deals 12 damage to the monster that killed it.' },
  'Death Knight':   { role:'Guardian',lore:'A paladin who refused to die and cut a deal to keep going. The Death Knight\'s oath binds them to the tile they guard with unnatural persistence. Killing them once isn\'t always enough — they have a way of not staying down.', ability:'Death Sentence — 20% chance to instantly kill on any damage dealt (attack or counter-strike).' },
  'Shade Walker':   { role:'Vanguard',lore:'The Shade Walker exists between states — partially corporeal, partially not. This makes them genuinely hard to read in combat: they can absorb a blow or dodge it depending on their angle. Versatile survivors of the Undead roster.', ability:'Cursed Touch — after a stalemate, the opposing monster loses 5 HP per turn for 2 turns (follows the monster, can\'t kill, does not stack).' },
  'Demon Lord':     { role:'Ascendant · Temple Only',lore:'The Demon Lord has died so many times that death simply stopped sticking. Once per game, when their HP drops to zero, they stabilize at 15 and keep fighting — a nightmare to put down permanently.', ability:'Last Rite — survives fatal damage once per game, continuing at 15 HP.' },

  // ── BEAST ──
  'Razorclaw':      { role:'Assailant',lore:'Part predator, part projectile. The Razorclaw doesn\'t have a defensive strategy because it has never needed one — it closes the distance so fast that the opponent rarely gets to counterattack. Fragile in a prolonged fight, lethal in a short one.', ability:'Apex Predator — gains +1 ATK per tile currently owned and +1 ATK per battle won (both stack cumulatively).' },
  'Iron Hide':      { role:'Guardian',lore:'An ancient creature armored by centuries of scar tissue. The Iron Hide has survived things that should have ended it a dozen times, and each survival made it harder. A reliable defensive anchor that enemies learn to respect or route around.', ability:'Hardened Shell — permanently gains +3 HP each time it survives a battle (stacks).' },
  'Pack Hunter':    { role:'Vanguard',lore:'The Pack Hunter is most dangerous when it feels like a fair fight — because that means you\'re not watching the flanks. Even alone it applies pressure from multiple angles, feinting and circling rather than committing to a straight exchange.', ability:'Pack Tactics — gains +3 ATK per other Beast summon currently stationed on tiles.' },
  'Red Dragon':     { role:'Ascendant · Temple Only',lore:'A dragon that has claimed a territory burns that claim into the land itself. Neighboring tile owners feel the heat every time someone new tries to stake a claim — the Red Dragon\'s intimidating presence costs them Mana even before the battle starts.', ability:'Intimidate — at the start of each affected player\'s turn, they pay 5✦ per stationed summon adjacent to the Red Dragon.' },

  // ── NATURE ──
  'Thornling':      { role:'Assailant',lore:'A creature made of compressed briar and thorns, launched at problems. The Thornling explodes with violent speed from a standing position, impaling anything in range before the target has time to react. Its fragility is the cost of being mostly made of spikes.', ability:'Thorn Burst — while stationed on a tile: if she is destroyed, the attacker loses 8 HP and the tile converts to Nature element. Does not trigger when she attacks.' },
  'Ancient Oak':    { role:'Guardian',lore:'Older than the kingdom it now defends, the Ancient Oak moves slowly and doesn\'t need to move quickly. Its roots stabilize in every tile it stands on, making it extraordinarily difficult to dislodge. It has simply outlasted everything that has ever challenged it.', ability:'Overgrowth — every 3 turns stationed without being attacked, permanently gains +3 ATK and +3 DEF (resets on attack).' },
  'Grove Warden':   { role:'Vanguard',lore:'The Grove Warden tends the living battlefield with as much care as it fights on it. Neither the most aggressive nor the most defensive of the Nature roster, but adaptable — capable of holding tiles or applying pressure depending on what the board demands.', ability:'Nature\'s Bulwark — grants +5 DEF to all friendly Nature-type summons stationed anywhere on the board.' },
  'World Tree':     { role:'Ascendant · Temple Only',lore:'The World Tree\'s roots run under every Nature tile on the board. The more Nature territory your team controls, the faster it grows — feeding Mana back into your reserves with every passing round through the network it maintains beneath the surface.', ability:'Deep Roots — generates +1 bonus Mana Gen for each Nature tile you currently own, and +1 for each Nature-type summon you have stationed.' },

  // ── LIGHT (new) ──
  'Dawn Striker':   { role:'Assailant',lore:'The Dawn Striker hits before the enemy even sees the light. Trained to attack the moment the sun breaks the horizon, this warrior combines celestial timing with brutal force — high attack, low armour, built for the decisive first blow.', ability:'Soulmend — heals itself for 8 HP each time it wins a battle.' },
  'Radiant Lancer': { role:'Vanguard',lore:'Carrying a spear infused with concentrated sunlight, the Radiant Lancer punches through shields and shadows alike. Steady and adaptable, it holds tiles reliably while threatening enemies who stray too close to its extended reach.', ability:'Piercing Light — ignores 30% of the target\'s DEF on every strike it makes (attack and counter-strike).' },
  'Sunfire Herald': { role:'Vanguard',lore:'The Sunfire Herald moves across the board like a slow burn — patient, inevitable. It prioritises endurance over aggression, trusting that the longer a battle drags on, the more its radiant resilience tips the scales in its favour.', ability:'Battle Cry — grants +5 ATK to the friendly summon on each adjacent tile.' },

  // ── DARK (new) ──
  'Void Reaper':    { role:'Assailant',lore:'The Void Reaper tears through enemy lines with terrifying speed, leaving nothing but silence. Extremely fragile, but hits with an attack stat most summons at double the cost cannot match. It exists to delete one thing, then disappear.', ability:'Void Hunger — gains +2 ATK permanently each time it wins a battle (stacks).' },
  'Dusk Blade':     { role:'Vanguard',lore:'Half shadow, half blade — the Dusk Blade occupies the space between an assassin and a soldier. It trades blows with most opponents on even footing while always looking for the moment to strike something decisive with its slightly elevated attack.', ability:'Hemorrhage — on win, the target\'s Mana income next turn is reduced by 4✦.' },
  'Umbral Stalker': { role:'Vanguard',lore:'The Umbral Stalker watches from the dark and waits for the right time. Tougher than most balanced units, it absorbs punishment while wearing opponents down — less about explosive damage and more about outlasting the thing standing in its way.', ability:'Umbral Aura — adjacent enemy stationed monsters lose 5 DEF (active aura, while stationed).' },

  // ── ARCANE (new) ──
  'Spell Wraith':   { role:'Assailant',lore:'A barely-contained burst of arcane energy given a body just long enough to fight. The Spell Wraith collapses its own existence into a single devastating strike. Impressive attack, practically no armour, and a lifespan measured in battles rather than rounds.', ability:'Mana Siphon — adjacent enemy stationed monsters lose their base Gen from their owner\'s income each turn, and you gain it.' },
  'Runic Duelist':  { role:'Vanguard',lore:'The Runic Duelist inscribes battle equations into the air mid-fight, calculating angles and energy output on the fly. It leans slightly toward aggression, finding combat solutions faster than opponents can adapt their defences.', ability:'Arcane Pact — gains +1 ATK per friendly Arcane summon currently stationed (recalculated each battle).' },
  'Mana Weaver':    { role:'Vanguard',lore:'The Mana Weaver treats the battlefield like a loom, threading magical currents through everything it touches. A durable generalist with exceptional defensive depth, it holds positions long enough for the board to shift in your favour.', ability:'Mana Web — all other friendly stationed monsters gain +1✦ Gen per turn.' },

  // ── UNDEAD (new) ──
  'Grave Specter':  { role:'Assailant',lore:'The Grave Specter phases through solid matter and hits from angles that shouldn\'t be possible. Its attack power is exceptional, its survivability almost nonexistent — a creature that decided dying was optional as long as it killed you first.', ability:'Necrotic Claim — on winning a battle, the tile converts to Undead element.' },
  'Cursed Revenant':{ role:'Vanguard',lore:'Bound to the battlefield by a curse it cannot lift, the Cursed Revenant fights with the weight of unfinished business behind every strike. Slightly attack-forward, it applies steady pressure and is difficult to ignore even when other threats demand attention.', ability:'Undead Resilience — gains +2 DEF permanently each time it survives a battle (stacks).' },
  'Plague Herald':  { role:'Vanguard',lore:'The Plague Herald doesn\'t fight clean. It layers debilitating pressure over time, weathering damage while making the fight increasingly miserable for whoever stands against it. Among the more durable Undead balanced units.', ability:'Pestilence — adjacent enemy stationed monsters lose 3 HP per turn (can\'t reduce them below 1 HP).' },

  // ── BEAST (new) ──
  'Feral Striker':  { role:'Assailant',lore:'Raw instinct weaponised. The Feral Striker doesn\'t strategise — it charges, claws, and hopes its ferocity lands before anything can hit back. Extremely high attack, a body that can barely absorb punishment, and zero regard for personal safety.', ability:'Territorial — gains +2 ATK per tile currently owned (recalculated each battle).' },
  'Stormtalon':     { role:'Vanguard',lore:'Part eagle, part lion — built to strike from height and shred what it lands on. The Stormtalon dives hard and fast, trading finesse for raw aggression. Defenders rarely get a second pass to adjust.', ability:'Lightning Strike — always strikes first, even when defending; if that first strike kills, no counter-strike occurs.' },
  'Stoneback':      { role:'Vanguard',lore:'The Stoneback\'s hide has fossilised over decades of taking hits. Slower and tougher than most Beast units, it doesn\'t chase opponents — it stands in their way. Exceptional defensive stats for the archetype, trades raw damage for staying power.', ability:'Granite Hide — gains +2 DEF per tile you currently own (recalculated each battle).' },

  // ── NATURE (new) ──
  'Briar Sprite':   { role:'Assailant',lore:'A knot of razor thorns compressed into something almost the size of a small animal. The Briar Sprite launches itself at opponents with unnerving speed, shredding at the point of impact before anything can react. It doesn\'t survive long, but it doesn\'t need to.', ability:'Nature\'s Fury — grants +5 ATK to all friendly Nature-type summons stationed anywhere on the board.' },
  'Vine Stalker':   { role:'Vanguard',lore:'The Vine Stalker moves through terrain like water through cracks, arriving exactly where it\'s least expected. Attack-forward for a Nature unit, it combines mobility with enough toughness to hold what it takes.', ability:'Verdant Surge — after 5 rounds stationed, permanently grants +3 ATK to all friendly stationed summons (clock resets if redeployed).' },
  'Moss Golem':     { role:'Vanguard',lore:'Built from centuries of accumulated forest material, the Moss Golem is slow but deeply difficult to remove from a tile it has claimed. Prioritises defensive durability above all — the kind of unit that is still standing long after the board around it has changed completely.', ability:'Stone Skin — after 5 rounds stationed, permanently grants +5 DEF to all friendly stationed summons (clock resets if redeployed).' },

  // ── DUAL-ELEMENT RARES ──
  'Luminar Operative': { role:'Rare · Light / Arcane', lore:'The Luminar Operative exists at the intersection of divine radiance and arcane precision — a being that channels both orders of power without contradiction. Its Light unravels Undead bindings while its Arcane precision dismantles Dark sorcery. Enemies on either front find it an equally punishing opponent, with no easy angle of attack in return.', ability:'Dual Element: 2× vs Undead & Dark. Mutual weaknesses cancel — no weak side.\nLuminary Field — all friendly summons stationed on a Light or Arcane tile gain +2 ATK and +2 DEF.' },
  'Hex Stalker':     { role:'Rare · Undead / Beast', lore:'When a predator dies cursed, something worse comes back. The Hex Stalker retains the feral hunting instincts of the creature it was, now fused with the relentless persistence of the undead. It haunts the edges of the board — its Undead essence dismantles Arcane constructs while its Beast fury tears through Nature\'s endurance, indifferent to everything else.', ability:'Dual Element: 2× vs Arcane & Nature. Mutual weaknesses cancel — no weak side.\nHex Dominion — all friendly summons stationed on an Undead or Beast tile gain +2 ATK and +2 DEF.' },
  'Verdant Sorcerer':{ role:'Rare · Arcane / Nature', lore:'A practitioner who stopped drawing the line between learned magic and wild magic a long time ago. The Verdant Sorcerer has grown roots into both traditions deep enough that neither feels like a compromise. It dismantles Dark sorcery with arcane counter-magic and devours Light with nature\'s hunger — a pairing most opponents never see coming.', ability:'Dual Element: 2× vs Dark & Light. Mutual weaknesses cancel — no weak side.\nVerdant Surge — all friendly summons stationed on an Arcane or Nature tile gain +2 ATK and +2 DEF.' },
};

// ─── CARD DETAIL OVERLAY ────────────────────────────────────────────────────
// v0.5.06: SHARED DETAIL SHEET — one swipeable detail view for every card picker.
// openDetailSheet(items, startIdx, actionFor, opts)
//   items     : array of monster objects (swipe order)
//   startIdx  : index of the tapped card (sheet opens on it)
//   actionFor : (m) => { label, kind:'primary'|'gold', disabled, reason, hint, run } | null (read-only)
//   opts.title: header label
// Swipe left/right (stops at the ends), arrows for desktop, dots + "n / N" counter,
// next card peeks at the edge. Action taps are ignored for 250ms after a swipe settles.
let _ds = null;
const DS_SLIDE_GAP = 12, DS_PEEK = 22, DS_SWIPE_MS = 260, DS_TAP_LOCK_MS = 250;

function _dsContextKey() {
  return G ? `${G.phase}|${G.currentPlayer}|${G.turnCount}` : '';
}

function _cardDetailBody(m) {
  const isSupport = m.rarity === 'support';
  const SUPC = '#9aabbc';
  const lore = MONSTER_LORE[m.name] || { role: isSupport ? 'Support Card' : (m.archetype || ''), lore: isSupport ? 'A neutral support card with no elemental affiliation. Station it on any tile to activate its passive aura. The effect persists as long as it remains stationed, and stacks with additional copies.' : 'A mysterious creature of unknown origin.', ability: isSupport ? (m.supportDesc || null) : null };
  const elColor = isSupport ? SUPC : (TYPE_COLOR[m.type] || 'var(--accent)');
  const hpPct = Math.round((m.hp / m.maxHp) * 100);
  const strongType = TYPE_STRONG[m.type];
  const weakType   = TYPE_WEAK[m.type];

  return `
      <!-- Large card centered -->
      <div style="display:flex;justify-content:center;margin-bottom:20px;">
        <div style="transform:scale(1.5);transform-origin:top center;margin-bottom:100px;">
          ${renderCard(m, {size:'full', showCost:true})}
        </div>
      </div>

      <!-- Monster info block -->
      <div style="background:var(--surface);border:1px solid ${elColor}44;border-radius:14px;padding:18px;margin-top:8px;">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px;">
          <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:${elColor};">${m.name}</div>
          ${m.isSpecial ? `<div style="font-size:9px;color:var(--gold-glow);font-family:'Cinzel',serif;letter-spacing:.1em;">✦ SPECIAL</div>` : ''}
          ${m.rarity === 'rare' ? `<div style="font-size:9px;color:#c8aaff;font-family:'Cinzel',serif;letter-spacing:.1em;">★ RARE</div>` : ''}
          ${isSupport ? `<div style="font-size:9px;color:${SUPC};font-family:'Cinzel',serif;letter-spacing:.1em;">◈ SUPPORT</div>` : ''}
        </div>
        <div style="font-size:10px;color:var(--text-mute);letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px;">${m.rarity === 'rare' || isSupport ? lore.role : `${lore.role} · <span style="color:${elColor}">${m.type}</span>`}</div>

        <!-- Stat row -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;">
          ${[['⚔','ATK',m.atk],['🛡','DEF',m.def],['✦','GEN',m.gen],['💰','COST',m.cost]].map(([icon,label,val]) => `
            <div style="background:var(--surface2);border-radius:8px;padding:8px 4px;text-align:center;">
              <div style="font-size:14px;line-height:1;">${icon}</div>
              <div style="font-size:16px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums;">${val ?? '—'}</div>
              <div style="font-size:8px;color:var(--text-mute);letter-spacing:.1em;">${label}</div>
            </div>
          `).join('')}
        </div>

        <!-- HP bar -->
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-mute);margin-bottom:4px;">
            <span>HP</span><span>${m.hp} / ${m.maxHp}</span>
          </div>
          <div style="height:5px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;">
            <div style="height:100%;width:${hpPct}%;border-radius:3px;background:${hpPct > 50 ? '#4fa355' : hpPct > 25 ? '#c9a028' : '#b84a4a'};transition:width .3s;"></div>
          </div>
        </div>

        <!-- Type matchup / Support Effect -->
        <div style="margin-bottom:14px;padding:10px 12px;background:var(--surface2);border-radius:10px;font-size:11px;line-height:1.6;">
          ${isSupport ? `
          <div style="color:${SUPC};font-size:9px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;">Support Effect</div>
          <div style="color:${SUPC};font-size:13px;font-weight:600;">${m.supportDesc || '—'}</div>
          <div style="color:var(--text-mute);font-size:10px;margin-top:6px;">Stacks with each additional copy stationed. Destroyed when HP reaches 0 — buff is lost.</div>
          ` : `
          <div style="color:var(--text-mute);font-size:9px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;">Type Matchup</div>
          ${m.rarity === 'rare' ? (() => {
            const TS = {Light:'Undead',Dark:'Beast',Arcane:'Dark',Undead:'Arcane',Beast:'Nature',Nature:'Light'};
            const TW = {Light:'Nature',Dark:'Arcane',Arcane:'Undead',Undead:'Light',Beast:'Dark',Nature:'Beast'};
            const ALL = ['Light','Dark','Arcane','Undead','Beast','Nature'];
            function singleMod(at, dt) { return TS[at]===dt?2:TW[at]===dt?0.5:1; }
            const strongs=[], weaks=[];
            for (const dt of ALL) {
              const mod1 = singleMod(m.type, dt);
              const mod2 = m.type2 ? singleMod(m.type2, dt) : mod1;
              const best = Math.max(mod1, mod2);
              if (best > 1) strongs.push(dt);
              else if (best < 1) weaks.push(dt);
            }
            return strongs.map(s => `<div><span style="color:${TYPE_COLOR[s]||'#7dba81'}">▲ Strong vs ${s}</span> <span style="color:var(--text-mute);font-size:10px;">(2× dmg)</span></div>`).join('')
              + (weaks.length ? weaks.map(w => `<div><span style="color:#e08080">▼ Weak vs ${w}</span> <span style="color:var(--text-mute);font-size:10px;">(0.5× dmg)</span></div>`).join('') : `<div style="color:var(--text-mute);font-size:10px;">◆ No weaknesses — dual elements cancel</div>`);
          })() : `
          <div><span style="color:${TYPE_COLOR[strongType] || '#7dba81'}">▲ Strong vs ${strongType || '—'}</span> <span style="color:var(--text-mute);font-size:10px;">(2× dmg)</span></div>
          <div><span style="color:${TYPE_COLOR[weakType] || '#e08080'}">▼ Weak vs ${weakType || '—'}</span> <span style="color:var(--text-mute);font-size:10px;">(0.5× dmg)</span></div>`}
          `}
        </div>

        ${lore.ability ? `
        <!-- Special/Rare ability -->
        <div style="margin-bottom:14px;padding:10px 12px;background:${m.rarity==='rare'?'rgba(145,132,217,.12)':m.isSpecial?'rgba(169,123,64,.12)':'var(--surface2)'};border:1px solid ${m.rarity==='rare'?'rgba(145,132,217,.3)':m.isSpecial?'rgba(169,123,64,.3)':elColor+'44'};border-radius:10px;">
          <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:${m.rarity==='rare'?'#c8aaff':m.isSpecial?'var(--gold-glow)':elColor};font-family:'Cinzel',serif;margin-bottom:5px;">${m.rarity==='rare'?'★ Rare Ability':m.isSpecial?'✦ Ascendant Ability':'◆ Ability'}</div>
          <div style="font-size:12px;color:var(--text);line-height:1.5;">${lore.ability}</div>
        </div>` : ''}

        ${m.isSpecial ? (() => {
          // v0.5.27: Ascendant unlock condition on the detail sheet
          const cond = m.conditionDesc || ASCENDANT_CONDITIONS[m.name] || '';
          if (!cond) return '';
          const st = m.canUse === true ? `<span style="color:#7dba81">✓ Met</span>` : m.canUse === false ? `<span style="color:#e08080">🔒 Not met</span>` : '';
          return `<div style="margin-bottom:14px;padding:10px 12px;background:rgba(169,123,64,.08);border:1px dashed rgba(169,123,64,.45);border-radius:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-glow);font-family:'Cinzel',serif;margin-bottom:5px;"><span>⛩ Unlock Condition</span>${st ? `<span style="font-family:inherit;letter-spacing:.08em">${st}</span>` : ''}</div>
            <div style="font-size:12px;color:var(--text);line-height:1.5;">${cond}</div>
            <div style="font-size:10px;color:var(--text-mute);margin-top:4px;">Checked each time you try to station it.</div>
          </div>`;
        })() : ''}

        <!-- Lore text -->
        <div>
          <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-mute);font-family:'Cinzel',serif;margin-bottom:8px;">Lore</div>
          <div style="font-size:12px;color:var(--text-dim);line-height:1.65;font-style:italic;">${lore.lore}</div>
        </div>
      </div>

  `;
}

function openDetailSheet(items, startIdx, actionFor, opts = {}) {
  closeCardDetail();
  if (!items || !items.length) return;
  _ds = {
    items, actionFor: actionFor || null,
    idx: Math.max(0, Math.min(startIdx || 0, items.length - 1)),
    title: opts.title || 'Card Detail',
    renderItem: opts.renderItem || _cardDetailBody,
    onChange: opts.onChange || null,
    onClose: opts.onClose || null,
    colorOf: opts.colorOf || (m => (m.rarity === 'support') ? '#9aabbc' : (TYPE_COLOR[m.type] || 'var(--accent)')),
    keyFn: opts.keyFn || _dsContextKey,
    key: (opts.keyFn || _dsContextKey)(),
    lockUntil: 0,
  };

  const overlay = document.createElement('div');
  overlay.id = 'card-detail-overlay';
  overlay.className = 'ds-overlay';
  overlay.innerHTML = `
    <div class="ds-top">
      <div class="ds-title" id="ds-title">${_ds.title}</div>
      <div class="ds-count" id="ds-count"></div>
      <button class="ds-x" onclick="closeCardDetail()" aria-label="Close">✕</button>
    </div>
    <div class="ds-viewport" id="ds-viewport">
      <div class="ds-track" id="ds-track">
        ${items.map(m => `<div class="ds-slide"><div class="ds-slide-inner">${_ds.renderItem(m)}</div></div>`).join('')}
      </div>
      ${items.length > 1 ? `
      <button class="ds-arrow ds-arrow-l" id="ds-arrow-l" onclick="dsGo(-1)" aria-label="Previous">‹</button>
      <button class="ds-arrow ds-arrow-r" id="ds-arrow-r" onclick="dsGo(1)" aria-label="Next">›</button>` : ''}
    </div>
    ${items.length > 1 && items.length <= 12 ? `<div class="ds-dots" id="ds-dots">${items.map((_, i) => `<span class="ds-dot" onclick="dsGoTo(${i})"></span>`).join('')}</div>` : ''}
    ${_ds.actionFor ? `<div class="ds-actions" id="ds-actions"></div>` : ''}
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCardDetail(); });
  document.body.appendChild(overlay);

  _dsAttachSwipe();
  window.addEventListener('resize', _dsLayout);
  document.addEventListener('keydown', _dsKey);
  _dsLayout(false);
  _dsUpdateChrome();
}

function _dsSlideW() {
  const vp = document.getElementById('ds-viewport');
  return vp ? vp.clientWidth - DS_PEEK * 2 : 300;
}

function _dsLayout(animate = true, dragPx = 0) {
  const track = document.getElementById('ds-track');
  if (!track || !_ds) return;
  const w = _dsSlideW();
  track.querySelectorAll('.ds-slide').forEach(sl => { sl.style.width = w + 'px'; sl.style.marginRight = DS_SLIDE_GAP + 'px'; });
  const x = DS_PEEK - _ds.idx * (w + DS_SLIDE_GAP) + dragPx;
  track.style.transition = animate ? `transform ${DS_SWIPE_MS}ms cubic-bezier(.2,.8,.2,1)` : 'none';
  track.style.transform = `translateX(${x}px)`;
}

function _dsUpdateChrome() {
  if (!_ds) return;
  const n = _ds.items.length, i = _ds.idx, m = _ds.items[i];
  const cnt = document.getElementById('ds-count');
  if (cnt) cnt.textContent = n > 1 ? `${i + 1} / ${n}` : '';
  const title = document.getElementById('ds-title');
  if (title) title.style.color = _ds.colorOf(m);
  if (_ds.onChange && _ds._lastChanged !== m) { _ds._lastChanged = m; try { _ds.onChange(m); } catch (e) {} }
  document.querySelectorAll('#ds-dots .ds-dot').forEach((d, k) => d.classList.toggle('on', k === i));
  const l = document.getElementById('ds-arrow-l'), r = document.getElementById('ds-arrow-r');
  if (l) l.classList.toggle('hidden', i === 0);
  if (r) r.classList.toggle('hidden', i === n - 1);
  document.querySelectorAll('#ds-track .ds-slide').forEach((sl, k) => sl.classList.toggle('active', k === i));

  const box = document.getElementById('ds-actions');
  if (box && _ds.actionFor) {
    const act = _ds.actionFor(m);
    if (!act) { box.innerHTML = ''; return; }
    box.innerHTML = `
      ${act.reason ? `<div class="ds-reason">${act.reason}</div>` : act.hint ? `<div class="ds-hint">${act.hint}</div>` : ''}
      <button class="action-btn ${act.kind === 'gold' ? 'gold-btn' : 'primary'} ds-act-btn ds-k-${act.kind || 'primary'}"
        ${act.disabled ? 'disabled' : ''} onclick="_dsAction()">${act.label}</button>`;
  }
}

function dsGoTo(i) {
  if (!_ds) return;
  const n = Math.max(0, Math.min(i, _ds.items.length - 1));   // stop at ends, no wrap
  _ds.idx = n;
  _ds.lockUntil = Date.now() + DS_SWIPE_MS + DS_TAP_LOCK_MS;
  _dsLayout(true);
  _dsUpdateChrome();
}
function dsGo(dir) { if (_ds) dsGoTo(_ds.idx + dir); }

function _dsKey(e) {
  if (!_ds) return;
  if (e.key === 'ArrowLeft') dsGo(-1);
  else if (e.key === 'ArrowRight') dsGo(1);
  else if (e.key === 'Escape') closeCardDetail();
}

function _dsAttachSwipe() {
  const vp = document.getElementById('ds-viewport');
  if (!vp) return;
  let sx = 0, sy = 0, axis = null, dx = 0, t0 = 0, active = false;
  vp.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    axis = null; dx = 0; t0 = Date.now(); active = true;
  }, { passive: true });
  vp.addEventListener('touchmove', (e) => {
    if (!active || !_ds) return;
    const mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
    if (!axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    }
    if (axis !== 'x') return;
    e.preventDefault();
    dx = mx;
    const atEnd = (_ds.idx === 0 && dx > 0) || (_ds.idx === _ds.items.length - 1 && dx < 0);
    _dsLayout(false, atEnd ? dx * 0.3 : dx);   // rubber-band at the ends
    _ds.lockUntil = Date.now() + 10000;        // block taps mid-drag
  }, { passive: false });
  const end = () => {
    if (!active || !_ds) return;
    active = false;
    if (axis !== 'x') return;
    const fast = Math.abs(dx) > 25 && (Date.now() - t0) < 250;
    if (Math.abs(dx) > _dsSlideW() * 0.22 || fast) dsGoTo(_ds.idx + (dx < 0 ? 1 : -1));
    else dsGoTo(_ds.idx);
  };
  vp.addEventListener('touchend', end);
  vp.addEventListener('touchcancel', end);
}

function _dsAction() {
  if (!_ds || !_ds.actionFor) return;
  if (Date.now() < _ds.lockUntil) return;     // accidental tap right after a swipe
  const m = _ds.items[_ds.idx];
  const act = _ds.actionFor(m);
  if (!act || act.disabled) return;
  _ds.onClose = null;          // acted — not a dismissal
  closeCardDetail();
  act.run(m);
}

// Hand strip tap. During my shop phase it opens in Sell mode; otherwise read-only browse.
function showCardDetail(iid) {
  const i = myHand.findIndex(x => x.iid === iid);
  if (i < 0) return;
  if (G && G.phase === 'shop' && G.currentPlayer === myIdx) { openShopDetail('sell', i); return; }
  openDetailSheet(myHand, i, null, { title: 'Your Hand' });
}

function closeCardDetail() {
  const el = document.getElementById('card-detail-overlay');
  if (el) el.remove();
  if (_ds && _ds.onClose) { const f = _ds.onClose; _ds.onClose = null; try { f(); } catch (e) {} }
  window.removeEventListener('resize', _dsLayout);
  document.removeEventListener('keydown', _dsKey);
  _ds = null;
}

// ─── SHOP DETAIL CONTEXTS (v0.5.06) ─────────────────────────────────────────
function _sellValue(m) { return Math.round(m.cost * (m.hp / m.maxHp)); }

function _shopBuyAction(m) {
  const me = G.players[myIdx];
  const price = m.price ?? m.cost;   // v0.5.60: Levy / Bargain / Patronage
  const label = price === m.cost ? `Buy · ${price} ✦` : `Buy · ${price} ✦ (was ${m.cost})`;
  if (myHand.length >= 5) return { label, kind:'primary', disabled:true, reason:'Hand full (5/5) — sell a summon first' };
  if (me.mana < price)  return { label, kind:'primary', disabled:true, reason:`Need ${price - me.mana} more ✦ (you have ${me.mana})` };
  return { label, kind:'primary', run: (mm) => { selectedIid = mm.iid; doBuy(); } };
}

function _shopSellAction(m) {
  const sv = _sellValue(m);
  const hint = m.hp < m.maxHp ? `Value scales with HP (${m.hp}/${m.maxHp})` : '';
  return { label: `Sell · +${sv} ✦`, kind:'gold', hint, run: (mm) => { selectedIid = mm.iid; doSell(); } };
}

function openShopDetail(mode, idx) {
  if (mode === 'sell') openDetailSheet(myHand, idx, _shopSellAction, { title: 'Selling from Hand' });
  else openDetailSheet(G.shopOffers, idx, _shopBuyAction, { title: 'Shop' });
}

// ─── SCROLL NAVIGATION HELPERS ──────────────────────────────────────────────
function shopScroll(scrollId, dotPrefix, count, dir) {
  const el = document.getElementById(scrollId);
  if (!el) return;
  el.scrollBy({left: dir * 140, behavior: 'smooth'});
}
function attachShopScrollListener(scrollId, dotPrefix, count) {
  const el = document.getElementById(scrollId);
  if (!el) return;
  el.onscroll = () => updateScrollDots(scrollId, dotPrefix, count);
  updateScrollDots(scrollId, dotPrefix, count);
}
function updateScrollDots(scrollId, dotPrefix, count) {
  const el = document.getElementById(scrollId);
  if (!el) return;
  const idx = Math.min(Math.round(el.scrollLeft / 140), count - 1);
  for (let i = 0; i < count; i++) {
    const d = document.getElementById(`${dotPrefix}-${i}`);
    if (d) d.classList.toggle('active', i === idx);
  }
}
function scrollNavHTML(scrollId, dotPrefix, count) {
  if (count <= 1) return '';
  const dots = Array.from({length: count}, (_, i) => `<div id="${dotPrefix}-${i}" class="shop-dot${i===0?' active':''}"></div>`).join('');
  return `<div class="shop-scroll-nav">
    <button class="shop-arrow" onclick="shopScroll('${scrollId}','${dotPrefix}',${count},-1)">‹</button>
    <div class="shop-dots">${dots}</div>
    <button class="shop-arrow" onclick="shopScroll('${scrollId}','${dotPrefix}',${count},1)">›</button>
  </div>`;
}
