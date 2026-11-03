import { readFileSync } from 'node:fs';
import { HealthSnapshot } from './gpu-health';

const health: HealthSnapshot = JSON.parse(readFileSync('reports/postboot/after.json', 'utf8'));
const browser = JSON.parse(readFileSync('reports/postboot/browser/browser-gpu.json', 'utf8'));
if (health.collectionErrors?.length) throw Error('GPU health collection failed; inspect reports/postboot/after.json');
if (health.newReports?.length) throw Error('New GPU/crash reports appeared; inspect reports/postboot/after.json');
if (health.recoveryCountIncreases?.length) throw Error('GPU recovery statistic increased; review reports/postboot/after.json');
if (!browser.renderer?.ok || !browser.stress?.ok || !browser.frameCaptured || browser.gpu?.auxAttributes?.sandboxed !== true || browser.processFailures !== 0) {
  throw Error('Browser GPU verification failed');
}
console.log('Post-boot GPU checks: PASS; no new GPU/crash reports or recovery-statistic increases observed during this run');
