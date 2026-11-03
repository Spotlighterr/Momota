interface GPUCheckResult {
  ok: boolean;
  renderer?: string;
  pixel?: number[];
  pixelCorrect?: boolean;
  error?: number;
  contextLost?: boolean;
}

interface GPUStressResult {
  ok: boolean;
  error?: string;
  frames?: number;
  resizes?: number;
  errors?: number;
  visibilityAtStart?: DocumentVisibilityState;
  visibilityAtEnd?: DocumentVisibilityState;
  elapsedMs?: number;
  framesPerSecond?: number;
}

interface GPUStatus {
  ok: boolean;
  message: string;
}

interface BrowserBridge {
  navigate(value: string): void;
  back(): void;
  reload(): void;
  test(): void;
  onLocation(callback: (url: string) => void): void;
  onGpuStatus(callback: (result: GPUStatus) => void): void;
}

interface Window {
  gpuResult: GPUCheckResult;
  runGpuStress(duration: number): Promise<GPUStressResult>;
  browser: BrowserBridge;
}
