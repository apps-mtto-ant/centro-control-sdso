# Backend v0.4 — staging

`Code.gs` is the candidate for a **separate Apps Script deployment** connected to a copied staging Sheet. Do not paste it into or redeploy the v0.3 production Apps Script project.

## Configuration

Create a staging Apps Script project and set Script Properties:

- `ENVIRONMENT`: must be `staging`.
- `SPREADSHEET_ID`: ID of the staging workbook; its name must contain `_STG` so writes pass the environment guard.
- `GOOGLE_CLIENT_ID`: OAuth web client ID used by Google Identity Services in the staging frontend.
- `ALLOWED_DOMAIN`: domain expected for the authorized accounts.
- `ALLOWED_EMAILS`: required in every mode; exact reader/editor allowlist. If absent or empty, access fails closed.
- `EDITOR_EMAILS`: comma/newline separated editor addresses; every editor must also be present in `ALLOWED_EMAILS`.
- `BUILD_ID`: exact deployed source commit SHA, exposed by `health` for deployment verification.

Set the staging origin as an authorized JavaScript origin in the OAuth client. Set `googleClientId` and the staging deployment URL in the staging copy of `js/config.js` only.

After checking that `SPREADSHEET_ID` points to the staging copy, run `prepareV040Schema()` once. It appends `esCritico` to `MAESTRO_EQUIPOS`, `fechaRegistro` and `requestId` to `ESTADO_ACTUAL` and `LECTURAS_HOROMETRO`, and `fechaRegistro`, `requestId`, `fechaRegistroCierre`, `requestIdCierre`, and `usuarioCierre` to `NOVEDADES`. It does not alter existing rows or remove columns. Critical flags remain blank until the historical records have been matched to validated equipment IDs.

Deploy the web app as the staging owner. Only `health` is intentionally public. Dashboard/equipment/novelty detail requests require an authorized Google ID token, and writes additionally require the server-side editor allowlist. Do not treat a URL, frontend control, or local role as authentication.

Before enabling forms in staging, verify in a browser that JSON GET/POST works through Apps Script redirects from the staging Pages origin. Then test a lector, a permitted editor, invalid token, invalid equipment, duplicate request, invalid list value, and a decreasing horometer. Keep writes online-only.

### Estado operacional AUTH12

The editor selects only the operational state. Availability is server-derived and persisted as follows: `OPERATIVO` and `STAND BY` → `DISPONIBLE`; `FUERA DE SERVICIO`, `OVERHAUL`, `MANTENCION`, and `FALLA` → `NO DISPONIBLE`. Client-supplied availability is not authoritative. For legacy rows, a recognized operational state is authoritative even when the stored availability contradicts it; reads return the canonical derived availability without rewriting the sheet. Unknown legacy states are read as **Sin estado**. `NO APLICA` is not part of the model. `_LISTAS.ESTADO_OPERACIONAL` must contain the six canonical states; `_LISTAS.DISPONIBILIDAD` should contain `DISPONIBLE` and `NO DISPONIBLE`. Do not edit or delete `HISTORIAL_ESTADO` rows.

## Exposed data

`health` and `getDashboardCompresores` return only the fields needed for counts, area status, horometers, inventory, and SAP counts. They exclude user emails and free-text observations/descriptions. `getNovedades` requires a valid domain session and returns details without the author's email. Writes require the server-side editor allowlist.

The Apps Script source is versioned here; the Script Properties, OAuth client, staging workbook, and deployed URL are external configuration and must not be committed.
