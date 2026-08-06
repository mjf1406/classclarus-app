(function () {
  try {
    var meta = document.querySelector('meta[name="app-theme-storage-key"]');
    var key = meta && meta.getAttribute("content");
    if (!key || key.indexOf("%") === 0) return;
    var theme = localStorage.getItem(key) || "system";
    var resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.classList.add(resolved);
  } catch (_) {}
})();
