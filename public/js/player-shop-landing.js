// player-shop-landing.js: split from the inline page script (L2). Loaded in order by player.html; all files share one global scope.
// ─── SANCTIONED (v0.5.33) ────────────────────────────────────────────────────
const SX_REDEEM_COST = 15, SX_REDEEM_BACK = 5;
const SX_SEAL_SVG = (sz, col) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 15l6-6"/><path d="M11 6l1.5-1.5a3.5 3.5 0 0 1 5 5L16 11"/><path d="M13 18l-1.5 1.5a3.5 3.5 0 0 1-5-5L8 13"/></svg>`;
let _sancHeldByBattle = false, _sancShowAt = 0;   // v0.5.39
let _sanctionNoticeSeen = (() => { try { const v = sessionStorage.getItem('sg_sanc_seen'); return v === null ? undefined : Number(v); } catch (e) { return undefined; } })();
let _sxSacConfirm = false;
function _sxFinalRound() { return (G.round != null ? G.round : Math.floor(G.turnCount / G.players.length) + 1) >= (G.roundLimit || 20); }   // v0.5.42: real round
function _sxMyTiles() { return G.board.filter(t => t.ownerId === myIdx).length; }
// mirrors the server's redeemBlockReason()
function _sxRedeemBlock(me) {
  if (me.redeemUsed) return 'Already used this game';
  if (_sxFinalRound()) return 'Not allowed in the final round';
  if (me.mana < SX_REDEEM_COST) return `Need ${SX_REDEEM_COST}✦ · you have ${me.mana}✦`;
  if (!_sxMyTiles()) return 'Need at least 1 tile';
  return null;
}
function _sxSellValue(m) { return m ? Math.floor(m.cost * (m.hp / m.maxHp)) : 0; }

// ─── WHEEL OF FORTUNE (v0.5.35) — mirrors server FORTUNE table ────────────────
const FORTUNE_INFO = {
   1: { name:'Glimmer',    eff:'+10% DEF · holding it pays +2✦' },
   2: { name:'Radiance',   eff:'+20% DEF · +10% counter-strike · holding it pays +4✦' },
   3: { name:'Exaltation', eff:'+30% DEF · +20% counter-strike · holding it pays +8✦ and heals 10 HP' },
  '-1': { name:'Tarnish', eff:'−10% DEF · whoever takes it gets +2✦' },
  '-2': { name:'Blight',  eff:'−20% DEF · whoever takes it gets +4✦' },
  '-3': { name:'Doom',    eff:'−30% DEF · loses 5 HP every turn · whoever takes it gets +8✦' },
};
function _fortuneLabel(f) { return f ? `${FORTUNE_INFO[f].name} ${f > 0 ? '+' : '−'}${Math.abs(f)}` : 'Neutral 0'; }
function _fortuneLadderHTML(f) {
  const cells = [-3,-2,-1,0,1,2,3].map(v => `<div class="fl-cell ${v > 0 ? 'b' : v < 0 ? 'c' : 'z'}${v === f ? ' cur' : ''}">${v > 0 ? '+' + v : v}</div>`).join('');
  return `<div class="fl-wrap"><div class="fl-ends"><span style="color:#ff8a80">Curse</span><span style="color:#e0c07a">Blessing</span></div>
    <div class="fl-row">${cells}</div>
    <div class="fl-eff">${f ? `<b style="color:${f > 0 ? '#e0c07a' : '#ff8a80'}">${FORTUNE_INFO[f].name}:</b> ${FORTUNE_INFO[f].eff}` : 'No Fortune on this tile yet.'}</div></div>`;
}
// shown at the top of any tile's detail sheet when it carries a Fortune meter
function _fortuneBlockHTML(t) {
  const f = t && t.fortune;
  if (!f) return '';
  return `<div class="fb-block ${f > 0 ? 'b' : 'c'}"><div class="sx-lbl" style="color:${f > 0 ? '#e0c07a' : '#ff8a80'}">🎡 Wheel of Fortune · ${_fortuneLabel(f)}</div>
    <div style="font-size:12px;line-height:1.5;color:var(--text-lo)">${FORTUNE_INFO[f].eff}</div></div>`;
}
// result screen after your own flip
let _wheelSeenSeq = null;
function _maybeWheelResult() {
  const w = G && G.lastWheel;
  if (_wheelSeenSeq === null) { _wheelSeenSeq = w ? w.seq : 0; return false; }   // first state after (re)connect: don't replay
  if (!w) return false;
  if (w.seq === _wheelSeenSeq || w.playerIdx !== myIdx) { _wheelSeenSeq = w.seq; return false; }
  _wheelSeenSeq = w.seq;
  const col = w.upright ? '#e0c07a' : '#ff8a80';
  const title = w.jackpot ? `JACKPOT +${w.jackpot}✦` : w.upright ? 'BLESSING' : 'CURSE';
  const sub = w.jackpot
    ? `Tile ${w.pos} is already at ${_fortuneLabel(w.after)}. The Wheel pays you ${w.jackpot}✦ instead.`
    : `Tile ${w.pos} is now <b style="color:${w.after ? (w.after > 0 ? '#e0c07a' : '#ff8a80') : 'var(--text)'}">${_fortuneLabel(w.after)}</b>.` + (w.after ? `<br>${FORTUNE_INFO[w.after].eff}` : '<br>The Blessing and Curse cancelled out.');
  const ov = document.createElement('div');
  ov.className = 'wr-ov'; ov.id = 'wheel-result';
  ov.innerHTML = `<div class="wr-card"><div class="wr-in${w.upright ? '' : ' rev'}">
      <div class="wr-face" style="background-image:url('img/omens/omen-back-wheel.webp')"></div>
      <div class="wr-face wr-front" style="background-image:url('img/omens/omen-wheel-of-fortune.webp');box-shadow:0 0 0 3px ${col},0 0 40px ${col}88"></div></div></div>
    <div class="wr-title" style="color:${col}">${title}</div>
    <div class="wr-sub">${w.upright ? 'Upright' : 'Reversed'} · ${sub}</div>
    <div style="width:100%;max-width:340px;opacity:0;animation:wrIn .4s 1.6s forwards">${_fortuneLadderHTML(w.after)}</div>
    <button class="action-btn gold-btn" style="flex:none;width:100%;max-width:340px;opacity:0;animation:wrIn .4s 1.8s forwards" onclick="document.getElementById('wheel-result').remove()">Continue</button>`;
  document.body.appendChild(ov);
  return true;
}

// ─── OMENS (v0.5.37) — mirrors server OMENS ───────────────────────────────────
const OMEN_INFO = {
  saints_ward:       { name: "Saint's Ward",      kind: 'blessing', desc: '+20% DEF on this tile' },
  kindled_blade:     { name: 'Kindled Blade',     kind: 'blessing', desc: "+20% damage on this summon's next strike" },
  mercys_touch:      { name: "Mercy's Touch",     kind: 'blessing', desc: 'Heals the summon 15 HP now' },
  golden_tithe:      { name: 'Golden Tithe',      kind: 'blessing', desc: "This tile's Gen ×2 at its owner's next income" },
  veil_of_stillness: { name: 'Veil of Stillness', kind: 'blessing', desc: "Can't be attacked: landing here just ends the move" },
  echoing_hymn:      { name: 'Echoing Hymn',      kind: 'blessing', desc: 'If attacked, the attacker takes 8 damage before the battle' },
  withering_brand:   { name: 'Withering Brand',   kind: 'curse',    desc: '−20% DEF on this tile' },
  hollow_hunger:     { name: 'Hollow Hunger',     kind: 'curse',    desc: "This tile's Gen is 0 at its owner's next income" },
  bleeding_sigil:    { name: 'Bleeding Sigil',    kind: 'curse',    desc: 'Summon loses 5 HP at the start of each turn (never below 1)' },
  shackled_will:     { name: 'Shackled Will',     kind: 'curse',    desc: "This summon's counter-strike deals half damage" },
  toll_of_the_bell:  { name: 'Toll of the Bell',  kind: 'curse',    desc: 'The owner pays 5✦ whenever a rival lands here' },
  betrayers_mark:    { name: "Betrayer's Mark",   kind: 'curse',    desc: 'If the tile is taken, the attacker gets +5✦' },
};
const omenImg = id => `img/omens/omen-${id}.webp`;
function _omenBlockHTML(t) {
  const o = t && t.omen; if (!o || !OMEN_INFO[o.id]) return '';
  const O = OMEN_INFO[o.id], b = O.kind === 'blessing', by = G.players.find(p => p.idx === o.byIdx);
  return `<div class="fb-block ${b ? 'b' : 'c'}" style="flex-direction:row;gap:10px;align-items:center">
    <img src="${omenImg(o.id)}" alt="" style="width:34px;height:60px;object-fit:cover;border-radius:4px;flex-shrink:0">
    <div style="display:flex;flex-direction:column;gap:3px"><div class="sx-lbl" style="color:${b ? '#e0c07a' : '#ff8a80'}">🔮 ${O.name} · ${b ? 'Blessing' : 'Curse'}</div>
    <div style="font-size:12px;line-height:1.5;color:var(--text-lo)">${O.desc}. Placed by ${by ? by.name : '?'}, lasts until their next turn.</div></div></div>`;
}

function renderSanctionNotice() {
  const me = G.players[myIdx];
  updateStatusBar(false);
  updateHandStrip(false);
  document.getElementById('action-bar').classList.remove('visible');
  document.getElementById('main-content').classList.add('no-hand');
  const again = me.redeemUsed ? `<div class="sx-redeem no" style="margin-top:4px">Redeem is used up, so this time it's for good. Hold your tiles.</div>` : '';
  document.getElementById('main-content').innerHTML = `
    <div style="min-height:100%;box-sizing:border-box;background:radial-gradient(ellipse at 50% 22%,#3a151b 0%,transparent 62%);display:flex;flex-direction:column;align-items:center;padding:56px 24px 28px;gap:18px;text-align:center">
      <div class="sx-seal" style="width:104px;height:104px">${SX_SEAL_SVG(52, '#ff8a80')}</div>
      <div style="font-family:'Cinzel',serif;font-size:28px;font-weight:900;letter-spacing:.1em;color:#f5efe0">SANCTIONED</div>
      <div style="font-size:15px;line-height:1.6;color:var(--text-lo)">Your Mana ran out. You're not out of the game, but you're bound.</div>
      <div class="sx-card" style="margin:0;width:100%;box-sizing:border-box;text-align:left;gap:9px">
        <div class="sx-lbl">While Sanctioned</div>
        <div style="font-size:14px;line-height:1.5">• No income, shop or dice.</div>
        <div style="font-size:14px;line-height:1.5">• Your summons still defend your tiles.</div>
        <div style="font-size:14px;line-height:1.5">• Each turn you get a <b>Sanction turn</b>: pick 1 of 3 tiles to bless, curse or cash in.</div>
        <div style="font-size:14px;line-height:1.5">• Lose your last tile and you're Eliminated.</div>
      </div>
      <div style="width:100%;box-sizing:border-box;display:flex;gap:12px;align-items:center;text-align:left;background:rgba(201,160,90,.08);border:1px solid rgba(201,160,90,.35);border-radius:12px;padding:14px 16px">
        <img src="img/omens/omen-redeem.webp" alt="" style="width:44px;height:78px;object-fit:cover;border-radius:4px">
        <div style="font-size:13px;line-height:1.5;color:#e8d5b0"><b style="color:#f5efe0">Redeem</b> once per game: pick your own tile with ${SX_REDEEM_COST}✦ or more and come back with ${SX_REDEEM_BACK}✦. Not in the final round.</div>
      </div>
      ${again}
      <button class="action-btn gold-btn" style="margin-top:auto;width:100%;flex:none" onclick="dismissSanctionNotice()">Dismiss</button>
    </div>`;
}
function dismissSanctionNotice() {
  const me = G.players[myIdx];
  _sanctionNoticeSeen = me ? me.sanctionedAt : undefined;
  try { sessionStorage.setItem('sg_sanc_seen', String(_sanctionNoticeSeen)); } catch (e) {}
  render();
}

// Shown at the top of the waiting screen while you are Sanctioned
function _sanctionStandingHTML(me) {
  const why = _sxRedeemBlock(me);
  const redeem = why
    ? `<div class="sx-redeem no"><b>Redeem</b><span style="margin-left:auto">${why}</span></div>`
    : `<div class="sx-redeem ok"><b style="color:#f5efe0">Redeem ${SX_REDEEM_COST}✦</b><span style="margin-left:auto">Ready: pick your own tile</span></div>`;
  return `<div class="sx-card" style="margin:0 0 12px">
      <div class="sx-lbl" style="color:#ff8a80">⛓ You are Sanctioned</div>
      <div class="sx-row"><span style="color:var(--text-lo)">Tiles held</span><b>${_sxMyTiles()}</b></div>
      <div class="sx-row"><span style="color:var(--text-lo)">Income</span><b style="color:#ff8a80">None while Sanctioned</b></div>
      ${redeem}
    </div>`;
}

function _sxHero(sub) {
  return `<div class="sx-hero">
      <div class="sx-seal">${SX_SEAL_SVG(32, '#ff8a80')}</div>
      <div class="sx-title">YOUR SANCTION TURN</div>
      <div class="sx-sub">${sub}</div>
    </div>`;
}

// sanction:pick_tile — same cards + detail sheet as the landing choice
function renderSanctionPick() {
  const sx = G.sanction;
  if (!sx) { renderWaiting(); return; }
  render._sxPickSeen = sx.seq;   // v0.5.36: this phone saw the pick, so it waits for the board's flip after Choose
  updateStatusBar(true);
  updateHandStrip(false);   // v0.5.34: no hand strip while Sanctioned
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');
  _sxSacConfirm = false;
  document.getElementById('main-content').innerHTML = `
    ${_sxHero('The same three tiles pulse on the board')}
    <div class="lc-section">
      <div class="lc-header">Choose a Tile</div>
      <div class="lc-opts">${_lcOptCardsHTML(sx.offers, 'openSanctionPickDetail')}</div>
      <div class="lc-tap-hint">Tap a tile to see details, then confirm with <b>Choose</b></div>
      <div style="padding:14px 16px 0;display:flex"><button class="action-btn secondary" onclick="send('sanction_pass')">Pass turn</button></div>
    </div>`;
}
function _sanctionPickAction(pos) {
  const t = G.board[pos];
  const run = () => send('sanction_pick_tile', { tilePos: pos });
  if (t.ownerId === myIdx) return { label: 'Choose · Your tile', kind: 'gold', hint: 'Then: Sacrifice, Redeem or the Wheel', run };
  const ow = G.players.find(p => p.idx === t.ownerId);
  return { label: 'Choose · Place an Omen', kind: 'battle',
    hint: `On ${ow ? ow.name + "'s" : 'a rival\'s'} ${t.summon ? t.summon.name : 'tile'}: bless or curse it for a round`, run };
}
function openSanctionPickDetail(i) {
  const sx = G.sanction;
  if (!sx) return;
  openDetailSheet(sx.offers, i, _sanctionPickAction, { title: 'Choose a Tile', renderItem: _tileDetailBody, colorOf: _tileColor,
    // v0.5.34: the board scales up the tile you're looking at (like the battle attacker preview)
    onChange: pos => send('sanction_preview', { tilePos: pos }),
    onClose: () => { if (G && G.phase === 'sanction:pick_tile' && G.currentPlayer === myIdx) send('sanction_preview', { tilePos: null }); } });
}

// sanction:own — Sacrifice / Redeem / Wheel cards; tapping opens the detail sheet
const SX_OWN = ['sacrifice', 'redeem', 'wheel'];
function _sxOwnInfo(id) {
  const me = G.players[myIdx];
  const t = G.board[G.sanction.pickedPos];
  const m = t && t.summon;
  const last = _sxMyTiles() <= 1;
  if (id === 'sacrifice') {
    const gain = _sxSellValue(m);
    return { name: 'Sacrifice', img: 'img/omens/omen-sacrifice.webp', val: `+${gain}✦`, off: false,
      note: `Destroy ${m ? m.name : 'the summon'}, tile goes neutral`,
      desc: `Destroy ${m ? m.name : 'your summon'} (${m ? m.hp + '/' + m.maxHp + ' HP' : ''}) and gain its sell value, <b>+${gain}✦</b>. Tile ${t.pos} goes neutral.` + (last ? `<br><br><b style="color:#ff8a80">This is your last tile. Sacrificing it Eliminates you.</b>` : ''),
      act: () => last && !_sxSacConfirm
        ? { label: 'Sacrifice · last tile', kind: 'battle', hint: 'Tap again to confirm: you will be Eliminated', run: () => { _sxSacConfirm = true; openSanctionOwnDetail(0); } }
        : { label: last ? 'Confirm · Sacrifice and leave' : `Sacrifice · +${gain}✦`, kind: 'battle', run: () => send('sanction_sacrifice') } };
  }
  if (id === 'redeem') {
    const why = _sxRedeemBlock(me);
    return { name: 'Redeem', img: 'img/omens/omen-redeem.webp', val: `${SX_REDEEM_COST}✦`, off: !!why,
      note: why || `Back in the game with ${me.mana - SX_REDEEM_COST + SX_REDEEM_BACK}✦`,
      desc: `Pay ${SX_REDEEM_COST}✦ and return to normal play next turn, keeping your tiles, summons and hand. You come back with ${SX_REDEEM_BACK}✦ on top of what's left. Once per game, not in the final round.`,
      act: () => why ? { label: 'Redeem', disabled: true, reason: why } : { label: `Redeem · ${SX_REDEEM_COST}✦`, kind: 'gold', run: () => send('sanction_redeem') } };
  }
  const f = t.fortune || 0;
  return { name: 'Wheel', img: 'img/omens/omen-wheel-of-fortune.webp', val: f ? `${f > 0 ? '+' : '−'}${Math.abs(f)} ${FORTUNE_INFO[f].name}` : 'Meter 0', off: false,
    note: 'Bless or curse this tile',
    desc: `Flip the tarot card. <b style="color:#e0c07a">Upright</b> moves this tile one step toward Blessing, <b style="color:#ff8a80">reversed</b> one step toward Curse (50/50). At ±3 a matching flip pays <b>+5✦</b> instead.${_fortuneLadderHTML(f)}`,
    act: () => ({ label: 'Turn the Wheel', kind: 'gold', run: () => send('sanction_wheel') }) };
}
function renderSanctionOwn() {
  const sx = G.sanction;
  if (!sx || sx.pickedPos == null) { renderWaiting(); return; }
  const t = G.board[sx.pickedPos];
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');
  const cards = SX_OWN.map((id, i) => {
    const o = _sxOwnInfo(id);
    return `<button class="sx-opt" onclick="openSanctionOwnDetail(${i})">
        <div class="sx-art${o.off ? ' off' : ''}"><img src="${o.img}" alt="">
          <div class="sx-art-cap"><span class="sx-art-name">${o.name}</span><span class="sx-art-val"${o.off ? ' style="color:var(--text-lo)"' : ''}>${o.val}</span></div></div>
        <span class="sx-note${o.off && id === 'redeem' ? ' bad' : ''}">${o.note}</span>
      </button>`;
  }).join('');
  const last = _sxMyTiles() <= 1;
  document.getElementById('main-content').innerHTML = `
    <div class="sx-hero" style="padding-bottom:0">
      <div class="sx-lbl">Tile ${t.pos} · Your tile</div>
      <div style="font-size:17px;font-weight:600">${t.summon ? `${t.summon.name} · ${t.summon.hp}/${t.summon.maxHp} HP` : 'Empty'}</div>
    </div>
    <div class="sx-grid">${cards}</div>
    ${last ? `<div class="sx-warn"><span>⚠</span><span><b>Last tile.</b> Sacrificing it Eliminates you.</span></div>` : ''}
    <div style="padding:18px 16px;display:flex"><button class="action-btn secondary" onclick="send('sanction_pass')">Pass turn</button></div>`;
}
function openSanctionOwnDetail(i) {
  if (!G.sanction) return;
  openDetailSheet(SX_OWN, i, id => _sxOwnInfo(id).act(), {
    title: 'Your Tile',
    renderItem: id => { const o = _sxOwnInfo(id); return `<div style="padding:16px 18px 20px"><img class="sx-detail-art" src="${o.img}" alt="" style="${o.off ? 'filter:grayscale(.8) brightness(.6)' : ''}">
      <div style="font-family:'Cinzel',serif;font-size:22px;font-weight:700;text-align:center;color:#f5efe0;margin-bottom:10px">${o.name}</div>
      <div style="font-size:14px;line-height:1.6;color:var(--text-lo);text-align:center">${o.desc}</div></div>`; },
    colorOf: () => 'var(--gold-glow)',
  });
}

// v0.5.36: while the board plays its flips, the phone says "Watch the board" — timings from common.js SX_TIMING
let _sxWatch = { seq: null, chooseEnd: 0, revealSeq: null, revealAt: 0 };
function _sxBoardWaiting() {
  const sx = G.sanction; if (!sx) return false;
  if (_sxWatch.seq !== sx.seq) {
    // first time we see this tile chosen: wait for gather + fanfare + flip (skip the wait after a reload)
    const fresh = render._sxPickSeen === sx.seq;
    _sxWatch.seq = sx.seq;
    _sxWatch.chooseEnd = fresh ? Date.now() + sxMs('turn') + sxMs('gather') + sxMs('fanfare') + sxMs('flip') : 0;
  }
  const left = _sxWatch.chooseEnd - Date.now();
  if (left > 0) { clearTimeout(_sxWatch.t); _sxWatch.t = setTimeout(render, left + 30); return true; }
  return false;
}
function renderSanctionWatch(mode) {
  const sx = G.sanction; if (!sx) { renderWaiting(); return; }
  const t = G.board[sx.pickedPos], own = t && t.ownerId === myIdx;
  updateStatusBar(true); updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');
  const r = sx.result || {};
  let face = own ? 'img/omens/omen-back-wheel.webp' : 'img/omens/omen-back-omen.webp';
  if (mode === 'choose' && t && t.summon && t.summon.id) face = monsterCardSrc(t.summon.id);
  const line = mode === 'choose' ? 'Your card is turning over…' : r.kind === 'wheel' ? 'The Wheel is turning…' : 'Revealing your choice…';
  // reveal: flip at the moment the board's card turns face-up
  let flipIn = -1;
  if (mode === 'reveal') {
    if (_sxWatch.revealSeq !== sx.revealSeq) { _sxWatch.revealSeq = sx.revealSeq; _sxWatch.revealAt = Date.now() + sxMs('fanfare') + sxMs('flip'); _sxWatch.flipped = false; }
    flipIn = _sxWatch.revealAt - Date.now();
  }
  document.getElementById('main-content').innerHTML = `
    <div class="sx-hero" style="padding-top:34px"><div class="sx-title">${flipIn <= 0 && mode === 'reveal' ? 'REVEALED' : 'WATCH THE BOARD'}</div><div class="sx-sub" id="sxw-sub">${flipIn <= 0 && mode === 'reveal' ? 'Also showing on the board' : line}</div></div>
    <div class="wr-card" style="margin:12px auto 0;width:58%"><div class="wr-in" id="sxw-in" style="animation:none"><div class="wr-face p-wait-glow" style="background-image:url('${face}')"></div><div class="wr-face wr-front" id="sxw-front"></div></div></div>
    <div id="sxw-res"></div>`;
  if (mode !== 'reveal') return;
  const R = _sxResultInfo(r);
  const show = animate => {
    const f = document.getElementById('sxw-front'), inn = document.getElementById('sxw-in'); if (!f || !inn) return;
    f.style.backgroundImage = `url('${R.img}')`; f.style.boxShadow = `0 0 0 3px ${R.col},0 0 36px ${R.col}aa`;
    if (R.upsideDown) f.style.transform = 'rotateY(180deg) rotateZ(180deg)';
    if (animate) inn.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(180deg)' }], { duration: 500, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' });
    else inn.style.transform = 'rotateY(180deg)';
    const t = document.querySelector('.sx-title'); if (t) t.textContent = 'REVEALED';
    const sb = document.getElementById('sxw-sub'); if (sb) sb.textContent = 'Also showing on the board';
    const res = document.getElementById('sxw-res');
    if (res) res.innerHTML = `<div class="wr-title" style="color:${R.col};opacity:1;animation:none;text-align:center;margin-top:14px">${R.title}</div><div class="wr-sub" style="opacity:1;animation:none;margin:6px auto 0;text-align:center">${R.sub}</div>${R.ladder != null ? `<div style="padding:12px 16px 0">${_fortuneLadderHTML(R.ladder)}</div>` : ''}`;
  };
  if (flipIn <= 0) show(false);
  else setTimeout(() => { if (G.phase === 'sanction:reveal' && G.sanction && G.sanction.revealSeq === _sxWatch.revealSeq) show(true); }, flipIn);
}
function _sxResultInfo(r) {
  if (r.kind === 'sacrifice') return { img: 'img/omens/omen-sacrifice.webp', col: '#ff6b6b', title: 'SACRIFICED', sub: `${r.summonName || 'Your summon'} destroyed. You gain ${r.gain}✦ and Tile ${r.pos} goes neutral.` };
  if (r.kind === 'redeem') return { img: 'img/omens/omen-redeem.webp', col: '#ffd77a', title: 'REDEEMED', sub: `You're back in the game next turn with ${r.mana}✦.` };
  if (r.kind === 'wheel') {
    const col = r.upright ? '#ffd77a' : '#ff6b6b';
    if (r.jackpot) return { img: 'img/omens/omen-wheel-of-fortune.webp', col, upsideDown: !r.upright, title: `JACKPOT +${r.jackpot}✦`, sub: `Tile ${r.pos} is already at ${_fortuneLabel(r.after)}. The Wheel pays you ${r.jackpot}✦ instead.`, ladder: r.after };
    return { img: 'img/omens/omen-wheel-of-fortune.webp', col, upsideDown: !r.upright, title: r.upright ? 'BLESSING' : 'CURSE',
      sub: `${r.upright ? 'Upright' : 'Reversed'} · Tile ${r.pos} is now <b style="color:${r.after ? (r.after > 0 ? '#e0c07a' : '#ff8a80') : 'var(--text)'}">${_fortuneLabel(r.after)}</b>.` + (r.after ? `<br>${FORTUNE_INFO[r.after].eff}` : '<br>The Blessing and Curse cancelled out.'), ladder: r.after };
  }
  if (r.kind === 'omen' && OMEN_INFO[r.id]) {
    const O = OMEN_INFO[r.id], b = O.kind === 'blessing', ow = G.players.find(p => p.idx === r.ownerIdx);
    return { img: omenImg(r.id), col: b ? '#ffd77a' : '#ff6b6b', title: O.name.toUpperCase(),
      sub: `${b ? 'Blessing' : 'Curse'} on ${ow ? ow.name + "'s" : 'the'} tile ${r.pos}.<br>${O.desc}${r.healed ? ` (healed ${r.healed} HP)` : ''}.` };
  }
  return { img: 'img/omens/omen-back-omen.webp', col: '#b5abfc', title: 'DONE', sub: '' };
}

// sanction:omen — three Omens to place on the rival's tile (v0.5.37)
function renderSanctionOmen() {
  const sx = G.sanction;
  if (!sx || sx.pickedPos == null) { renderWaiting(); return; }
  const t = G.board[sx.pickedPos];
  const ow = G.players.find(p => p.idx === t.ownerId);
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');
  const ids = (sx.omenOffers || []).filter(id => OMEN_INFO[id]);
  const cards = ids.map((id, i) => { const O = OMEN_INFO[id], b = O.kind === 'blessing';
    return `<button class="sx-opt" onclick="openSanctionOmenDetail(${i})">
        <div class="sx-art" style="box-shadow:0 0 0 2px ${b ? '#c9a05a' : '#e0565b'},0 8px 20px rgba(0,0,0,.5)"><img src="${omenImg(id)}" alt="">
          <div class="sx-art-cap"><span class="sx-art-name" style="font-size:11px;text-align:center">${O.name}</span><span class="sx-art-val" style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${b ? '#e0c07a' : '#ff8a80'}">${b ? 'Blessing' : 'Curse'}</span></div></div>
        <span class="sx-note">${O.desc}</span>
      </button>`; }).join('');
  document.getElementById('main-content').innerHTML = `
    <div class="sx-hero" style="padding-bottom:0">
      <div class="sx-lbl" style="color:${ow ? ow.color : 'var(--text-lo)'}">Tile ${t.pos} · ${ow ? ow.name + "'s" : 'Rival'} tile</div>
      <div style="font-size:17px;font-weight:600">Choose an Omen to place</div>
      <div class="sx-sub">Lasts until your next turn</div>
    </div>
    <div class="sx-grid">${cards}</div>
    ${t.omen && OMEN_INFO[t.omen.id] ? `<div class="sx-warn" style="background:rgba(145,132,217,.1);border-color:#6b5fc0;color:var(--text-lo)">This tile already has ${OMEN_INFO[t.omen.id].name}. A new Omen replaces it.</div>` : ''}
    <div style="padding:18px 16px;display:flex"><button class="action-btn secondary" onclick="send('sanction_omen_skip')">Pass</button></div>`;
}
function openSanctionOmenDetail(i) {
  const sx = G.sanction; if (!sx) return;
  const ids = (sx.omenOffers || []).filter(id => OMEN_INFO[id]);
  openDetailSheet(ids, i, id => { const O = OMEN_INFO[id]; return { label: 'Place ' + O.name, kind: O.kind === 'blessing' ? 'gold' : 'battle', run: () => send('sanction_omen', { id }) }; }, {
    title: 'Omens',
    renderItem: id => { const O = OMEN_INFO[id], b = O.kind === 'blessing'; return `<div style="padding:16px 18px 20px"><img class="sx-detail-art" src="${omenImg(id)}" alt="" style="box-shadow:0 0 0 2px ${b ? '#c9a05a' : '#e0565b'},0 10px 26px rgba(0,0,0,.55)">
      <div style="font-family:'Cinzel',serif;font-size:22px;font-weight:700;text-align:center;color:#f5efe0;margin-bottom:6px">${O.name}</div>
      <div style="text-align:center;font-family:'Cinzel',serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${b ? '#e0c07a' : '#ff8a80'};margin-bottom:10px">${b ? 'Blessing' : 'Curse'} · one round</div>
      <div style="font-size:14px;line-height:1.6;color:var(--text-lo);text-align:center">${O.desc}.</div></div>`; },
    colorOf: id => OMEN_INFO[id].kind === 'blessing' ? 'var(--gold-glow)' : '#ff8a80',
  });
}

function renderWaiting() {
  const me = G.players[myIdx];
  const _sx = !!(me && me.sanctioned);   // v0.5.34: no hand strip while Sanctioned
  updateStatusBar(true);
  updateHandStrip(!_sx);
  document.getElementById('action-bar').classList.remove('visible');
  document.getElementById('main-content').classList.toggle('no-hand', _sx);

  // v0.5.11: ring auto-follows the active player until the viewer browses
  if (_ringFollow) { const t = _ringFollowTarget(false); if (t != null) _waitCarouselIdx = t; }

  const currentP = G.players[G.currentPlayer];
  const chips = G.players.map(p => `
    <div class="wc-player-chip${p.idx===G.currentPlayer?' active':''}">
      <svg width="14" height="14" viewBox="0 0 20 20">${sigilShape(p.idx,10,10,5,p.color)}</svg>
      <span style="color:${p.color}">${p.name}${p.idx===myIdx?' (you)':''}</span>
      ${p.sanctioned ? '<span class="wc-sanc-tag">⛓</span>' : ''}
      <span style="color:var(--text-mute);font-size:11px">${p.tileCount}✦${p.mana}</span>
    </div>`).join('');

  const events = G.events.slice(0,6).map(e =>
    `<div class="wc-event-row">${e.text}</div>`).join('') ||
    '<div class="wc-event-row" style="color:var(--text-mute)">No events yet</div>';

  document.getElementById('main-content').innerHTML = `
    <div class="wc-wrap">
      <div class="wc-whose">
        <div class="waiting-pulse"></div>
        <span style="color:${currentP?.color};font-weight:600">${currentP?.name||'?'}</span>
        <span style="color:var(--text-mute)">'s turn</span>
        <button class="br-follow wc-follow${_ringFollow ? ' on' : ''}" onclick="ringSetFollow(${!_ringFollow})"><span class="br-dot"></span>${_ringFollow ? 'Following' : `Follow ${currentP ? currentP.name : ''}`}</button>
      </div>
      ${me && me.sanctioned ? _sanctionStandingHTML(me) : ''}
      ${buildBoardRing(_waitCarouselIdx, false, false, true)}
      <div class="wc-players-strip">${chips}</div>
      ${synergyBannerHTML()}
      <div class="wc-events"><div class="screen-label" style="margin-bottom:6px">Recent Events</div>${events}</div>
    </div>`;
  attachBoardRing();
}

function moveWaitCarousel(dir) {
  _waitCarouselIdx = (_waitCarouselIdx + dir + G.board.length) % G.board.length;
  renderWaiting();
}

// ─── SHOP ────────────────────────────────────────────────────────────────────
let _shopRenderKey = null;
function renderShop() {
  const me = G.players[myIdx];
  // v0.5.51: a second update while the shop is open (tally finished, someone reconnecting…) used to rebuild
  // the cards and snap the carousel back to the start. Same shop + same hand + same Mana → leave it alone;
  // anything else changed → rebuild but keep the scroll positions.
  const _key = JSON.stringify([G.round, G.currentPlayer, (G.shopOffers||[]).map(m => m.iid ?? m.id), myHand.map(m => m.iid + ':' + m.hp), me.mana]);
  const _buyEl = document.getElementById('shop-buy-scroll');
  if (_key === _shopRenderKey && _buyEl && _buyEl.isConnected) { updateStatusBar(true); return; }
  const _keepScroll = _buyEl ? { buy: _buyEl.scrollLeft, sell: (document.getElementById('shop-sell-scroll')||{}).scrollLeft || 0 } : null;
  _shopRenderKey = _key;
  updateStatusBar(true);
  updateHandStrip(false);   // v0.5.07: Sell row already shows the hand
  document.getElementById('main-content').classList.add('no-hand');

  const canAfford = (m) => me.mana >= m.cost && myHand.length < 5;

  // v0.5.06: tapping a card opens the shared detail sheet (Buy lives there)
  const buyCards = G.shopOffers.map((m, i) => renderCard(m, {
    size:'full', dim: !canAfford(m),
    onclick: `openShopDetail('buy', ${i})`
  })).join('');

  const sellCards = myHand.length === 0
    ? `<div style="padding:14px 0;color:var(--text-mute);font-size:13px">Hand is empty</div>`
    : myHand.map((m, i) => {
        const sv = _sellValue(m);
        return `<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:3px">
          ${renderCard(m, {size:'full', showCost:false, onclick:`openShopDetail('sell', ${i})`})}
          <div style="font-size:11px;color:var(--gold-glow);font-weight:600">+${sv} ✦</div>
        </div>`;
      }).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="mana-collect-banner">
      <span class="mana-collect-icon">✦</span>
      <span class="mana-collect-text"><strong>${me.mana} Mana</strong> available</span>
    </div>
    <div class="screen-section" style="padding-bottom:0">
      <div class="screen-label">Shop</div>
    </div>
    <div class="shop-one-action-note">One action only — buy <em>or</em> sell, then roll. Or skip.</div>
    <div class="shop-section-hdr">Buy${myHand.length >= 5 ? ' <span style="color:#e05555;font-size:11px;font-weight:700;margin-left:6px">✕ HAND FULL (5/5)</span>' : ` <span style="color:var(--text-mute);font-size:11px;margin-left:6px">(${myHand.length}/5)</span>`}</div>
    ${myHand.length >= 5 ? `<div style="background:#3a1515;border:1px solid #e05555;border-radius:8px;padding:8px 12px;font-size:12px;color:#e08888;margin:0 0 8px">Sell a summon first to make room</div>` : ''}
    <div class="shop-cards-wrap">
      <div class="shop-cards-scroll" id="shop-buy-scroll"><div class="scroll-inner">${buyCards}</div></div>
      ${scrollNavHTML('shop-buy-scroll','shop-buy-dot',G.shopOffers.length)}
    </div>
    <div class="shop-section-hdr" style="margin-top:14px">Sell from Hand</div>
    <div class="shop-cards-wrap">
      <div class="shop-cards-scroll" id="shop-sell-scroll"><div class="scroll-inner">${sellCards}</div></div>
      ${myHand.length > 1 ? scrollNavHTML('shop-sell-scroll','shop-sell-dot',myHand.length) : ''}
    </div>`;

  attachShopScrollListener('shop-buy-scroll','shop-buy-dot',G.shopOffers.length);
  attachShopScrollListener('shop-sell-scroll','shop-sell-dot',myHand.length);
  if (_keepScroll) {
    const b = document.getElementById('shop-buy-scroll'), sl = document.getElementById('shop-sell-scroll');
    if (b) { b.style.scrollSnapType = 'none'; b.scrollLeft = _keepScroll.buy; requestAnimationFrame(() => { b.style.scrollSnapType = ''; b.dispatchEvent(new Event('scroll')); }); }
    if (sl) sl.scrollLeft = _keepScroll.sell;
  }

  // v0.5.06: no Select/Buy button here — Buy/Sell live in the detail sheet. Skip stays.
  selectedIid = null;
  const ab = document.getElementById('action-bar');
  ab.classList.add('visible');
  ab.innerHTML = `<div class="shop-tap-hint">Tap a card above to <b>buy</b> or <b>sell</b></div>
    <button class="action-btn secondary" onclick="send('skip_shop')">Skip Shop</button>`;
}

// ─── ROLL ─────────────────────────────────────────────────────────────────
function renderRoll() {
  const me = G.players[myIdx];
  updateStatusBar(true);
  updateHandStrip(true);
  document.getElementById('main-content').classList.remove('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  const tile = G.board[me.position];
  document.getElementById('main-content').innerHTML = `
    <div class="roll-hero">
      <div class="roll-position-chip">Currently on tile <span>${me.position}</span> · <span style="color:${tile.element?TYPE_COLOR[tile.element]:'var(--gold-glow)'}">${tile.label || tile.kind}</span></div>
      <div class="dice-tray idle" id="die-btn" onclick="doRoll()"><div class="dt-label">TAP TO ROLL</div></div>
      <div class="roll-result-line waiting" id="roll-line">Tap the dice to roll</div>
    </div>
    ${_delayNoteHTML()}
    ${synergyBannerHTML()}`;
  DT.idle(document.getElementById('die-btn'));   // v0.5.30
}

// v0.5.46 (U5): Delay went off this turn — say so on the roll screen, with who played it
function _delayNoteHTML() {
  const d = (G.wcTriggers || []).slice().reverse().find(t => t.id === 'delay' && t.idx === myIdx && t.turn === G.turnCount);
  if (!d) return '';
  const by = d.byIdx != null ? G.players[d.byIdx] : null;
  return `<div style="margin:4px 16px 12px;padding:10px 14px;border-radius:12px;border:1px solid #c0392b;background:rgba(192,57,43,.14);text-align:center;font-size:13px;line-height:1.45;color:var(--text)">
      🃏 <b>Delay</b>: your shop was skipped this turn${by ? `<div style="font-style:italic;font-size:12px;color:${by.color || 'var(--text-dim)'};margin-top:2px">courtesy of ${by.name}</div>` : ''}</div>`;
}

function renderWell() {
  const isMyTurn = G.currentPlayer === myIdx;
  updateStatusBar(isMyTurn);
  updateHandStrip(isMyTurn);
  document.getElementById('main-content').classList.remove('no-hand');
  document.getElementById('action-bar').classList.remove('visible');
  const name = G.players[G.currentPlayer]?.name || 'Player';
  document.getElementById('main-content').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:32px;text-align:center">
      <div style="font-size:40px">✦</div>
      <div style="font-family:Cinzel,serif;font-size:18px;color:var(--gold-glow)">${isMyTurn ? 'Mana Well' : `${name} landed on the Mana Well`}</div>
      <div style="font-size:14px;color:var(--text-mute)">${isMyTurn ? 'You collected +40 ✦' : '+40 ✦ collected'}</div>
      <div style="font-size:12px;color:var(--text-mute);margin-top:8px">Continuing…</div>
    </div>`;
}

// ─── v0.5.30: DICE TRAY — the board's 3D dice (board-fx.js rollDice), sized for the phone ─────────
const DT = (() => {
  const PIPS = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  const FACE_ROT = {1:[0,0],6:[0,180],3:[0,-90],4:[0,90],2:[-90,0],5:[90,0]};
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  // dice-roll.mp3 = 9 takes in one file (same table as board.html); follows the phone's Sound Effects slider
  const TAKES = [[0.12,1.0],[1.52,2.2],[3.02,3.7],[4.42,5.1],[5.52,6.15],[6.82,7.55],[8.37,9.1],[9.47,10.25],[10.67,11.3]];
  let snd = null, sndT = null, lastTake = -1;
  function playRoll() {
    const L = _sfxLvl(); if (L <= 0) return;
    try {
      if (!snd) { snd = new Audio('/audio/dice-roll.mp3'); snd.preload = 'auto'; }
      let k; do { k = Math.floor(Math.random() * TAKES.length); } while (k === lastTake); lastTake = k;
      const [a, b] = TAKES[k];
      clearTimeout(sndT); snd.volume = 0.7 * L; snd.currentTime = a; snd.play().catch(() => {});
      sndT = setTimeout(() => { try { snd.pause(); } catch (e) {} }, (b - a) * 1000 + 120);
    } catch (e) {}
  }
  function warm() { try { if (!snd) { snd = new Audio('/audio/dice-roll.mp3'); snd.preload = 'auto'; snd.load(); } } catch (e) {} }
  function face(v, t) {
    const f = document.createElement('div'); f.className = 'dt-face'; if (t) f.style.transform = t;
    for (let i = 0; i < 9; i++) { const c = document.createElement('div'); if (PIPS[v].includes(i)) c.className = 'dt-pip'; f.appendChild(c); }
    return f;
  }
  function buildDie(sz) {
    const d = document.createElement('div'); d.className = 'dt-die'; d.style.width = d.style.height = sz + 'px';
    const h = sz / 2;
    const t = {1:`translateZ(${h}px)`,6:`rotateY(180deg) translateZ(${h}px)`,3:`rotateY(90deg) translateZ(${h}px)`,
               4:`rotateY(-90deg) translateZ(${h}px)`,2:`rotateX(90deg) translateZ(${h}px)`,5:`rotateX(-90deg) translateZ(${h}px)`};
    for (const v in t) d.appendChild(face(+v, t[v]));
    return d;
  }
  const geo = tray => ({ cx: tray.clientWidth / 2, cy: tray.clientHeight - 62, sz: 62, gap: 54 });
  function mk(tray, cls, st) { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, st || {}); tray.appendChild(d); return d; }
  function stage(tray, side) {
    const { cx, cy, sz, gap } = geo(tray);
    const st = mk(tray, 'dt-stage', { left: (cx + side * gap - sz / 2) + 'px', top: (cy - sz / 2) + 'px', width: sz + 'px', height: sz + 'px' });
    const sh = document.createElement('div'); sh.className = 'dt-shadow';
    Object.assign(sh.style, { width: sz * 1.2 + 'px', height: sz * .35 + 'px', left: (-sz * .1) + 'px', top: (sz * .9) + 'px' });
    st.appendChild(sh); const die = buildDie(sz); st.appendChild(die);
    return { st, sh, die };
  }
  function clear(tray) { tray.querySelectorAll('.dt-stage,.dt-fx,.dt-callout').forEach(e => e.remove()); }
  // resting dice before the first tap
  function idle(tray) {
    if (!tray) return; clear(tray); warm();
    [[5, -1, 18], [3, 1, -22]].forEach(([v, side, rz]) => {
      const { die } = stage(tray, side); const [rx, ry] = FACE_ROT[v];
      die.style.transform = `rotateX(${rx - 14}deg) rotateY(${ry + 18 * side}deg) rotateZ(${rz}deg)`;
    });
  }
  // dice already landed (landing-choice screen)
  function settled(tray, dice) {
    if (!tray || !Array.isArray(dice)) return; clear(tray);
    dice.forEach((v, i) => { const { die } = stage(tray, i ? 1 : -1); const [rx, ry] = FACE_ROT[v] || [0, 0]; die.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`; });
  }
  // shake the resting dice while the phone waits for the server; returns a stop function
  function shake(tray) {
    const anims = [...tray.querySelectorAll('.dt-stage')].map(st => st.animate([
      { transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(-4px,-6px) rotate(-8deg)' },
      { transform: 'translate(4px,-3px) rotate(7deg)' }, { transform: 'translate(0,0) rotate(0)' }], { duration: 260, iterations: Infinity }));
    return () => anims.forEach(a => { try { a.cancel(); } catch (e) {} });
  }
  function ring(tray, x, y, size, color) {
    const d = mk(tray, 'dt-fx', { width: size + 'px', height: size + 'px', left: (x - size / 2) + 'px', top: (y - size / 2) + 'px', border: `3px solid ${color}`, boxShadow: `0 0 18px ${color}, inset 0 0 12px ${color}` });
    const a = d.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(.6)', opacity: 1, offset: .15 }, { transform: 'scale(2.1)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    a.onfinish = () => d.remove();
  }
  function sparks(tray, x, y, color, n, dist) {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * .5, r = dist * (.6 + Math.random() * .6), s = 4 + Math.random() * 4;
      const d = mk(tray, 'dt-fx', { width: s + 'px', height: s + 'px', left: (x - s / 2) + 'px', top: (y - s / 2) + 'px', background: color, boxShadow: `0 0 ${s * 2}px ${color}` });
      const a = d.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * r}px,${Math.sin(ang) * r}px) scale(.2)`, opacity: 0 }], { duration: 800, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'both' });
      a.onfinish = () => d.remove();
    }
  }
  // tumble in from above, two bounces, land on the server's faces
  function throwDice(tray, dice, color, onLand) {
    clear(tray);
    const red = reduced(), dur = red ? 650 : 1150, { sz } = geo(tray), stages = [];
    setTimeout(playRoll, red ? 0 : 120);
    dice.forEach((v, i) => {
      const side = i ? 1 : -1, { st, sh, die } = stage(tray, side); stages.push(st);
      st.style.opacity = 0;
      const [rx, ry] = FACE_ROT[v] || [0, 0];
      const spinX = (red ? 360 : 720 + Math.floor(Math.random() * 2) * 360) * (Math.random() < .5 ? 1 : -1), spinY = (red ? 360 : 1080) * side;
      const sx = side * (70 + Math.random() * 40), sy = -(140 + Math.random() * 30);
      const T = (x, y, f, sc = 1) => `translate(${x}px,${y}px) rotateX(${rx + spinX * (1 - f)}deg) rotateY(${ry + spinY * (1 - f)}deg) scale(${sc})`;
      die.animate(red ? [{ transform: T(0, -30, 0) }, { transform: T(0, 0, 1) }] : [
        { transform: T(sx, sy, 0, 1.15), offset: 0 }, { transform: T(sx * .35, sy * .1, .45, 1.05), offset: .38 },
        { transform: T(sx * .08, 0, .75), offset: .58 }, { transform: T(sx * .03, -18, .9), offset: .72 },
        { transform: T(0, 0, .98), offset: .86 }, { transform: T(0, -6, 1), offset: .93 }, { transform: T(0, 0, 1), offset: 1 }
      ], { duration: dur + i * 90, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
      // fade on the stage, never on the die (opacity on a preserve-3d element flattens it)
      st.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * .3, fill: 'forwards' });
      sh.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: dur * .6, fill: 'forwards' });
    });
    setTimeout(() => {
      if (!red) stages.forEach(st => ring(tray, parseFloat(st.style.left) + sz / 2, parseFloat(st.style.top) + sz / 2, sz, color || '#c9a05a'));
      try { onLand && onLand(); } catch (e) {}
    }, dur + 90);
  }
  // pill above the dice: Stumble note, or DOUBLES! when this roll earned a Wild Card
  function callout(tray, game, { fresh = false } = {}) {
    if (!tray || !game) return;
    tray.querySelectorAll('.dt-callout').forEach(e => e.remove());
    const me = game.players ? game.players[myIdx] : null; if (!me) return;
    const t = game.wcTable;
    let html = '';
    if (me.lastStumble) html = `<div class="stumble-callout"${fresh ? '' : ' style="animation:none"'}>🃏 Stumbled — you move exactly 3</div>`;
    else if (t && t.playerIdx === myIdx && !t.pick && !t.skipped) html = `<div class="dbl-callout"${fresh ? '' : ' style="animation:none"'}>DOUBLES!<small>Wild Card at the end of your turn</small></div>`;
    if (!html) return;
    const o = mk(tray, 'dt-callout'); o.innerHTML = html;
    if (fresh && !me.lastStumble && !reduced()) sparks(tray, tray.clientWidth / 2, 34, '#ffd77a', 14, 90);
  }
  return { idle, settled, shake, throwDice, callout };
})();

function doRoll() {
  if (rollAnimating) return;
  const tray = document.getElementById('die-btn');
  if (!tray) return;

  rollAnimating = true;
  pendingGameState = null;
  pendingRollValue = null;
  rollShowCallback = null;

  tray.classList.remove('idle'); tray.onclick = null;
  const lbl = tray.querySelector('.dt-label'); if (lbl) lbl.remove();
  const line = document.getElementById('roll-line');
  if (line) line.textContent = 'Rolling…';
  const stopShake = DT.shake(tray);

  function finish() {
    rollAnimating = false;
    if (pendingGameState) {
      G = pendingGameState.game;
      myIdx = pendingGameState.myIdx;
      myHand = pendingGameState.hand;
      pendingGameState = null;
    }
    render();
  }
  // safety: if the server never answers, don't leave the screen frozen
  const guard = setTimeout(() => { if (rollAnimating && rollShowCallback) { rollShowCallback = null; stopShake(); finish(); } }, 8000);

  function displayResult(val) {
    clearTimeout(guard);
    stopShake();
    const g = pendingGameState ? pendingGameState.game : G;
    const me = g && g.players ? g.players[myIdx] : null;
    const dice = me && Array.isArray(me.lastDice) && me.lastDice.length === 2 ? me.lastDice : null;
    const landed = () => {
      if (line) { line.classList.remove('waiting'); line.textContent = `You rolled a ${val}!`; }
      DT.callout(tray, g, { fresh: true });
      setTimeout(finish, 1500);
    };
    if (dice) DT.throwDice(tray, dice, me.color, landed);
    else landed();
  }

  send('roll');
  if (pendingRollValue != null) displayResult(pendingRollValue);
  else rollShowCallback = displayResult;
}

// ─── LANDING CHOICE ─────────────────────────────────────────────────────────

function renderLandingChoice() {
  const me = G.players[myIdx];
  const pl = G.pendingLanding;
  if (!pl) { renderWaiting(); return; }

  updateStatusBar(true);
  updateHandStrip(true);
  document.getElementById('main-content').classList.remove('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  const optCards = _lcOptCardsHTML(pl.options, 'openLandingDetail');

  document.getElementById('main-content').innerHTML = `
    <div class="roll-hero" style="padding-bottom:8px">
      <div class="roll-position-chip">Currently on tile <span>${me.position}</span></div>
      <div class="dice-tray" id="dice-tray-landed"></div>
      <div class="roll-result-line">You rolled a ${pl.roll}!</div>
    </div>
    <div class="lc-section">
      <div class="lc-header">Choose Your Destination</div>
      <div class="lc-opts">${optCards}</div>
      <div class="lc-tap-hint">Tap a tile to see details, then confirm with <b>Land here</b></div>
    </div>
    ${synergyBannerHTML()}`;
  // v0.5.30: the dice stay where they landed
  const _dt = document.getElementById('dice-tray-landed');
  if (_dt) { DT.settled(_dt, me.lastDice); DT.callout(_dt, G); }
}

// v0.5.33: tile option cards shared by the landing choice and the Sanction turn pick
function _lcOptCardsHTML(options, openFn) {
  return options.map((pos, i) => {
    const tile = G.board[pos];
    const elColor = tile.element ? (TYPE_COLOR[tile.element] || '#888') : '#888';
    const tileImgSrc = TILE_IMG[tile.element] || TILE_IMG[tile.kind] || '';

    // Tile art (same pattern as renderPlayerTileCard but smaller)
    const artStyle = tileImgSrc
      ? `background:url('${tileImgSrc}') center/cover no-repeat;`
      : `background:linear-gradient(160deg,${elColor}33 0%,${elColor}11 100%);`;

    // Status label below the card
    let statusHtml;
    // Mini card for stationed monster (shown inside the tile card)
    let summonMiniHtml = '';
    if (tile.summon) {
      const m = tile.summon;
      const isSupM = m.rarity === 'support';
      const typeCol = isSupM ? '#9aabbc' : (TYPE_COLOR[m.type] || '#9184d9');
      const typeLabel = isSupM ? 'Support' : (m.type || 'Neutral');
      const typePill = `<div class="lc-type-pill" style="color:${typeCol};border-color:${typeCol}88;background:rgba(0,0,0,.72)">${typeLabel}</div>`;
      summonMiniHtml = `<div class="lc-summon-mini" style="position:absolute;bottom:28px;left:50%;transform:translateX(-50%);">${renderCard(m, {size:'mini', showCost:false})}${typePill}</div>`;
    }

    if (tile.kind === 'start') {
      statusHtml = `<div class="lc-status special">✦ Mana Well</div>`;
    } else if (tile.kind === 'chest') {
      statusHtml = `<div class="lc-status special">📦 Chest</div>`;
    } else if (tile.kind === 'temple') {
      statusHtml = `<div class="lc-status special">🏛 Temple</div>`;
    } else if (tile.kind === 'heal') {
      statusHtml = `<div class="lc-status special">💚 Healing</div>`;
    } else if (tile.ownerId == null) {
      statusHtml = `<div class="lc-status unclaimed">Unclaimed</div>`;
    } else if (tile.ownerId === myIdx) {
      let myMonsterHtml = '';
      if (tile.summon) {
        const m = tile.summon;
        const hpPct = Math.max(0, Math.round((m.hp / m.maxHp) * 100));
        const hpColor = hpPct > 60 ? '#4caf7d' : hpPct > 30 ? '#e8a838' : '#e85555';
        myMonsterHtml = `
          <div class="lc-enemy-monster">
            <div class="lc-mon-name">${m.name}</div>
            <div class="lc-hp-bar-wrap"><div class="lc-hp-bar" style="width:${hpPct}%;background:${hpColor}"></div></div>
          </div>`;
      }
      statusHtml = `${myMonsterHtml}<div class="lc-status own">Your Tile</div>`;
    } else {
      // Enemy tile — show owner name
      const owner = G.players.find(p => p.idx === tile.ownerId);
      const ownerColor = owner ? owner.color : '#888';
      const ownerName = owner ? owner.name : 'Enemy';
      let monsterHtml = '';
      if (tile.summon) {
        const m = tile.summon;
        const hpPct = Math.max(0, Math.round((m.hp / m.maxHp) * 100));
        const hpColor = hpPct > 60 ? '#4caf7d' : hpPct > 30 ? '#e8a838' : '#e85555';
        monsterHtml = `
          <div class="lc-enemy-monster">
            <div class="lc-mon-name">${m.name}</div>
            <div class="lc-hp-bar-wrap"><div class="lc-hp-bar" style="width:${hpPct}%;background:${hpColor}"></div></div>
          </div>`;
      }
      statusHtml = `${monsterHtml}<div class="lc-status enemy" style="color:${ownerColor}">${ownerName}</div>`;
    }

    // Element label inside card
    const elLabel = tile.element || (tile.kind === 'start' ? 'Well' : tile.kind || '');

    return `
      <div class="lc-opt" style="animation-delay:${i * 80}ms" onclick="${openFn}(${i})">
        <div class="lc-tile-num">${pos}</div>
        <div class="lc-tile-card" style="border-color:${elColor}88;">
          <div class="lc-tile-card-bg" style="${artStyle}"></div>
          ${summonMiniHtml}
          <div class="lc-el-label" style="color:${elColor}">${elLabel}</div>
        </div>
        ${statusHtml}
      </div>`;
  }).join('');
}

// v0.5.07: landing goes through the shared detail sheet — a tap previews, only "Land here" commits
function _landingAction(pos) {
  const t = G.board[pos];
  const names = { start:'Mana Well', well:'Mana Well', chest:'Treasure Chest', temple:'Temple', heal:'Healing Spring', healing:'Healing Spring' };
  const run = () => doChooseLanding(pos);
  if (t.kind !== 'element') return { label:`Land here · ${names[t.kind] || t.label || t.kind}`, kind:'primary', run };
  if (t.ownerId == null)    return { label:'Land here · Claim', kind:'claim', hint:'Empty tile — you can station a summon here', run };
  if (t.ownerId === myIdx)  return { label:'Land here · Your tile', kind:'primary', hint:'Swap, heal, or change element', run };
  const owner = G.players.find(p => p.idx === t.ownerId);
  const m = t.summon;
  if (!m) return { label:'Land here · Enemy tile', kind:'battle', hint:`Owned by ${owner ? owner.name : 'an opponent'}`, run };
  const noHand = myHand.length === 0;
  return { label:'Land here · Battle', kind:'battle',
    hint: `vs ${m.name} (${m.hp}/${m.maxHp} HP)` + (noHand ? ' — empty hand: 8✦ retreat penalty' : ''), run };
}
function openLandingDetail(i) {
  const pl = G.pendingLanding;
  if (!pl) return;
  openDetailSheet(pl.options, i, _landingAction, {
    title: 'Choose Destination',
    renderItem: _tileDetailBody,
    colorOf: _tileColor,
  });
}

function doChooseLanding(tilePos) {
  // Tap feedback — briefly highlight the chosen card
  const cards = document.querySelectorAll('.lc-opt');
  cards.forEach(c => c.classList.remove('lc-opt-pressed'));
  // Find the clicked card by pos (data attribute would be cleaner but onclick index works)
  if (G.pendingLanding) {
    const idx = G.pendingLanding.options.indexOf(tilePos);
    if (idx >= 0 && cards[idx]) {
      cards[idx].classList.add('lc-opt-pressed');
    }
  }
  send('choose_landing', { tilePos });
}

// ─── STALEMATE ──────────────────────────────────────────────────────────────
// stalemateTab: 'attack' | 'buy' | 'sell'
function renderStalemate() {
  const me = G.players[myIdx];
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');

  const sd = G.stalemateData;
  const tile = G.board[sd?.tilePos ?? me.position];
  const defM = tile?.summon;
  const defOwner = (tile?.ownerId != null) ? G.players.find(p => p.idx === tile.ownerId) : null;
  const elColor = TYPE_COLOR[tile?.element] || 'var(--accent)';
  const hasHand = myHand.length > 0;

  const handCards = myHand.length
    ? myHand.map(m => renderCard(m, { size:'full', showCost:false })).join('')
    : `<div style="padding:16px 0;color:var(--text-mute);font-size:12px;">No summons in hand</div>`;

  document.getElementById('main-content').innerHTML = `
    <div class="resolve-banner battle">
      <span class="resolve-icon">🤝</span>
      <div>
        <div class="resolve-title">Stalemate!</div>
        <div class="resolve-sub">Both summons survived the last battle.</div>
      </div>
    </div>

    <div style="padding:0 16px 4px;">
      <div style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-mute);font-family:'Cinzel',serif;margin-bottom:10px;">Contested Tile</div>
      <div style="display:flex;align-items:center;gap:14px;padding:14px;background:var(--surface);border-radius:12px;border:1px solid ${elColor}55;">
        ${renderPlayerTileCard(tile)}
        <div style="flex:1;min-width:0;">
          ${defM ? renderCard(defM, { size:'full', showCost:false }) : `<div style="color:var(--text-mute);font-size:12px;">No summon</div>`}
          ${defOwner ? `<div style="font-size:11px;color:${defOwner.color};font-weight:600;margin-top:5px;">${defOwner.name}'s summon</div>` : ''}
        </div>
      </div>
    </div>

    <div style="padding:16px 16px 4px;">
      <div style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-mute);font-family:'Cinzel',serif;margin-bottom:10px;">Your Hand</div>
      <div class="picker-scroll" id="stalemate-hand-scroll"><div class="scroll-inner">${handCards}</div></div>
      ${scrollNavHTML('stalemate-hand-scroll','stalemate-hand-dot',myHand.length)}
    </div>

    <div style="padding:12px 16px 0;font-size:12px;color:var(--text-dim);line-height:1.5;">
      ${hasHand
        ? '⚔️ <strong style="color:var(--text)">Battle Again</strong> — fight fresh, this uses your turn.<br>🚶 <strong style="color:var(--text)">Continue On</strong> — retreat for <span style="color:var(--gold-glow)">8✦</span>, then shop as normal.'
        : '🚶 You have no summons in hand. You must <strong style="color:var(--text)">Continue On</strong> (costs <span style="color:var(--gold-glow)">8✦</span>).'}
    </div>`;

  attachShopScrollListener('stalemate-hand-scroll','stalemate-hand-dot',myHand.length);

  const ab = document.getElementById('action-bar');
  ab.classList.add('visible');
  ab.innerHTML = hasHand
    ? `<button class="action-btn secondary" onclick="doStalemateContinue()">Continue (8✦)</button>
       <button class="action-btn primary" onclick="doStalemateFight()">⚔️ Battle Again</button>`
    : `<button class="action-btn primary" onclick="doStalemateContinue()">Continue On (8✦)</button>`;
}

// ─── CLAIM ──────────────────────────────────────────────────────────────────