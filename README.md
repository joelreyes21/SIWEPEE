# SIWEPE — Frontend

Frontend estático (HTML/CSS/JS, sin frameworks ni build) del marketplace multiempresa SIWEPE. El backend (API + MySQL) vive en el repo hermano `Backend_SIWEPE-main`, desplegado en Railway.

## Estructura

```
index.html   Portada — vive en la raíz a propósito, no en pages/
pages/       Las otras 7 páginas del sitio (tienda, admin, etc.)
assets/
  css/       Un archivo por área (admin, tienda, platform, ...)
  js/        Un archivo/carpeta por área (admin, tienda, perfil, commerce, shared)
  img/       Logos e imágenes propias del sitio
```

## Configuración

No hay `.env`: la única configuración es la URL del backend, fija en `assets/js/shared/data.js` (constante `API_BASE`). Si el backend cambia de dominio, ese es el único lugar que hay que editar.

## Despliegue

Es un sitio 100% estático: cualquier hosting que sirva archivos alcanza. No hay comando de build ni configuración especial — se sube el repo tal cual y `index.html` en la raíz ya es lo que la mayoría de hostings estáticos sirve por defecto en `/`. Las demás páginas se acceden como `/pages/tienda.html`, `/pages/admin.html`, etc.

## Desarrollo

No hay servidor local propio: abrí `index.html` (o cualquier archivo de `pages/`) con la extensión "Live Server" de tu editor, o cualquier servidor estático genérico, apuntando a la raíz del repo — así las rutas relativas resuelven igual que en producción.
