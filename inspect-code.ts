import * as fs from 'node:fs';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(__dirname, '../..');
const port = 9339;
export interface CDPTarget { type: string; url: string; webSocketDebuggerUrl: string; }
interface CDPMessage { id?: number; result?: unknown; error?: unknown; }
interface PendingCall {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}
interface CDPConnection {
  socket: WebSocket;
  call<T>(method: string, params?: Record<string, unknown>): Promise<T>;
}

export async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error(`CDP HTTP ${response.status}`);
  return await response.json() as T;
}

export async function connect(url: string, selectedPort = port): Promise<CDPConnection> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'ws:' || parsed.hostname !== '127.0.0.1' || parsed.port !== String(selectedPort)) {
    throw Error('CDP WebSocket must remain on the selected loopback endpoint');
  }
  const socket = new WebSocket(url);
  const pending = new Map<number, PendingCall>();
  let id = 0;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(Error('CDP connection timed out')); }, 10000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(Error('CDP connection failed')); }, { once: true });
  });
  const failPending = (): void => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(Error('CDP connection closed'));
    }
    pending.clear();
  };
  socket.addEventListener('close', failPending);
  socket.addEventListener('error', failPending);
  socket.addEventListener('message', event => {
    let message: CDPMessage;
    try { message = JSON.parse(String(event.data)) as CDPMessage; } catch { return; }
    if (message.id === undefined) return;
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error) item.reject(Error(JSON.stringify(message.error)));
    else item.resolve(message.result);
  });
  return {
    socket,
    call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const number = ++id;
        const timer = setTimeout(() => { pending.delete(number); reject(Error(`Timeout: ${method}`)); }, 30000);
        pending.set(number, { resolve: value => resolve(value as T), reject, timer });
        try { socket.send(JSON.stringify({ id: number, method, params })); }
        catch (error) {
          clearTimeout(timer);
          pending.delete(number);
          reject(error instanceof Error ? error : Error(String(error)));
        }
      });
    }
  };
}

async function main(): Promise<void> {
  const copyRoot = path.join(root, 'build', 'Code RTX.app') + path.sep;
  const deadline = Date.now() + 30000;
  let metadata: { webSocketDebuggerUrl: string } | undefined;
  let target: CDPTarget | undefined;
  while (Date.now() < deadline) {
    try {
      metadata = await fetchJSON<{ webSocketDebuggerUrl: string }>(`http://127.0.0.1:${port}/json/version`);
      const targets = await fetchJSON<CDPTarget[]>(`http://127.0.0.1:${port}/json/list`);
      target = targets.find(item => {
        if (item.type !== 'page' || !item.url.startsWith('vscode-file:')) return false;
        try { return decodeURIComponent(new URL(item.url).pathname).startsWith(copyRoot); } catch { return false; }
      });
      if (target) break;
    } catch { /* The selected diagnostic instance may still be starting. */ }
    await delay(250);
  }
  if (!metadata || !target) throw Error('No Momota Code RTX workbench became ready within 30 seconds; refusing to inspect another app');
  const browser = await connect(metadata.webSocketDebuggerUrl);
  let page: CDPConnection | undefined;
  try {
    const gpu = await browser.call<{ gpu: { devices: unknown[]; featureStatus: unknown } }>('SystemInfo.getInfo');
    page = await connect(target.webSocketDebuggerUrl);
    const evaluation = await page.call<{ result: { value?: GPUCheckResult }; exceptionDetails?: unknown }>('Runtime.evaluate', {
      expression: `(()=>{const c=document.createElement('canvas');const gl=c.getContext('webgl');if(!gl)return {ok:false};const ext=gl.getExtension('WEBGL_debug_renderer_info');const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);gl.clearColor(0.25,0.5,0.75,1);gl.clear(gl.COLOR_BUFFER_BIT);const p=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);const error=gl.getError();return {renderer,pixel:Array.from(p),error,ok:/NVIDIA/.test(renderer)&&error===gl.NO_ERROR&&Math.abs(p[0]-64)<2&&Math.abs(p[1]-128)<2&&Math.abs(p[2]-191)<2&&p[3]===255};})()`,
      returnByValue: true
    });
    if (evaluation.exceptionDetails) throw Error('GPU check raised a renderer exception');
    const report = { capturedAt: new Date().toISOString(), gpu, renderer: evaluation.result.value };
    const output = path.join(root, 'reports', 'code');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'gpu.json'), JSON.stringify(report, null, 2));
    const screenshot = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(output, 'frame.png'), Buffer.from(screenshot.data, 'base64'));
    console.log(JSON.stringify({ renderer: report.renderer, devices: gpu.gpu.devices, features: gpu.gpu.featureStatus }, null, 2));
    if (process.env.RTX_CLOSE_TEST === '1') await browser.call('Browser.close').catch(() => undefined);
    if (!report.renderer?.ok) process.exitCode = 1;
  } finally {
    page?.socket.close();
    browser.socket.close();
  }
}
if (require.main === module) main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
