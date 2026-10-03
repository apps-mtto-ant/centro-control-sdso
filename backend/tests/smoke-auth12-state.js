const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, [__dirname + '/smoke.js'], { encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) process.exit(result.status || 1);
if (!result.stdout.includes('AUTH12 six-state derived availability')) {
  throw new Error('La smoke principal no reportó la cobertura de comportamiento AUTH12.');
}

console.log('AUTH12 state smoke: OK (delegada a la smoke conductual principal)');
