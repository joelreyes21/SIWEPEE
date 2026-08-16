# CLAUDE.md

## Proyecto

Frontend estático multiempresa de SIWEPE, sin build ni servidor propio. El API Express/MySQL vive en `../Backend_SIWEPE-main`, desplegado en Railway, y `assets/js/shared/data.js` (`API_BASE`) apunta ahí siempre — no hay modo "local" ni detección de host. Este sitio se sube tal cual a cualquier hosting estático (Vercel, Netlify, GitHub Pages, etc.): no necesita build step ni variables de entorno propias.

## Páginas

`index.html` vive en la raíz del repo (junto a `assets/`). Las otras 7 páginas viven en `pages/` (un nivel abajo, por eso referencian `../assets/...` y enlazan de vuelta con `../index.html`). Esta división la definió Joel — no muevas `index.html` a `pages/` de nuevo sin hablarlo primero.

- `index.html`: portada y registro verificado de empresas.
- `pages/descubrir.html`: marketplace global de tiendas y productos.
- `pages/tienda.html`: tienda de una empresa, identificada por `?e=slug`.
- `pages/admin.html`: acceso y panel administrativo.
- `pages/terminos.html`: términos, privacidad y cookies.

Todas cargan `platform.css` (con el prefijo de ruta que corresponda) para identidad institucional. La portada, marketplace y legales muestran el logo SIWEPE. La tienda y el panel conservan el logo del emprendimiento y muestran SIWEPE como plataforma, sin sustituirlo.

Los enlaces entre las 7 páginas de `pages/` siguen siendo nombres sueltos (`admin.html`, `tienda.html?e=...`) porque viven juntas ahí. Los enlaces hacia/desde `index.html` cruzan una carpeta (`../index.html` desde `pages/`, `pages/admin.html` etc. desde `index.html`). El backend construye enlaces absolutos (verificación de correo → `${SITE_URL}/index.html`, recuperación de contraseña/onboarding → `${SITE_URL}/pages/admin.html`) — si esta división cambia, hay que actualizar esos redirects en `Backend_SIWEPE-main/server.js` y las rutas en `test/contracts.test.js` (`carpetaDe()`).

## Datos y autenticación

- `assets/js/shared/data.js` define `API_BASE`, sesión JWT, cache local, temas y `DB`.
- Clientes, administradores y proveedores ingresan por correo y contraseña con `POST /api/auth/login`.
- Los clientes se registran globalmente con `POST /api/auth/register` y usan checkout, historial, perfil, cancelación y chat mediante endpoints dedicados.
- Admin/proveedor consultan `GET /api/state`. Sólo admin escribe `PUT /api/state`, siempre con `_revision`.
- El rol proveedor es de consulta en la interfaz y el servidor.
- La empresa activa se obtiene de `?e=` mediante `bsEmpresa()`.

## Reglas

- Mantener textos, variables y comentarios en español.
- Escapar datos antes de insertarlos con `innerHTML` y no reintroducir bloqueos de DevTools como supuesto control de seguridad.
- No mostrar datos internos del catálogo ni confiar en precios enviados por el navegador.
- Preservar responsive sin scroll horizontal en 390 px y respetar `prefers-reduced-motion`.
- Para verificar cambios, ejecutar `npm test` en el backend: incluye sintaxis inline, existencia de recursos y contratos frontend/backend.
