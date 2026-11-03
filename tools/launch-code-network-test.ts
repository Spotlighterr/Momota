import * as dns from 'node:dns/promises';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isIPv4 } from 'node:net';
import { execFileSync, spawn } from 'node:child_process';

async function main(): Promise<void> {
  const options = process.argv.slice(2);
  if (options.some(value => !['--isolated', '--dry-run'].includes(value))) throw Error('Usage: launch-code-network-test [--isolated] [--dry-run]');
  const isolated = options.includes('--isolated'), dryRun = options.includes('--dry-run');
  const root = path.resolve(__dirname, '../../..');
  const executable = '/Applications/Visual Studio Code.app/Contents/MacOS/Code';
  const running = execFileSync('/bin/ps', ['-axo', 'comm='], { encoding: 'utf8' }).split('\n').some(line => line.trim() === executable);
  if (running && !isolated && !dryRun) throw Error('Save files and close original VS Code first. Renderer/network flags cannot change an existing process.');
  const hosts = ['main.vscode-cdn.net', 'update.code.visualstudio.com'];
  const records = await Promise.all(hosts.map(async host => {
    const result = await dns.lookup(host, { family: 4 });
    if (!isIPv4(result.address)) throw Error(`No IPv4 address for ${host}`);
    return { host, address: result.address };
  }));
  const rules = records.map(record => `MAP ${record.host} ${record.address}`).join(', ');
  if (dryRun) { console.log(JSON.stringify({ executable, isolated, rules, debugEndpoint: 'http://127.0.0.1:9344' }, null, 2)); return; }
  fs.mkdirSync(path.join(root, 'reports/code-network-test'), { recursive: true });
  const report = fs.mkdtempSync(path.join(root, 'reports/code-network-test/run-'));
  const args = ['--remote-debugging-port=9344', '--remote-debugging-address=127.0.0.1', `--host-resolver-rules=${rules}`];
  // macOS Unix-domain socket names are limited to 103 bytes. A profile nested
  // under a long workspace/report path can prevent VS Code from starting.
  const profile = isolated ? fs.mkdtempSync('/tmp/momota-net-') : undefined;
  if (profile) args.push('--user-data-dir', profile, '--extensions-dir', path.join(report, 'extensions'), '--disable-extensions', '--new-window');
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('VSCODE_') || ['ELECTRON_RUN_AS_NODE', 'DYLD_INSERT_LIBRARIES'].includes(key)) delete env[key];
  const child = spawn(executable, args, { env, stdio: 'inherit' });
  const metadata = { capturedAt: new Date().toISOString(), pid: child.pid, isolated, executable, records, profile, report };
  fs.writeFileSync(path.join(root, 'reports/code-network-test/last-run.json'), JSON.stringify(metadata, null, 2) + '\n');
  console.log('Temporary IPv4 mappings apply only to the two Microsoft hosts in this VS Code process. TLS verification remains enabled.');
  console.log('Diagnostic endpoint: http://127.0.0.1:9344. Quit this VS Code instance after diagnosis to close it.');
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
