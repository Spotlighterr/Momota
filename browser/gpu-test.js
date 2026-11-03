const canvas=document.getElementById('canvas');
const gl=canvas.getContext('webgl',{preserveDrawingBuffer:true});
window.gpuResult={ok:false};
if(gl){
  const extension=gl.getExtension('WEBGL_debug_renderer_info');
  const renderer=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p; varying vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec2 uv; void main(){gl_FragColor=vec4(uv.x,uv.y,0.25,1.);}'));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const attribute=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  gl.viewport(0,0,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();
  const pixel=new Uint8Array(4);gl.readPixels(320,160,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
  const correct=Math.abs(pixel[0]-128)<3 && Math.abs(pixel[1]-128)<3 && Math.abs(pixel[2]-64)<2 && pixel[3]===255;
  window.gpuResult={renderer,pixel:Array.from(pixel),pixelCorrect:correct,error:gl.getError(),ok:correct&&/NVIDIA/i.test(renderer)};
}
document.getElementById('result').textContent=JSON.stringify(window.gpuResult,null,2);
