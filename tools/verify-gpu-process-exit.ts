import { spawn, execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

async function main(): Promise<void> {
  const root = path.resolve(__dirname, '../../..');
  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
  const report = fs.mkdtempSync(path.join(root, 'reports/gpu-exit-'));
  const profile = path.join(report, 'profile');
  const child = spawn('/bin/bash', [path.join(root, 'Launch-RTX-Browser.command')], {
    cwd: root, env: { ...process.env, MOMOTA_PROFILE_DIR: profile, RTX_REPORT_DIR: report,
      RTX_SMOKE_EXIT: '1', MOMOTA_STRESS_MS: '10000' }, stdio: 'ignore'
  });
  let exited = false;
  const outcome = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => { exited = true; resolve(code); });
  });
  try {
    const prefix = path.join(root, 'build/RTX Browser.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper') + ' --type=gpu-process ';
    let killed = false;
    for (let attempt = 0; attempt < 100 && !exited; attempt++) {
      const rows = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8', timeout: 3000 });
      for (const row of rows.split('\n')) {
        const match = row.match(/^\s*(\d+)\s+(.*)$/);
        if (match && match[2].startsWith(prefix) && match[2].includes(`--user-data-dir=${profile} `)) {
          process.kill(Number(match[1]), 'SIGTERM');
          killed = true;
          break;
        }
      }
      if (killed) break;
      await delay(100);
    }
    if (!killed) throw Error('Owned diagnostic GPU process was not found; no process was signaled');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const code = await Promise.race([outcome, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error('Diagnostic browser did not exit after GPU termination')), 30000);
    })]).finally(() => clearTimeout(timer));
    const events = fs.readFileSync(path.join(report, 'events.jsonl'), 'utf8').trim().split('\n')
      .map(line => JSON.parse(line) as { type: string });
    if (code !== 1 || !events.some(event => event.type === 'GPU')) {
      throw Error(`GPU termination was not rejected by smoke verification (exit ${code}); inspect ${report}`);
    }
    console.log(`GPU process termination: PASS; only the isolated test child was signaled; browser exited 1. Reports: ${report}`);
  } finally {
    if (!exited) child.kill('SIGTERM');
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
