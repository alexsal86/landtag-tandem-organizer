

## Root Cause

The iframe detection `window !== window.top` throws a **DOMException** when the parent frame is cross-origin (Lovable Preview is on a different domain). The script crashes silently — no SW deregistration happens, and the old COI service worker continues intercepting all requests with COOP/COEP headers, breaking iframe embedding.

## Fix

### `index.html` — Wrap iframe detection in try/catch

Replace the current inline script with a version that:
1. Uses `try/catch` around `window.top` access (cross-origin throws → means we're in an iframe)
2. In iframe: deregisters COI service workers + reloads
3. Outside iframe: loads `coi-serviceworker.js` normally for full functionality (Push, Matrix E2EE)

```javascript
(function() {
  var inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch (e) {
    inIframe = true; // cross-origin → definitely in iframe
  }

  var onChat = window.location.pathname.startsWith('/chat');

  if (inIframe && !onChat) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        var hadWorker = false;
        regs.forEach(function(r) {
          if (r.active && r.active.scriptURL.indexOf('coi-serviceworker') !== -1) {
            hadWorker = true;
            r.unregister();
          }
        });
        if (hadWorker) {
          window.location.reload();
        }
      });
    }
  } else {
    window.coi = {
      shouldRegister: function() { return true; },
      shouldDeregister: function() { return false; },
      quiet: true
    };
    var s = document.createElement('script');
    s.src = '/coi-serviceworker.js';
    document.head.appendChild(s);
  }
})();
```

### Result

| Environment | Behavior |
|---|---|
| Preview iframe | COI worker deregistered, no COOP/COEP, app renders |
| Direct browser tab | COI worker active, Push + Matrix E2EE fully functional |

One file changed: `index.html` (inline script only).

