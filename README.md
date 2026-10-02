# Centro de Control SDSO — v0.1.2

Esqueleto inicial del nuevo Centro de Control web/PWA de Minera Antucoya · Servicios de Soporte a la Operación.

## Alcance

- Navegación principal modular.
- Diseño corporativo responsive.
- App Compresores y Centro Informe mantenidos como módulos externos.
- Módulos Power BI e Informes/Herramientas preparados.
- Manifest PWA y Service Worker.
- Apertura offline del app shell.
- Indicador permanente online/offline.
- Estado de última sincronización sin inventar datos: permanece `Sin sincronizar` hasta una respuesta real del futuro backend.
- Estructuras `api.js`, `offline.js` y `auth.js` preparadas para evolución.

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
│   └── auth.js
├── dashboards/
│   └── .gitkeep
├── modules/
│   └── .gitkeep
└── assets/
    └── icons/
```

## Configuración

Los valores compartidos viven en un solo archivo: `js/config.js`.

- `version`: versión desplegada y versión del caché PWA.
- `backendUrl`: vacío en esta etapa.
- `links.compressors.url`: App Compresores vigente.
- `links.turnReport.url`: Centro Informes de Turno vigente en `apps-mtto-ant`.

Solo se aceptan enlaces externos `https:`.

## Prueba local

No abrir `index.html` mediante `file://`, porque usa módulos ES y Service Worker. Desde la raíz del repositorio usar un servidor HTTP local, por ejemplo:

```bash
python -m http.server 8080
```

Luego abrir `http://localhost:8080/`.

## Publicación en GitHub Pages

1. Subir el contenido de esta carpeta a la raíz del repositorio dedicado.
2. En GitHub: **Settings → Pages**.
3. Seleccionar despliegue desde la rama principal y carpeta raíz `/`.
4. Esperar la publicación y abrir la URL Pages.
5. Validar navegación, instalación PWA y recarga offline.

Las rutas son relativas para funcionar bajo una subcarpeta de GitHub Pages.

## Regla de despliegue PWA

Cada despliegue que cambie HTML, CSS, JS, manifest o recursos del app shell debe incrementar `version` en `js/config.js`. El Service Worker usa ese valor para crear un nuevo caché y elimina únicamente cachés anteriores cuyo nombre comienza con `centro-control-sdso-`. El registro usa `updateViaCache: none` y las solicitudes del shell se revalidan sin depender de una copia HTTP obsoleta.

## Sincronización

El botón **Verificar** solo actualiza el estado de conectividad del dispositivo. No modifica la última sincronización. La fecha de sincronización será registrada por `api.js` únicamente después de una respuesta real satisfactoria del backend.
