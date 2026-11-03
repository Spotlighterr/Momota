const { app, BrowserWindow, WebContentsView, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
app.setName('RTX Browser');
app.setPath('userData', path.join(app.getPath('appData'), 'RTX Browser Test'));
app.commandLine.appendSwitch('use-angle', 'metal');
app.commandLine.appendSwitch('force-high-performance-gpu');
// NVMTL itself enables ANGLE's NVIDIA Metal path. Keep the Chromium sandbox.
let window, page;
function navigate(value) {
  let url;
  try { url = new URL(value.includes('://') ? value : `https://${value}`); }
  catch { return; }
  if (!['https:', 'http:'].includes(url.protocol)) return;
  page.webContents.loadURL(url.href).catch(() => {});
}
app.whenReady().then(async () => {
  window = new BrowserWindow({width:1100,height:780,title:'Momota RTX Browser — Experimental',
    webPreferences:{preload:path.join(__dirname,'preload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  page = new WebContentsView({webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  window.contentView.addChildView(page);
  const resize = () => { const [width,height]=window.getContentSize();page.setBounds({x:0,y:66,width,height:Math.max(1,height-66)}); };
  window.on('resize',resize);resize();
  page.webContents.setWindowOpenHandler(({url}) => {navigate(url);return {action:'deny'};});
  page.webContents.on('did-navigate',(_,url)=>window.webContents.send('location',url));
  page.webContents.on('did-navigate-in-page',(_,url)=>window.webContents.send('location',url));
  ipcMain.on('navigate',(event,url)=>{if(event.sender===window.webContents && typeof url==='string')navigate(url);});
  ipcMain.on('back',event=>{if(event.sender===window.webContents && page.webContents.navigationHistory.canGoBack())page.webContents.navigationHistory.goBack();});
  ipcMain.on('reload',event=>{if(event.sender===window.webContents)page.webContents.reload();});
  ipcMain.on('gpu-test',event=>{if(event.sender===window.webContents)page.webContents.loadFile(path.join(__dirname,'gpu-test.html'));});
  await window.loadFile(path.join(__dirname,'toolbar.html'));
  await page.webContents.loadFile(path.join(__dirname,'gpu-test.html'));
  const report = {gpu:await app.getGPUInfo('complete'),features:app.getGPUFeatureStatus(),
    renderer:await page.webContents.executeJavaScript('window.gpuResult')};
  // Capture the composited result to check that NVIDIA output reaches the AMD display path.
  const image=await page.webContents.capturePage();
  const reportDir=process.env.RTX_REPORT_DIR;
  if(reportDir){fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'browser-gpu.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(reportDir,'browser-frame.png'),image.toPNG());}
  console.log('[rtx-browser]',JSON.stringify({renderer:report.renderer,sandboxed:report.gpu.auxAttributes?.sandboxed}));
  if(process.env.RTX_SMOKE_EXIT==='1')setTimeout(()=>app.quit(),1500);
});
app.on('window-all-closed',()=>app.quit());
