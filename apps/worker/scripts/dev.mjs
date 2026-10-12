/**
 * `wrangler dev` com portas vindas do ambiente (padrão 8787), para rodar várias instâncias em paralelo.
 * TABLEHUB_WORKER_PORT e TABLEHUB_INSPECTOR_PORT são definidas pelo despachante (docs/AUTOMATION.md).
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkg = require.resolve('wrangler/package.json');
const bin = join(dirname(pkg), require('wrangler/package.json').bin.wrangler);

const port = process.env.TABLEHUB_WORKER_PORT;
const args = ['dev', '--port', port ?? '8787'];
if (process.env.TABLEHUB_INSPECTOR_PORT) args.push('--inspector-port', process.env.TABLEHUB_INSPECTOR_PORT);
// com porta própria, estado local próprio: duas instâncias no mesmo diretório travam o SQLite dos Durable Objects
if (port) args.push('--persist-to', `.wrangler/state-${port}`);
args.push(...process.argv.slice(2));

const child = spawn(process.execPath, [bin, ...args], { stdio: 'inherit' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
