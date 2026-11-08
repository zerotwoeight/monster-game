
// v0.5.48 (live log): if this phone's page stalls for over half a second, report it to the server's game log
(function () { let last = performance.now();
  setInterval(() => { const now = performance.now(), lag = now - last - 500; last = now;
    if (lag > 500 && !document.hidden) { try { if (typeof ws !== 'undefined' && ws && ws.readyState === 1) ws.send(JSON.stringify({ action: 'client_perf', kind: 'page stall', ms: Math.round(lag), phase: (typeof G !== 'undefined' && G && G.phase) || '' })); } catch (_) {} } }, 500);
})();
