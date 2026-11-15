// No rounding, quantization or simplification. Identical district forms are
// stored once; forms needed by exactly the same years share a request/package.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error('Usage: node scripts/geometry/pack-election-topology.mjs 2006=path.topojson 2011=path.topojson 2016=path.topojson 2021=path.topojson');
const sources = inputs.map(input => {
  const separator = input.indexOf('=');
  const year = input.slice(0, separator);
  const file = input.slice(separator + 1);
  if (separator < 0 || !/^\d{4}$/.test(year) || !file) throw new Error('Expected YEAR=path.topojson');
  return { year: Number(year), file };
}).sort((a, b) => a.year - b.year);
if (new Set(sources.map(source => source.year)).size !== sources.length) throw new Error('Duplicate boundary year');
const hash = text => createHash('sha256').update(text).digest('hex');
const forms = new Map();
const manifests = new Map();
const ring = (references, topology) => {
  const result = [];
  for (const reference of references) {
    const points = reference < 0 ? [...topology.arcs[~reference]].reverse() : topology.arcs[reference];
    if (result.length) result.pop();
    for (const point of points) result.push(point);
  }
  return result;
};
// Canonicalize only cyclic start, direction and ordering. No point is removed
// except the duplicate closing point in the comparison key (not in storage).
const canonicalRing = points => {
  const open = points.map(point => JSON.stringify(point));
  if (open[0] === open.at(-1)) open.pop();
  if (!open.length) throw new Error('Empty boundary ring');
  let minimum = open[0];
  for (const point of open) if (point < minimum) minimum = point;
  let best;
  for (const direction of [open, [...open].reverse()]) {
    for (let i = 0; i < direction.length; i++) {
      if (direction[i] !== minimum) continue;
      const candidate = `[${[...direction.slice(i), ...direction.slice(0, i)].join(',')}]`;
      if (best === undefined || candidate < best) best = candidate;
    }
  }
  return best;
};
for (const { year, file } of sources) {
  const topology = JSON.parse(readFileSync(file, 'utf8'));
  if (topology.type !== 'Topology' || topology.transform) throw new Error('Expected unquantized Topology');
  const objects = Object.values(topology.objects);
  if (objects.length !== 1 || objects[0].type !== 'GeometryCollection') throw new Error('Expected one district collection');
  const districts = [];
  const numbers = new Set();
  for (const geometry of objects[0].geometries) {
    const number = Number(geometry.properties?.Nummer);
    if (!Number.isInteger(number) || number < 1 || number > 70 || numbers.has(number)) throw new Error('Invalid or duplicate district number');
    numbers.add(number);
    if (!['Polygon', 'MultiPolygon'].includes(geometry.type)) throw new Error('Expected district polygon');
    const polygons = geometry.type === 'Polygon' ? [geometry.arcs] : geometry.arcs;
    const key = JSON.stringify(polygons.map(polygon => JSON.stringify([
      canonicalRing(ring(polygon[0], topology)),
      polygon.slice(1).map(references => canonicalRing(ring(references, topology))).sort(),
    ])).sort());
    const shape = hash(key);
    if (!forms.has(shape)) forms.set(shape, { geometry, topology, years: new Set() });
    forms.get(shape).years.add(year);
    districts.push({ shape, properties: geometry.properties });
  }
  if (districts.length !== 70) throw new Error('Expected all 70 districts');
  manifests.set(year, { version: 1, year, districts: districts.sort((a, b) => Number(a.properties.Nummer) - Number(b.properties.Nummer)) });
}
const groups = new Map();
for (const [shape, form] of forms) {
  const signature = [...form.years].sort().join(',');
  if (!groups.has(signature)) groups.set(signature, []);
  groups.get(signature).push([shape, form]);
}
const directory = 'public/data/geometry';
mkdirSync(directory, { recursive: true });
function writeAsset(prefix, extension, value) {
  const data = Buffer.from(JSON.stringify(value));
  const name = `${prefix}-${hash(data)}.${extension}`;
  const gzip = gzipSync(data, { level: 9 });
  const brotli = brotliCompressSync(data, { params: {
    [constants.BROTLI_PARAM_QUALITY]: 11,
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
  } });
  writeFileSync(`${directory}/${name}`, data);
  writeFileSync(`${directory}/${name}.gz`, gzip);
  writeFileSync(`${directory}/${name}.br`, brotli);
  return { path: `/data/geometry/${name}`, bytes: data.length, gzip: gzip.length, brotli: brotli.length };
}
const packages = new Map();
const formPackages = new Map();
for (const [signature, group] of groups) {
  const topology = { type: 'Topology', objects: {}, arcs: [] };
  const index = new Map();
  const addArc = points => {
    const key = JSON.stringify(points);
    if (index.has(key)) return index.get(key);
    const reference = topology.arcs.length;
    topology.arcs.push(points);
    index.set(key, reference);
    const reverse = JSON.stringify([...points].reverse());
    if (!index.has(reverse)) index.set(reverse, ~reference);
    return reference;
  };
  for (const [shape, form] of group.sort(([a], [b]) => a.localeCompare(b))) {
    const remap = references => Array.isArray(references) ? references.map(remap) : references < 0
      ? ~addArc(form.topology.arcs[~references]) : addArc(form.topology.arcs[references]);
    topology.objects[shape] = { type: 'GeometryCollection', geometries: [{
      type: form.geometry.type, arcs: remap(form.geometry.arcs), properties: {},
    }] };
  }
  const asset = writeAsset('shapes', 'topojson', topology);
  packages.set(signature, { ...asset, forms: group.length });
  for (const [shape] of group) formPackages.set(shape, asset.path);
}
const paths = {};
const downloads = {};
for (const [year, manifest] of manifests) {
  for (const district of manifest.districts) district.package = formPackages.get(district.shape);
  const asset = writeAsset(`manifest-${year}`, 'json', manifest);
  paths[year] = asset.path;
  const required = [...packages.values()].filter(p => manifest.districts.some(d => d.package === p.path));
  downloads[year] = { requests: required.length + 1,
    gzip: asset.gzip + required.reduce((sum, p) => sum + p.gzip, 0),
    brotli: asset.brotli + required.reduce((sum, p) => sum + p.brotli, 0) };
}
writeFileSync('src/utils/electoralTopologyAsset.ts', `// Generated by scripts/geometry/pack-election-topology.mjs\nexport const ELECTORAL_TOPOLOGY_MANIFESTS: Readonly<Record<number, string>> = ${JSON.stringify(paths, null, 2)};\nexport const ELECTORAL_TOPOLOGY_VERSION = "${hash(JSON.stringify(paths))}";\n`);
console.log(JSON.stringify({ uniqueForms: forms.size, groups: Object.fromEntries(packages), downloads }));
