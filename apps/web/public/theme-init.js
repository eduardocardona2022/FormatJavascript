(function () {
  try {
    var stored = window.localStorage.getItem('formatjs-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (stored !== 'light' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch {
    // Si localStorage no está disponible, se usa el tema claro por defecto.
  }
})();
