const { app, BrowserWindow, WebContentsView, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
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
let window, page;
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
function timeout(promise, milliseconds, label) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error(`${label} timed out`)), milliseconds);
  })]).finally(() => clearTimeout(timer));
}
function status(ok, message) {
  if (window && !window.isDestroyed()) window.webContents.send('gpu-status', { ok, message });
}
function recordEvent(event) {
  if (reportDir) {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.appendFileSync(path.join(reportDir, 'events.jsonl'), JSON.stringify({ time: new Date().toISOString(), ...event }) + '\n');
  }
}
function navigate(value) {
  let url;
  try { url = new URL(value.includes('://') ? value : `https://${value}`); } catch { return; }
  if (!['https:', 'http:'].includes(url.protocol)) return;
  page.webContents.loadURL(url.href).catch(() => status(false, 'Page failed to load'));
}
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
app.on('child-process-gone', (_, details) => {
  recordEvent({ type: details.type, reason: details.reason, exitCode: details.exitCode });
  if (details.type === 'GPU') status(false, 'GPU process restarted; run the GPU check again');
});
if (single) app.whenReady().then(async () => {
  window = new BrowserWindow({ width: 1100, height: 780, title: 'Momota RTX Browser — Experimental',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
  page = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  window.contentView.addChildView(page);
  const resize = () => {
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
    status(false, 'Page renderer stopped; reload to continue');
  });
  ipcMain.on('navigate', (event, url) => { if (event.sender === window?.webContents && typeof url === 'string') navigate(url); });
  ipcMain.on('back', event => { if (event.sender === window?.webContents && page.webContents.navigationHistory.canGoBack()) page.webContents.navigationHistory.goBack(); });
  ipcMain.on('reload', event => { if (event.sender === window?.webContents) page.webContents.reload(); });
  ipcMain.on('gpu-test', async event => {
    if (event.sender !== window?.webContents) return;
    try { await page.webContents.loadFile(path.join(__dirname, 'gpu-test.html')); await check(); }
    catch (error) { status(false, error.message); }
  });
  async function check() {
    const report = { backend, gpu: await timeout(app.getGPUInfo('complete'), 15000, 'GPU information'),
      features: app.getGPUFeatureStatus(), renderer: await timeout(page.webContents.executeJavaScript('window.gpuResult'), 5000, 'GPU check') };
    const duration = Number(process.env.MOMOTA_STRESS_MS || 0);
    if (duration) {
      if (!Number.isInteger(duration) || duration < 1000 || duration > 60000) throw Error('MOMOTA_STRESS_MS must be 1000..60000');
      report.stress = await timeout(page.webContents.executeJavaScript(`window.runGpuStress(${duration})`), duration + 15000, 'GPU stress');
    }
    const image = await timeout(page.webContents.capturePage(), 10000, 'Frame capture');
    const ok = report.renderer?.ok && report.gpu.auxAttributes?.sandboxed === true && (!duration || report.stress?.ok);
    status(ok, ok ? 'NVIDIA verified' : 'GPU check failed');
    if (reportDir) {
      fs.mkdirSync(reportDir, { recursive: true });
      fs.writeFileSync(path.join(reportDir, 'browser-gpu.json'), JSON.stringify(report, null, 2));
      fs.writeFileSync(path.join(reportDir, 'browser-frame.png'), image.toPNG());
    }
    console.log('[momota]', JSON.stringify({ ok, backend, renderer: report.renderer, stress: report.stress }));
    return ok;
  }
  await timeout(window.loadFile(path.join(__dirname, 'toolbar.html')), 10000, 'Toolbar');
  await timeout(page.webContents.loadFile(path.join(__dirname, 'gpu-test.html')), 15000, 'Test page');
  const ok = await check();
  if (smoke) setTimeout(() => app.exit(ok ? 0 : 1), 300);
}).catch(error => {
  recordEvent({ type: 'verification-error', message: error.message });
  status(false, 'GPU verification failed; see the local report');
  console.error('[momota]', error.message);
  if (smoke) app.exit(1);
});
app.on('window-all-closed', () => app.quit());
