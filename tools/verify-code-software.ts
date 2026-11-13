import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { connect, fetchJSON, CDPTarget } from '../inspect-code';
import { collectHealth, compareHealth } from './gpu-health';

async function main(): Promise<void> {
  const root = path.resolve(__dirname, '../../..');
  const port = 9355, endpoint = `http://127.0.0.1:${port}`;
  try {
    await fetchJSON(endpoint + '/json/version');
    throw Error('Diagnostic port is already occupied');
  } catch (error) {
    if (error instanceof Error && error.message === 'Diagnostic port is already occupied') throw error;
  }
  const profile = fs.mkdtempSync('/tmp/momota-soft-');
  const report = path.join(root, 'reports/code-software', String(Date.now()));
  fs.mkdirSync(report, { recursive: true });
  const before = collectHealth();
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('VSCODE_') || ['ELECTRON_RUN_AS_NODE', 'DYLD_INSERT_LIBRARIES', 'RTX_FORCE', 'RTX_REGISTRY_ID'].includes(key)) delete env[key];
  }
  const log = fs.openSync(path.join(report, 'launch.log'), 'w');
  const child = spawn('/Applications/Visual Studio Code.app/Contents/MacOS/Code', [
    '--disable-gpu', '--disable-extensions', '--skip-welcome', '--skip-release-notes',
    '--user-data-dir', profile, '--extensions-dir', path.join(profile, 'extensions'),
    `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', '--new-window'
  ], { env, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  let launchError: Error | undefined;
  child.once('error', error => { launchError = error; });
  const exited = new Promise<void>(resolve => child.once('close', () => resolve()));
  const watchdog = setTimeout(() => child.kill('SIGKILL'), 60000);
  let browser: Awaited<ReturnType<typeof connect>> | undefined;
  let page: Awaited<ReturnType<typeof connect>> | undefined;
  let owned = false;
  const result: Record<string, unknown> = { capturedAt: new Date().toISOString(), profile, report, before };
  try {
    const deadline = Date.now() + 25000;
    let metadata: { webSocketDebuggerUrl: string } | undefined;
    while (Date.now() < deadline && child.exitCode === null && !launchError) {
      try { metadata = await fetchJSON(endpoint + '/json/version'); break; } catch { await delay(300); }
    }
    if (!metadata) throw launchError ?? Error('Software-rendered Code did not expose its diagnostic endpoint');
    browser = await connect(metadata.webSocketDebuggerUrl, port);
    const processes = await browser.call<{ processInfo: { type: string; id: number }[] }>('SystemInfo.getProcessInfo');
    if (!processes.processInfo.some(item => item.type === 'browser' && item.id === child.pid)) throw Error('Endpoint belongs to another process');
    owned = true;
    const info = await browser.call<{ gpu: { featureStatus: Record<string, string> } }>('SystemInfo.getInfo');
    result.gpu = info.gpu;
    if (info.gpu.featureStatus.gpu_compositing !== 'disabled_software' ||
        info.gpu.featureStatus.skia_graphite !== 'disabled_off') throw Error('Software rendering and disabled Graphite were not confirmed');
    let target: CDPTarget | undefined;
    while (Date.now() < deadline) {
      const targets = await fetchJSON<CDPTarget[]>(endpoint + '/json/list');
      target = targets.find(item => item.type === 'page' && item.url.startsWith('vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/'));
      if (target) break;
      await delay(300);
    }
    if (!target) throw Error('Original Code workbench was not ready');
    page = await connect(target.webSocketDebuggerUrl, port);
    const heartbeats: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await page.call('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
      heartbeats.push(Math.round(performance.now() - start));
      await delay(500);
    }
    result.heartbeatMs = heartbeats;
    const frame = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(report, 'frame.png'), Buffer.from(frame.data, 'base64'));
    result.frameCaptured = true;
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    if (owned && browser) await browser.call('Browser.close').catch(() => undefined);
    page?.socket.close(); browser?.socket.close();
    await Promise.race([exited, delay(2000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await Promise.race([exited, delay(2000)]);
    clearTimeout(watchdog);
    result.childExited = child.exitCode !== null || child.signalCode !== null;
    const after = collectHealth(); compareHealth(after, before); result.after = after;
    if (after.newReports?.length || after.collectionErrors?.length || after.recoveryCountIncreases?.length || !result.childExited) process.exitCode = 1;
    fs.writeFileSync(path.join(report, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ report, features: (result.gpu as { featureStatus?: unknown } | undefined)?.featureStatus,
      heartbeatMs: result.heartbeatMs, frameCaptured: result.frameCaptured, failure: result.failure,
      childExited: result.childExited, newReports: after.newReports, recoveryCountIncreases: after.recoveryCountIncreases }, null, 2));
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
