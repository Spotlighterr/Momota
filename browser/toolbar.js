document.getElementById('nav').onsubmit=e=>{e.preventDefault();window.browser.navigate(document.getElementById('url').value);};
document.getElementById('back').onclick=()=>window.browser.back();
document.getElementById('reload').onclick=()=>window.browser.reload();
document.getElementById('test').onclick=()=>window.browser.test();
window.browser.onLocation(url=>{document.getElementById('url').value=url;});
