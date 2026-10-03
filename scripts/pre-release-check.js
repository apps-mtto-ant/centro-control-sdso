const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

const STAGING_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbxJTs7TKUhHNK5YFAQofouB86GmzlSG9BodXvFjVke93BbyjHDp9TkPrMipU5mkdIU/exec';

const forbidden = [
  {label:'config.environment=staging', hit:/environment:\s*['"]staging['"]/i.test(config)},
  {label:'config.cachePrefix staging', hit:/cachePrefix:\s*['"][^'"]*stg[^'"]*['"]/i.test(config)},
  {label:'config.dbName staging', hit:/dbName:\s*['"][^'"]*stg[^'"]*['"]/i.test(config)},
  {label:'config.lastSyncKey staging', hit:/lastSyncKey:\s*['"][^'"]*stg[^'"]*['"]/i.test(config)},
  {label:'config.version staging', hit:/version:\s*['"][^'"]*-stg-[^'"]*['"]/i.test(config)},
  {label:'config.backendUrl staging', hit:config.includes(STAGING_BACKEND_URL)},
  {label:'service worker staging version', hit:/\bstg\b/i.test(serviceWorker.split('\n')[0] || '')},
  {label:'manifest STAGING', hit:/STAGING|SDSO STG|environment=staging/i.test(manifest)},
  {label:'index STAGING', hit:/STAGING|ENTORNO DE PRUEBAS/i.test(index)}
].filter(x=>x.hit);

if (forbidden.length) {
  console.error('PRE-RELEASE BLOCKED: todavía existen marcadores de staging:');
  forbidden.forEach(x=>console.error('- '+x.label));
  process.exit(1);
}

console.log('Pre-release config check: OK (sin marcadores de staging conocidos)');
