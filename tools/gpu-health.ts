import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';

export interface Accelerator {
  name: string;
  registryID?: string;
  stats: Record<string, number>;
}
export interface Diagnostic {
  name: string;
  modified: number;
  application?: string | null;
  applicationPath?: string | null;
  gpu?: string | null;
  shaders?: string[];
  kind?: string;
  thread?: string;
  exceptionCode?: string;
}
export interface HealthSnapshot {
  capturedAt: string;
  accelerators: Accelerator[];
  reports: Diagnostic[];
  collectionErrors?: string[];
  newReports?: Diagnostic[];
  recoveryCountIncreases?: { name: string; registryID?: string; before: number; after: number }[];
}

/** Read only the exception and thread-name streams, not captured heap data. */
export function gpuDumpMetadata(data: Buffer): { thread: string; exceptionCode: string } | null {
  if (data.length < 32 || data.toString('ascii', 0, 4) !== 'MDMP') return null;
  const count = data.readUInt32LE(8), directory = data.readUInt32LE(12);
  if (count > 128 || directory + count * 12 > data.length) return null;
  const streams = new Map<number, { size: number; offset: number }>();
  for (let i = 0; i < count; i++) {
    const entry = directory + i * 12;
    const kind = data.readUInt32LE(entry), size = data.readUInt32LE(entry + 4), offset = data.readUInt32LE(entry + 8);
    if (offset + size > data.length) return null;
    streams.set(kind, { size, offset });
  }
  const exception = streams.get(6), names = streams.get(24);
  if (!exception || exception.size < 12 || !names || names.size < 4) return null;
  const threadID = data.readUInt32LE(exception.offset), code = data.readUInt32LE(exception.offset + 8);
  const nameCount = data.readUInt32LE(names.offset);
  if (nameCount > Math.min(4096, Math.floor((names.size - 4) / 12))) return null;
  for (let i = 0; i < nameCount; i++) {
    const entry = names.offset + 4 + i * 12;
    if (data.readUInt32LE(entry) !== threadID) continue;
    const address64 = data.readBigUInt64LE(entry + 4);
    if (address64 > BigInt(data.length - 4)) return null;
    const address = Number(address64), length = data.readUInt32LE(address);
    if (length > 1024 || length % 2 || address + 4 + length > data.length) return null;
    const thread = data.toString('utf16le', address + 4, address + 4 + length);
    // Viz owns Chromium compositing; its diagnostic dumps need the same review
    // as CrGpuMain/GpuWatchdog even though its name contains no "Gpu".
    return thread.includes('Gpu') || thread === 'VizCompositorThread'
      ? { thread, exceptionCode: `0x${code.toString(16)}` } : null;
  }
  return null;
}

export function compareHealth(current: HealthSnapshot, previous: HealthSnapshot): void {
  const cutoff = Date.parse(previous.capturedAt) / 1000;
  if (!Number.isFinite(cutoff)) throw Error('Invalid baseline timestamp');
  const known = new Set(previous.reports.map(item => item.name));
  current.newReports = current.reports.filter(item => !known.has(item.name) && item.modified >= cutoff);
  current.recoveryCountIncreases = [];
  for (const device of current.accelerators) {
    const before = previous.accelerators.filter(item => device.registryID && item.registryID
      ? device.registryID === item.registryID : device.name === item.name);
    const oldValues = before.map(item => item.stats.recoveryCount).filter((value): value is number => Number.isFinite(value));
    const value = device.stats.recoveryCount;
    if (oldValues.length && Number.isFinite(value) && value > Math.max(...oldValues)) {
      current.recoveryCountIncreases.push({ name: device.name, registryID: device.registryID, before: Math.max(...oldValues), after: value });
    }
  }
}

function files(root: string, recursive = false): string[] {
  try {
    return fs.readdirSync(root, { withFileTypes: true }).flatMap(item => {
      const file = path.join(root, item.name);
      return item.isFile() ? [file] : recursive && item.isDirectory() ? files(file, true) : [];
    });
  } catch { return []; }
}

export function collectHealth(): HealthSnapshot {
  const root = path.resolve(__dirname, '../../..');
  const result: HealthSnapshot = { capturedAt: new Date().toISOString(), accelerators: [], reports: [], collectionErrors: [] };
  try {
    result.accelerators = JSON.parse(execFileSync(path.join(root, 'build/gpu-stats'), [], { encoding: 'utf8', timeout: 15000 }));
    if (!result.accelerators.length) result.collectionErrors!.push('No accelerators were enumerated');
  } catch (error) {
    result.collectionErrors!.push(`Native GPU statistics unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  for (const dir of ['/Library/Logs/DiagnosticReports', path.join(os.homedir(), 'Library/Logs/DiagnosticReports')]) {
    for (const file of files(dir)) {
      const name = path.basename(file), reset = name.endsWith('.gpuRestart');
      if (!reset && !(name.endsWith('.ips') && /WindowServer|mediaanalysisd|Code-|Code Helper|rtx-probe/.test(name))) continue;
      try {
        const item: Diagnostic = { name, modified: fs.statSync(file).mtimeMs / 1000 };
        if (reset) {
          const text = fs.readFileSync(file, 'utf8');
          item.application = text.match(/^Application:\s*(.*)/m)?.[1] ?? null;
          item.applicationPath = text.match(/^Path:\s*(.*)/m)?.[1] ?? null;
          item.gpu = text.match(/^Graphics Hardware:\s*(.*)/m)?.[1] ?? null;
          item.shaders = [...new Set([...text.matchAll(/Hash:.*?\[(.*?)\]/g)].map(match => match[1]))].sort();
        }
        result.reports.push(item);
      } catch { /* Reports can rotate during collection. */ }
    }
  }
  const crashpads = [
    { dir: path.join(os.homedir(), 'Library/Application Support/Code/Crashpad'), application: 'Code' },
    { dir: path.join(root, 'code-profile/Crashpad'), application: 'Code RTX' }
  ];
  for (const location of crashpads) {
    for (const file of files(location.dir, true).filter(file => file.endsWith('.dmp'))) {
      try {
        const stat = fs.statSync(file);
        if (stat.size > 32 * 1024 * 1024) continue;
        const metadata = gpuDumpMetadata(fs.readFileSync(file));
        if (metadata) result.reports.push({ name: path.basename(file), modified: stat.mtimeMs / 1000,
          application: location.application, kind: 'chromium-gpu-diagnostic-dump', ...metadata });
      } catch { /* Crashpad may be publishing or rotating this file. */ }
    }
  }
  result.reports.sort((a, b) => b.modified - a.modified);
  return result;
}

if (require.main === module) {
  try {
    let output = 'reports/health/current.json', compare: string | undefined;
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--help') { console.log('Usage: gpu-health [--output FILE] [--compare BASELINE]'); process.exit(0); }
      const value = args[++i];
      if (!value || value.startsWith('--')) throw Error(`Missing value for ${arg}`);
      if (arg === '--output') output = value;
      else if (arg === '--compare') compare = value;
      else throw Error(`Unknown argument: ${arg}`);
    }
    const result = collectHealth();
    if (compare) compareHealth(result, JSON.parse(fs.readFileSync(compare, 'utf8')));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ accelerators: result.accelerators, newReports: result.newReports ?? [],
      recoveryCountIncreases: result.recoveryCountIncreases ?? [], collectionErrors: result.collectionErrors, output }, null, 2));
    if (result.collectionErrors?.length) process.exitCode = 2;
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
