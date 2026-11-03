import * as path from 'node:path';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// Replace the legacy JXA/objc_msgSend probe with the compiled Metal probe.
const root = path.resolve(__dirname, '../../..');
const guard = spawnSync(process.execPath, [path.join(__dirname, 'check-driver-state.js')], { stdio: 'inherit', timeout: 60000 });
if (guard.error || guard.status !== 0) process.exit(guard.status ?? 1);
const output = path.join(root, 'reports/gpu-probe');
fs.mkdirSync(output, { recursive: true });
for (const gpu of ['AMD', 'NVIDIA']) {
  const environment = { ...process.env };
  delete environment.DYLD_INSERT_LIBRARIES;
  delete environment.RTX_REGISTRY_ID;
  delete environment.RTX_FORCE;
  if (gpu === 'NVIDIA') {
    environment.RTX_FORCE = '1';
    environment.DYLD_INSERT_LIBRARIES = path.join(root, 'build/rtx_select.dylib');
  }
  const result = spawnSync(path.join(root, 'build/rtx-probe'), [], { env: environment, encoding: 'utf8', timeout: 45000 });
  fs.writeFileSync(path.join(output, `${gpu}.txt`), result.stdout ?? '');
  fs.writeFileSync(path.join(output, `${gpu}.log`), result.stderr ?? '');
  if (result.error || result.status !== 0 || !result.stdout?.split('\n')[0].includes(gpu)) {
    console.error(`${gpu} probe failed; inspect ${output}`);
    process.exit(1);
  }
  console.log(`${gpu}: compute and render probe passed`);
}
