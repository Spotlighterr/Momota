import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Query the installed AppleALC user client through its upstream alc-verb tool.
// Coefficient selection changes only the index latch, which is restored in finally.
// This collector never sends SET_PROC_COEF, pin, amp, EAPD or reset writes.
const root = path.resolve(__dirname, '../../..');
const tool = process.env.ALC_VERB ?? path.join(root, 'build/audio-tools/alc-verb');
const label = process.argv[2] ?? 'unclassified';
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Use an alphanumeric snapshot label.');
function verb(node: number, code: number, param: number): number {
  const output = execFileSync(tool, [node, code, param].map(n => `0x${n.toString(16)}`),
    { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] });
  const match = output.trim().match(/(?:^|\n)0x([0-9a-f]+)$/i);
  if (!match) throw new Error(`Unexpected alc-verb response: ${output}`);
  const value = Number.parseInt(match[1], 16);
  if (value === 0xffffffff) throw new Error(`Codec query failed: node ${node}, verb ${code}`);
  return value;
}
const vendor = verb(0, 0xf00, 0);
if (vendor !== 0x10ec0285) throw new Error(`Expected ALC285, found 0x${vendor.toString(16)}`);
const snapshot = {
  capturedAt: new Date().toISOString(), label, codec: '0x10ec0285',
  pins: [0x14, 0x17, 0x21].map(node => ({ node,
    control: verb(node, 0xf07, 0), eapd: verb(node, 0xf0c, 0),
    connection: verb(node, 0xf01, 0), connectionList: verb(node, 0xf02, 0),
    power: verb(node, 0xf05, 0) })),
  dacs: [0x02, 0x03, 0x06].map(node => ({ node,
    widgetCaps: verb(node, 0xf00, 9),
    outputAmpLeft: verb(node, 0xb00, 0xa000), outputAmpRight: verb(node, 0xb00, 0x8000),
    streamChannel: verb(node, 0xf06, 0), format: verb(node, 0xa00, 0) })),
  processingCaps: verb(0x20, 0xf00, 0x10), coefficients: [] as { index: number; value: number }[],
  originalIndex: verb(0x20, 0xd00, 0), restoredIndex: -1,
};
const count = (snapshot.processingCaps >>> 8) & 0xff;
if (!count) throw new Error('Codec reports no processing coefficients.');
try {
  for (let index = 0; index < count; index++) {
    verb(0x20, 0x500, index);
    if (verb(0x20, 0xd00, 0) !== index) throw new Error('Coefficient selection did not match.');
    snapshot.coefficients.push({ index, value: verb(0x20, 0xc00, 0) });
  }
} finally {
  verb(0x20, 0x500, snapshot.originalIndex);
  snapshot.restoredIndex = verb(0x20, 0xd00, 0);
  if (snapshot.restoredIndex !== snapshot.originalIndex) throw new Error('Failed to restore coefficient index.');
}
const output = path.join(root, 'reports/audio', `${label}-${Date.now()}.json`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(snapshot, null, 2) + '\n');
console.log(JSON.stringify({ output, coefficients: count, restoredIndex: snapshot.restoredIndex }));
