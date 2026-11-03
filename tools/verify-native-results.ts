import { readFileSync } from 'node:fs';

const scenarios = ['baseline', 'forced', 'disabled', 'missing-target', 'invalid-invalid', 'invalid-0',
  'invalid--1', 'invalid-18446744073709551616', 'invalid-empty'];
for (const name of scenarios) {
  const text = readFileSync(`reports/native/${name}.txt`, 'utf8');
  const expected = name === 'forced' ? 'NVIDIA' : 'AMD';
  const entries = text.split('\n').filter(line => line.startsWith('enumerated='));
  if (!text.split('\n')[0].includes(expected)) throw Error(`Incorrect default for ${name}`);
  if (entries.length !== (name === 'forced' ? 1 : 2)) throw Error(`Wrong enumeration for ${name}`);
  if (!text.includes('compute=PASS 256/256') || !text.includes('render-readback=PASS 4096/4096') ||
    !text.includes('observer-enumeration=PASS')) throw Error(`Wrong compute/render/observer output for ${name}`);
  console.log(`${name}: PASS default=${expected}; compute 256/256; pixels 4096/4096`);
}
