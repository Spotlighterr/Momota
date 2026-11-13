import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { gpuDumpMetadata, gpuResetMetadata, compareHealth, HealthSnapshot } from '../tools/gpu-health';

test('empty reset attribution does not consume the next report field', () => {
  const metadata = gpuResetMetadata('Application:         \nPath:                \nTailspin: /private/report.tailspin\nGraphics Hardware: AMD Renoir\n');
  assert.equal(metadata.application, null);
  assert.equal(metadata.applicationPath, null);
  assert.equal(metadata.gpu, 'AMD Renoir');
});

test('reset attribution retains the exact application path and distinct shaders', () => {
  assert.deepEqual(gpuResetMetadata('Application:\tCode Helper\r\nPath: /Applications/Visual Studio Code.app/Code Helper  \r\nGraphics Hardware: AMD Renoir\r\nHash: a [main0]\nHash: b [test]\nHash: c [main0]\n'), {
    application: 'Code Helper', applicationPath: '/Applications/Visual Studio Code.app/Code Helper',
    gpu: 'AMD Renoir', shaders: ['main0', 'test']
  });
});

test('truncated and malicious Crashpad stream offsets do not escape bounds', () => {
  for (const size of [0, 4, 31, 32, 64]) assert.equal(gpuDumpMetadata(Buffer.alloc(size)), null);
  const data = Buffer.alloc(64);
  data.write('MDMP'); data.writeUInt32LE(128, 8); data.writeUInt32LE(0xfffffff0, 12);
  assert.equal(gpuDumpMetadata(data), null);
});

test('GPU metadata decoding excludes ordinary reporting threads', () => {
  const data = Buffer.alloc(200);
  data.write('MDMP'); data.writeUInt32LE(2, 8); data.writeUInt32LE(32, 12);
  data.writeUInt32LE(6, 32); data.writeUInt32LE(12, 36); data.writeUInt32LE(64, 40);
  data.writeUInt32LE(24, 44); data.writeUInt32LE(16, 48); data.writeUInt32LE(80, 52);
  data.writeUInt32LE(42, 64); data.writeUInt32LE(0x43507378, 72);
  data.writeUInt32LE(1, 80); data.writeUInt32LE(42, 84); data.writeBigUInt64LE(100n, 88);
  const name = Buffer.from('GpuWatchdog', 'utf16le');
  data.writeUInt32LE(name.length, 100); name.copy(data, 104);
  assert.deepEqual(gpuDumpMetadata(data), { thread: 'GpuWatchdog', exceptionCode: '0x43507378' });
  const compositor = Buffer.from('VizCompositorThread', 'utf16le');
  data.writeUInt32LE(compositor.length, 100); compositor.copy(data, 104);
  assert.deepEqual(gpuDumpMetadata(data), { thread: 'VizCompositorThread', exceptionCode: '0x43507378' });
  data.writeBigUInt64LE(0xffffffffffffffffn, 88);
  assert.equal(gpuDumpMetadata(data), null);
  data.writeBigUInt64LE(100n, 88);
  const main = Buffer.from('MainThread', 'utf16le');
  data.writeUInt32LE(main.length, 100); main.copy(data, 104);
  assert.equal(gpuDumpMetadata(data), null);
});

test('health comparison identifies accelerators by registry ID and ignores old dumps', () => {
  const before: HealthSnapshot = { capturedAt: '2026-11-04T00:00:00Z', reports: [], accelerators: [
    { name: 'AMD', registryID: '1', stats: { recoveryCount: 0 } },
    { name: 'AMD', registryID: '2', stats: { recoveryCount: 20 } }
  ] };
  const after: HealthSnapshot = { capturedAt: '2026-11-04T00:01:00Z', reports: [
    { name: 'old.dmp', modified: 1 }, { name: 'new.dmp', modified: Date.parse(before.capturedAt) / 1000 + 1 }
  ], accelerators: [{ name: 'AMD', registryID: '1', stats: { recoveryCount: 1 } }] };
  compareHealth(after, before);
  assert.equal(after.newReports?.length, 1);
  assert.deepEqual(after.recoveryCountIncreases, [{ name: 'AMD', registryID: '1', before: 0, after: 1 }]);
});
