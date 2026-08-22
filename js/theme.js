/* Theme toggle — light/dark, kept in memory for this session */
(function () {
  const THEME_ICONS = {
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'
  };

  const themeBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const themeLabel = document.getElementById('theme-label');
  const htmlEl = document.documentElement;

  function setTheme(theme) {
    htmlEl.dataset.theme = theme;
    const isDark = theme === 'dark';
    themeIcon.innerHTML = isDark ? THEME_ICONS.sun : THEME_ICONS.moon;
    const label = isDark ? 'Light mode' : 'Dark mode';
    themeLabel.textContent = label;
    themeBtn.setAttribute('aria-label', label);
    themeBtn.setAttribute('aria-pressed', String(isDark));
  }

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(prefersDark ? 'dark' : 'light');
  themeBtn.addEventListener('click', () => {
    setTheme(htmlEl.dataset.theme === 'dark' ? 'light' : 'dark');
  });
})();
