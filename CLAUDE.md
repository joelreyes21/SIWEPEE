# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este repo

SIWEPE (antes "Belle Stock / Miscelaneasaly") es el **front-end estático** de una plataforma
multi-tienda: cualquiera puede crear su "empresa" (tienda en línea + panel de administración)
sin backend propio. Es un proyecto académico (ver `RESPUESTAS_TERNA.md` para el contexto de la
entrega y lo que queda pendiente para una "segunda etapa").

El **backend vive en otro repositorio** (Node + MySQL, desplegado en Railway). Este repo solo
consume esa API vía `fetch`; aquí no hay servidor, build ni base de datos.

## Comandos

No hay `package.json`, ni bundler, ni linter, ni test runner. Es HTML/CSS/JS plano.

- **Ejecutar localmente**: abrir los `.html` directo en el navegador, o servirlos con cualquier
  servidor estático (ej. `python -m http.server`) si se necesita evitar restricciones de `file://`.
- **Backend de desarrollo**: para que el login, el guardado y el catálogo funcionen de verdad hace
  falta el backend corriendo en `http://localhost:3000` (repo aparte). Sin él, el front cae en modo
  "sin conexión" y usa datos semilla en `localStorage` (ver más abajo).
- No hay pasos de build ni de verificación automatizados que ejecutar antes de confirmar un cambio.

## Arquitectura

### Las 3 páginas

- **`index.html`** — landing/marketplace: lista las empresas registradas (`GET /api/empresas`) y
  tiene el wizard de 3 pasos para crear una empresa nueva (`POST /api/empresas`).
- **`tienda.html`** — la tienda pública de **una** empresa (catálogo, carrito, pedidos, chat con el
  vendedor) y también la pantalla de auth (tabs: iniciar sesión cliente / registro / admin).
- **`admin.html`** — panel de administración de esa misma empresa (dashboard, productos, ventas,
  compras, movimientos de inventario, pedidos, reportes, configuración).

Cada página carga `assets/js/shared/data.js` primero y luego su propio `main.js`
(`assets/js/admin/main.js` o `assets/js/tienda/main.js`). Los estilos están en
`assets/css/admin.css` y `assets/css/tienda.css`.

### Multi-tenant: cómo se identifica la empresa

La empresa activa viaja en la URL como `?e=slug` (o id) y `bsEmpresa()` (en `data.js`) la persiste
en `localStorage['bs_empresa']` para que sobreviva la navegación dentro de la misma tienda.
Todas las llamadas de catálogo/estado usan ese valor.

### Autenticación y sesión

- El login real ocurre **en `tienda.html`** (pestaña Admin del panel de auth), que llama a
  `POST /api/auth/login` (o `/api/auth/register`, `/api/auth/cliente-login` para clientes) y guarda
  el JWT con `guardarSesionToken(token, role, nombre)` → `localStorage['bs_token']` / `bs_role`.
- **`admin.html` no hace login por sí mismo**: en su `DOMContentLoaded` solo valida que exista
  `bs_token` y que `bs_role` sea `admin` o `proveedor`; si no, redirige a `tienda.html`. El
  `login-page` con PIN que aparece en el HTML de `admin.html` es una pantalla heredada — el guardián
  real de acceso es ese chequeo de token/rol.
- Roles: `admin`, `proveedor`, `cliente` (clientes navegan el catálogo sin cuenta; solo se
  autentican al confirmar el pedido — o ya tienen cuenta vía `cliente-login`).

### Estado global: el objeto `DB`

`data.js` mantiene un objeto `DB` en memoria con esta forma (ver `_esqueletoDB()` / `semilla()`):

```
{ config:{nombre,logo,moneda,tema,pinAdmin,banners,pago}, seq:{...},
  categorias:[], proveedores:[], clientes:[], productos:[],
  compras:[], ventas:[], movimientos:[], pedidos:[], mensajes:[] }
```

- **Carga**: `bootstrapDB()` — con token trae el estado completo (`GET /api/state`); sin token
  (invitado) trae solo el catálogo público (`GET /api/catalog?empresa=slug`). Si el backend no
  responde, cae a un respaldo local en `localStorage['siwepe_pro_v1']` o a los datos semilla.
- **Guardado**: `dbGuardar()` escribe primero en `localStorage` (respaldo inmediato) y, si hay
  sesión, hace `PUT /api/state` en el backend. Después de cada cambio en `DB` se debe llamar
  `dbGuardar()` explícitamente — no hay reactividad automática.
- **Refresco en vivo**: tanto admin (`iniciarPollAdmin`) como tienda (`iniciarPollChat`) hacen
  polling cada pocos segundos con `refrescarEstado()`, que respeta una ventana de "no pisar un
  guardado reciente" (`_guardandoHasta`) para no sobrescribir un cambio local que aún no llegó al
  servidor.
- **Migraciones**: `_migrar()` en `data.js` normaliza el `DB` cargado (agrega campos nuevos con
  default, remapea claves de tema viejas, etc.) — es el lugar donde añadir compatibilidad al cambiar
  la forma de los datos.

### Motor de temas

`TEMAS` en `data.js` define paletas completas con nombre (rosado, coral, cielo, ...). `aplicarTema(key)`
inyecta un `<style id="__tema_vars">` con custom properties (`--accent`, `--bg`, `--sidebar-*`, y
alias `--rose`/`--cream`/etc. para compatibilidad con nombres viejos usados en `tienda.css`). Cambiar
el tema desde Configuración cambia **tienda y admin a la vez** porque ambos consumen las mismas
variables — no hay temas independientes por página.

### Convenciones de código

- Todo el código (variables, funciones, comentarios, textos de UI) está en **español**; mantener esa
  convención.
- Helpers globales cortos en `main.js` de cada página: `$`/`$$` (querySelector), `esc()` (escape
  HTML), `dinero()`, `fechaCorta()` (en `data.js`).
- Cada página estructura su UI en "páginas" (`.page` / `.page-*`) mostradas/ocultadas por JS
  (`goTo(page)` en admin, `goToT(page)` en tienda) en vez de rutas reales — es una sola página HTML
  con navegación por JS.
- Los archivos llevan el encabezado de licencia `SIWEPE · © 2026 Joel Reyes...` al inicio; mantenerlo
  al editar o crear archivos nuevos.
- Las imágenes (logos, banners, comprobantes de pago) se comprimen a data-URL en el cliente antes de
  guardarse (`comprimirImagen()` en `admin/main.js`), con conversión automática de HEIC de iPhone vía
  `heic2any` — pensar en el límite de tamaño de `localStorage` al tocar ese flujo.
