import { app, BrowserWindow, WebContentsView, ipcMain } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
app.setName('RTX Browser');
app.setPath('userData', process.env.MOMOTA_PROFILE_DIR
  ? path.resolve(process.env.MOMOTA_PROFILE_DIR)
  : path.join(app.getPath('appData'), 'RTX Browser Test'));
const backend = process.env.MOMOTA_BACKEND || 'ganesh';
if (!['ganesh', 'graphite'].includes(backend)) throw Error('MOMOTA_BACKEND must be ganesh or graphite');
app.commandLine.appendSwitch('use-angle', 'metal');
app.commandLine.appendSwitch('force-high-performance-gpu');
if (backend === 'ganesh') app.commandLine.appendSwitch('disable-features', 'SkiaGraphite');
const reportDir = process.env.RTX_REPORT_DIR;
const smoke = process.env.RTX_SMOKE_EXIT === '1';
let window: BrowserWindow | null = null, page: WebContentsView | null = null;
let processFailures = 0;
interface BrowserReport {
  backend: string;
  backgroundThrottling: boolean;
  gpu: unknown;
  features: Electron.GPUFeatureStatus;
  renderer: GPUCheckResult;
  stress?: GPUStressResult;
  processFailures: number;
  frameCaptured: boolean;
  captureError?: string;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function isSandboxed(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('auxAttributes' in value)) return false;
  const attributes = value.auxAttributes;
  return typeof attributes === 'object' && attributes !== null &&
    'sandboxed' in attributes && attributes.sandboxed === true;
}
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
function timeout<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([promise, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Error(`${label} timed out`)), milliseconds);
  })]).finally(() => clearTimeout(timer));
}
function status(ok: boolean, message: string) {
  if (window && !window.isDestroyed()) window.webContents.send('gpu-status', { ok, message });
}
function recordEvent(event: { type: string; reason?: string; exitCode?: number; message?: string }) {
  if (reportDir) {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.appendFileSync(path.join(reportDir, 'events.jsonl'), JSON.stringify({ time: new Date().toISOString(), ...event }) + '\n');
  }
}
function navigate(value: string) {
  let url;
  try { url = new URL(value.includes('://') ? value : `https://${value}`); } catch { return; }
  if (!['https:', 'http:'].includes(url.protocol)) return;
  page?.webContents.loadURL(url.href).catch(() => status(false, 'Page failed to load'));
}
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
app.on('child-process-gone', (_, details) => {
  recordEvent({ type: details.type, reason: details.reason, exitCode: details.exitCode });
  if (details.type === 'GPU') status(false, 'GPU process restarted; run the GPU check again');
  if (details.type === 'GPU') processFailures++;
});
if (single) app.whenReady().then(async () => {
  window = new BrowserWindow({ width: 1100, height: 780, title: 'Momota RTX Browser — Experimental',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: !smoke } });
  // Automated diagnostic throughput must not depend on which app has focus.
  page = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: !smoke } });
  window.contentView.addChildView(page);
  const resize = () => {
    if (!window || !page) return;
    const [width, height] = window.getContentSize();
    page.setBounds({ x: 0, y: 66, width, height: Math.max(1, height - 66) });
  };
  window.on('resize', resize); resize();
  window.on('closed', () => {
    if (page && !page.webContents.isDestroyed()) page.webContents.close();
    page = null; window = null;
  });
  page.webContents.setWindowOpenHandler(({ url }) => { navigate(url); return { action: 'deny' }; });
  page.webContents.on('did-navigate', (_, url) => window?.webContents.send('location', url));
  page.webContents.on('did-navigate-in-page', (_, url) => window?.webContents.send('location', url));
  page.webContents.on('render-process-gone', (_, details) => {
    recordEvent({ type: 'renderer', reason: details.reason, exitCode: details.exitCode });
    processFailures++;
    status(false, 'Page renderer stopped; reload to continue');
  });
  ipcMain.on('navigate', (event, url: unknown) => { if (event.sender === window?.webContents && typeof url === 'string') navigate(url); });
  ipcMain.on('back', event => { if (event.sender === window?.webContents && page && page.webContents.navigationHistory.canGoBack()) page.webContents.navigationHistory.goBack(); });
  ipcMain.on('reload', event => { if (event.sender === window?.webContents) page?.webContents.reload(); });
  ipcMain.on('gpu-test', async event => {
    if (event.sender !== window?.webContents || !page) return;
    try { await page.webContents.loadFile(path.join(__dirname, 'gpu-test.html')); await check(); }
    catch (error) { status(false, errorMessage(error)); }
  });
  async function check(): Promise<boolean> {
    if (!page || page.webContents.isDestroyed()) throw Error('Test page is unavailable');
    const failuresBefore = processFailures;
    const report: BrowserReport = { backend, backgroundThrottling: !smoke, processFailures, frameCaptured: false,
      gpu: await timeout(app.getGPUInfo('complete'), 15000, 'GPU information'),
      features: app.getGPUFeatureStatus(), renderer: await timeout(page.webContents.executeJavaScript('window.gpuResult'), 5000, 'GPU check') };
    const duration = Number(process.env.MOMOTA_STRESS_MS || 0);
    if (duration) {
      if (!Number.isInteger(duration) || duration < 1000 || duration > 60000) throw Error('MOMOTA_STRESS_MS must be 1000..60000');
      report.stress = await timeout(page.webContents.executeJavaScript(`window.runGpuStress(${duration})`), duration + 15000, 'GPU stress');
    }
    // The first WebGL readback can finish before Chromium publishes a display
    // surface. Keep retries bounded and retain pixel evidence if capture fails.
    let image: Electron.NativeImage | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        image = await timeout(page.webContents.capturePage(undefined, { stayHidden: false, stayAwake: true }), 2500, 'Frame capture');
        if (image.isEmpty()) throw Error('Frame capture returned an empty image');
        report.frameCaptured = true;
        break;
      } catch (error) {
        report.captureError = errorMessage(error);
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    if (report.frameCaptured) delete report.captureError;
    report.processFailures = processFailures;
    const processesOK = smoke ? processFailures === 0 : processFailures === failuresBefore;
    const ok = processesOK && report.frameCaptured && report.renderer?.ok === true && isSandboxed(report.gpu) && (!duration || report.stress?.ok === true);
    status(ok, ok ? 'NVIDIA verified' : report.captureError ? 'Frame capture failed; inspect the GPU report' : 'GPU check failed');
    if (reportDir) {
      fs.mkdirSync(reportDir, { recursive: true });
      fs.writeFileSync(path.join(reportDir, 'browser-gpu.json'), JSON.stringify(report, null, 2));
      if (report.frameCaptured && image) fs.writeFileSync(path.join(reportDir, 'browser-frame.png'), image.toPNG());
      else fs.rmSync(path.join(reportDir, 'browser-frame.png'), { force: true });
    }
    console.log('[momota]', JSON.stringify({ ok, backend, renderer: report.renderer, stress: report.stress }));
    return ok;
  }
  await timeout(window.loadFile(path.join(__dirname, 'toolbar.html')), 10000, 'Toolbar');
  await timeout(page.webContents.loadFile(path.join(__dirname, 'gpu-test.html')), 15000, 'Test page');
  const ok = await check();
  if (smoke) setTimeout(() => app.exit(ok ? 0 : 1), 300);
}).catch(error => {
  recordEvent({ type: 'verification-error', message: errorMessage(error) });
  status(false, 'GPU verification failed; see the local report');
  console.error('[momota]', errorMessage(error));
  if (smoke) app.exit(1);
});
app.on('window-all-closed', () => app.quit());
