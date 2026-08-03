# Belle Stock / Miscelaneasaly — Respuestas a la retroalimentación de la terna

Documento de trabajo del equipo. Reúne todas las observaciones del jurado y de la
Ing. Gloria Alejandra Rodríguez Romero (26 de junio), separa lo que **ya se
resolvió** de lo que queda para la **segunda etapa**, y da los argumentos para
defender cada decisión en la presentación final.

> Criterio guía (recomendación de la ing.): **manejar expectativas.** Es mejor
> decir "esto queda para una segunda etapa" que prometer algo que no se cumple.

---

## 1. Cambios ya implementados en el sistema

Estos puntos ya están resueltos en el código y se pueden mostrar en la demo:

| # | Observación de la terna | Qué se hizo |
|---|---|---|
| 1 | Compras y ventas: ver del más nuevo al más antiguo | Ahora se ordenan por **fecha descendente** (antes se ordenaban por id, por eso salían desordenadas). |
| 2 | Poder filtrar ventas y compras por fecha | Se agregó **filtro por rango de fechas** (Desde / Hasta) en ambas pantallas. |
| 3 | No mostrar el PIN del cliente | Se **quitó la columna PIN** de la tabla de clientes (el PIN solo se ve al editar, para gestionar el acceso). |
| 4 | Mostrar el total de venta de cada cliente y más información | La tabla de clientes ahora muestra **# de pedidos** y **total comprado** por cliente. |
| 5 | Historial: no eliminar, sino inactivar | "Eliminar producto" pasó a **inactivar** (deja de verse en la tienda pero conserva su historial de ventas; se puede reactivar). |
| 6 | Manejo de inventario: entradas, salidas y **ajustes** | Se agregó el tipo de movimiento **Ajuste** (daño, merma, robo o corrección por conteo físico) con su formulario y su registro en el historial. |
| 7 | Dejar el chat del pedido abierto para recibir retroalimentación | El chat **ya no se cierra al entregar**; permanece abierto (solo se cierra si el pedido se cancela). |
| 8 | ¿Cómo maneja el sistema si un cliente cancela el pedido? | El **cliente puede cancelar** su propio pedido mientras esté *pendiente*, y el emprendedor también puede anularlo desde el panel. |

*(Además, del ciclo anterior: pago por transferencia con comprobante, sesión que
no se cierra al refrescar, y el rediseño de la tienda con barra de filtros.)*

---

## 2. Respuestas a las preguntas del jurado

**¿Por qué dos dashboards? El dashboard puede tener el filtro.**
De acuerdo. El panel del administrador tiene **un solo dashboard**; la idea es
que incorpore un selector de período (hoy / mes / rango) en lugar de vistas
separadas. *(El filtro de período en el dashboard queda como mejora de la
siguiente iteración; hoy el dashboard ya muestra los últimos 6 meses.)*

**¿Por qué un cliente tiene que autenticarse para realizar un pedido? / Que
inicie sesión solo al comprar, como Amazon.**
Es una observación válida y es el cambio de experiencia más importante. El
objetivo es: **el cliente navega todo el catálogo sin cuenta** y solo inicia
sesión (o se registra) **al momento de confirmar el pedido**. Está planificado
como el primer entregable de la segunda etapa porque implica rehacer el flujo de
acceso de la tienda. *(Ver §3.)*

**¿Cómo van a controlar los 2 segundos?**
Se refiere al tiempo de respuesta que se prometió. Hay que **medirlo, no
afirmarlo**: como la app es 100% front-end y los datos están en el navegador
(localStorage), las operaciones son prácticamente instantáneas. Para la
presentación conviene mostrar una métrica real (por ejemplo, tiempo de carga del
catálogo) en vez de prometer "2 segundos" sin evidencia.

**¿Por qué no un panel de administrador "en blanco" (multitenant) para no hacer
tantos cambios por cada cliente?**
Correcto como visión de producto. El sistema **ya está preparado en parte**: el
nombre, logo, colores (tema), banners y datos de pago se configuran desde el
panel sin tocar código. El **multitenant completo** (varios negocios aislados en
una misma instalación, cada uno con su propia base de datos y usuarios) requiere
un backend real y queda para la segunda etapa. *(Ver §3.)*

**¿Por qué no incluir la pasarela de pagos?**
Hoy el pago se maneja por **transferencia con comprobante** (foto que sube el
cliente y valida el emprendedor). Una pasarela real (tarjeta, links de pago)
necesita backend, credenciales de un proveedor (ej. una pasarela local) y
manejo seguro de transacciones. Es un objetivo de segunda etapa, no de esta clase.

**¿Cómo es el modelo para compras al mismo tiempo? ¿En qué momento se resta el
inventario?**
Hoy el inventario se descuenta **cuando el emprendedor aprueba el pedido** (no
cuando el cliente lo envía), lo que evita descontar stock de pedidos que no se
concretan. La **concurrencia real** (dos clientes comprando la última unidad a la
vez) solo se resuelve con un backend transaccional; en la versión actual, al ser
un solo administrador aprobando, no ocurre. Se documenta como riesgo a resolver
en la etapa con servidor.

**¿Cuál es el identificador para la creación de la base de datos?**
Cada entidad usa un **id numérico autoincremental** como llave primaria. El
**nombre** identifica al cliente en el login (nombre + PIN) y el **correo** sirve
como dato de contacto único. Para la etapa con backend, el identificador de
acceso recomendado es el **correo electrónico**.

**Validación de compras y proveedores como lista de contactos.**
Correcto: hoy los **proveedores son una lista de contactos** y las compras
registran la entrada de mercancía. La validación de compras (aprobación,
factura) y el **acceso de proveedores al sistema** para validar inventario se
plantean para la segunda etapa.

**Pedido: ¿cómo veo cuántos pedidos ha hecho un cliente? ¿Conviene otra vista?**
Ya se agregó el **# de pedidos y el total comprado** por cliente en la tabla de
clientes. Como mejora, se puede abrir el detalle de un cliente con su historial
completo de pedidos.

---

## 3. Segunda etapa (siguiente período) — alcance propuesto

Se documenta explícitamente para **manejar expectativas** y demostrar análisis:

1. **Compra sin iniciar sesión (estilo Amazon).** Navegar y armar el carrito
   como invitado; pedir cuenta solo al confirmar el pedido.
2. **Usuarios, roles y seguridad.** Roles (administrador, vendedor, proveedor),
   permisos y autenticación robusta.
3. **Multitenant / panel en blanco.** Varios negocios en una instalación, cada
   uno con su configuración y datos aislados.
4. **Pasarela de pagos.** Integración con un proveedor de pagos real.
5. **Backend y concurrencia.** Servidor + base de datos para historial confiable
   y manejo de compras simultáneas.
6. **Acceso de proveedores** para validar/actualizar inventario.
7. **Pedido completo de punta a punta** y proceso formal de anulación con
   reposición de inventario.

---

## 4. Presentación e informe (coherencia y forma)

- **Diagrama de contexto:** eliminar **WhatsApp** como entidad (es un canal de
  comunicación, no una entidad del sistema). Entidades reales: Administrador,
  Cliente, Proveedor (y a futuro Pasarela de pagos).
- **Coherencia visual:** usar **la misma línea gráfica** en presentación, informe
  y sistema — misma paleta (el tema rosado del sistema), misma tipografía
  (Fraunces para títulos, Inter para el resto), mismo estilo de botones e
  imágenes. Que se perciba como **una sola solución**, no piezas sueltas.
- **Valor agregado / competencia:** no quedarse en "existen 30 apps". Hacer un
  cuadro comparativo corto (3–5 competidores) y responder **¿qué hace diferente a
  Belle Stock?** — por ejemplo: pensado para **microemprendimientos de belleza**,
  tienda + inventario en una sola herramienta, **sin costos de servidor**,
  personalizable (marca, colores, banners) y con **pago por transferencia +
  comprobante** que es lo que realmente usan los pequeños negocios locales.
- **Recomendados configurables:** el administrador ya marca productos como
  **"Destacados"**, que son los que aparecen en la portada de la tienda (cumple
  la sugerencia del jurado de un espacio de recomendados controlado por el admin).

---

## 5. Habilidades blandas (recordatorio del equipo para la exposición)

- Tomarse **unos segundos** para pensar antes de responder; no contestar
  apresurado.
- **Repartir la participación**: que hablen todos, apoyarse entre compañeros.
- **No prometer de más**: usar la frase "eso queda para una segunda etapa".
- Practicar **exposición y manejo del estrés**; buscar un taller corto de
  comunicación efectiva y presentación de proyectos.
