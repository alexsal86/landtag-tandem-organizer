import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { decodeLosslessAreaTopology } from '../../src/utils/losslessAreaTopology.ts';

const [source, target] = process.argv.slice(2);
if (!source || !target) throw new Error('Usage: node scripts/geometry/pack-local-result-areas.mjs <source-dir> <target-dir>');
const municipalities = 'public/data/municipalities-2026';
const exactValue = -2147483648;

function separateBytes(values, width) {
  const packed = Buffer.alloc(values.length * width);
  const separated = Buffer.alloc(packed.length);
  values.forEach((value, index) => {
    if (width === 4) packed.writeInt32LE(value, index * width);
    else packed.writeDoubleLE(value, index * width);
  });
  for (let byte = 0; byte < width; byte++) {
    for (let index = 0; index < values.length; index++) {
      separated[byte * values.length + index] = packed[index * width + byte];
    }
  }
  return separated;
}

function pack(topology, transform) {
  const { arcs, ...properties } = topology;
  if (properties.transform) throw new Error('Expected absolute coordinates');
  const points = arcs.flat();
  const columns = [];
  const coordinateEncoding = [0, 1].map(axis => {
    const grid = transform && { scale: transform.scale[axis], translate: transform.translate[axis] };
    const codes = [];
    const exact = [];
    let previous = 0;
    for (const point of points) {
      const value = point[axis];
      if (grid) {
        const index = Math.round((value - grid.translate) / grid.scale);
        const delta = index - previous;
        if (delta > exactValue && delta <= 2147483647 && Object.is(index * grid.scale + grid.translate, value)) {
          codes.push(delta);
          previous = index;
          continue;
        }
        codes.push(exactValue);
      }
      exact.push(value);
    }
    if (grid) columns.push(separateBytes(codes, 4));
    columns.push(separateBytes(exact, 8));
    return { exactCount: exact.length, grid };
  });

  const header = Buffer.from(JSON.stringify({ ...properties, arcLengths: arcs.map(arc => arc.length), coordinateEncoding }));
  const headerSize = Buffer.alloc(4);
  headerSize.writeUInt32LE(header.length);
  return Buffer.concat([headerSize, header, ...columns]);
}

mkdirSync(target, { recursive: true });
let before = 0;
let after = 0;
for (const file of readdirSync(source).filter(name => /^\d+\.topojson\.gz$/.test(name))) {
  const number = file.split('.')[0];
  const input = readFileSync(join(source, file));
  const topology = JSON.parse(gunzipSync(input));
  const municipalFile = join(municipalities, `${number}.topojson`);
  const transform = existsSync(municipalFile) ? JSON.parse(readFileSync(municipalFile)).transform : undefined;
  const packed = pack(topology, transform);
  const output = gzipSync(packed, { level: 9 });
  const restored = gunzipSync(output);
  assert.deepStrictEqual(decodeLosslessAreaTopology(new Uint8Array(restored).buffer), topology);
  if (output.length >= input.length) throw new Error(`No size reduction for district ${number}`);
  writeFileSync(join(target, `${number}.bin.gz`), output);
  before += input.length;
  after += output.length;
  if (number === '22') console.log(`Schwäbisch Hall: ${input.length} → ${output.length} bytes`);
}
console.log(`Total: ${before} → ${after} bytes`);
