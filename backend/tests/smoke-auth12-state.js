const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync(__dirname + '/../Code.gs', 'utf8');

// AUTH12-1: un encabezado no clave del historial debe estar cubierto por la validación completa.
assert.match(source, /HISTORY_HEADERS[^\n]+requestId/);
assert.match(source, /validateHeaders_\(SHEETS\.HISTORIAL_ESTADO,historyTable\.headers,HISTORY_HEADERS\)/);

// AUTH12-2: NO APLICA en cualquiera de los dos campos queda fuera de las listas admitidas.
assert.match(source, /map\.estadoOperacional=.*OPERATIVO.*FUERA DE SERVICIO/);
assert.match(source, /map\.disponibilidad=.*DISPONIBLE.*INDISPONIBLE/);
assert.doesNotMatch(source.match(/map\.estadoOperacional=.*\n/)[0], /NO APLICA/);
assert.doesNotMatch(source.match(/map\.disponibilidad=.*\n/)[0], /NO APLICA/);

// AUTH12-3: lectura de datos antiguos. Cualquier par distinto de los dos aprobados se proyecta como Sin estado.
const helper = source.match(/function normalizeOperationalState_\(state\) \{[\s\S]*?\n\}/);
assert.ok(helper, 'normalizeOperationalState_ debe existir');
const normalizeOperationalState_ = Function(helper[0] + '; return normalizeOperationalState_;')();
assert.equal(normalizeOperationalState_({estado:'OPERATIVO',disponibilidad:'DISPONIBLE'}).estado,'OPERATIVO');
assert.equal(normalizeOperationalState_({estado:'FUERA DE SERVICIO',disponibilidad:'INDISPONIBLE'}).estado,'FUERA DE SERVICIO');
assert.equal(normalizeOperationalState_({estado:'NO APLICA',disponibilidad:'INDISPONIBLE'}),null);
assert.equal(normalizeOperationalState_({estado:'OPERATIVO',disponibilidad:'NO APLICA'}),null);
assert.equal(normalizeOperationalState_({estado:'NO APLICA',disponibilidad:'NO APLICA'}),null);
assert.equal(normalizeOperationalState_({estado:'OPERATIVO',disponibilidad:'INDISPONIBLE'}),null);
assert.equal(normalizeOperationalState_({estado:'FUERA DE SERVICIO',disponibilidad:'DISPONIBLE'}),null);

assert.match(source, /INVALID_STATE_COMBINATION/);
console.log('AUTH12 state smoke: OK (non-key history header, inverse NO APLICA, legacy data compatibility, closed state matrix)');
