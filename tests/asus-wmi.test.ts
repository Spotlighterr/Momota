import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(__dirname, '../../..');
const compiler = process.env.IASL ?? path.join(root, 'build/acpi-tools/iasl');
const interpreter = process.env.ACPIEXEC ?? path.join(root, 'build/acpi-tools/acpica-src/generate/unix/bin/acpiexec');
const out = path.join(root, 'build/acpi/tests');
const reports = path.join(root, 'reports/asus-dgpu/tests');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(reports, { recursive: true });
const template = fs.readFileSync(path.join(root, 'tests/asus-wmi-fixture.dsl'), 'utf8');
const cases = [
  { name: 'audit-eco', write: false, response: 0x10001, count: 0 },
  { name: 'enable-eco', write: true, response: 0x10001, count: 1 },
  { name: 'already-standard', write: true, response: 0x10000, count: 0 },
  { name: 'unsupported', write: true, response: 0xfffffffe, count: 0 },
  { name: 'absent', write: true, response: 0, count: 0 },
  { name: 'unknown-status', write: true, response: 0x10003, count: 0 },
  { name: 'windows', write: true, response: 0x10001, count: 0, windows: true },
  { name: 'missing-provider', write: true, response: 0x10001, count: 0, missing: true },
  { name: 'firmware-refuses', write: true, response: 0x10001, count: 1, result: 0 },
  { name: 'firmware-false-success', write: true, response: 0x10001, count: 1, stuck: true },
];
for (const item of cases) {
  let source = template.replace('#define ECO_RESPONSE 0x00010001', `#define ECO_RESPONSE ${item.response}`)
    .replace('#define WRITE_RESULT 1', `#define WRITE_RESULT ${item.result ?? 1}`)
    .replace('#define STUCK_ECO 0', `#define STUCK_ECO ${item.stuck ? 1 : 0}`);
  if (item.missing) source = source.replace('Device (ATKD)', 'Device (ATKX)');
  const prefix = path.join(out, item.name);
  fs.writeFileSync(`${prefix}.dsl`, source);
  execFileSync(compiler, ['-we', '-p', prefix, `${prefix}.dsl`], { timeout: 15000, stdio: 'pipe' });
  const fields = ['WRIT', 'READ', 'BADS', '\\_SB.MRTG.BEFR', '\\_SB.MRTG.AFTR', '\\_SB.MRTG.RSLT', '\\_SB.MRTG.STEP'];
  const commands = [item.windows ? 'osi' : 'osi install Darwin',
    'execute \\_SB.MRTG._INI', 'execute \\_SB.MRTG._INI', ...fields.map(f => `evaluate ${f}`)].join(';');
  const log = execFileSync(interpreter, ['-di', '-b', commands, `${prefix}.aml`,
    path.join(root, `build/acpi/SSDT-Momota-DGPU-${item.write ? 'Enable' : 'Audit'}.aml`)],
  { encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
  fs.writeFileSync(path.join(reports, `${item.name}.txt`), log);
  assert(!/AE_AML_|AE_NOT_FOUND|failed with status/i.test(log), `${item.name}: interpreter failure`);
  const value = (field: string): number => {
    const index = log.indexOf(`Evaluating ${field.startsWith('\\') ? field : `\\${field}`}\n`);
    assert(index >= 0, `${item.name}: missing ${field}`);
    const match = log.slice(index).match(/\[Integer\] = ([0-9A-F]+)/);
    assert(match, `${item.name}: missing integer for ${field}`);
    return Number.parseInt(match[1], 16);
  };
  assert.equal(value('WRIT'), item.count, `${item.name}: write count (including repeated initialization)`);
  assert.equal(value('BADS'), 0, `${item.name}: 20-byte ABI and zero control`);
  const skipped = item.windows || item.missing;
  assert.equal(value('READ'), skipped ? 0 : item.count ? 2 : 1, `${item.name}: read count`);
  const after = skipped ? 0xffffffff : item.count && !item.stuck && item.result !== 0 ? 0x10000 : item.response;
  assert.equal(value('\\_SB.MRTG.AFTR'), after, `${item.name}: retain actual firmware response`);
  assert.equal(value('\\_SB.MRTG.RSLT'), item.count ? item.result ?? 1 : 0xffffffff);
  console.log(`PASS ${item.name}`);
}
console.log(`${cases.length} ACPICA interpreter scenarios passed; no hardware methods executed.`);
