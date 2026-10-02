# CHANGELOG — Centro de Control SDSO

## v0.2.0 — 2026-10-02

Primera versión estable de la etapa v0.2.

### Navegación y organización
- Navegación lateral simplificada: Inicio, Aplicaciones SDSO, Dashboard, Power BI e Informes / herramientas.
- Compresores y Centro Informe se retiran de la barra lateral por redundancia; permanecen como accesos rápidos en Inicio y dentro de Aplicaciones SDSO.
- Se incorpora la sección principal Dashboard, preparada para la migración progresiva de dashboards SDSO.
- Catálogo de Aplicaciones SDSO: App Compresores, Centro Informes de Turno, Mantención Clima ANT, Puentes Grúa y Polipastos ANT e Inspección de Polines.

### PWA / offline
- El Service Worker se registra sin depender de IndexedDB.
- Fallback a caché ante respuestas HTTP 5xx cuando existe una copia válida.
- Respuesta inmediata desde caché durante ventanas de red degradada para evitar timeouts acumulados.
- Aislamiento seguro entre producción y staging mediante prefijos de caché no solapados.
- Protección del almacenamiento local y apertura offline del app shell.

### IndexedDB y API
- Se incorpora `js/db.js` con stores iniciales `datasets`, `meta` y `outbox`.
- IndexedDB incorpora timeout, `onblocked`, `onversionchange`, reintento tras fallo y confirmación de escrituras al completar la transacción.
- `api.js` normaliza errores mediante `ApiError`.
- `health()` no marca sincronización real.
- `auth.can('consultar')` queda habilitado para el rol provisional LECTOR; la autorización real seguirá validándose backend-side.

### Interfaz y accesibilidad
- Topbar móvil más compacta y texto de sincronización legible.
- Foco correcto del drawer móvil y retorno al botón de menú al cerrar.
- Scroll al inicio al cambiar de sección.
- Iconografía específica para Compresores.
- Aplicaciones, Power BI e Informes/Herramientas se renderizan desde `js/config.js`.

### Entorno productivo
- `version: 0.2.0`
- `environment: production`
- `cachePrefix: centro-control-sdso-`
- `dbName: centro-control-sdso`
- `lastSyncKey: sdso:lastSync`

### Validaciones realizadas
- Cinco enlaces de Aplicaciones SDSO verificados por Mario.
- App shell offline validado en staging y producción.
- Staging verificado sin interferir con el caché offline de producción.
- Polines y Centro Informe actualmente no tienen Service Worker, por lo que no interfieren con el caché del Centro de Control.

### Pendientes de etapas posteriores
- La conectividad visible sigue basada en `navigator.onLine`; los estados `SINCRONIZANDO` y `CAMBIOS PENDIENTES` se activarán cuando exista backend/sincronización y edición offline reales.
- Antes de agregar páginas HTML separadas en `dashboards/` o `modules/`, revisar el fallback de navegación del Service Worker.
- Al migrar Compresores, Clima o Puentes al origen `apps-mtto-ant.github.io`, revisar sus Service Workers antes de publicar.

## v0.1.2

- Corrección C3 residual: Service Worker registrado con `updateViaCache: 'none'` y revalidación del shell con `cache: 'no-cache'`.
- Corrección N1: detección temporal de red degradada para evitar timeouts acumulados en recursos cacheados.
- Protección de `localStorage` ante almacenamiento bloqueado.
- URL real del Centro Informe Fin de Turno incorporada.
- Textos y documentación actualizados.

## v0.1.1

- Corrección de sincronización ficticia.
- Aislamiento de cachés respecto de otras PWA del mismo origen.
- Navegación por hash con historial.
- Catálogo seguro sin `innerHTML` para datos configurables.
- Indicador online/offline visible en móvil.
- Manifest, accesibilidad y documentación reforzados.
