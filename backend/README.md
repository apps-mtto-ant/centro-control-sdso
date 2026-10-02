# Backend v0.4 — staging

`Code.gs` is the candidate for a **separate Apps Script deployment** connected to a copied staging Sheet. Do not paste it into or redeploy the v0.3 production Apps Script project.

## Configuration

Create a staging Apps Script project and set Script Properties:

- `SPREADSHEET_ID`: ID of the staging copy of `BD_CENTRO_CONTROL_SDSO`.
- `GOOGLE_CLIENT_ID`: OAuth web client ID used by Google Identity Services in the staging frontend.
- `ALLOWED_DOMAIN`: Google Workspace domain allowed to consult operational details.
- `EDITOR_EMAILS`: comma/newline separated addresses allowed to write.

Set the staging origin as an authorized JavaScript origin in the OAuth client. Set `googleClientId` and the staging deployment URL in the staging copy of `js/config.js` only.

After checking that `SPREADSHEET_ID` points to the staging copy, run `prepareV040Schema()` once. It appends `esCritico` to `MAESTRO_EQUIPOS`, `fechaRegistro` and `requestId` to `ESTADO_ACTUAL` and `LECTURAS_HOROMETRO`, and `fechaRegistro`, `requestId`, `fechaRegistroCierre`, `requestIdCierre`, and `usuarioCierre` to `NOVEDADES`. It does not alter existing rows or remove columns. Critical flags remain blank until the historical records have been matched to validated equipment IDs.

Deploy the web app as the staging owner. The Apps Script endpoint may be publicly reachable for sanitized read-only summaries; each detail or write request still validates its Google ID token, audience, domain, and editor email on the server. Do not treat a URL, frontend control, or local role as authentication.

Before enabling forms in staging, verify in a browser that JSON GET/POST works through Apps Script redirects from the staging Pages origin. Then test a lector, a permitted editor, invalid token, invalid equipment, duplicate request, invalid list value, and a decreasing horometer. Keep writes online-only.

## Exposed data

`health` and `getDashboardCompresores` return only the fields needed for counts, area status, horometers, inventory, and SAP counts. They exclude user emails and free-text observations/descriptions. `getNovedades` requires a valid domain session and returns details without the author's email. Writes require the server-side editor allowlist.

The Apps Script source is versioned here; the Script Properties, OAuth client, staging workbook, and deployed URL are external configuration and must not be committed.
