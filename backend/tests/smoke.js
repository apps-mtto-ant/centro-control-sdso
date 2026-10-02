const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const dir = __dirname + '/..';
const tables = {
  MAESTRO_EQUIPOS: [
    ['','','','','','','','','','','','','','','','','','','','',''],
    ['','','','','','','','','','','','','','','','','','','','',''],
    ['','','','','','','','','','','','','','','','','','','','',''],
    ['equipoId','activo','tipoObjeto','contratoBase','areaOperacional','ubicacionFisica','ubicacionTecnicaSAP','tag','numeroEquipoSAP','marca','tipo','modelo','modeloSAP','numeroSerie','denominacion','aplicaKpi','estadoValidacionSAP','observacionSAP','fechaAlta','fechaBaja','motivoBaja'],
    ['EQ01','SI','EQUIPO','','Ripios','','','TAG-1','1001','Atlas','COMPRESOR','XAS98','XAS-98','SER-PRIVATE','Portátil 1','SI','CONFIRMADO','nota privada','','',''],
    ['EQ02','SI','EQUIPO','','Ripios','','','TAG-2','1002','Atlas','COMPRESOR','XAS-98','XAS98','SER-PRIVATE-2','Portátil 2','SI','PENDIENTE SAP','nota privada','','','']
  ],
  ESTADO_ACTUAL: [
    ['','','','','','','','','','','',''],['','','','','','','','','','','',''],['','','','','','','','','','','',''],
    ['equipoId','estado','subestado','disponibilidad','ubicacionActual','horometroActual','fechaHoraActualizacion','fuente','usuario','observacion','fechaRegistro','requestId'],
    ['EQ01','OPERATIVO','','DISPONIBLE','','999','2026-10-01T12:00:00.000Z','test','private@example.com','private note','','']
  ],
  LECTURAS_HOROMETRO: [
    ['','','','','','','','','',''],['','','','','','','','','',''],['','','','','','','','','',''],
    ['lecturaId','fechaHora','equipoId','horometro','unidad','origen','usuario','observacion','fechaRegistro','requestId'],
    ['R1','2026-10-01T10:00:00.000Z','EQ01',500,'h','test','private@example.com','note','2026-10-01T10:01:00.000Z','r1'],
    ['R2','2026-10-01T11:00:00.000Z','EQ01',510,'h','test','private@example.com','note','2026-10-01T11:01:00.000Z','r2']
  ],
  NOVEDADES: [
    ['','','','','','','','','','','',''],['','','','','','','','','','','',''],['','','','','','','','','','','',''],
    ['novedadId','fechaHora','equipoId','tipo','descripcion','estado','criticidad','usuario','fechaCierre','observacionCierre','fechaRegistro','requestId'],
    ['N1','2026-10-01T12:00:00.000Z','EQ01','FALLA','Texto reservado','ABIERTA','ALTA','private@example.com','','','2026-10-01T12:01:00.000Z','n1']
  ],
  _LISTAS: [
    ['ACTIVO','TIPO_OBJETO','ESTADO_VALIDACION_SAP','ESTADO_OPERACIONAL','DISPONIBILIDAD','TIPO_NOVEDAD','ESTADO_NOVEDAD','CRITICIDAD'],
    ['SI','EQUIPO','CONFIRMADO','OPERATIVO','DISPONIBLE','FALLA','ABIERTA','BAJA'],
    ['NO','SALA','PENDIENTE SAP','FUERA DE SERVICIO','INDISPONIBLE','MANTENCION','EN SEGUIMIENTO','MEDIA'],
    ['', 'OTRO','SIN SAP','EN MANTENCION','NO APLICA','OPERACION','CERRADA','ALTA']
  ]
};

class FakeSheet {
  constructor(name, values) { this.name=name; this.values=values.map(r=>r.slice()); }
  getLastRow(){ return this.values.length; }
  getLastColumn(){ return Math.max(0,...this.values.map(r=>r.length)); }
  getDataRange(){ return {getValues:()=>this.values.map(r=>r.slice())}; }
  getRange(row,col,height=1,width=1){
    return {
      getValues:()=>Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>this.values[row-1+y]?.[col-1+x]??'')),
      getDisplayValues:()=>Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>String(this.values[row-1+y]?.[col-1+x]??''))),
      setValue:value=>{while(this.values.length<row)this.values.push([]);this.values[row-1][col-1]=value;},
      setValues:values=>values.forEach((arr,y)=>{while(this.values.length<row+y)this.values.push([]);for(let x=0;x<arr.length;x++)this.values[row-1+y][col-1+x]=arr[x];})
    };
  }
}
const sheets=Object.fromEntries(Object.entries(tables).map(([n,v])=>[n,new FakeSheet(n,v)]));
const props={SPREADSHEET_ID:'staging-id',GOOGLE_CLIENT_ID:'client-id',ALLOWED_DOMAIN:'gmail.com',ALLOWED_EMAILS:'editor@gmail.com,reader@gmail.com',EDITOR_EMAILS:'editor@gmail.com'};
function tokenInfo(token){
  if(token==='EDITOR_TOKEN_LONG_123456789012345678901234567890')return {email:'editor@gmail.com',aud:'client-id',email_verified:true};
  if(token==='READER_TOKEN_LONG_123456789012345678901234567890')return {email:'reader@gmail.com',aud:'client-id',email_verified:true};
  if(token==='OUTSIDER_TOKEN_LONG_123456789012345678901234567890')return {email:'outsider@gmail.com',aud:'client-id',email_verified:true};
  return null;
}
const context={
  console:{log:console.log,warn:console.warn,error(){}},Date,JSON,Math,Number,String,Object,Array,RegExp,Error,encodeURIComponent,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||''})},
  UrlFetchApp:{fetch:url=>{const token=new URL(url).searchParams.get('id_token');const info=tokenInfo(token);return {getResponseCode:()=>info?200:401,getContentText:()=>JSON.stringify(info||{})};}},
  SpreadsheetApp:{openById:id=>{assert.equal(id,'staging-id');return {getSheetByName:n=>sheets[n]||null};}},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  Utilities:{getUuid:()=>`UUID-${Math.random()}`},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:content=>({content,setMimeType(){return this;}})}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(dir+'/Code.gs','utf8'),context);
function body(res){return JSON.parse(res.content);}

assert.equal(context.prepareV040Schema(),'v0.4 staging columns ready');
assert.ok(sheets.MAESTRO_EQUIPOS.values[3].includes('esCritico'));
assert.ok(sheets.NOVEDADES.values[3].includes('requestIdCierre'));
const snapshot=body(context.doGet({parameter:{action:'getDashboardCompresores'}}));
assert.equal(snapshot.ok,true);
assert.equal(snapshot.data.equipos.length,2);
assert.equal(snapshot.data.equipos[0].ultimaLecturaHorometro.horometro,510,'most recent ledger reading wins over legacy ESTADO_ACTUAL value');
assert.equal(snapshot.data.porModelo.XAS98,2,'model punctuation is normalized');
assert.equal(snapshot.data.resumen.disponibles,1);
assert.equal(snapshot.data.resumen.sinEstado,1);
assert.equal(JSON.stringify(snapshot).includes('private note'),false,'public snapshot omits state observations');
assert.equal(JSON.stringify(snapshot).includes('SER-PRIVATE'),false,'public snapshot omits serial numbers');
assert.equal(JSON.stringify(snapshot).includes('Texto reservado'),false,'public snapshot omits novelty descriptions');

const denied=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:'READER_TOKEN_LONG_123456789012345678901234567890',data:{}})}}));
assert.equal(denied.error.code,'EDITOR_REQUIRED');
const invalid=body(context.doPost({postData:{contents:JSON.stringify({action:'authenticate',idToken:'BAD_TOKEN_LONG_123456789012345678901234567890'})}}));
assert.equal(invalid.error.code,'AUTH_INVALID');
const details=body(context.doPost({postData:{contents:JSON.stringify({action:'getNovedades',idToken:'READER_TOKEN_LONG_123456789012345678901234567890'})}}));
assert.equal(details.data.novedades.length,1);
assert.equal(JSON.stringify(details).includes('private@example.org'),false,'authenticated novelty response still omits author email');
const outsider=body(context.doPost({postData:{contents:JSON.stringify({action:'getNovedades',idToken:'OUTSIDER_TOKEN_LONG_123456789012345678901234567890'})}}));
assert.equal(outsider.error.code,'ACCESS_DENIED','consumer Gmail access is limited to the exact allowlist');
const status=body(context.doPost({postData:{contents:JSON.stringify({action:'saveEstado',idToken:'EDITOR_TOKEN_LONG_123456789012345678901234567890',data:{requestId:'state-request-1',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',estado:'OPERATIVO',disponibilidad:'DISPONIBLE'}})}}));
assert.equal(status.ok,true);
const stale=body(context.doPost({postData:{contents:JSON.stringify({action:'saveEstado',idToken:'EDITOR_TOKEN_LONG_123456789012345678901234567890',data:{requestId:'state-request-2',fechaHora:'2026-10-01T10:00:00.000Z',equipoId:'EQ01',estado:'OPERATIVO',disponibilidad:'DISPONIBLE'}})}}));
assert.equal(stale.error.code,'STALE_STATE_UPDATE');
const saved=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:'EDITOR_TOKEN_LONG_123456789012345678901234567890',data:{requestId:'request-1',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',tipo:'FALLA',criticidad:'ALTA',descripcion:'Prueba operativa'}})}}));
assert.equal(saved.ok,true);
assert.equal(sheets.NOVEDADES.values.length,6,'editor adds one novelty');
const replay=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:'EDITOR_TOKEN_LONG_123456789012345678901234567890',data:{requestId:'request-1',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',tipo:'FALLA',criticidad:'ALTA',descripcion:'Prueba operativa'}})}}));
assert.equal(replay.data.replayed,true);
assert.equal(sheets.NOVEDADES.values.length,6,'same request id does not duplicate');
const noveltyHeaders=sheets.NOVEDADES.values[3];
const formulaSafe=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:'EDITOR_TOKEN_LONG_123456789012345678901234567890',data:{requestId:'request-formula',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',tipo:'FALLA',criticidad:'ALTA',descripcion:'=IMPORTXML("https://invalid.example","//x")'}})}}));
assert.equal(formulaSafe.ok,true);
assert.equal(sheets.NOVEDADES.values[6][noveltyHeaders.indexOf('descripcion')],"'=IMPORTXML(\"https://invalid.example\",\"//x\")",'free text cannot become a sheet formula');
const closed=body(context.doPost({postData:{contents:JSON.stringify({action:'closeNovedad',idToken:'EDITOR_TOKEN_LONG_123456789012345678901234567890',data:{novedadId:'N1',requestId:'close-request-1',observacionCierre:'Revisada'}})}}));
assert.equal(closed.ok,true);
assert.equal(sheets.NOVEDADES.values[4][noveltyHeaders.indexOf('usuario')],'private@example.com','closing keeps original author');
assert.equal(sheets.NOVEDADES.values[4][noveltyHeaders.indexOf('usuarioCierre')],'editor@gmail.com','closing records the closer separately');
const unknown=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:'EDITOR_TOKEN_LONG_123456789012345678901234567890',data:{requestId:'request-2',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'UNKNOWN',tipo:'FALLA',criticidad:'ALTA',descripcion:'Equipo desconocido'}})}}));
assert.equal(unknown.error.code,'EQUIPMENT_NOT_ACTIVE');
const decrease=body(context.doPost({postData:{contents:JSON.stringify({action:'saveHorometro',idToken:'EDITOR_TOKEN_LONG_123456789012345678901234567890',data:{requestId:'request-3',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',horometro:509}})}}));
assert.equal(decrease.error.code,'HOURMETER_DECREASE');
console.log('Apps Script smoke: OK (migración de encabezados, sanitización, lectura vigente, dominio/rol, estado, fecha obsoleta, alta/cierre, idempotencia, fórmula segura y horómetro)');
