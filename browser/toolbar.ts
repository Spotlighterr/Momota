const navForm = document.getElementById('nav');
const urlInput = document.getElementById('url');
const backButton = document.getElementById('back');
const reloadButton = document.getElementById('reload');
const testButton = document.getElementById('test');
const gpuLabel = document.getElementById('gpu-status');

if (!(navForm instanceof HTMLFormElement) || !(urlInput instanceof HTMLInputElement) ||
    !(backButton instanceof HTMLButtonElement) || !(reloadButton instanceof HTMLButtonElement) ||
    !(testButton instanceof HTMLButtonElement) || !(gpuLabel instanceof HTMLElement)) {
  throw Error('Toolbar elements are missing');
}
const addressInput = urlInput;
const statusLabel = gpuLabel;
navForm.onsubmit = event => {
  event.preventDefault();
  window.browser.navigate(addressInput.value);
};
backButton.onclick = () => window.browser.back();
reloadButton.onclick = () => window.browser.reload();
testButton.onclick = () => window.browser.test();
window.browser.onLocation(url => { addressInput.value = url; });
window.browser.onGpuStatus(result => {
  statusLabel.textContent = result.message;
  statusLabel.style.color = result.ok ? '#a3e87d' : '#ffc16a';
});
