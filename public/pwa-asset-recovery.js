/**
 * Pre-boot recovery when a module/script asset fails to load (stale SW / deleted chunk).
 * Must stay a classic script — hosted CSP is script-src 'self' (no inline).
 */
(function () {
  var KEY = "vctr-pwa-stale-recovery-at";
  var COOLDOWN_MS = 30000;
  var recovering = false;

  function shouldThrottle() {
    try {
      var last = sessionStorage.getItem(KEY);
      var lastAt = last ? Number(last) : 0;
      if (isFinite(lastAt) && Date.now() - lastAt < COOLDOWN_MS) {
        return true;
      }
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch (_) {}
    return false;
  }

  function recover() {
    if (recovering || shouldThrottle()) {
      return;
    }
    recovering = true;

    var unregister = Promise.resolve();
    if ("serviceWorker" in navigator) {
      unregister = navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(
          regs.map(function (reg) {
            return reg.unregister();
          }),
        );
      });
    }

    var clearCaches = Promise.resolve();
    if ("caches" in window) {
      clearCaches = caches.keys().then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            return caches.delete(key);
          }),
        );
      });
    }

    Promise.all([unregister, clearCaches]).finally(function () {
      window.location.reload();
    });
  }

  window.addEventListener(
    "error",
    function (event) {
      var target = event && event.target;
      if (!target) {
        return;
      }
      var tag = target.tagName;
      if (tag === "SCRIPT" && target.type === "module") {
        recover();
        return;
      }
      if (tag === "LINK" && target.rel === "modulepreload") {
        recover();
      }
    },
    true,
  );
})();
