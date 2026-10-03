const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

const STAGING_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbxJTs7TKUhHNK5YFAQofouB86GmzlSG9BodXvFjVke93BbyjHDp9TkPrMipU5mkdIU/exec';
const LEGACY_V03_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbxvNHInBM-lIBnAQ_CiaEMeW0zcwL1ioVg8nwEjS3daLoTZZ6C0wKFhi7c9RJFwWjs/exec';

const forbidden = [
  {label:'config.environment no es production', hit:!/environment:\s*['"]production['"]/i.test(config)},
  {label:'config.cachePrefix no productivo', hit:!/cachePrefix:\s*['"]centro-control-sdso-['"]/i.test(config)},
  {label:'config.dbName no productivo', hit:!/dbName:\s*['"]centro-control-sdso['"]/i.test(config)},
  {label:'config.lastSyncKey no productivo', hit:!/lastSyncKey:\s*['"]sdso:lastSync['"]/i.test(config)},
  {label:'config.version no es 0.4.0', hit:!/version:\s*['"]0\.4\.0['"]/i.test(config)},
  {label:'config.backendUrl placeholder', hit:/backendUrl:\s*['"]__PRODUCTION_V04_BACKEND_URL__['"]/i.test(config)},
  {label:'config.backendUrl vacío o inválido', hit:!/backendUrl:\s*['"]https:\/\/script\.google\.com\/macros\/s\/[^'"]+\/exec['"]/i.test(config)},
  {label:'config.backendUrl apunta a staging', hit:config.includes(STAGING_BACKEND_URL)},
  {label:'config.backendUrl reutiliza v0.3', hit:config.includes(LEGACY_V03_BACKEND_URL)},
  {label:'googleClientId ausente o inválido', hit:!/googleClientId:\s*['"][^'"]+\.apps\.googleusercontent\.com['"]/i.test(config)},
  {label:'service worker no está en v0.4.0', hit:!/\/\*\s*v0\.4\.0\s*\*\//i.test(serviceWorker.split('\n')[0] || '')},
  {label:'manifest conserva STAGING', hit:/STAGING|SDSO STG|environment=staging/i.test(manifest)},
  {label:'index conserva STAGING', hit:/STAGING|ENTORNO DE PRUEBAS/i.test(index)}
].filter(x=>x.hit);

if (forbidden.length) {
  console.error('PRE-RELEASE BLOCKED: configuración productiva incompleta o insegura:');
  forbidden.forEach(x=>console.error('- '+x.label));
  process.exit(1);
}

console.log('Pre-release config check: OK (configuración productiva validada)');
