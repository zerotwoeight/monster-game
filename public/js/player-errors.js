
// v0.5.47: report script errors to the server so a crash on this screen shows in the server terminal + crash-log.txt
(function () {
  let n = 0;
  function rep(message, stack) {
    try { if (++n > 10 || typeof ws === 'undefined' || !ws || ws.readyState !== 1) return;
      ws.send(JSON.stringify({ action: 'client_error', where: 'player v0.5.52', message: String(message || ''), stack: String(stack || ''), phase: (typeof G !== 'undefined' && G && G.phase) || '' })); } catch (_) {}
  }
  window.addEventListener('error', e => rep(e.message, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', e => rep('Unhandled promise: ' + ((e.reason && e.reason.message) || e.reason), e.reason && e.reason.stack));
})();
