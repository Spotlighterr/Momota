import { readFileSync, writeFileSync } from 'node:fs';
import { HealthSnapshot } from './gpu-health';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--nvidia-only')) throw Error('Usage: verify-postboot-results [--nvidia-only]');

const health: HealthSnapshot = JSON.parse(readFileSync('reports/postboot/after.json', 'utf8'));
const browser = JSON.parse(readFileSync('reports/postboot/browser/browser-gpu.json', 'utf8'));
if (health.collectionErrors?.length) throw Error('GPU health collection failed; inspect reports/postboot/after.json');
if (health.newReports?.length) throw Error('New GPU/crash reports appeared; inspect reports/postboot/after.json');
if (health.recoveryCountIncreases?.length) throw Error('GPU recovery statistic increased; review reports/postboot/after.json');
if (!browser.renderer?.ok || !browser.stress?.ok || !browser.frameCaptured || browser.gpu?.auxAttributes?.sandboxed !== true || browser.processFailures !== 0) {
  throw Error('Browser GPU verification failed');
}
writeFileSync('reports/postboot/verification.json', JSON.stringify({
  capturedAt: health.capturedAt, scope: args[0] === '--nvidia-only' ? 'nvidia-only' : 'full',
  amdFallbackTested: args[0] !== '--nvidia-only', passed: true,
  renderer: browser.renderer, stress: browser.stress, sandboxed: true,
  frameCaptured: true, processFailures: browser.processFailures
}, null, 2) + '\n');
console.log(`${args[0] === '--nvidia-only' ? 'NVIDIA-only post-boot checks (AMD fallback not tested)' : 'Post-boot GPU checks'}: PASS; no new GPU/crash reports or recovery-statistic increases observed during this run`);
