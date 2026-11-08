
// v0.6.43: Full screen — button in lobby + top bar, F key toggles, Esc exits (browser default)
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const req = el.requestFullscreen || el.webkitRequestFullscreen; if (req) { const p = req.call(el); if (p && p.catch) p.catch(()=>{}); } }
}
document.addEventListener('keydown', e => {
  if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName||''))) toggleFullscreen();
});
document.addEventListener('fullscreenchange', () => { try { window.dispatchEvent(new Event('resize')); } catch(_){} });
