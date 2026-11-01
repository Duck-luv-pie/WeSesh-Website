// Dev-only: reloads the page when watched files change. No-op outside localhost.
(() => {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;
  const files = ['index.html', 'styles.css', 'mock.css', 'mock.js', 'sections.css', 'sections.js'];
  const seen = {};
  setInterval(async () => {
    for (const f of files) {
      try {
        const res = await fetch(f, { method: 'HEAD', cache: 'no-store' });
        const stamp = res.headers.get('Last-Modified');
        if (seen[f] && seen[f] !== stamp) return location.reload();
        seen[f] = stamp;
      } catch {}
    }
  }, 1000);
})();
