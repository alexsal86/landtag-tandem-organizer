(function() {
  var inIframe = false;
  try { inIframe = window.self !== window.top; }
  catch (e) { inIframe = true; }

  if (inIframe) {
    // ── Iframe: deregister any COI service workers, then reload once ──
    var state = sessionStorage.getItem('coi-cleanup-state');
    console.log('[COI-iframe] cleanup state:', state);

    if (state === 'done') {
      console.log('[COI-iframe] cleanup done, proceeding normally');
      return;
    }

    if (state === 'reloaded') {
      sessionStorage.setItem('coi-cleanup-state', 'done');
      console.log('[COI-iframe] post-reload, marked done');
      return;
    }

    if (!state && 'serviceWorker' in navigator) {
      sessionStorage.setItem('coi-cleanup-state', 'started');
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        console.log('[COI-iframe] found', regs.length, 'SW registration(s)');
        if (regs.length === 0) {
          sessionStorage.setItem('coi-cleanup-state', 'done');
          return;
        }
        return Promise.all(regs.map(function(r) { return r.unregister(); }));
      }).then(function(results) {
        if (results && results.length > 0) {
          console.log('[COI-iframe] deregistered', results.length, 'SW(s), reloading…');
          sessionStorage.setItem('coi-cleanup-state', 'reloaded');
          window.location.reload();
        }
      }).catch(function(err) {
        console.warn('[COI-iframe] cleanup error:', err);
        sessionStorage.setItem('coi-cleanup-state', 'done');
      });
    }
    return;
  }

  // ── Standalone tab: register COI service worker ──
  window.coi = {
    shouldRegister: function() { return true; },
    shouldDeregister: function() { return false; },
    quiet: true
  };
  var s = document.createElement('script');
  s.src = '/coi-serviceworker.js?v=2026-03-04-v3';
  document.head.appendChild(s);
})();
