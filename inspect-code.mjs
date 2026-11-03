import fs from 'node:fs';
const root = new URL('./',import.meta.url);
const port = 9339;
async function connect(url) {
  const socket=new WebSocket(url),pending=new Map();let id=0;
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id && pending.has(m.id)){const {resolve,reject,timer}=pending.get(m.id);clearTimeout(timer);pending.delete(m.id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);}});
  return {socket,call(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error(`Timeout: ${method}`));},30000);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}));});}};
}
const metadata=await fetch(`http://127.0.0.1:${port}/json/version`).then(r=>r.json());
const browser=await connect(metadata.webSocketDebuggerUrl);
const gpu=await browser.call('SystemInfo.getInfo');
const targets=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
const target=targets.find(t=>t.type==='page' && t.url.startsWith('vscode-file:')) || targets.find(t=>t.type==='page');
if(!target)throw Error('No Code workbench target');
const page=await connect(target.webSocketDebuggerUrl);
const {result}=await page.call('Runtime.evaluate',{expression:`(()=>{const c=document.createElement('canvas');const gl=c.getContext('webgl');if(!gl)return {ok:false};const ext=gl.getExtension('WEBGL_debug_renderer_info');const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);gl.clearColor(0.25,0.5,0.75,1);gl.clear(gl.COLOR_BUFFER_BIT);const p=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return {renderer,pixel:Array.from(p),error:gl.getError(),ok:/NVIDIA/.test(renderer)&&Math.abs(p[0]-64)<2&&Math.abs(p[1]-128)<2&&Math.abs(p[2]-191)<2&&p[3]===255};})()`,returnByValue:true});
const report={gpu,renderer:result.value};
fs.writeFileSync(new URL('reports/code/gpu.json',root),JSON.stringify(report,null,2));
const screenshot=await page.call('Page.captureScreenshot',{format:'png'});
fs.writeFileSync(new URL('reports/code/frame.png',root),Buffer.from(screenshot.data,'base64'));
console.log(JSON.stringify({renderer:report.renderer,devices:gpu.gpu.devices,features:gpu.gpu.featureStatus},null,2));
page.socket.close();
if(process.env.RTX_CLOSE_TEST==='1')await browser.call('Browser.close').catch(()=>{});
browser.socket.close();
if(!report.renderer?.ok)process.exitCode=1;
