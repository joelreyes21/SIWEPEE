/*! SIWEPE · © 2026 Joel Reyes. Todos los derechos reservados.
   Disuasor básico de inspección. AVISO: esto NO es una medida de seguridad
   real — las DevTools no se pueden bloquear de verdad (se abren desde el menú,
   con JS desactivado, view-source, un proxy, etc.). La seguridad real de SIWEPE
   vive en el backend (JWT, bcrypt, validaciones). Esto solo estorba al curioso
   casual. */
(function () {
  function bloquear(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  // Clic derecho → menú contextual
  document.addEventListener('contextmenu', bloquear);

  // Atajos de teclado hacia las herramientas de desarrollo / ver código
  document.addEventListener('keydown', function (e) {
    var key = e.key || '';
    var kl = key.toLowerCase();
    var mod = e.ctrlKey || e.metaKey;      // Ctrl (Windows/Linux) o Cmd (Mac)

    // F12
    if (key === 'F12') return bloquear(e);
    // Ctrl/Cmd + Shift + I  (Inspector) / J (Consola) / C (Selector)
    if (mod && e.shiftKey && (kl === 'i' || kl === 'j' || kl === 'c')) return bloquear(e);
    // Ctrl/Cmd + U  (ver código fuente)
    if (mod && kl === 'u') return bloquear(e);
  });
})();
