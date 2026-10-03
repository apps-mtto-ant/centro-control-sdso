/**
 * CENTRO DE CONTROL SDSO · Apps Script v0.4.0
 * Fuente v0.4 para despliegue en staging. No instalar sobre el proyecto de producción.
 * Requiere Script Properties: ENVIRONMENT=staging, SPREADSHEET_ID, GOOGLE_CLIENT_ID, ALLOWED_DOMAIN,
 * EDITOR_EMAILS. Para cuentas gmail.com, ALLOWED_EMAILS debe enumerar las
 * cuentas autorizadas, ya que Gmail no entrega un hosted domain de Workspace.
 * Requiere usar BD_CENTRO_CONTROL_SDSO de staging.
 */
const API_VERSION = '0.4.0-rc2';
const SHEETS = Object.freeze({
  MAESTRO: 'MAESTRO_EQUIPOS', ESTADO: 'ESTADO_ACTUAL', HOROMETROS: 'LECTURAS_HOROMETRO',
  NOVEDADES: 'NOVEDADES', LISTAS: '_LISTAS', CONCILIACION: 'CONCILIACION', HISTORIAL_ESTADO: 'HISTORIAL_ESTADO'
});
const HEADER_ROW = 4;
const HISTORY_HEADERS = Object.freeze(['historialId','fechaRegistro','fechaHoraOperacional','equipoId','estadoAnterior','disponibilidadAnterior','estadoNuevo','disponibilidadNueva','subestadoNuevo','ubicacionNueva','usuario','requestId','observacion']);
const EXTRA_HEADERS = Object.freeze({
  MAESTRO_EQUIPOS: ['esCritico'],
  ESTADO_ACTUAL: ['fechaRegistro', 'requestId'],
  LECTURAS_HOROMETRO: ['fechaRegistro', 'requestId'],
  NOVEDADES: ['fechaRegistro', 'requestId', 'fechaRegistroCierre', 'requestIdCierre', 'usuarioCierre']
});

function doGet(e) {
  const started = Date.now();
  try {
    const action = String(e && e.parameter && e.parameter.action || 'health').trim();
    let data;
    if (action === 'health') data = {service:'Centro de Control SDSO',status:'ok',mode:'authenticated-summary-editor-write',environment:String(PropertiesService.getScriptProperties().getProperty('ENVIRONMENT')||'unconfigured'),requiredSheets:[SHEETS.MAESTRO,SHEETS.ESTADO,SHEETS.HOROMETROS,SHEETS.NOVEDADES,SHEETS.HISTORIAL_ESTADO]};
    else if (action === 'getEquipos' || action === 'getDashboardCompresores') throw apiError_('AUTH_REQUIRED','Inicia sesión para consultar los datos.');
    else return response_({ok:false,error:{code:'ACTION_NOT_FOUND',message:'Acción no reconocida.'}});
    return response_({ok:true,apiVersion:API_VERSION,serverTime:new Date().toISOString(),elapsedMs:Date.now()-started,data,error:null});
  } catch (err) {
    console.error(err && err.stack || err);
    return response_({ok:false,apiVersion:API_VERSION,serverTime:new Date().toISOString(),elapsedMs:Date.now()-started,data:null,error:error_(err)});
  }
}

function doPost(e) {
  const started = Date.now();
  try {
    const body = JSON.parse(e && e.postData && e.postData.contents || '{}');
    const action = String(body.action || '').trim();
    let data;
    if (action === 'authenticate') data = authenticate_(body.idToken);
    else {
      const identity = verifyIdentity_(body.idToken);
      if (action === 'getEquipos') data = getEquipos_();
      else if (action === 'getDashboardCompresores') data = getDashboard_();
      else if (action === 'getNovedades') data = getNovedades_(identity);
      else {
      requireEditor_(identity);
      data = withScriptLock_(function() {
          assertStagingTarget_();
          if (action === 'saveEstado') return saveEstado_(body.data || {}, identity);
          if (action === 'saveHorometro') return saveHorometro_(body.data || {}, identity);
          if (action === 'saveNovedad') return saveNovedad_(body.data || {}, identity);
          if (action === 'closeNovedad') return closeNovedad_(body.data || {}, identity);
          throw apiError_('ACTION_NOT_FOUND', 'Acción de escritura no reconocida.');
        });
      }
    }
    return response_({ok:true,apiVersion:API_VERSION,serverTime:new Date().toISOString(),elapsedMs:Date.now()-started,data,error:null});
  } catch (err) {
    console.error(err && err.stack || err);
    return response_({ok:false,apiVersion:API_VERSION,serverTime:new Date().toISOString(),elapsedMs:Date.now()-started,data:null,error:error_(err)});
  }
}

function authenticate_(token) {
  const user = verifyIdentity_(token);
  return {email:user.email,role:isEditor_(user.email)?'EDITOR':'LECTOR'};
}

function verifyIdentity_(token) {
  if (!token || String(token).length < 40) throw apiError_('AUTH_REQUIRED','Inicia sesión para continuar.');
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('GOOGLE_CLIENT_ID');
  const domain = String(props.getProperty('ALLOWED_DOMAIN') || '').toLowerCase().replace(/^@/,'');
  const allowedEmails = String(props.getProperty('ALLOWED_EMAILS') || '').split(/[\n,;]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (!clientId || !domain || (domain === 'gmail.com' && !allowedEmails.length)) throw apiError_('AUTH_NOT_CONFIGURED','La autenticación de staging aún no está configurada.');
  const claims=cheapJwtClaims_(String(token),clientId);
  const cache=CacheService.getScriptCache();const cacheKey='identity:'+sha256Hex_(String(token));let result=null;const cached=cache.get(cacheKey);if(cached){try{result=JSON.parse(cached);}catch(_){}}
  if(!result){const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token);try {const res = UrlFetchApp.fetch(url,{method:'get',muteHttpExceptions:true});if (res.getResponseCode() !== 200) throw new Error('tokeninfo rechazó la credencial');result = JSON.parse(res.getContentText());} catch (err) { throw apiError_('AUTH_INVALID','La sesión de Google no es válida o expiró.'); }}
  const email = String(result.email || '').trim().toLowerCase();
  const aud = String(result.aud || '');
  const hostedDomain = String(result.hd || '').toLowerCase();
  const verified = String(result.email_verified || '').toLowerCase() === 'true';
  const issuer=String(result.iss||'');
  const emailDomain = email.split('@').pop();
  const identityAllowed = domain === 'gmail.com'
    ? emailDomain === 'gmail.com' && allowedEmails.indexOf(email) >= 0
    : emailDomain === domain && hostedDomain === domain && (!allowedEmails.length || allowedEmails.indexOf(email) >= 0);
  if (aud !== clientId || !verified || !email || !identityAllowed || issuer!=='https://accounts.google.com' && issuer!=='accounts.google.com') {
    throw apiError_('ACCESS_DENIED','La cuenta no pertenece al dominio autorizado.');
  }
  const identity={email:email};const ttl=Math.min(300,Math.max(1,Number(claims.exp)-Math.floor(Date.now()/1000)));cache.put(cacheKey,JSON.stringify(result),ttl);return identity;
}

function cheapJwtClaims_(token,clientId) {
  const parts=String(token).split('.');if(parts.length!==3||parts.some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))throw apiError_('AUTH_INVALID','La sesión de Google no es válida o expiró.');
  let claims;try{claims=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());}catch(_){throw apiError_('AUTH_INVALID','La sesión de Google no es válida o expiró.');}
  const issuer=String(claims.iss||''),expires=Number(claims.exp),now=Math.floor(Date.now()/1000);
  if(String(claims.aud||'')!==clientId||!['https://accounts.google.com','accounts.google.com'].includes(issuer)||!Number.isFinite(expires)||expires<=now||!claims.email)throw apiError_('AUTH_INVALID','La sesión de Google no es válida o expiró.');
  return claims;
}
function sha256Hex_(value) {return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value).map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');}

function isEditor_(email) {
  const allowed = String(PropertiesService.getScriptProperties().getProperty('EDITOR_EMAILS') || '')
    .split(/[\n,;]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
  return allowed.indexOf(String(email).toLowerCase()) >= 0;
}
function requireEditor_(identity) { if (!isEditor_(identity.email)) throw apiError_('EDITOR_REQUIRED','Tu cuenta tiene acceso de consulta, no de edición.'); }

function getDashboard_() {
  const master = readObjects_(SHEETS.MAESTRO);
  const states = readObjects_(SHEETS.ESTADO);
  const readings = readObjects_(SHEETS.HOROMETROS);
  const novelties = readObjects_(SHEETS.NOVEDADES);
  validateHeaders_(SHEETS.MAESTRO,master.headers,['equipoId','activo','tipoObjeto','areaOperacional','modelo','denominacion','aplicaKpi','estadoValidacionSAP']);
  validateHeaders_(SHEETS.ESTADO,states.headers,['equipoId','estado','disponibilidad','fechaHoraActualizacion']);
  validateHeaders_(SHEETS.HOROMETROS,readings.headers,['lecturaId','fechaHora','equipoId','horometro']);
  validateHeaders_(SHEETS.NOVEDADES,novelties.headers,['novedadId','fechaHora','equipoId','tipo','descripcion','estado','criticidad']);

  const statesById = latestStateByEquipment_(states.rows);
  const lastReadings = latestByEquipment_(readings.rows);
  const open = novelties.rows.filter(n=>String(n.estado||'').toUpperCase()!=='CERRADA');
  const openCounts = groupCount_(open,'equipoId');
  const items = master.rows.filter(m=>String(m.tipoObjeto||'').toUpperCase()==='EQUIPO'&&String(m.activo||'').toUpperCase()==='SI').map(m=>{
    const id=String(m.equipoId||''); const state=statesById[id]||null; const reading=lastReadings[id]||null;
    return {
      equipoId:id,
      maestro:{activo:m.activo||'',areaOperacional:m.areaOperacional||'',ubicacionFisica:m.ubicacionFisica||'',tag:m.tag||'',numeroEquipoSAP:m.numeroEquipoSAP||'',marca:m.marca||'',tipo:m.tipo||'',modelo:m.modelo||'',modeloSAP:m.modeloSAP||'',denominacion:m.denominacion||'',aplicaKpi:m.aplicaKpi||'',esCritico:m.esCritico||'',estadoValidacionSAP:m.estadoValidacionSAP||''},
      estadoActual:state?{estado:state.estado||'',subestado:state.subestado||'',disponibilidad:state.disponibilidad||'',ubicacionActual:state.ubicacionActual||'',fechaHoraActualizacion:state.fechaHoraActualizacion||''}:null,
      ultimaLecturaHorometro:reading?{lecturaId:reading.lecturaId||'',fechaHora:reading.fechaHora||'',horometro:numberOrNull_(reading.horometro),unidad:reading.unidad||'h'}:null,
      novedadesAbiertas:openCounts[id]||0
    };
  });
  const byArea={},byModel={},sap={};let available=0,unavailable=0,noState=0;
  items.forEach(x=>{
    const area=x.maestro.areaOperacional||'SIN ÁREA';const a=byArea[area]||(byArea[area]={total:0,disponibles:0,indisponibles:0,sinEstado:0});a.total++;
    const d=String(x.estadoActual&&x.estadoActual.disponibilidad||'').toUpperCase();if(d==='DISPONIBLE'){available++;a.disponibles++;}else if(d==='INDISPONIBLE'){unavailable++;a.indisponibles++;}else{noState++;a.sinEstado++;}
    const model=normalizeModel_(x.maestro.modelo||'SIN MODELO');byModel[model]=(byModel[model]||0)+1;
    const validation=x.maestro.estadoValidacionSAP||'SIN ESTADO';sap[validation]=(sap[validation]||0)+1;
  });
  const activeMaster=master.rows.filter(m=>String(m.tipoObjeto||'').toUpperCase()==='EQUIPO'&&String(m.activo||'').toUpperCase()==='SI');
  const sapRows=master.rows.filter(m=>String(m.tipoObjeto||'').toUpperCase()==='EQUIPO');
  const sapKeys=sapRows.map(m=>String(m.numeroEquipoSAP||'').trim()).filter(Boolean);
  const duplicates=sapKeys.filter((v,i,a)=>a.indexOf(v)!==i).filter((v,i,a)=>a.indexOf(v)===i);
  const dates=[...states.rows.map(x=>x.fechaHoraActualizacion),...readings.rows.map(x=>x.fechaHora),...novelties.rows.map(x=>x.fechaHora)].map(dateMs_).filter(Number.isFinite);
  const lists=readLists_();
  const inactiveCount=sapRows.filter(m=>String(m.activo||'').toUpperCase()!=='SI').length;
  const modelMismatch=sapRows.filter(m=>m.modelo&&m.modeloSAP&&normalizeModel_(m.modelo)!==normalizeModel_(m.modeloSAP)).map(m=>({equipoId:m.equipoId,modelo:m.modelo,modeloSAP:m.modeloSAP}));
  const sapMaster=sapRows.map(m=>({maestro:{activo:m.activo||'',estadoValidacionSAP:m.estadoValidacionSAP||''}}));
  return {resumen:{totalEquipos:items.length,disponibles:available,indisponibles:unavailable,sinEstado:noState,novedadesAbiertas:open.length,ultimaActualizacion:dates.length?new Date(Math.max.apply(null,dates)).toISOString():null},porArea:byArea,porModelo:byModel,validacionSAP:sap,equipos:items,listas:lists,conciliacionSAP:{activos:activeMaster.length,inactivos:inactiveCount,sinSAP:activeMaster.filter(m=>!String(m.numeroEquipoSAP||'').trim()).length,duplicadosSAP:duplicates,modeloNoEquivalente:modelMismatch,equipos:sapMaster}};
}

function getEquipos_() {
  const data=getDashboard_();
  return {count:data.equipos.length,equipos:data.equipos.map(x=>({equipoId:x.equipoId,activo:x.maestro.activo,areaOperacional:x.maestro.areaOperacional,tag:x.maestro.tag,numeroEquipoSAP:x.maestro.numeroEquipoSAP,marca:x.maestro.marca,modelo:x.maestro.modelo,denominacion:x.maestro.denominacion,estadoValidacionSAP:x.maestro.estadoValidacionSAP}))};
}

function getNovedades_(identity) {
  const rows=readObjects_(SHEETS.NOVEDADES);validateHeaders_(SHEETS.NOVEDADES,rows.headers,['novedadId','fechaHora','equipoId','tipo','descripcion','estado','criticidad']);
  const list=rows.rows.filter(x=>String(x.estado||'').toUpperCase()!=='CERRADA').sort((a,b)=>dateMs_(b.fechaHora)-dateMs_(a.fechaHora)).map(x=>({novedadId:String(x.novedadId||''),fechaHora:x.fechaHora||'',equipoId:String(x.equipoId||''),tipo:x.tipo||'',descripcion:x.descripcion||'',estado:x.estado||'',criticidad:x.criticidad||''}));
  return {novedades:list,role:isEditor_(identity.email)?'EDITOR':'LECTOR'};
}

function saveEstado_(data,identity) {
  const clean=validateCommon_(data);const ss=sheet_(SHEETS.ESTADO);const table=readObjects_(SHEETS.ESTADO);validateWriteHeaders_(SHEETS.ESTADO,table.headers,['equipoId','estado','subestado','disponibilidad','ubicacionActual','fechaHoraActualizacion','fuente','usuario','observacion']);
  if(!table.headers.includes('fechaRegistro')||!table.headers.includes('requestId'))throw apiError_('SCHEMA_UPGRADE_REQUIRED','La hoja de estado requiere fechaRegistro y requestId en staging.');
  requireActiveEquipment_(clean.equipoId);
  requireChoice_(data.estado,readLists_().estadoOperacional,'estado');requireChoice_(data.disponibilidad,readLists_().disponibilidad,'disponibilidad');
  const hit=table.rows.filter(x=>String(x.equipoId)===clean.equipoId);if(hit.length>1)throw apiError_('DUPLICATE_EQUIPMENT_STATE','ESTADO_ACTUAL contiene más de una fila para este equipo. Corregir duplicados en staging.');
  const now=new Date().toISOString();const row=hit.length?hit[0]._row:nextRow_(ss,HEADER_ROW,table.headers,'equipoId');
  const existing=hit[0]||{};
  if(existing.requestId&&existing.requestId===clean.requestId)return {saved:true,replayed:true};
  if(existing.fechaHoraActualizacion&&dateMs_(clean.fechaHora)<dateMs_(existing.fechaHoraActualizacion))throw apiError_('STALE_STATE_UPDATE','La fecha ingresada es anterior al estado vigente. Actualiza la fecha antes de guardar.');
  const dataRow=table.headers.map(h=>({
    equipoId:clean.equipoId,estado:String(data.estado).trim(),subestado:short_(data.subestado,120),disponibilidad:String(data.disponibilidad).trim(),ubicacionActual:short_(data.ubicacionActual,160),
    horometroActual:existing.horometroActual||'',fechaHoraActualizacion:clean.fechaHora,fuente:'Dashboard SDSO',usuario:identity.email,observacion:short_(data.observacion,1000),fechaRegistro:now,requestId:clean.requestId
  }[h]??existing[h]??''));
  table.headers.forEach((header,index)=>ss.getRange(row,index+1).setValue(dataRow[index]));
  const history=sheet_(SHEETS.HISTORIAL_ESTADO);const historyHeaders=history.getRange(HEADER_ROW,1,1,history.getLastColumn()).getDisplayValues()[0].map(x=>String(x).trim());validateHeaders_(SHEETS.HISTORIAL_ESTADO,historyHeaders,HISTORY_HEADERS);
  appendByHeaders_(history,historyHeaders,{historialId:Utilities.getUuid(),fechaRegistro:now,fechaHoraOperacional:clean.fechaHora,equipoId:clean.equipoId,estadoAnterior:short_(existing.estado,120),disponibilidadAnterior:short_(existing.disponibilidad,80),estadoNuevo:String(data.estado).trim(),disponibilidadNueva:String(data.disponibilidad).trim(),subestadoNuevo:short_(data.subestado,120),ubicacionNueva:short_(data.ubicacionActual,160),usuario:identity.email,requestId:clean.requestId,observacion:short_(data.observacion,1000)});
  return {saved:true,equipoId:clean.equipoId,fechaRegistro:now};
}

function saveHorometro_(data,identity) {
  const clean=validateCommon_(data);if(data.horometro===null||data.horometro===undefined||String(data.horometro).trim()==='')throw apiError_('INVALID_HOURMETER','Ingresa un horómetro válido.');const reading=Number(data.horometro);if(!Number.isFinite(reading)||reading<0||reading>10000000)throw apiError_('INVALID_HOURMETER','Ingresa un horómetro válido.');
  requireActiveEquipment_(clean.equipoId);const ss=sheet_(SHEETS.HOROMETROS);const table=readObjects_(SHEETS.HOROMETROS);validateWriteHeaders_(SHEETS.HOROMETROS,table.headers,['lecturaId','fechaHora','equipoId','horometro','unidad','origen','usuario','observacion']);
  if(!table.headers.includes('fechaRegistro')||!table.headers.includes('requestId'))throw apiError_('SCHEMA_UPGRADE_REQUIRED','El histórico de horómetros requiere las columnas fechaRegistro y requestId en staging.');
  const replay=table.rows.find(x=>x.requestId===clean.requestId);if(replay){if(String(replay.equipoId)!==clean.equipoId||Number(replay.horometro)!==reading||dateMs_(replay.fechaHora)!==dateMs_(clean.fechaHora))throw apiError_('REQUEST_ID_CONFLICT','El identificador de solicitud ya fue usado con otros datos.');return {saved:true,replayed:true};}
  const readings=table.rows.filter(x=>String(x.equipoId)===clean.equipoId&&x.horometro!==''&&x.horometro!==null).sort((a,b)=>dateMs_(a.fechaHora)-dateMs_(b.fechaHora));
  const before=readings.filter(x=>dateMs_(x.fechaHora)<=dateMs_(clean.fechaHora)).pop();const after=readings.find(x=>dateMs_(x.fechaHora)>dateMs_(clean.fechaHora));
  if(before&&reading<Number(before.horometro)||after&&reading>Number(after.horometro))throw apiError_('HOURMETER_DECREASE','La lectura no mantiene la secuencia cronológica del horómetro. Revisa el dato y las lecturas cercanas.');
  const now=new Date().toISOString();const id=Utilities.getUuid();
  appendByHeaders_(ss,table.headers,{lecturaId:id,fechaHora:clean.fechaHora,equipoId:clean.equipoId,horometro:reading,unidad:'h',origen:'Dashboard SDSO',usuario:identity.email,observacion:short_(data.observacion,500),fechaRegistro:now,requestId:clean.requestId});
  return {saved:true,lecturaId:id,fechaRegistro:now};
}

function saveNovedad_(data,identity) {
  const clean=validateCommon_(data);const description=short_(data.descripcion,2000);if(description.trim().length<5)throw apiError_('INVALID_NOVELTY','La descripción debe incluir al menos 5 caracteres.');
  requireActiveEquipment_(clean.equipoId);const lists=readLists_();requireChoice_(data.tipo,lists.tipoNovedad,'tipo');requireChoice_(data.criticidad,lists.criticidad,'criticidad');
  const ss=sheet_(SHEETS.NOVEDADES);const table=readObjects_(SHEETS.NOVEDADES);validateWriteHeaders_(SHEETS.NOVEDADES,table.headers,['novedadId','fechaHora','equipoId','tipo','descripcion','estado','criticidad','usuario','fechaCierre','observacionCierre']);
  if(!table.headers.includes('fechaRegistro')||!table.headers.includes('requestId'))throw apiError_('SCHEMA_UPGRADE_REQUIRED','La hoja de novedades requiere fechaRegistro y requestId en staging.');
  const replay=table.rows.find(x=>x.requestId===clean.requestId);if(replay){if(String(replay.equipoId)!==clean.equipoId||String(replay.descripcion)!==description||String(replay.tipo)!==String(data.tipo)||String(replay.criticidad)!==String(data.criticidad)||dateMs_(replay.fechaHora)!==dateMs_(clean.fechaHora))throw apiError_('REQUEST_ID_CONFLICT','El identificador de solicitud ya fue usado con otros datos.');return {saved:true,replayed:true};}
  const now=new Date().toISOString();const id=Utilities.getUuid();
  appendByHeaders_(ss,table.headers,{novedadId:id,fechaHora:clean.fechaHora,equipoId:clean.equipoId,tipo:String(data.tipo),descripcion:description,estado:'ABIERTA',criticidad:String(data.criticidad),usuario:identity.email,fechaCierre:'',observacionCierre:'',fechaRegistro:now,requestId:clean.requestId});
  return {saved:true,novedadId:id,fechaRegistro:now};
}

function closeNovedad_(data,identity) {
  const id=short_(data.novedadId,100);const request=short_(data.requestId,100);if(!id||!request)throw apiError_('INVALID_REQUEST','Falta identificador de novedad o solicitud.');
  const ss=sheet_(SHEETS.NOVEDADES);const table=readObjects_(SHEETS.NOVEDADES);validateWriteHeaders_(SHEETS.NOVEDADES,table.headers,['novedadId','estado','fechaCierre','observacionCierre','usuario']);
  if(!table.headers.includes('requestIdCierre')||!table.headers.includes('usuarioCierre')||!table.headers.includes('fechaRegistroCierre'))throw apiError_('SCHEMA_UPGRADE_REQUIRED','La hoja de novedades requiere columnas de auditoría de cierre en staging.');
  const hit=table.rows.find(x=>String(x.novedadId)===id);if(!hit)throw apiError_('NOVELTY_NOT_FOUND','No se encontró la novedad.');if(String(hit.estado).toUpperCase()==='CERRADA')return {saved:true,replayed:true};
  if(hit.requestIdCierre&&hit.requestIdCierre!==request)throw apiError_('REQUEST_ID_CONFLICT','El identificador de solicitud ya fue usado para otro cierre.');
  const now=new Date().toISOString();const updates={estado:'CERRADA',fechaCierre:now,observacionCierre:short_(data.observacionCierre,1000),fechaRegistroCierre:now,requestIdCierre:request,usuarioCierre:identity.email};
  Object.keys(updates).forEach(header=>ss.getRange(hit._row,table.headers.indexOf(header)+1).setValue(updates[header]));return {saved:true,novedadId:id,fechaCierre:now};
}

function validateCommon_(data) {
  const equipmentId=short_(data.equipoId,80);const requestId=short_(data.requestId,100);const eventDate=dateMs_(data.fechaHora);
  if(!equipmentId||!requestId||!Number.isFinite(eventDate))throw apiError_('INVALID_REQUEST','Completa equipo, fecha y vuelve a enviar el registro.');
  if(eventDate>Date.now()+5*60*1000)throw apiError_('FUTURE_DATE','La fecha de operación no puede estar en el futuro.');
  return {equipoId:equipmentId,requestId:requestId,fechaHora:new Date(eventDate).toISOString()};
}
function requireActiveEquipment_(id) {const rows=readObjects_(SHEETS.MAESTRO);const exists=rows.rows.some(x=>String(x.equipoId)===id&&String(x.activo).toUpperCase()==='SI'&&String(x.tipoObjeto).toUpperCase()==='EQUIPO');if(!exists)throw apiError_('EQUIPMENT_NOT_ACTIVE','El equipo no existe o está inactivo en MAESTRO_EQUIPOS.');}
function requireChoice_(value,options,label) {if(!value||!options.includes(String(value)))throw apiError_('INVALID_'+label.toUpperCase(),'Selecciona un valor vigente para '+label+'.');}
function validateWriteHeaders_(name,headers,required) {validateHeaders_(name,headers,required);}

function readLists_() {
  const sh=sheet_(SHEETS.LISTAS);const vals=sh.getDataRange().getValues();if(vals.length<2)return {};
  const headers=vals[0].map(String);const map={};headers.forEach((h,c)=>{map[listKey_(h)]=vals.slice(1).map(r=>String(r[c]||'').trim()).filter(Boolean);});return map;
}
function listKey_(label) {return ({ESTADO_OPERACIONAL:'estadoOperacional',DISPONIBILIDAD:'disponibilidad',TIPO_NOVEDAD:'tipoNovedad',CRITICIDAD:'criticidad',ESTADO_NOVEDAD:'estadoNovedad'})[String(label).toUpperCase()]||String(label);}

function readObjects_(name) {
  const sh=sheet_(name);if(sh.getMaxRows()<HEADER_ROW)return {headers:[],rows:[]};
  const width=sh.getLastColumn();const headers=sh.getRange(HEADER_ROW,1,1,width).getDisplayValues()[0].map(x=>String(x).trim());
  const key=primaryKeyForSheet_(name);const keyIndex=headers.indexOf(key);if(keyIndex<0)return {headers:headers,rows:[]};
  const maxRows=sh.getMaxRows(),first=HEADER_ROW+1,keyValues=sh.getRange(first,keyIndex+1,maxRows-HEADER_ROW,1).getValues();let last=HEADER_ROW;
  for(let i=keyValues.length-1;i>=0;i--)if(keyValues[i][0]!==''&&keyValues[i][0]!==null){last=first+i;break;}
  const rows=last<=HEADER_ROW?[]:sh.getRange(first,1,last-HEADER_ROW,width).getValues().map((values,index)=>{const obj={_row:first+index};headers.forEach((h,i)=>{if(h)obj[h]=normalizeCell_(values[i]);});return obj;}).filter(o=>o[key]!==''&&o[key]!==null);
  return {headers:headers,rows:rows};
}
function normalizeCell_(value) {if(value instanceof Date)return value.toISOString();return value===null||value===undefined?'':value;}
function validateHeaders_(name,headers,required) {const missing=required.filter(x=>headers.indexOf(x)<0);if(missing.length)throw apiError_('HEADERS_INVALID',name+' no tiene los encabezados requeridos: '+missing.join(', '));}
function primaryKeyForSheet_(name) {return ({MAESTRO_EQUIPOS:'equipoId',ESTADO_ACTUAL:'equipoId',LECTURAS_HOROMETRO:'lecturaId',NOVEDADES:'novedadId',HISTORIAL_ESTADO:'historialId'})[name]||'';}
function latestStateByEquipment_(rows) {const out={};rows.forEach(x=>{const id=String(x.equipoId||'');if(!id)return;const old=out[id];if(!old||dateMs_(x.fechaHoraActualizacion)>=dateMs_(old.fechaHoraActualizacion))out[id]=x;});return out;}
function uniqueIndex_(rows,key,sheetName) {const out={};rows.forEach(x=>{const id=String(x[key]||'');if(!id)return;if(out[id])throw apiError_('DUPLICATE_EQUIPMENT_STATE',sheetName+' tiene filas duplicadas para '+id+'.');out[id]=x;});return out;}
function latestByEquipment_(rows) {const out={};rows.forEach(x=>{const id=String(x.equipoId||'');if(!id||x.horometro===''||x.horometro===null)return;const t=dateMs_(x.fechaHora);const old=out[id];const oldTime=old?dateMs_(old.fechaHora):NaN;const recorded=dateMs_(x.fechaRegistro);const oldRecorded=old?dateMs_(old.fechaRegistro):NaN;if(!old||(!Number.isFinite(oldTime)&&Number.isFinite(t))||(t>oldTime)||(t===oldTime&&recorded>oldRecorded))out[id]=x;});return out;}
function normalizeModel_(value) {return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function withScriptLock_(fn) {const lock=LockService.getScriptLock();lock.waitLock(10000);try{return fn();}finally{lock.releaseLock();}}
function groupCount_(rows,key) {const out={};rows.forEach(x=>{const id=String(x[key]||'');if(id)out[id]=(out[id]||0)+1;});return out;}
function dateMs_(v) {if(v instanceof Date)return v.getTime();if(typeof v==='number')return new Date(Math.round((v-25569)*86400000)).getTime();if(!v)return NaN;return new Date(v).getTime();}
function numberOrNull_(v) {const n=Number(v);return Number.isFinite(n)?n:null;}
function short_(v,max) {const value=String(v||'').trim().slice(0,max);return /^[=+\-@]/.test(value)?"'"+value:value;}
function appendByHeaders_(sh,headers,record) {const row=headers.map(h=>record[h]===undefined?'':record[h]);sh.getRange(nextRow_(sh,HEADER_ROW,headers,primaryKeyForSheet_(sh.getName())),1,1,headers.length).setValues([row]);}
function nextRow_(sh,headerRow,headers,key) {const index=headers.indexOf(key);if(index<0)throw apiError_('HEADERS_INVALID','No se encontró la columna clave '+key+'.');const first=headerRow+1,max=sh.getMaxRows();const values=max>=first?sh.getRange(first,index+1,max-headerRow,1).getValues():[];for(let i=0;i<values.length;i++)if(values[i][0]===''||values[i][0]===null)return first+i;sh.insertRowsAfter(max,1);return max+1;}
function sheet_(name) {const ss=spreadsheet_();const sh=ss.getSheetByName(name);if(!sh)throw apiError_('SHEET_NOT_FOUND','No se encontró la hoja '+name+'.');return sh;}
function spreadsheet_() {const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw apiError_('SPREADSHEET_NOT_CONFIGURED','Configura SPREADSHEET_ID en las propiedades del script de staging.');return SpreadsheetApp.openById(id);}
function assertStagingTarget_() {const props=PropertiesService.getScriptProperties();if(String(props.getProperty('ENVIRONMENT')||'').toLowerCase()!=='staging')throw apiError_('WRITE_ENVIRONMENT_BLOCKED','La escritura está bloqueada: configura ENVIRONMENT=staging en el proyecto de prueba.');const name=spreadsheet_().getName();if(!/_STG(?:_|$)/i.test(String(name)))throw apiError_('WRITE_TARGET_BLOCKED','La escritura está bloqueada porque el libro configurado no está identificado como staging.');}
function apiError_(code,message) {const e=new Error(message);e.code=code;return e;}
function error_(err) {return {code:err&&err.code?String(err.code):'INTERNAL_ERROR',message:err&&err.message?String(err.message):'Error interno del backend.'};}
function response_(payload) {return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);}

/** Ejecutar manualmente solo en staging tras configurar ENVIRONMENT=staging y validar SPREADSHEET_ID. */
function prepareV040Schema() {
  assertStagingTarget_();
  const ss=spreadsheet_();
  Object.keys(EXTRA_HEADERS).forEach(name=>{const sh=ss.getSheetByName(name);if(!sh)throw new Error('Falta hoja '+name);const headers=sh.getRange(HEADER_ROW,1,1,sh.getLastColumn()).getDisplayValues()[0].map(String);EXTRA_HEADERS[name].forEach(h=>{if(headers.indexOf(h)<0){sh.getRange(HEADER_ROW,sh.getLastColumn()+1).setValue(h);}});});
  let history=ss.getSheetByName(SHEETS.HISTORIAL_ESTADO);if(!history)history=ss.insertSheet(SHEETS.HISTORIAL_ESTADO);const existing=history.getLastColumn()?history.getRange(HEADER_ROW,1,1,history.getLastColumn()).getDisplayValues()[0].map(x=>String(x).trim()):[];if(existing.filter(Boolean).length===0)history.getRange(HEADER_ROW,1,1,HISTORY_HEADERS.length).setValues([HISTORY_HEADERS]);else validateHeaders_(SHEETS.HISTORIAL_ESTADO,existing,HISTORY_HEADERS);
  return 'v0.4 staging columns ready';
}

/** Prueba local/manual de lectura y esquema. No escribe datos operacionales. */
function testV040ReadOnly() {const d=getDashboard_();if(!Array.isArray(d.equipos)||!d.resumen)throw new Error('snapshot inválido');return {equipos:d.equipos.length,ultimaActualizacion:d.resumen.ultimaActualizacion,apiVersion:API_VERSION};}
