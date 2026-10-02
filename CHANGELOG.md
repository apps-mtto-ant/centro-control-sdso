# CHANGELOG — Centro de Control SDSO

## v0.1.2 — 01/10/2026

Versión técnica de estabilización posterior a la reauditoría de v0.1.1.

### Corregido

- El Service Worker se registra con `updateViaCache: 'none'` para que sus imports no queden retenidos por la caché HTTP durante una actualización.
- Navegación y recursos del app shell se solicitan con `cache: 'no-cache'`, permitiendo revalidar cambios publicados inmediatamente.
- El precache de una nueva versión también fuerza revalidación, evitando crear un caché nuevo con assets HTTP antiguos.
- El timeout de red deja de acumularse por oleadas: si una solicitud detecta red degradada, durante 30 s los recursos ya cacheados se sirven inmediatamente.
- Timeout de navegación: 4 s; timeout de assets: 2 s cuando aún no se ha detectado degradación.
- URL oficial del Centro Informes de Turno incorporada en `js/config.js`.
- Texto de configuración actualizado de `js/app.js` a `js/config.js` y eliminadas referencias visuales rígidas a una versión concreta.
- Acceso a `localStorage` protegido para que políticas del navegador no interrumpan el arranque.

### Alcance sin cambios

- Sin backend productivo.
- Sin roles/autorización implementados.
- App Compresores y Centro Informe permanecen como aplicaciones externas.
- Sin migración del Dashboard Compresores todavía.

## v0.1.1 — 01/10/2026

Versión correctiva posterior a auditoría Claude de v0.1.

### Corregido

- Eliminada la creación de una fecha de sincronización ficticia.
- Service Worker elimina solo cachés propios con prefijo `centro-control-sdso-`.
- Shell PWA cambia a network-first con fallback a caché y timeout de 4 s.
- No se cachean respuestas HTTP no satisfactorias.
- Una ruta inexistente no reemplaza el `index.html` almacenado.
- Estado online/offline y última sincronización visibles permanentemente en móvil.
- Fecha de sincronización normalizada a `DD/MM/AAAA HH:MM`.
- Navegación basada en hash con historial y soporte del botón Atrás.
- Configuración de versión y enlaces externos centralizada en `js/config.js`.
- Catálogo de aplicaciones construido con DOM y `textContent`; enlaces limitados a `https:`.
- Drawer móvil con overlay, cierre por Escape/clic fuera, `inert` y `focus-visible`.
- Íconos de navegación reemplazados por SVG inline.
- Manifest ajustado con `id` y entradas `any` / `maskable` separadas.
- Carpetas `dashboards/` y `modules/` conservadas con `.gitkeep`.
- README ampliado con publicación, pruebas locales y regla de versionado PWA.

### Alcance sin cambios

- Sin backend productivo.
- Sin roles/autorización implementados.
- App Compresores y Centro Informe permanecen como aplicaciones externas.
- Sin migración del Dashboard Compresores todavía.

## v0.1.0 — 01/10/2026

- Esqueleto inicial del Centro de Control SDSO.
