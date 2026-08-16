# CLAUDE.md

## Proyecto

Frontend estático multiempresa de SIWEPE. El API Express/MySQL vive en `../Backend_SIWEPE-main`. Para desarrollo local se puede ejecutar `node serve-local.js` y abrir `http://127.0.0.1:5500` con el API en `http://localhost:3000`.

## Páginas

Todo el HTML vive en `pages/` (assets se mantiene en la raíz, un nivel arriba — por eso cada página referencia `../assets/...`). `serve-local.js` sirve `pages/index.html` como raíz (`/`).

- `pages/index.html`: portada y registro verificado de empresas.
- `pages/descubrir.html`: marketplace global de tiendas y productos.
- `pages/tienda.html`: tienda de una empresa, identificada por `?e=slug`.
- `pages/admin.html`: acceso y panel administrativo.
- `pages/terminos.html`: términos, privacidad y cookies.

Todas cargan `../assets/css/platform.css` para identidad institucional. La portada, marketplace y legales muestran el logo SIWEPE. La tienda y el panel conservan el logo del emprendimiento y muestran SIWEPE como plataforma, sin sustituirlo.

Los enlaces entre páginas siguen siendo nombres sueltos (`admin.html`, `tienda.html?e=...`) porque todas viven en la misma carpeta `pages/`. El backend construye enlaces absolutos hacia `${SITE_URL}/pages/...` (verificación de correo, recuperación de contraseña, onboarding) — si se mueve o renombra `pages/`, hay que actualizar también esos redirects en `Backend_SIWEPE-main/server.js`.

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
