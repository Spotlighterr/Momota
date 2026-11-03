const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('browser',{
  navigate:value=>ipcRenderer.send('navigate',value),
  back:()=>ipcRenderer.send('back'),reload:()=>ipcRenderer.send('reload'),test:()=>ipcRenderer.send('gpu-test'),
  onLocation:callback=>ipcRenderer.on('location',(_,url)=>callback(url)),
  onGpuStatus:callback=>ipcRenderer.on('gpu-status',(_,result)=>callback(result))
});
