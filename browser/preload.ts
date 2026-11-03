import { contextBridge, ipcRenderer } from 'electron';

const bridge: BrowserBridge = {
  navigate: value => ipcRenderer.send('navigate', value),
  back: () => ipcRenderer.send('back'),
  reload: () => ipcRenderer.send('reload'),
  test: () => ipcRenderer.send('gpu-test'),
  onLocation: callback => {
    ipcRenderer.on('location', (_event, url: unknown) => {
      if (typeof url === 'string') callback(url);
    });
  },
  onGpuStatus: callback => {
    ipcRenderer.on('gpu-status', (_event, result: unknown) => {
      if (typeof result === 'object' && result !== null && 'ok' in result &&
          typeof result.ok === 'boolean' && 'message' in result && typeof result.message === 'string') {
        callback({ ok: result.ok, message: result.message });
      }
    });
  }
};
contextBridge.exposeInMainWorld('browser', bridge);
