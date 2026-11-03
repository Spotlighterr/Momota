import * as fs from 'node:fs';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { connect, fetchJSON, CDPTarget } from '../inspect-code';
import { collectHealth, compareHealth } from './gpu-health';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--close-isolated', '--watch', '--click-accounts'].includes(arg))) throw Error('Usage: inspect-code-network [--watch] [--click-accounts] [--close-isolated]');
  const root = path.resolve(__dirname, '../../..');
  const run: { isolated: boolean; pid: number; report: string } = JSON.parse(fs.readFileSync(path.join(root, 'reports/code-network-test/last-run.json'), 'utf8'));
  if (!run.isolated && (args.includes('--close-isolated') || args.includes('--click-accounts'))) throw Error('Automatic actions require an isolated diagnostic profile');
  const port = 9344, endpoint = `http://127.0.0.1:${port}`;
  let meta: { webSocketDebuggerUrl: string } | undefined, targets: CDPTarget[] = [];
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      meta = await fetchJSON<{ webSocketDebuggerUrl: string }>(endpoint + '/json/version');
      targets = await fetchJSON<CDPTarget[]>(endpoint + '/json/list');
      if (targets.some(item => item.type === 'page' && item.url.startsWith('vscode-file:'))) break;
    } catch { /* The selected owned launch may still be starting. */ }
    await delay(500);
  }
  if (!meta) throw Error('Diagnostic VS Code endpoint did not become ready within 30 seconds');
  const browser = await connect(meta.webSocketDebuggerUrl, port);
  let page: Awaited<ReturnType<typeof connect>> | undefined;
  const before = collectHealth();
  const measurements: Record<string, unknown>[] = [];
  let profile: unknown;
  let profiling = false;
  let failure: string | undefined;
  let identityVerified = false;
  try {
    const processes = await browser.call<{ processInfo: { type: string; id: number }[] }>('SystemInfo.getProcessInfo');
    if (!processes.processInfo.some(item => item.type === 'browser' && item.id === run.pid)) throw Error('Debug endpoint does not belong to the selected diagnostic run');
    identityVerified = true;
    const target = targets.find(item => {
      try { return item.type === 'page' && item.url.startsWith('vscode-file:') && decodeURIComponent(new URL(item.url).pathname).startsWith('/Applications/Visual Studio Code.app/Contents/Resources/app/'); }
      catch { return false; }
    });
    if (!target) throw Error('Original VS Code workbench is not ready');
    page = await connect(target.webSocketDebuggerUrl, port);
    const frame = await page.call<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    for (const url of ['https://main.vscode-cdn.net/core/stable.json', 'https://main.vscode-cdn.net/extensions/marketplace.json',
      'https://main.vscode-cdn.net/extensions/chat.json', 'https://update.code.visualstudio.com/']) {
      const start = performance.now();
      const result = await page.call<{ resource: { success: boolean; httpStatusCode?: number; netErrorName?: string; stream?: string } }>('Network.loadNetworkResource', {
        frameId: frame.frameTree.frame.id, url, options: { disableCache: true, includeCredentials: false }
      });
      const resource = result.resource;
      measurements.push({ url, elapsedMs: Math.round(performance.now() - start), success: resource.success,
        status: resource.httpStatusCode, error: resource.netErrorName });
      if (resource.stream) await page.call('IO.close', { handle: resource.stream });
    }
    if (args.includes('--watch') || args.includes('--click-accounts')) {
      await page.call('Profiler.enable');
      await page.call('Profiler.start');
      profiling = true;
      if (args.includes('--click-accounts')) {
        if (!run.isolated) throw Error('Automatic Accounts-menu actions require an isolated test profile');
        const click = await page.call<{ result: { value?: { clicked: boolean; label?: string } } }>('Runtime.evaluate', {
          expression: `(()=>{const icon=[...document.querySelectorAll('.codicon-accounts-view-bar-icon')].find(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;});const button=icon?.closest('a,[role="button"]')||icon;if(!button)return {clicked:false};const label=button.getAttribute('aria-label');button.click();return {clicked:true,label};})()`, returnByValue: true
        });
        measurements.push({ accountsMenu: click.result.value });
        if (!click.result.value?.clicked) throw Error('Accounts control was not found; no UI action performed');
      }
      console.log('Recording original VS Code renderer responsiveness for 20 seconds.');
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        const heartbeat = await page.call<{ result: { value?: string } }>('Runtime.evaluate', { expression: 'document.visibilityState', returnByValue: true });
        measurements.push({ heartbeat: i, elapsedMs: Math.round(performance.now() - start), visibility: heartbeat.result.value });
        await delay(1000);
      }
      const result = await page.call<{ profile: unknown }>('Profiler.stop');
      profile = result.profile;
      profiling = false;
    }
    console.log(JSON.stringify({ measurements, report: run.report }, null, 2));
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (profiling && page) {
      const result = await page.call<{ profile: unknown }>('Profiler.stop').catch(() => undefined);
      if (result) profile = result.profile;
    }
    if (args.includes('--close-isolated') && run.isolated && identityVerified) {
      await browser.call('Browser.close').catch(() => undefined);
    }
    page?.socket.close(); browser.socket.close();
    const after = collectHealth(); compareHealth(after, before);
    fs.writeFileSync(path.join(run.report, 'network.json'), JSON.stringify({ measurements, failure, before, after }, null, 2) + '\n');
    if (profile) fs.writeFileSync(path.join(run.report, 'renderer.cpuprofile'), JSON.stringify(profile));
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
