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
  getName(){return this.name;}
  getMaxRows(){return Math.max(1000,this.values.length);}
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
while(sheets.LECTURAS_HOROMETRO.values.length<1000){const row=Array(10).fill('');row[4]='h';sheets.LECTURAS_HOROMETRO.values.push(row);}
const props={SPREADSHEET_ID:'staging-id',ENVIRONMENT:'staging',GOOGLE_CLIENT_ID:'client-id',ALLOWED_DOMAIN:'gmail.com',ALLOWED_EMAILS:'editor@gmail.com,reader@gmail.com',EDITOR_EMAILS:'editor@gmail.com'};
let targetSpreadsheetName='BD_CENTRO_CONTROL_SDSO_STG_v0.4';
const makeToken=email=>`e30.${Buffer.from(JSON.stringify({aud:'client-id',iss:'https://accounts.google.com',exp:Math.floor(Date.now()/1000)+3600,email})).toString('base64url')}.signature`;
const EDITOR_TOKEN=makeToken('editor@gmail.com'),READER_TOKEN=makeToken('reader@gmail.com'),OUTSIDER_TOKEN=makeToken('outsider@gmail.com'),BAD_TOKEN='not-a-valid-token-that-is-long-enough-for-prefilter';
let tokenInfoCalls=0;const tokenCache=new Map();
function tokenInfo(token){
  if(token===EDITOR_TOKEN)return {email:'editor@gmail.com',aud:'client-id',email_verified:true,iss:'https://accounts.google.com'};
  if(token===READER_TOKEN)return {email:'reader@gmail.com',aud:'client-id',email_verified:true,iss:'https://accounts.google.com'};
  if(token===OUTSIDER_TOKEN)return {email:'outsider@gmail.com',aud:'client-id',email_verified:true,iss:'https://accounts.google.com'};
  if(token===BAD_TOKEN)return {email:'bad@gmail.com',aud:'client-id',email_verified:true,iss:'https://accounts.google.com'};
  return null;
}
const context={
  console:{log:console.log,warn:console.warn,error(){}},Date,JSON,Math,Number,String,Object,Array,RegExp,Error,encodeURIComponent,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||''})},
  UrlFetchApp:{fetch:url=>{tokenInfoCalls++;const token=new URL(url).searchParams.get('id_token');const info=tokenInfo(token);return {getResponseCode:()=>info?200:401,getContentText:()=>JSON.stringify(info||{})};}},
  CacheService:{getScriptCache:()=>({get:k=>tokenCache.get(k)||null,put:(k,v)=>tokenCache.set(k,v)})},
  SpreadsheetApp:{openById:id=>{assert.equal(id,'staging-id');return {getName:()=>targetSpreadsheetName,getSheetByName:n=>sheets[n]||null,insertSheet:n=>{const sh=new FakeSheet(n,[[],[],[],[]]);sheets[n]=sh;return sh;}};}},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  Utilities:{getUuid:()=>`UUID-${Math.random()}`,base64DecodeWebSafe:s=>Buffer.from(s,'base64url'),newBlob:b=>({getDataAsString:()=>Buffer.from(b).toString()}),DigestAlgorithm:{SHA_256:'SHA-256'},computeDigest:(_alg,s)=>Array.from(Buffer.from(s))},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:content=>({content,setMimeType(){return this;}})}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(dir+'/Code.gs','utf8'),context);
function body(res){return JSON.parse(res.content);}

assert.equal(context.prepareV040Schema(),'v0.4 staging columns ready');
assert.ok(sheets.MAESTRO_EQUIPOS.values[3].includes('esCritico'));
assert.ok(sheets.NOVEDADES.values[3].includes('requestIdCierre'));
assert.ok(sheets.HISTORIAL_ESTADO.values[3].includes('historialId'));
const publicHealth=body(context.doGet({parameter:{action:'health'}}));
assert.equal(publicHealth.ok,true);
assert.equal(publicHealth.data.mode,'authenticated-summary-editor-write');
const anonymousDashboard=body(context.doGet({parameter:{action:'getDashboardCompresores'}}));
assert.equal(anonymousDashboard.error.code,'AUTH_REQUIRED');
const anonymousEquipos=body(context.doGet({parameter:{action:'getEquipos'}}));
assert.equal(anonymousEquipos.error.code,'AUTH_REQUIRED');
const anonymousPost=body(context.doPost({postData:{contents:JSON.stringify({action:'getDashboardCompresores'})}}));
assert.equal(anonymousPost.error.code,'AUTH_REQUIRED');
const beforeGarbage=tokenInfoCalls;for(let i=0;i<50;i++)body(context.doPost({postData:{contents:JSON.stringify({action:'getDashboardCompresores',idToken:`garbage-token-${i}-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`})}}));
assert.equal(tokenInfoCalls,beforeGarbage,'malformed anonymous tokens are rejected before tokeninfo');
const snapshot=body(context.doPost({postData:{contents:JSON.stringify({action:'getDashboardCompresores',idToken:READER_TOKEN})}}));
assert.equal(snapshot.ok,true);
assert.equal(snapshot.data.equipos.length,2);
const equipment=body(context.doPost({postData:{contents:JSON.stringify({action:'getEquipos',idToken:READER_TOKEN})}}));
assert.equal(equipment.ok,true);
assert.equal(equipment.data.equipos.length,2);
assert.equal(snapshot.data.equipos[0].ultimaLecturaHorometro.horometro,510,'most recent ledger reading wins over legacy ESTADO_ACTUAL value');
assert.equal(snapshot.data.porModelo.XAS98,2,'model punctuation is normalized');
assert.equal(snapshot.data.resumen.disponibles,1);
assert.equal(snapshot.data.resumen.sinEstado,1);
const callsAfterReaderAuth=tokenInfoCalls;body(context.doPost({postData:{contents:JSON.stringify({action:'getDashboardCompresores',idToken:READER_TOKEN})}}));
assert.equal(tokenInfoCalls,callsAfterReaderAuth,'verified identity is cached across requests');
assert.equal(JSON.stringify(snapshot).includes('private note'),false,'public snapshot omits state observations');
assert.equal(JSON.stringify(snapshot).includes('SER-PRIVATE'),false,'public snapshot omits serial numbers');
assert.equal(JSON.stringify(snapshot).includes('Texto reservado'),false,'public snapshot omits novelty descriptions');

const denied=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:READER_TOKEN,data:{}})}}));
assert.equal(denied.error.code,'EDITOR_REQUIRED');
const invalid=body(context.doPost({postData:{contents:JSON.stringify({action:'authenticate',idToken:BAD_TOKEN})}}));
assert.equal(invalid.error.code,'AUTH_INVALID');
const details=body(context.doPost({postData:{contents:JSON.stringify({action:'getNovedades',idToken:READER_TOKEN})}}));
assert.equal(details.data.novedades.length,1);
assert.equal(JSON.stringify(details).includes('private@example.com'),false,'authenticated novelty response still omits author email');
const outsider=body(context.doPost({postData:{contents:JSON.stringify({action:'getNovedades',idToken:OUTSIDER_TOKEN})}}));
assert.equal(outsider.error.code,'ACCESS_DENIED','consumer Gmail access is limited to the exact allowlist');
const status=body(context.doPost({postData:{contents:JSON.stringify({action:'saveEstado',idToken:EDITOR_TOKEN,data:{requestId:'state-request-1',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',estado:'OPERATIVO',disponibilidad:'DISPONIBLE'}})}}));
assert.equal(status.ok,true);
assert.equal(sheets.HISTORIAL_ESTADO.values[4][sheets.HISTORIAL_ESTADO.values[3].indexOf('requestId')],'state-request-1','state changes append to audit history');
props.ENVIRONMENT='production';const blocked=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:EDITOR_TOKEN,data:{requestId:'blocked-write',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',tipo:'FALLA',criticidad:'ALTA',descripcion:'No debe guardar'}})}}));assert.equal(blocked.error.code,'WRITE_ENVIRONMENT_BLOCKED');props.ENVIRONMENT='staging';
targetSpreadsheetName='BD_CENTRO_CONTROL_SDSO';const wrongBook=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:EDITOR_TOKEN,data:{requestId:'wrong-book-write',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',tipo:'FALLA',criticidad:'ALTA',descripcion:'No debe guardar'}})}}));assert.equal(wrongBook.error.code,'WRITE_TARGET_BLOCKED');targetSpreadsheetName='BD_CENTRO_CONTROL_SDSO_STG_v0.4';
const stale=body(context.doPost({postData:{contents:JSON.stringify({action:'saveEstado',idToken:EDITOR_TOKEN,data:{requestId:'state-request-2',fechaHora:'2026-10-01T10:00:00.000Z',equipoId:'EQ01',estado:'OPERATIVO',disponibilidad:'DISPONIBLE'}})}}));
assert.equal(stale.error.code,'STALE_STATE_UPDATE');
const saved=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:EDITOR_TOKEN,data:{requestId:'request-1',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',tipo:'FALLA',criticidad:'ALTA',descripcion:'Prueba operativa'}})}}));
assert.equal(saved.ok,true);
assert.equal(sheets.NOVEDADES.values.length,6,'editor adds one novelty');
const replay=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:EDITOR_TOKEN,data:{requestId:'request-1',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',tipo:'FALLA',criticidad:'ALTA',descripcion:'Prueba operativa'}})}}));
assert.equal(replay.data.replayed,true);
assert.equal(sheets.NOVEDADES.values.length,6,'same request id does not duplicate');
const noveltyHeaders=sheets.NOVEDADES.values[3];
const formulaSafe=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:EDITOR_TOKEN,data:{requestId:'request-formula',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',tipo:'FALLA',criticidad:'ALTA',descripcion:'=IMPORTXML("https://invalid.example","//x")'}})}}));
assert.equal(formulaSafe.ok,true);
assert.equal(sheets.NOVEDADES.values[6][noveltyHeaders.indexOf('descripcion')],"'=IMPORTXML(\"https://invalid.example\",\"//x\")",'free text cannot become a sheet formula');
const closed=body(context.doPost({postData:{contents:JSON.stringify({action:'closeNovedad',idToken:EDITOR_TOKEN,data:{novedadId:'N1',requestId:'close-request-1',observacionCierre:'Revisada'}})}}));
assert.equal(closed.ok,true);
assert.equal(sheets.NOVEDADES.values[4][noveltyHeaders.indexOf('usuario')],'private@example.com','closing keeps original author');
assert.equal(sheets.NOVEDADES.values[4][noveltyHeaders.indexOf('usuarioCierre')],'editor@gmail.com','closing records the closer separately');
const unknown=body(context.doPost({postData:{contents:JSON.stringify({action:'saveNovedad',idToken:EDITOR_TOKEN,data:{requestId:'request-2',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'UNKNOWN',tipo:'FALLA',criticidad:'ALTA',descripcion:'Equipo desconocido'}})}}));
assert.equal(unknown.error.code,'EQUIPMENT_NOT_ACTIVE');
const decrease=body(context.doPost({postData:{contents:JSON.stringify({action:'saveHorometro',idToken:EDITOR_TOKEN,data:{requestId:'request-3',fechaHora:'2026-10-02T10:00:00.000Z',equipoId:'EQ01',horometro:509}})}}));
assert.equal(decrease.error.code,'HOURMETER_DECREASE');
const emptyHour=body(context.doPost({postData:{contents:JSON.stringify({action:'saveHorometro',idToken:EDITOR_TOKEN,data:{requestId:'request-empty-hour',fechaHora:'2026-10-02T13:00:00.000Z',equipoId:'EQ02',horometro:''}})}}));
assert.equal(emptyHour.error.code,'INVALID_HOURMETER','empty hourmeter is rejected instead of becoming zero');
const savedHour=body(context.doPost({postData:{contents:JSON.stringify({action:'saveHorometro',idToken:EDITOR_TOKEN,data:{requestId:'request-hour-valid',fechaHora:'2026-10-02T13:00:00.000Z',equipoId:'EQ02',horometro:20}})}}));
assert.equal(savedHour.ok,true,'valid hourmeter saves despite unidad filler through row 1000');
assert.equal(sheets.LECTURAS_HOROMETRO.values[6][0],savedHour.data.lecturaId,'first blank lecturaId row is used rather than row 1001');
assert.equal(sheets.LECTURAS_HOROMETRO.values[999][0],'','filler rows remain untouched');
const conflict=body(context.doPost({postData:{contents:JSON.stringify({action:'saveHorometro',idToken:EDITOR_TOKEN,data:{requestId:'request-hour-valid',fechaHora:'2026-10-02T13:00:00.000Z',equipoId:'EQ01',horometro:20}})}}));assert.equal(conflict.error.code,'REQUEST_ID_CONFLICT','request IDs cannot silently replay a different payload');
console.log('Apps Script smoke: OK (schema, row-key append with unidad filler to row 1000, auth/roles, state, novelty, idempotency, formula safety and hourmeter validation)');
