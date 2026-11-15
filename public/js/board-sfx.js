// board-sfx.js v1.3 (2026-11-15, board v0.6.96; v1.3 = 13 picks from auditions v1.3: new death + streak-ended clips, volumes) · v1.2 (board v0.6.95; v1.2 = Mana lost → Checkpoint_Error_Riddle_Sfx_05 at 0.33) · v1.1 (2026-11-14, board v0.6.93; v1.1 = Rivalry sounds, placeholders until the user picks) · v1.0 (board v0.6.92) — SAMPLED SOUND EFFECTS (Polish Plan stage 4).
// The clips the user picked on /sound-auditions.html, one entry per moment. Files live in /audio/sfx/ (trimmed,
// levelled 112k mp3s made from D:\Asset Library\Stock\Audio Assets). To swap a sound: drop a new mp3 in
// /audio/sfx/ and change `f` here; `v` is the volume (0 to 1) before the board's Sound Effects slider.
// Several moments share a clip on purpose (the user's picks).
const SFX_SAMPLES = {
  battleStart:   { f: 'oimp-orchestral-impact-03',              v: 0.7 },     // battle preview opens
  lunge:         { f: 'sw-whooshshrttransitionalwhoosh-sft086203', v: 0.7 },     // each strike, just before the hit
  hitHeavy:      { f: 'oimp-orchestral-impact-01',              v: 0.5 },     // layer under Hit-Slash / Magic / Claw on big hits only
  stamp:         { f: 'med-medieval-fighting-war-club-01',      v: 0.7 },     // 2× STRONG / RESISTED stamp
  callout:       { f: 'mg-bellmagicfairyb',                     v: 0.39 },    // ability / Wild Card callout in a battle
  death:         { f: 'braam-orchestral-braams-03-bm',          v: 0.7 },     // summon destroyed (crumble)
  win:           { f: 'mus-symphfsttensioncre-ma011902',        v: 0.7 },     // outcome: attacker wins
  held:          { f: 'oimp-orchestral-impact-03',              v: 0.7 },     // outcome: defender holds
  mutual:        { f: 'oimp-orchestral-impact-24',              v: 0.34 },    // outcome: both destroyed
  stalemate:     { f: 'oimp-orchestral-impact-03',              v: 0.7 },     // outcome: stalemate
  manaGain:      { f: 'mg-bellmagicfairyb',                     v: 0.55 },    // gold +N float on a chip
  manaLoss:      { f: 'chk-checkpoint-error-riddle-sfx-05',     v: 0.25 },    // red -N float (v1.2: quieter, user's pick 2026-11-15)
  income:        { f: 'mg-bellmagicfairyb',                     v: 0.55 },    // end of the income sweep
  claim:         { f: 'fc-lowthudpunch-fs040204',               v: 0.37 },    // summon stationed / token lands on an empty tile
  takeover:      { f: 'msa-magic-spell-attack-sfx-08',          v: 0.42 },    // tile flips to a new owner
  sacrifice:     { f: 'msa-magic-spell-attack-sfx-26',          v: 0.53 },    // own summon sacrificed (own-tile action)
  changeElement: { f: 'mg-fantasy-dsl03-19-2',                  v: 0.36 },    // own tile changes element
  retreat:       { f: 'dw-motion-dreamy-whoosh-19',             v: 0.7 },     // player backs off an enemy tile
  baneGround:    { f: 'msa-magic-spell-attack-sfx-13',          v: 0.7 },     // Bane Ground banner
  curse:         { f: 'msa-magic-spell-attack-sfx-26',          v: 0.7 },     // Jinx / Delay / Stumble / Levy card stamps in
  plague:        { f: 'ff-ghost-fantasy-apparition-whoosh-fant053', v: 0.7 },     // Plague pulse
  crown:         { f: 'mus-chinesechimesbells-ma020801',        v: 0.49 },    // crown changes hands
  // v1.1 Rivalry (Denied + Streak ended picked 2026-11-15; Revenge and Streak still placeholders)
  revenge:       { f: 'mus-symphdramaticfinal-ma011003',        v: 0.7 },     // REVENGE! outcome (plays in place of the win / held sound)
  denied:        { f: 'mus-symphfsttensioncre-ma011902',        v: 0.7 },     // DENIED + jab, just after the outcome sound
  streak:        { f: 'ff-accentsenhancers-ec07-16-1',          v: 0.7 },     // on a streak (3+) / Unstoppable (5+)
  streakEnded:   { f: 'oimp-orchestral-impact-18',              v: 0.6 }      // streak ended
};
const _smpPool = {}, _smpLast = {};
// sfxSample('lunge') plays the clip. opt.gap = ignore repeats inside that many ms; opt.vol = extra volume factor.
function sfxSample(key, opt) {
  const d = SFX_SAMPLES[key]; if (!d) return false;
  opt = opt || {};
  const now = Date.now();
  if (opt.gap && now - (_smpLast[key] || 0) < opt.gap) return true;
  _smpLast[key] = now;
  const L = _sfxLvl(); if (L <= 0) return true;
  try {
    const base = _smpPool[d.f] || (_smpPool[d.f] = new Audio('/audio/sfx/' + d.f + '.mp3'));
    const a = base.cloneNode(); a.volume = Math.max(0, Math.min(1, d.v * (opt.vol == null ? 1 : opt.vol) * L));
    a.play().catch(() => {});
  } catch (e) {}
  return true;
}
// warm the cache so the first play is not late
try { Object.keys(SFX_SAMPLES).forEach(k => { const f = SFX_SAMPLES[k].f; if (!_smpPool[f]) { const a = new Audio('/audio/sfx/' + f + '.mp3'); a.preload = 'auto'; _smpPool[f] = a; } }); } catch (e) {}

// The synth versions of these are replaced by the samples (the synth stays in board-core.js as SFX._synth.* for reference).
(function () {
  if (typeof SFX === 'undefined') return;
  const map = { battleStart: 'battleStart', battleWin: 'win', battleLose: 'held', battleMutual: 'mutual', battleStalemate: 'stalemate',
                claimTile: 'claim', takeover: 'takeover', crownFanfare: 'crown' };
  SFX._synth = {};
  Object.keys(map).forEach(fn => { SFX._synth[fn] = SFX[fn]; SFX[fn] = () => sfxSample(map[fn], { gap: 120 }); });
  // the claim fanfare keeps its chime and gains the thud under it (Auto Setup deals many at once, hence the gap)
  const fan = SFX.claimFanfare; SFX.claimFanfare = function () { sfxSample('claim', { gap: 150 }); return fan.apply(this, arguments); };
  // board effects that had no sound at all
  if (window.BoardFX) {
    const pl = BoardFX.plague; if (pl) BoardFX.plague = function () { sfxSample('plague', { gap: 1500 }); return pl.apply(this, arguments); };
    const cu = BoardFX.curseLand; if (cu) BoardFX.curseLand = function (card, fromEl, caption, sub, opts) {
      opts = opts || {}; const was = opts.onStamp;
      opts.onStamp = function () { sfxSample('curse'); if (was) return was.apply(this, arguments); };
      return cu.call(this, card, fromEl, caption, sub, opts);
    };
  }
})();
