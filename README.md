# SIWEPE — Frontend

Frontend estático (HTML/CSS/JS, sin frameworks ni build) del marketplace multiempresa SIWEPE. El backend (API + MySQL) vive en el repo hermano `Backend_SIWEPE-main`, desplegado en Railway.

## Estructura

```
pages/     Las 8 páginas del sitio (index, tienda, admin, etc.)
assets/
  css/     Un archivo por área (admin, tienda, platform, ...)
  js/      Un archivo/carpeta por área (admin, tienda, perfil, commerce, shared)
  img/     Logos e imágenes propias del sitio
```

## Configuración

No hay `.env`: la única configuración es la URL del backend, fija en `assets/js/shared/data.js` (constante `API_BASE`). Si el backend cambia de dominio, ese es el único lugar que hay que editar.

## Despliegue

Es un sitio 100% estático: cualquier hosting que sirva archivos alcanza. No hay comando de build — se sube la carpeta tal cual.

Lo único que hay que configurar en el proveedor de hosting:
1. **Raíz del sitio → `pages/index.html`** (la carpeta `assets/` queda un nivel arriba de `pages/`, tal cual está en el repo).
2. **Todas las rutas desconocidas → `pages/index.html`** (fallback SPA-like), para que refrescar una página con `?e=slug` o similar no dé 404.

Ejemplos según proveedor:
- **Vercel / Netlify**: configurar `pages` como carpeta de publicación (o dejar la raíz del repo y usar un rewrite `/ -> /pages/index.html`, `/* -> /pages/:splat`).
- **GitHub Pages**: no soporta rewrites; hay que servir directamente desde `pages/` como raíz (o publicar solo esa carpeta).

## Desarrollo

No hay servidor local propio: abrí cualquier archivo de `pages/` con la extensión "Live Server" de tu editor (o cualquier servidor estático genérico) apuntando a la raíz del repo, para que las rutas relativas `../assets/...` resuelvan igual que en producción.
