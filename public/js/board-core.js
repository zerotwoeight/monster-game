// board-core.js: split from the inline page script (L2). Loaded in order by board.html; all files share one global scope.

'use strict';

// ─── Background image ────────────────────────────────────────────────────────────────────────────────
const BKG_SRC = "/img/backgrounds/bkg_1140.png";

// ─── AUDIO SETTINGS (v0.5.05) ─────────────────────────────────────────────────
// Per-device Music + Sound-effect levels, saved in this browser (host and every
// spectator keep their own). Level 0–1 multiplies each sound's built-in base volume.
const AUD = (() => {
  const d = { music: 1, sfx: 1, voice: 1, musicMute: false, sfxMute: false, voiceMute: false }; // v0.6.22: + voice
  try { Object.assign(d, JSON.parse(localStorage.getItem('sg_audio_board') || '{}')); } catch(e) {}
  return d;
})();
function _saveAud() { try { localStorage.setItem('sg_audio_board', JSON.stringify(AUD)); } catch(e) {} }
function _musicLvl() { return AUD.musicMute ? 0 : Math.max(0, Math.min(1, +AUD.music || 0)); }
function _sfxLvl()   { return AUD.sfxMute   ? 0 : Math.max(0, Math.min(1, +AUD.sfx   || 0)); }
function _voiceLvl() { return AUD.voiceMute ? 0 : Math.max(0, Math.min(1, AUD.voice == null ? 1 : +AUD.voice)); }

// ─── SFX (Web Audio API — procedural, no external files) ─────────────────────────────────────────────
const SFX = (() => {
  let _ctx = null;
  function ctx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume().catch(()=>{});
    return _ctx;
  }
  document.addEventListener('click',   () => ctx(), {once:true, capture:true});
  document.addEventListener('keydown', () => ctx(), {once:true, capture:true});

  function tone(freq, type='sine', vol=0.15, dur=0.12, attack=0.005, rel=0.1, delay=0) {
    const L = _sfxLvl(); if (L <= 0) return; vol = Math.max(0.0012, vol * L);
    try {
      const c = ctx(), now = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type; o.frequency.setValueAtTime(freq, now + delay);
      g.gain.setValueAtTime(0.001, now + delay);
      g.gain.linearRampToValueAtTime(vol, now + delay + attack);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      o.start(now + delay); o.stop(now + delay + dur + 0.02);
    } catch(e){}
  }
  function noise(vol=0.08, dur=0.1, delay=0, hipass=0) {
    const L = _sfxLvl(); if (L <= 0) return; vol = Math.max(0.0012, vol * L);
    try {
      const c = ctx(), now = c.currentTime;
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
      const src = c.createBufferSource(); src.buffer = buf;
      const g = c.createGain();
      if (hipass) {
        const f = c.createBiquadFilter(); f.type='highpass'; f.frequency.value=hipass;
        src.connect(f); f.connect(g);
      } else { src.connect(g); }
      g.connect(c.destination);
      g.gain.setValueAtTime(vol, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      src.start(now + delay); src.stop(now + delay + dur + 0.02);
    } catch(e){}
  }

  return {
    unlock() { ctx(); },
    // Die cycling tick — wooden click
    dieTick() {
      noise(0.06, 0.035, 0, 800);
      tone(180, 'square', 0.035, 0.035, 0.001, 0.03);
    },
    // Die lands — weighted thud, scales with value
    dieLand(val=3) {
      noise(0.18, 0.18);
      tone(55 + val*10, 'sine', 0.28, 0.35, 0.002, 0.32);
      tone(110 + val*18, 'triangle', 0.12, 0.22, 0.002, 0.20);
    },
    // Token hop — soft footstep per tile
    tokenHop() {
      noise(0.04, 0.04, 0, 600);
      tone(320, 'sine', 0.065, 0.07, 0.002, 0.065);
    },
    // Token arrives at destination — ascending chime
    tokenArrive() {
      tone(660,  'sine', 0.14, 0.35, 0.005, 0.32);
      tone(880,  'sine', 0.09, 0.28, 0.004, 0.25, 0.05);
      tone(1100, 'sine', 0.055,0.22, 0.003, 0.20, 0.10);
    },
    // Battle engaged — low dramatic swell
    battleStart() {
      noise(0.14, 0.5);
      tone(65,  'sawtooth', 0.18, 0.55, 0.025, 0.50);
      tone(130, 'sawtooth', 0.09, 0.45, 0.020, 0.42, 0.12);
      tone(390, 'sine',     0.07, 0.35, 0.010, 0.32, 0.22);
    },
    // Attacker wins — triumphant ascending triad
    battleWin() {
      tone(440, 'sine', 0.20, 0.22, 0.005, 0.20);
      tone(554, 'sine', 0.17, 0.22, 0.005, 0.20, 0.20);
      tone(660, 'sine', 0.20, 0.40, 0.005, 0.36, 0.40);
      noise(0.06, 0.18, 0.35);
    },
    // Defender wins — descending defeat
    battleLose() {
      tone(330, 'sawtooth', 0.16, 0.22, 0.005, 0.20);
      tone(277, 'sawtooth', 0.14, 0.22, 0.005, 0.20, 0.22);
      tone(207, 'sine',     0.16, 0.50, 0.005, 0.46, 0.44);
      noise(0.08, 0.25, 0.40);
    },
    // Mutual destruction — crash + burst
    battleMutual() {
      noise(0.22, 0.45);
      tone(140, 'sawtooth', 0.18, 0.55, 0.001, 0.50);
      tone(200, 'square',   0.10, 0.42, 0.001, 0.38, 0.06);
    },
    // Stalemate — unresolved wobble
    battleStalemate() {
      tone(370, 'sine', 0.13, 0.18, 0.005, 0.15);
      tone(350, 'sine', 0.11, 0.18, 0.005, 0.15, 0.22);
      tone(370, 'sine', 0.09, 0.22, 0.005, 0.20, 0.44);
    },
    // Claim tile — place + chime
    claimTile() {
      noise(0.08, 0.12, 0, 200);
      tone(480, 'sine', 0.10, 0.18, 0.003, 0.15);
      tone(720, 'sine', 0.065,0.14, 0.002, 0.12, 0.10);
    },
    // v0.6.01: claim fanfare — land, slide, seat + rising triad
    claimFanfare() {
      noise(0.10, 0.12, 0.34, 180);                          // card lands on the board
      tone(130, 'sine', 0.16, 0.22, 0.004, 0.20, 0.34);
      noise(0.05, 0.25, 0.55, 2500);                         // slide
      tone(110, 'sine', 0.22, 0.30, 0.004, 0.28, 0.92);      // seats in the slot
      tone(523, 'triangle', 0.09, 0.30, 0.004, 0.26, 0.96);
      tone(659, 'triangle', 0.08, 0.30, 0.004, 0.26, 1.04);
      tone(784, 'triangle', 0.08, 0.45, 0.004, 0.40, 1.12);
    },
    // v0.6.01: dice rolling — short bright clicks while tumbling (r = 0..1 random pitch)
    diceRattle(r=0.5) {
      noise(0.09, 0.025, 0, 1800 + r*1400);
      tone(900 + r*700, 'square', 0.022, 0.02, 0.001, 0.018);
    },
    // v0.6.01: dice hitting the table — woody clack, softer on each later bounce
    diceClack(j=0) {
      const v = [1, .7, .45][j] || .4;
      noise(0.20*v, 0.05, 0, 500);
      tone(240 - j*30, 'triangle', 0.16*v, 0.07, 0.001, 0.06);
      tone(1200, 'square', 0.03*v, 0.02, 0.001, 0.015);
    },
    // v0.6.10: Tier 2 sounds
    takeover() {
      noise(0.16, 0.18, 0, 1200);                                 // crack
      tone(98, 'sawtooth', 0.10, 0.30, 0.004, 0.26);
      tone(392, 'triangle', 0.08, 0.25, 0.004, 0.22, 0.30);       // new owner rises
      tone(587, 'triangle', 0.08, 0.35, 0.004, 0.32, 0.40);
    },
    shieldHeld() {
      tone(220, 'square', 0.06, 0.25, 0.002, 0.22);               // clang
      tone(660, 'triangle', 0.10, 0.50, 0.002, 0.46);
      tone(990, 'sine', 0.05, 0.45, 0.002, 0.40, 0.04);
    },
    chestOpen() {
      noise(0.08, 0.12, 0, 900);
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, 'triangle', 0.07, 0.25, 0.003, 0.22, 0.10 + i * 0.07));
    },
    wellFountain() {
      noise(0.07, 0.6, 0, 2500);
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 'sine', 0.06, 0.30, 0.003, 0.26, i * 0.08));
    },
    templeChoir() {
      [261, 329, 392, 523].forEach((f, i) => tone(f, 'sine', 0.05, 1.2, 0.25, 0.9, i * 0.05));
    },
    healChime() {
      tone(880, 'sine', 0.05, 0.30, 0.004, 0.26);
      tone(1320, 'sine', 0.04, 0.35, 0.004, 0.30, 0.08);
    },
    // v0.6.20: Tier 3 sounds
    wildCardFly() { noise(0.06, 0.5, 0, 1800); tone(330, 'sine', 0.05, 0.5, 0.2, 0.3); },
    // v0.6.26: Wild Card table — card flick per deal (Gilded lands heavier), soft whoosh on a pass
    wildCardDeal(i=0) {
      noise(0.07, 0.09, 0, 3200); tone(200 + i * 60, 'triangle', 0.05, 0.12, 0.002, 0.10, 0.02);
      if (i === 2) { noise(0.12, 0.22, 0.02, 0); tone(70, 'sine', 0.18, 0.45, 0.004, 0.40, 0.02); }
    },
    wildCardLive() { [392, 523, 659].forEach((f, j) => tone(f, 'sine', 0.035, 0.6, 0.05, 0.5, j * 0.07)); },
    wildCardPass() { noise(0.06, 0.45, 0, 900); tone(220, 'sine', 0.03, 0.4, 0.01, 0.35); },
    wildCardReveal(tier='low') {
      const base = tier === 'high' ? 392 : tier === 'mid' ? 466 : 523;
      [1, 1.25, 1.5, 2].forEach((m, i) => tone(base * m, tier === 'high' ? 'sawtooth' : 'triangle', tier === 'high' ? 0.06 : 0.07, 0.35, 0.004, 0.30, i * 0.06));
      if (tier === 'high') { noise(0.14, 0.35, 0, 200); tone(65, 'sine', 0.22, 0.6, 0.004, 0.55); }
    },
    shatterBurst() { noise(0.18, 0.3, 0, 2000); tone(1568, 'square', 0.04, 0.15, 0.001, 0.12); tone(110, 'sawtooth', 0.10, 0.3, 0.004, 0.26, 0.05); },
    playerFallen() { tone(220, 'sawtooth', 0.10, 0.9, 0.01, 0.85); tone(165, 'sawtooth', 0.09, 1.0, 0.01, 0.95, 0.25); tone(110, 'sine', 0.16, 1.2, 0.01, 1.1, 0.5); },
    playerLeft() { tone(392, 'sine', 0.07, 0.5, 0.01, 0.45); tone(294, 'sine', 0.07, 0.6, 0.01, 0.55, 0.2); },
    crownFanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 'triangle', 0.08, i === 3 ? 0.5 : 0.18, 0.003, i === 3 ? 0.45 : 0.15, i * 0.1)); },
    // v0.6.00: doubles sting
    doubles() {
      tone(784, 'square', 0.05, 0.12, 0.002, 0.10);
      tone(1047,'square', 0.05, 0.12, 0.002, 0.10, 0.09);
      tone(1319,'triangle',0.07, 0.40, 0.003, 0.36, 0.18);
    },
  };
})();

// ─── Constants ────────────────────────────────────────────────────────────────────────────────
const TYPE_ICON   = {Light:'✦',Dark:'◉',Arcane:'✶',Undead:'☠',Beast:'⚔',Nature:'❧'};
const TYPE_WEAK   = {Light:'Nature',Dark:'Arcane',Arcane:'Undead',Undead:'Light',Beast:'Dark',Nature:'Beast'};
const PHASE_LABELS = {
  lobby:'Lobby',setup:'Setup Phase',shop:'Shop Phase',roll:'Roll Phase',
  'resolve:claim':'Claim Tile',stalemate:'Stalemate',
  'resolve:battle':'Battle!','resolve:own':'Own Tile',
  'resolve:chest':'Chest Opened','resolve:temple':'Temple',
  'resolve:heal_tile':'Healing Tile',game_over:'Game Over',
  'resolve:wildcard_cards':'🃏 Wild Card',
  'resolve:wildcard_target':'🃏 Wild Card',
  'resolve:wildcard_coup_tile':'🃏 Coup — Pick Tile',
  'resolve:wildcard_coup_summon':'🃏 Coup — Deploy',
  'resolve:wildcard_shatter':'🃏 Shatter',
  'resolve:landing':'Choose Landing',
  'resolve:turn_summary':'Turn Summary',
  'resolve:battle_result':'Battle Result',
  'resolve:round_callout':'Round Callout',
  'sanction:pick_tile':'⛓ Sanction Turn','sanction:own':'⛓ Sanction Turn','sanction:omen':'⛓ Sanction Turn','sanction:reveal':'⛓ Sanction Turn','resolve:veil':'🌫 Veil of Stillness'   // v0.6.33
};

// ─── State ────────────────────────────────────────────────────────────────────────────────
let G = null;
let ws = null;
let boardPrevPhase = null;           // tracks phase to detect roll completion
let boardPrevCurrentPlayer = null;   // tracks player to avoid cross-turn false triggers
let boardRollAnimating = false;      // true while die cycles + holds
let boardPendingG = null;            // state received during animation
let boardShowIdleDie = false;        // forces idle die even in battle phase
let boardTokenAnim = null;           // {playerIdx, path:[tileIdxs], step} — hop-by-hop movement
let reconnectTimer = null;
let selectedTile = null;
let selectedRoundLimit = 20;
// Persist room code across WebSocket reconnects so we always rejoin the same room.
// Initialised from ?room=CODE in the URL; updated when we first receive a state with a code.
let savedRoomCode = new URLSearchParams(location.search).get('room') || '';
// Spectator mode — set when page loaded at /spectate
const isSpectator = window.location.pathname.includes('/spectate');
let spectatorJoined = false; // true once spectate_connect is acknowledged
const isEmbed = new URLSearchParams(location.search).get('embed') === 'true'; // desktop mode — skip spectator join UI, auto-connect
// Tile element cache — keeps img/GIF elements alive across renders
// so token moves don't cause image flicker or GIF restarts
const tileElCache = new Map(); // tileIdx → { el: HTMLElement, contentKey: string }

// ─── SVG art generators ──────────────────────────────────────────────────────────────────────

// v0.5.02: board send helper (matches player.html send signature)
function send(action, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action, ...data }));
}

const SVG_FNS = {Light:svgLight,Dark:svgDark,Arcane:svgArcane,Undead:svgUndead,Beast:svgBeast,Nature:svgNature};
function artSVG(type,w,h){ const c=TYPE_COLOR[type]||'#9397ab'; const fn=SVG_FNS[type]; return fn?fn(c,w,h):''; }

function renderBoardCard(m, hpOverride) {
  if (!m) return '';
  const isRare    = m.rarity === 'rare';
  const isSupport = m.rarity === 'support';
  const SUPPORT_COLOR = '#9aabbc';
  const c  = isSupport ? SUPPORT_COLOR : (TYPE_COLOR[m.type]  || '#9184d9');
  const c2 = m.type2 ? (TYPE_COLOR[m.type2] || '#9184d9') : null;
  const displayHp = (hpOverride !== undefined) ? Math.max(0, hpOverride) : m.hp;
  const pct = Math.max(0, Math.min(1, displayHp / m.maxHp));
  const hpColor = pct < .35 ? '#b05050' : c;
  let border, shadow;
  if (isSupport) {
    border = SUPPORT_COLOR;
    shadow = `box-shadow:0 0 0 2px ${SUPPORT_COLOR}99,0 0 18px ${SUPPORT_COLOR}33`;
  } else if (isRare) {
    border = c;
    shadow = `box-shadow:0 0 0 2px ${c}99,0 0 0 3.5px ${c2}66,0 0 22px ${c}44`;
  } else if (m.isSpecial) {
    border = `${c}cc`;
    shadow = `box-shadow:0 0 0 2.5px ${c}33,0 0 22px ${c}44`;
  } else {
    border = `${c}88`;
    shadow = `box-shadow:0 0 14px ${c}28`;
  }
  const art = m.id ? summonImg(m.id) : artSVG(m.type, 130, 186);
  const typeLabel = isSupport
    ? `<span style="color:${SUPPORT_COLOR}">Support</span>`
    : m.type2
      ? `<span style="color:${c}">${m.type}</span><span style="color:rgba(255,255,255,.4)">/</span><span style="color:${c2}">${m.type2}</span>`
      : `<span style="color:${c}">${m.type}</span>`;
  return `<div class="board-summon-card" style="border-color:${border};${shadow}">
    ${m.isSpecial ? `<div class="bmc-special">✦ Ascendant</div>` : ''}
    ${isRare ? `<div class="bmc-special" style="color:#c8aaff;border-color:rgba(200,170,255,.45);background:rgba(145,132,217,.18);">★ Rare</div>` : ''}
    ${isSupport ? `<div class="bmc-special" style="color:${SUPPORT_COLOR};border-color:${SUPPORT_COLOR}66;background:rgba(154,171,188,.15);">◈ Support</div>` : ''}
    ${m.charm ? `<div style="position:absolute;top:4px;right:4px;width:14px;height:14px;border-radius:50%;background:#c9a05a;box-shadow:0 0 8px #c9a05acc;z-index:3;display:flex;align-items:center;justify-content:center;font-size:8px;line-height:1;" title="Battle Charm">⚡</div>` : ''}
    <div class="bmc-art">${art}</div>
    <div class="bmc-overlay">
      <div class="bmc-name" style="color:${c}">${m.name}</div>
      <div class="bmc-hp-row"><div class="bmc-hp-track"><div class="bmc-hp-fill" style="width:${Math.round(pct*100)}%;background:${hpColor};transition:width .5s ease,background .5s ease;"></div></div><span class="bmc-hp-num">${displayHp}/${m.maxHp}</span></div>
      ${isSupport && m.supportDesc ? `<div style="font-size:7.5px;color:${SUPPORT_COLOR};text-align:center;line-height:1.3;margin-top:2px;padding:0 2px;">${m.supportDesc}</div>` : `<div class="bmc-stats">
        <div class="bmc-stat"><span class="bmc-stat-lbl">ATK</span><span class="bmc-stat-val">${m.atk}</span></div>
        <div class="bmc-stat"><span class="bmc-stat-lbl">DEF</span><span class="bmc-stat-val">${m.def}</span></div>
        <div class="bmc-stat"><span class="bmc-stat-lbl">TYPE</span><span class="bmc-stat-val" style="font-size:7px;">${typeLabel}</span></div>
      </div>`}
    </div>
  </div>`;
}

// ─── Player sigil SVG ──────────────────────────────────────────────────────────────────────────
function playerSigilSVG(player, size=20){
  const c = player.color;
  const i = (player.idx !== undefined ? player.idx : 0) % 6;
  const s = size;
  if(i===0){
    return `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="${c}33" stroke="${c}" stroke-width="2"/><circle cx="10" cy="10" r="3" fill="${c}" opacity=".85"/></svg>`;
  } else if(i===1){
    return `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><polygon points="10,2 18,10 10,18 2,10" fill="${c}44" stroke="${c}" stroke-width="1.8"/><polygon points="10,6 14,10 10,14 6,10" fill="${c}" opacity=".85"/></svg>`;
  } else if(i===2){
    return `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><polygon points="10,2 18.5,17.5 1.5,17.5" fill="${c}44" stroke="${c}" stroke-width="1.8"/><polygon points="10,7 15,16 5,16" fill="${c}" opacity=".85"/></svg>`;
  } else if(i===3){
    return `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><polygon points="10,1 12.5,7.5 19.5,7.5 14,12 16,18.5 10,14.5 4,18.5 6,12 0.5,7.5 7.5,7.5" fill="${c}55" stroke="${c}" stroke-width="1.2"/><polygon points="10,4.5 11.8,9.5 17,9.5 12.8,12.5 14.4,17.5 10,14.5 5.6,17.5 7.2,12.5 3,9.5 8.2,9.5" fill="${c}" opacity=".85"/></svg>`;
  } else if(i===4){
    const pts=(r,cy=10)=>Array.from({length:5},(_,j)=>{const a=j*72-90;return `${10+Math.cos(a*Math.PI/180)*r},${cy+Math.sin(a*Math.PI/180)*r}`;}).join(' ');
    return `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><polygon points="${pts(8.5)}" fill="${c}44" stroke="${c}" stroke-width="1.8"/><polygon points="${pts(4.5)}" fill="${c}" opacity=".85"/></svg>`;
  } else {
    const pts=r=>Array.from({length:6},(_,j)=>{const a=j*60-30;return `${10+Math.cos(a*Math.PI/180)*r},${10+Math.sin(a*Math.PI/180)*r}`;}).join(' ');
    return `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><polygon points="${pts(8.5)}" fill="${c}44" stroke="${c}" stroke-width="1.8"/><polygon points="${pts(4.5)}" fill="${c}" opacity=".85"/></svg>`;
  }
}
function playerTokenSVG(player, size=40){
  const i = ((player.idx !== undefined ? player.idx : 0) % 6) + 1;
  return `<img src="/img/players/Player${i}.svg" width="${size}" height="${size}" style="display:block;pointer-events:none;" alt="P${i}">`;
}

// ─── Tile mini summon card ─────────────────────────────────────────────────────────────────────
function tileSummonCard(summon, ownerColor){
  const c = TYPE_COLOR[summon.type] || '#9397ab';
  const pct = Math.max(0, Math.min(1, summon.hp / summon.maxHp));
  const hpColor = pct < 0.35 ? '#c05050' : pct < 0.6 ? '#c09040' : c;
  // Art: SVG base + try real summon image on top
  const svgArt = artSVG(summon.type, 54, 70);
  const imgLayer = summon.id
    ? `<img src="${monsterMiniSrc(summon.id)}" class="tmc-art-img-overlay" onerror="this.remove()" alt="">`
    : '';
  return `<div class="tmc-wrap" style="position:relative;">
    ${summon.charm ? `<div style="position:absolute;top:-5px;right:-5px;width:14px;height:14px;border-radius:50%;background:#c9a05a;box-shadow:0 0 7px #c9a05acc;z-index:5;display:flex;align-items:center;justify-content:center;font-size:8px;line-height:1;" title="Battle Charm">⚡</div>` : ''}
    ${(summon.shield || summon.disarmed) ? `<div class="tmc-marks">${summon.shield ? `<div class="tmc-mark tmc-${summon.shield}" title="${summon.shield === 'aegis' ? 'Aegis: next strike against it deals 0' : 'Parry: next strike against it is halved'}"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" fill="#fff" stroke="#1a1a28" stroke-width="1.2"/></svg></div>` : ''}${summon.disarmed ? `<div class="tmc-mark tmc-disarm" title="Disarmed: its next counter-strike deals 0"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M20 3 13.5 9.5M10.5 12.5 6 17" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M4 15l5 5M3 21l2-2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M11 8.5l3 6" stroke="#ffd0d0" stroke-width="1.6"/></svg></div>` : ''}</div>` : ''}
    <div class="tmc-card" style="border-color:${ownerColor};">
      <div class="tmc-art">${svgArt}${imgLayer}</div>
      <div class="tmc-strip" style="background:${c};"></div>
    </div>
    <div class="tmc-hp-wrap">
      <div class="tmc-hp-bar"><div class="tmc-hp-fill" style="width:${Math.round(pct*100)}%;background:${hpColor};"></div></div>
      <div class="tmc-hp-num" style="color:rgba(255,255,255,.9);">${summon.hp}/${summon.maxHp}</div>
    </div>
  </div>`;
}

// ─── Token hop animation ─────────────────────────────────────────────────────────────────
function getEffectivePosition(playerIdx) {
  if (boardTokenAnim && boardTokenAnim.playerIdx === playerIdx) {
    return boardTokenAnim.path[boardTokenAnim.step];
  }
  return G.players[playerIdx]?.position;
}

// Build a path array [fromPos, fromPos+1, ..., toPos] wrapping at 28
function buildHopPath(fromPos, toPos) {
  const N = 28;
  const path = [fromPos];
  let p = fromPos;
  let _hopSafety = 0;
  while (p !== toPos && _hopSafety < 30) {
    p = (p + 1) % N;
    path.push(p);
    _hopSafety++;
  }
  return path;
}

// Advance boardTokenAnim one step; call this every 230ms after the die lands
function advanceTokenAnim() {
  if (!boardTokenAnim) return;
  boardTokenAnim.step++;
  if (boardTokenAnim.step >= boardTokenAnim.path.length) {
    const _fp = boardTokenAnim.path[boardTokenAnim.path.length - 1], _fi = boardTokenAnim.playerIdx;
    boardTokenAnim = null; // animation done — token is now "settled"
    SFX.tokenArrive();
    // Phase-based landing sound cue
    if (G) {
      if (G.phase === 'resolve:battle') SFX.battleStart();
      else if (G.phase === 'resolve:claim') SFX.claimTile();
    }
    render();
    _fxHop(_fp, true, _fi);
    return;
  }
  SFX.tokenHop();
  render();
  _fxHop(boardTokenAnim.path[boardTokenAnim.step], false, boardTokenAnim.playerIdx);
  setTimeout(advanceTokenAnim, 230);
}

// v0.6.00: dust puff per hop, landing ring, Mana Well shimmer when passing tile 0
function _fxHop(pos, final, pIdx) {
  if (!window.BoardFX) return;
  const c = tileElCache.get(pos);
  const inner = c && c.el.querySelector('.tile-inner');
  const col = G?.players?.find(p => p.idx === pIdx)?.color || '#c9a05a';
  BoardFX.hop(inner, { final, color: col, well: pos === 0 && !final });
}

// Used as fallback if boardTokenAnim wasn't pre-seeded (shouldn't happen in normal flow)
function startTokenAnim(playerIdx, fromPos, toPos) {
  const path = buildHopPath(fromPos, toPos);
  if (path.length <= 1) { render(); return; }
  boardTokenAnim = {playerIdx, path, step: 0};
  advanceTokenAnim(); // immediately steps to path[1] (fromPos+1)
}

// ─── Board die animation ─────────────────────────────────────────────────────────────────
function startBoardDieAnimation(finalVal, fromPos, toPos, animPlayerIdx) {
  boardShowIdleDie = true;
  render(); // renders board with idle die showing '?'

  let dieEl = document.getElementById('board-anim-die');
  let faceEl = document.getElementById('board-die-face');
  // v0.6.20: watchdog — a roll can never hold the board for more than 7 s, whatever happens to the DOM
  const _rollToken = (startBoardDieAnimation._n = (startBoardDieAnimation._n || 0) + 1);
  setTimeout(() => {
    if (startBoardDieAnimation._n !== _rollToken || !boardRollAnimating) return;
    console.warn('[board] roll animation watchdog released the board');
    boardShowIdleDie = false; boardRollAnimating = false;
    if (boardPendingG) { boardPrevPhase = boardPendingG.phase; boardPrevCurrentPlayer = boardPendingG.currentPlayer; G = boardPendingG; boardPendingG = null; }
    if (boardTokenAnim && boardTokenAnim.playerIdx === animPlayerIdx && boardTokenAnim.step === 0) advanceTokenAnim(); else render();
  }, 7000);
  if (!dieEl || !faceEl) {
    boardShowIdleDie = false;
    boardRollAnimating = false;
    render();
    return;
  }

  const seq = [1,2,3,4,5,6,1,2,3,4,5,6];
  let step = 0;
  // v0.6.00: two real 3D dice (BoardFX) when the server sends both dice
  const _dice = G?.players?.[animPlayerIdx]?.lastDice;
  const _pCol = G?.players?.[animPlayerIdx]?.color || '#c9a05a';
  if (window.BoardFX && Array.isArray(_dice) && _dice.length === 2) {
    faceEl.textContent = '';
    step = seq.length; // skip the flat-number cycle
    setTimeout(_playDiceRoll, 200);   // v0.6.02: real dice-roll.mp3 (one random take)
    BoardFX.rollDice(dieEl, _dice, finalVal, {
      color: _pCol,
      land: () => {},
      doubles: () => SFX.doubles(),
    }).then(() => boardCycle());
    return;
  }

  function boardCycle() {
    // v0.6.20: if a re-render replaced the die mid-roll, pick up the new elements instead of
    // bailing out (bailing left boardRollAnimating stuck and froze the board).
    if (!faceEl.isConnected || !dieEl.isConnected) {
      const f = document.getElementById('board-die-face'), d = document.getElementById('board-anim-die');
      if (f) faceEl = f; if (d) dieEl = d;
    }
    if (step < seq.length) {
      SFX.dieTick();
      faceEl.textContent = seq[step++];
      faceEl.classList.remove('board-die-flash');
      void faceEl.offsetWidth;
      faceEl.classList.add('board-die-flash');
      dieEl.classList.remove('die-cycling');
      void dieEl.offsetWidth;
      dieEl.classList.add('die-cycling');
      setTimeout(boardCycle, 85);
    } else {
      dieEl.classList.remove('die-cycling');
      dieEl.classList.add('die-landed');
      SFX.dieLand(finalVal);
      // v0.6.02: the whole ring of cards kicks outward with the burst, wave starting at the roller
      if (window.BoardFX) {
        const _tiles = []; for (let i = 0; i < 28; i++) { const c = tileElCache.get(i); _tiles.push(c ? c.el : null); }
        const _org = G?.players?.[animPlayerIdx]?.position ?? 0;
        BoardFX.ripple(_tiles, fromPos != null ? fromPos : _org);
      }

      // ── Lottie hit effect — plays before number reveals ──────────────────
      const lottieEl = document.getElementById('board-die-hit-lottie');
      let lottieDuration = 0;
      if (lottieEl && typeof lottie !== 'undefined') {
        lottieEl.style.display = 'block';
        lottieEl.innerHTML = '';
        const hitAnim = lottie.loadAnimation({
          container: lottieEl,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          path: '/animations/Hit-effect.json'
        });
        // Estimate duration from animation data; fallback to 600ms
        hitAnim.addEventListener('DOMLoaded', () => {
          const frames = hitAnim.totalFrames || 0;
          const fps = hitAnim.frameRate || 30;
          lottieDuration = frames > 0 ? Math.round((frames / fps) * 1000) : 600;
        });
        hitAnim.addEventListener('complete', () => {
          lottieEl.style.opacity = '0';
          setTimeout(() => {
            lottieEl.style.display = 'none';
            lottieEl.style.opacity = '1';
            hitAnim.destroy();
          }, 250);
        });
        lottieDuration = 600; // safe initial estimate while DOMLoaded fires
      }
      // ─────────────────────────────────────────────────────────────────────

      // Reveal number after Lottie completes (or immediately if no Lottie)
      setTimeout(() => {
        faceEl.textContent = finalVal;
        faceEl.classList.remove('board-die-flash');
        void faceEl.offsetWidth;
        faceEl.classList.add('board-die-flash');
      }, lottieDuration);

      setTimeout(() => {
        boardShowIdleDie = false;
        boardRollAnimating = false;
        if (boardPendingG) {
          boardPrevPhase = boardPendingG.phase;
          boardPrevCurrentPlayer = boardPendingG.currentPlayer;
          G = boardPendingG; boardPendingG = null;
        }
        // Tile-Choice: choose_landing may have arrived while die was spinning (buffered
        // in boardPendingG and now merged). Re-read actual destination from current G —
        // it will differ from toPos (which was fromPos at die-start time) if the player
        // already chose their tile before the die animation finished.
        const actualToPos = G?.players[animPlayerIdx]?.position ?? toPos;
        // Continue token animation: boardTokenAnim was pre-seeded at fromPos,
        // now advance it hop-by-hop. Falls back to render() if nothing to animate.
        if (boardTokenAnim && boardTokenAnim.playerIdx === animPlayerIdx) {
          advanceTokenAnim(); // steps from path[0]=fromPos → path[1]...toPos
        } else if (fromPos != null && actualToPos != null && fromPos !== actualToPos && animPlayerIdx != null) {
          startTokenAnim(animPlayerIdx, fromPos, actualToPos);
        } else {
          render();
        }
      }, 2500);
    }
  }

  setTimeout(boardCycle, 50);
}

// ─── Spectator join screen ───────────────────────────────────────────────────────────────
function renderSpectatorJoin(errorMsg) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;background:rgba(6,6,16,.92);display:flex;align-items:center;justify-content:center;z-index:9999;';
  root.innerHTML = `
    <div style="background:linear-gradient(160deg,#1a1228 0%,#12101e 100%);border:1px solid rgba(145,132,217,.25);border-radius:16px;padding:44px 52px;text-align:center;max-width:340px;width:90%;box-shadow:0 0 60px rgba(0,0,0,.7);">
      <div style="font-size:36px;margin-bottom:12px">👁️</div>
      <div style="font-family:'Cinzel',serif;font-size:22px;font-weight:700;letter-spacing:.18em;color:var(--gold-glow);margin-bottom:4px;">SUMMONERS GAMBIT</div>
      <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.35em;color:var(--text-mute);text-transform:uppercase;margin-bottom:32px;">Spectator Mode</div>
      <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.25em;color:var(--text-mute);text-transform:uppercase;margin-bottom:10px;">Room Code</div>
      <input id="spec-code-input" maxlength="4" placeholder="ABCD"
        style="width:100%;box-sizing:border-box;font-family:'Cinzel',serif;font-size:26px;font-weight:700;letter-spacing:.3em;text-align:center;text-transform:uppercase;background:rgba(0,0,0,.4);border:1px solid rgba(145,132,217,.35);border-radius:8px;color:var(--gold-glow);padding:12px 8px;outline:none;margin-bottom:${errorMsg ? '8px' : '20px'};">
      ${errorMsg ? `<div style="font-size:11px;color:#e05252;margin-bottom:14px;letter-spacing:.03em;">${errorMsg}</div>` : ''}
      <button onclick="doSpectatorJoin()" style="width:100%;font-family:'Cinzel',serif;font-size:13px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;background:linear-gradient(135deg,var(--gold-glow),#b8862e);color:#0c0c1a;border:none;border-radius:8px;padding:14px;cursor:pointer;">Watch Game</button>
    </div>`;
  app.appendChild(root);
  const inp = document.getElementById('spec-code-input');
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSpectatorJoin(); });
}

function doSpectatorJoin() {
  const code = (document.getElementById('spec-code-input')?.value || '').toUpperCase().trim();
  if (!code || code.length < 1) return;
  if (ws && ws.readyState === WebSocket.OPEN) {
    send('spectate_connect', { roomCode: code });
  }
}

// ─── WebSocket connection ────────────────────────────────────────────────────────────────
function connect(){
  reconnectTimer = null; // clear so onclose guard knows no timer is pending
  const chip = document.getElementById('conn-chip');
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);

  ws.onopen = () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (isSpectator) {
      if (!isEmbed) {
        chip.className = 'ok';
        chip.textContent = '● Spectating';
      }
      if (!spectatorJoined) {
        if (isEmbed && savedRoomCode) {
          // Desktop embed mode — auto-connect directly, skip join UI
          send('spectate_connect', { roomCode: savedRoomCode });
        } else {
          renderSpectatorJoin();
        }
      }
    } else {
      chip.className = 'ok';
      chip.textContent = '● Board View';
      // Claim or create a room — use persisted room code so reconnects land in the same room
      // v0.6.45 (S3): send this screen's host key so the server knows it's the real host
      let _hk = ''; try { _hk = savedRoomCode ? (localStorage.getItem('sg_host_' + savedRoomCode) || '') : ''; } catch(e) {}
      send('board_connect', { roomCode: savedRoomCode, hostKey: _hk });
    }
  };

  ws.onmessage = e => {
    try {
    const msg = JSON.parse(e.data);
    if (msg.type === 'news') { if (window.SGNews) SGNews.set(msg.news); return; }   // v0.6.44: lobby news
    if (msg.type === 'ready') return; // server ready ping — board_connect was just sent
    // v0.6.45 (S3): the server hands the host its key; keep it per room so a refresh stays host
    if (msg.type === 'host_key') {
      try { localStorage.setItem('sg_host_' + msg.roomCode, msg.hostKey); } catch(e) {}
      if (savedRoomCode !== msg.roomCode) { savedRoomCode = msg.roomCode; history.replaceState(null, '', `?room=${savedRoomCode}`); }
      return;
    }
    if (msg.type === 'host_denied') {
      clearTimeout(reconnectTimer); reconnectTimer = null; window._sgHostDenied = true;
      const code = msg.roomCode;
      document.body.innerHTML = '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0d0e1c;color:#e8e2d0;font-family:system-ui,sans-serif;padding:24px;text-align:center"><div style="max-width:440px"><h2 style="font-family:Cinzel,serif;margin:0 0 12px">Room ' + code + ' already has a host</h2><p style="color:#a8a090;line-height:1.5;margin:0 0 20px">' + (msg.message || '') + '</p><a href="/spectate?room=' + code + '" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#c9a05a;color:#1a1710;text-decoration:none;font-weight:600;margin:4px">Watch as spectator</a> <a href="/board" style="display:inline-block;padding:10px 18px;border-radius:8px;border:1px solid #c9a05a;color:#c9a05a;text-decoration:none;font-weight:600;margin:4px">Host a new room</a></div></div>';
      try { ws.onclose = null; ws.onerror = null; ws.close(); } catch(e) {}
      return;
    }
    if (msg.type === 'error' && !isSpectator) { _hostToast(msg.message || 'Not allowed'); return; }   // v0.6.49: host sees why an action was refused
    if (msg.type === 'error' && isSpectator && !spectatorJoined) {
      renderSpectatorJoin(msg.message || 'Room not found');
      return;
    }
    if (msg.type === 'state') {
      // v0.5.22 / v0.6.12: a deploy restarted the server with a new version — reload once so this
      // device runs the new code (session key / room code bring it straight back into the game).
      if (msg.game && msg.game.serverVersion) {
        if (window._sgSrv && window._sgSrv !== msg.game.serverVersion) { location.reload(); return; }
        window._sgSrv = msg.game.serverVersion;
      }
      if (isSpectator) spectatorJoined = true; // first state received = successfully joined
      // Save room code on first state so reconnects always land in the same room
      if (msg.game && msg.game.roomCode && !savedRoomCode) {
        savedRoomCode = msg.game.roomCode;
        history.replaceState(null, '', `?room=${savedRoomCode}`);
      }
      if (boardRollAnimating) {
        boardPendingG = msg.game;
        return;
      }
      const newG = msg.game;
      // v0.6.57: Warning Sting when a new player joins the lobby (host board only; not on reconnects or first load)
      try {
        if (!isSpectator && newG.phase === 'lobby' && G && G.roomCode === newG.roomCode && Array.isArray(G.players)) {
          const had = new Set(G.players.map(p => p.idx + '|' + p.name));
          if (newG.players.some(p => !had.has(p.idx + '|' + p.name))) {
            _sfxWarnSting.currentTime = 0; _playSfx(_sfxWarnSting);
          }
        }
      } catch (_) {}
      const prevPhase = boardPrevPhase;
      const prevPlayer = boardPrevCurrentPlayer;
      // Only trigger roll animation if the same player's turn is still active
      // (cross-turn: prevPlayer changes → not a roll completion for the new player)
      const rollJustHappened = prevPhase === 'roll'
        && newG.phase !== 'roll'
        && (prevPlayer === null || prevPlayer === newG.currentPlayer);
      const rollVal = newG.players[newG.currentPlayer]?.lastDiceRoll;
      // Capture previous positions BEFORE overwriting G (needed for token animation)
      const prevPositions = G ? G.players.map(p => p.position) : null;
      boardPrevPhase = newG.phase;
      boardPrevCurrentPlayer = newG.currentPlayer;
      G = newG;
      if (rollJustHappened && rollVal != null) {
        boardRollAnimating = true;
        boardPendingG = null;
        const animPlayerIdx = newG.currentPlayer;
        let fromPos = prevPositions ? prevPositions[animPlayerIdx] : null;
        let toPos = newG.players[animPlayerIdx]?.position;
        // Pre-seed boardTokenAnim at fromPos so the token STAYS at the old tile
        // while the die is spinning — prevents the "jump-to-destination" bug.
        fromPos = Math.round(Number(fromPos)) % 28;
        toPos   = Math.round(Number(toPos))   % 28;
        if (isNaN(fromPos) || isNaN(toPos)) fromPos = toPos; // skip animation if garbage data
        if (fromPos != null && toPos != null && fromPos !== toPos) {
          boardTokenAnim = {playerIdx: animPlayerIdx, path: buildHopPath(fromPos, toPos), step: 0};
        }
        startBoardDieAnimation(rollVal, fromPos, toPos, animPlayerIdx);
      } else if (newG.phase === 'resolve:battle' && prevPhase !== 'resolve:battle'
                 && !(prevPhase === 'resolve:landing' && prevPositions
                      && prevPositions[newG.currentPlayer] !== newG.players[newG.currentPlayer]?.position)) {
        // v0.6.11: a landing choice that starts a battle goes to the hop branch below instead
        // (this branch used to catch it first, so the token snapped onto the enemy tile).
        // Battle arrived without going through roll animation (warp, reconnect, etc.)
        // Block render and show idle die for 2s so battle overlay isn't instant
        boardRollAnimating = true;
        boardPendingG = null;
        boardShowIdleDie = true;
        render();
        setTimeout(() => {
          boardShowIdleDie = false;
          boardRollAnimating = false;
          if (boardPendingG) {
            boardPrevPhase = boardPendingG.phase;
            boardPrevCurrentPlayer = boardPendingG.currentPlayer;
            G = boardPendingG; boardPendingG = null;
          }
          SFX.battleStart();
          render();
        }, 2000);
      } else {
        // Tile-Choice: player sent choose_landing → position changed after die already finished.
        // Detect resolve:landing → any_phase transition with a position change and hop the token.
        let startedHop = false;
        if (prevPhase === 'resolve:landing' && prevPositions) {
          const animPlayerIdx = newG.currentPlayer;
          const from = prevPositions[animPlayerIdx];
          const to   = newG.players[animPlayerIdx]?.position;
          if (from != null && to != null && from !== to) {
            startTokenAnim(animPlayerIdx, from, to);
            startedHop = true;
          }
        }
        // Phase-transition sound cues
        if (newG.phase === 'resolve:battle_result' && prevPhase !== 'resolve:battle_result' && newG.lastBattle) {
          const oc = newG.lastBattle.outcome;
          if      (oc === 'attacker_wins') SFX.battleWin();
          else if (oc === 'defender_wins') SFX.battleLose();
          else if (oc === 'mutual')        SFX.battleMutual();
          else if (oc === 'stalemate')     SFX.battleStalemate();
        }
        // ── Round callout / game-over fanfare ────────────────────────────
        if (newG.phase === 'resolve:round_callout' && _roundCalloutTriggered !== newG.roundCallout) {
          _roundCalloutTriggered = newG.roundCallout;
          _fireRoundCallout(newG.roundCallout);
        }
        if (prevPhase === 'resolve:round_callout' && newG.phase !== 'resolve:round_callout') {
          _roundCalloutTriggered = null;
        }
        if (newG.phase === 'game_over' && !_goFanfareTriggered) {
          _goFanfareTriggered = true;
          _fireGameOverFanfare();
        }
        if (!startedHop) render();
      }
    }
    } catch(err) {
      console.error('[board] ws.onmessage error:', err);
    }
  };

  ws.onclose = ws.onerror = () => {
    if (reconnectTimer) return; // already scheduled — don't double-queue
    chip.className = 'err';
    chip.textContent = '✕ Disconnected';
    G = null;
    render();
    reconnectTimer = setTimeout(connect, 2000);
  };
}
