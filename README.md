# Centro de Control SDSO — v0.2.0

Versión candidata a producción de la etapa v0.2 del Centro de Control web/PWA de Minera Antucoya · Servicios de Soporte a la Operación.

## Alcance v0.2.0

- Mantiene navegación principal modular y diseño corporativo responsive.
- Mantiene App Compresores y Centro Informe como aplicaciones externas dentro de `Aplicaciones SDSO`.
- Catálogo actual: App Compresores, Centro Informes de Turno, Mantención Clima ANT, Puentes Grúa y Polipastos ANT e Inspección de Polines.
- Navegación lateral: Inicio, Aplicaciones SDSO, Dashboard, Power BI e Informes / herramientas.
- Compresores y Centro Informe se mantienen como accesos rápidos en Inicio y dentro de Aplicaciones SDSO, pero no como entradas redundantes del menú lateral.
- Se incorpora la sección principal `Dashboard`, preparada para la migración progresiva de dashboards SDSO.
- Mejora resiliencia PWA ante red degradada y respuestas HTTP 5xx.
- Mejora experiencia móvil y accesibilidad del drawer.
- Parametriza Aplicaciones, Power BI e Informes/Herramientas desde `js/config.js`.
- Inicializa una capa IndexedDB para cache estructurado futuro, sin activar todavía edición offline productiva.
- Prepara el contrato de `api.js` sin conectar todavía Apps Script.

## Entorno productivo

Esta candidata usa los identificadores productivos del Centro:

```text
environment: production
cachePrefix: centro-control-sdso-
dbName: centro-control-sdso
lastSyncKey: sdso:lastSync
```

El repositorio/sitio de staging debe mantener identificadores distintos y no compartir prefijos de caché con producción.

## Estructura

```text
/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── README.md
├── CHANGELOG.md
├── css/
│   └── app.css
├── js/
│   ├── config.js
│   ├── app.js
│   ├── api.js
│   ├── offline.js
│   ├── db.js
│   └── auth.js
├── dashboards/
│   └── .gitkeep
├── modules/
│   └── .gitkeep
└── assets/
    └── icons/
```

## Configuración

La configuración compartida vive en `js/config.js`.

- `version`: versión desplegada y versión del caché PWA.
- `environment`: entorno actual (`production`).
- `cachePrefix`, `dbName`, `lastSyncKey`: identificadores del entorno productivo.
- `backendUrl`: permanece vacío hasta la etapa de Apps Script.
- `links`: aplicaciones externas validadas/configuradas.
- `catalogs.apps`: orden de las aplicaciones mostradas.
- `catalogs.powerbi`: enlaces Power BI validados.
- `catalogs.tools`: informes y herramientas validados.

Solo se aceptan enlaces externos `https:`.

## Aplicaciones SDSO validadas

- App Compresores.
- Centro Informe Fin de Turno.
- Mantención Clima ANT.
- Puentes Grúa y Polipastos ANT.
- Inspección de Polines.

Polines y Centro Informe no utilizan Service Worker actualmente. Si en el futuro incorporan PWA, su Service Worker deberá usar cachés y almacenamiento propios y no limpiar recursos ajenos del origen compartido.

## IndexedDB

`js/db.js` crea la base local definida por `config.dbName` con tres stores iniciales:

- `datasets`: datos estructurados cacheados en futuras sincronizaciones.
- `meta`: metadatos de sincronización/configuración.
- `outbox`: cola futura para cambios pendientes de sincronización.

La apertura tiene timeout para no bloquear el arranque ni el registro del Service Worker. Se manejan estados `blocked` y `versionchange`. En v0.2.0 no se habilita todavía edición offline.

## Contrato API preparado

`js/api.js` expone:

- `health()`
- `getConfig()`
- `getEquipos()`
- `getDashboard(name)`
- `sync()`

`health()` solo verifica disponibilidad. **No registra una sincronización exitosa.** `sync()` representa el endpoint futuro; la fecha de última sincronización se actualizará únicamente después de descargar y persistir datos reales.

Los errores de backend se normalizan como `ApiError` con código y mensaje.

## Estado offline

- El Service Worker se registra sin esperar a IndexedDB.
- Ante respuestas HTTP 5xx se utiliza una copia válida en caché cuando existe.
- Durante una ventana de red degradada se prioriza caché para evitar esperas repetidas.
- La apertura offline del app shell está validada.
- El indicador de conectividad actual se basa en `navigator.onLine`.
- `SINCRONIZANDO` y `CAMBIOS PENDIENTES` se activarán cuando exista sincronización/backend y edición offline real; no se simulan estados inexistentes.

## Prueba local

No abrir `index.html` mediante `file://`, porque usa módulos ES y Service Worker. Desde la raíz usar un servidor HTTP local, por ejemplo:

```bash
python -m http.server 8080
```

Luego abrir `http://localhost:8080/`.

## Publicación en GitHub Pages

Producción se publica desde `main`:

```text
https://apps-mtto-ant.github.io/centro-control-sdso/
```

El sitio de staging es independiente:

```text
https://apps-mtto-ant.github.io/centro-control-sdso-stg/
```

No subir esta candidata productiva al repositorio de staging: allí deben conservarse los identificadores `stg-*`.

## Regla de despliegue PWA

Todo cambio de HTML, CSS, JS, manifest o recursos del app shell debe incrementar `version` en `js/config.js`. El Service Worker usa ese valor para crear un nuevo caché y elimina únicamente cachés anteriores cuyo nombre comienza con el `cachePrefix` del entorno actual.

## Flujo de liberación

1. Mantener `main` en la versión estable vigente hasta aprobar la candidata.
2. Subir esta candidata a `develop-v0.2`.
3. Revisar el diff del Pull Request `develop-v0.2 → main`.
4. Hacer merge sólo después de la prueba final.
5. Verificar GitHub Pages productivo y funcionamiento offline.
6. Crear tag/release `v0.2.0`.
