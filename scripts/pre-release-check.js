const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');

const forbidden = [
  {label:'config.environment=staging', hit:/environment:\s*['"]staging['"]/i.test(config)},
  {label:'config.cachePrefix staging', hit:/cachePrefix:\s*['"][^'"]*stg[^'"]*['"]/i.test(config)},
  {label:'config.dbName staging', hit:/dbName:\s*['"][^'"]*stg[^'"]*['"]/i.test(config)},
  {label:'config.lastSyncKey staging', hit:/lastSyncKey:\s*['"][^'"]*stg[^'"]*['"]/i.test(config)},
  {label:'manifest STAGING', hit:/STAGING|SDSO STG|environment=staging/i.test(manifest)}
].filter(x=>x.hit);

if (forbidden.length) {
  console.error('PRE-RELEASE BLOCKED: todavía existen marcadores de staging:');
  forbidden.forEach(x=>console.error('- '+x.label));
  process.exit(1);
}

console.log('Pre-release config check: OK (sin marcadores de staging conocidos)');
