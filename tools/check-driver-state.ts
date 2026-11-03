import { execFileSync } from 'node:child_process';

try {
  const loadedText = execFileSync('/usr/bin/kmutil', ['showloaded'], { encoding: 'utf8', timeout: 15000 });
  const states = ['NVRM', 'NVAccel', 'NVRMFB', 'NVRMAGDC'].map(driver => {
    const path = `/Library/Extensions/${driver}.kext/Contents/Info.plist`;
    const installed = execFileSync('/usr/bin/plutil', ['-extract', 'CFBundleVersion', 'raw', '-o', '-', path],
      { encoding: 'utf8', timeout: 15000 }).trim();
    const match = loadedText.match(new RegExp(`com\\.nullmoth\\.${driver}\\s+\\(([^)]+)\\)`));
    return { driver, installed, loaded: match?.[1] ?? null };
  });
  if (states.some(item => !item.installed || !item.loaded || item.installed !== item.loaded)) {
    console.error(JSON.stringify(states, null, 2));
    console.error('GPU driver update pending or driver unavailable. Restart the Mac before running Momota GPU tests.');
    process.exitCode = 2;
  } else console.log('GPU drivers ready: ' + states.map(item => `${item.driver} ${item.loaded}`).join(', '));
} catch (error) {
  console.error('GPU driver state check failed: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 3;
}
