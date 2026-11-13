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
    const pciText = execFileSync('/usr/sbin/ioreg', ['-r', '-c', 'IOPCIDevice', '-l', '-w0'],
      { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
    const nvidiaPCIVisible = /"vendor-id"\s*=\s*<de100000>/i.test(pciText);
    console.error(JSON.stringify({ nvidiaPCIVisible }));
    if (!nvidiaPCIVisible) {
      console.error('NVIDIA is absent from the PCI device listing. Check firmware GPU mode and ACPI power controls before reinstalling drivers.');
      console.error('On ASUS laptops, disable Eco/iGPU-only mode in Windows G-Helper or Armoury Crate, select Standard/Hybrid, then boot macOS and recheck.');
    } else if (states.some(item => item.loaded && item.installed !== item.loaded)) {
      console.error('Installed and loaded GPU driver versions differ. Restart before running Momota GPU tests.');
    } else {
      console.error('NVIDIA PCI hardware is visible, but required drivers are not loaded. Inspect driver matching and boot logs before running Momota GPU tests.');
    }
    process.exitCode = 2;
  } else console.log('GPU drivers ready: ' + states.map(item => `${item.driver} ${item.loaded}`).join(', '));
} catch (error) {
  console.error('GPU driver state check failed: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 3;
}
