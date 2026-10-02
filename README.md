# Centro de Control SDSO — v0.3

> La rama `develop-v0.4` contiene la candidata en desarrollo. Lee [docs/V0.4_SCOPE.md](docs/V0.4_SCOPE.md) y [backend/README.md](backend/README.md) antes de conectar recursos de staging. La configuración de v0.4 mantiene `backendUrl` vacío hasta crear el endpoint separado.

Candidata de la etapa v0.3 del Centro de Control web/PWA de Minera Antucoya · Servicios de Soporte a la Operación.

## Alcance v0.3

- Mantiene la navegación modular: Inicio, Aplicaciones SDSO, Dashboard, Power BI e Informes / herramientas.
- `#/dashboard` es el catálogo de dashboards SDSO.
- `#/dashboard-compresores` contiene el primer dashboard nativo.
- Dashboard Compresores conectado a Google Apps Script + Google Sheets.
- KPIs, distribución por área/modelo, conciliación SAP, maestro de equipos, búsqueda y filtros.
- Caché estructurada en IndexedDB para consulta offline.
- Service Worker para app shell y operación PWA.
- App Compresores y Centro Informe continúan como aplicaciones externas.

## Arquitectura

```text
GitHub Pages
  → Frontend / PWA
  → Google Apps Script
  → Google Sheets
```

Offline:

```text
Service Worker + Cache Storage + IndexedDB
```

## Backend v0.3

API Apps Script en modo read-only:

- `health`
- `getEquipos`
- `getDashboardCompresores`

El frontend usa dos intentos para errores transitorios del backend, con timeout por intento y fallback a la última caché válida.

## Datos esperados de Compresores

Estado validado al cierre de esta candidata:

- 31 equipos activos
- 24 CONFIRMADO SAP
- 6 PENDIENTE SAP
- 1 ERROR MAESTRO SAP

Los KPIs operacionales permanecen en 0/31 sin estado mientras `ESTADO_ACTUAL` no tenga datos.

## IndexedDB

Base configurada por `config.dbName`.

Stores:

- `datasets`
- `meta`
- `outbox`

La consulta online no debe depender de IndexedDB. Si el almacenamiento local falla, el dashboard debe seguir mostrando datos recibidos desde red y avisar que no estarán disponibles offline.

## Entornos

Producción:

```text
environment: production
cachePrefix: centro-control-sdso-
dbName: centro-control-sdso
lastSyncKey: sdso:lastSync
```

Staging usa identificadores separados con prefijo `stg-`.

## Regla de despliegue PWA

Todo release que modifique HTML, CSS, JS, manifest o app shell debe incrementar `version` en `js/config.js`.

Al tomar control un Service Worker nuevo, la app realiza una única recarga controlada para evitar combinaciones de HTML nuevo con assets HTTP antiguos.

## Publicación

Producción:

```text
https://apps-mtto-ant.github.io/centro-control-sdso/
```

Staging:

```text
https://apps-mtto-ant.github.io/centro-control-sdso-stg/
```

## Flujo de liberación

1. Desarrollo en `develop-v0.3`.
2. Sincronización a staging.
3. Pruebas online, offline, actualización PWA y backend.
4. Correcciones de auditoría.
5. Revisión final.
6. Merge `develop-v0.3 → main`.
7. Validación productiva.
8. Tag/release `v0.3.0`.

## Pendiente posterior

- Autenticación y roles reales.
- Separación de base staging/producción mediante Script Properties.
- Estados operacionales completos y novedades.
- Paridad funcional progresiva con dashboards históricos: pestañas, gráficos, vistas por área y captura para Informe Fin de Turno.
