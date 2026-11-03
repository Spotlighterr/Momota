const canvasElement = document.getElementById('canvas');
const resultElement = document.getElementById('result');
if (!(canvasElement instanceof HTMLCanvasElement) || !(resultElement instanceof HTMLElement)) {
  throw Error('GPU test elements are missing');
}
const canvas = canvasElement;
const resultOutput = resultElement;
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
window.gpuResult = { ok: false };

if (gl) {
  const extension = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const context = gl;
  const shader = (type: GLenum, source: string): WebGLShader => {
    const compiled = context.createShader(type);
    if (!compiled) throw Error('Unable to allocate a WebGL shader');
    context.shaderSource(compiled, source);
    context.compileShader(compiled);
    if (!context.getShaderParameter(compiled, context.COMPILE_STATUS)) {
      throw Error(context.getShaderInfoLog(compiled) || 'Shader compilation failed');
    }
    return compiled;
  };
  const program = gl.createProgram();
  if (!program) throw Error('Unable to allocate a WebGL program');
  const vertex = shader(gl.VERTEX_SHADER, 'attribute vec2 p; varying vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}');
  const fragment = shader(gl.FRAGMENT_SHADER, 'precision mediump float; varying vec2 uv; void main(){gl_FragColor=vec4(uv.x,uv.y,0.25,1.);}');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program) || 'Program linking failed');
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  if (!buffer) throw Error('Unable to allocate a WebGL buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, 'p');
  if (attribute < 0) throw Error('Position attribute is unavailable');
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
  const pixel = new Uint8Array(4);
  gl.readPixels(320, 160, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  const correct = Math.abs(pixel[0] - 128) < 3 && Math.abs(pixel[1] - 128) < 3 && Math.abs(pixel[2] - 64) < 2 && pixel[3] === 255;
  const error = gl.getError();
  window.gpuResult = { renderer, pixel: Array.from(pixel), pixelCorrect: correct, error,
    ok: correct && error === gl.NO_ERROR && /NVIDIA/i.test(renderer) };
}
resultOutput.textContent = JSON.stringify(window.gpuResult, null, 2);
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  window.gpuResult.ok = false;
  window.gpuResult.contextLost = true;
});

window.runGpuStress = async (duration: number): Promise<GPUStressResult> => {
  if (!Number.isInteger(duration) || duration < 1000 || duration > 60000) {
    return { ok: false, error: 'Stress duration must be 1000..60000 ms' };
  }
  const start = performance.now();
  let frames = 0, errors = 0, resizes = 0;
  const visibilityAtStart = document.visibilityState;
  if (!gl || !window.gpuResult.ok) return { ok: false, error: 'NVIDIA WebGL was not verified' };
  while (performance.now() - start < duration) {
    if (frames % 30 === 0) {
      canvas.width = frames % 60 === 0 ? 1280 : 640;
      canvas.height = frames % 60 === 0 ? 720 : 320;
      resizes++;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (gl.getError() !== gl.NO_ERROR || Math.abs(pixel[0] - 128) > 3 || Math.abs(pixel[1] - 128) > 3 ||
        Math.abs(pixel[2] - 64) > 2 || pixel[3] !== 255 || gl.isContextLost()) {
      errors++;
      break;
    }
    frames++;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  const elapsed = performance.now() - start;
  const result: GPUStressResult = { ok: errors === 0 && frames > 0 && window.gpuResult.ok,
    frames, resizes, errors, visibilityAtStart, visibilityAtEnd: document.visibilityState,
    elapsedMs: Math.round(elapsed), framesPerSecond: Math.round(frames * 1000 / elapsed) };
  resultOutput.textContent = JSON.stringify({ gpu: window.gpuResult, stress: result }, null, 2);
  return result;
};
