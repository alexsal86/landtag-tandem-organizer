import type { ResearchDataset } from "./data";
export interface FeatureRow {
  number: number;
  name: string;
  values: number[];
  raw: Record<string, number>;
}
export function typologyFeatures(
  current: ResearchDataset,
  before: ResearchDataset | null,
  allowUnknown: boolean,
  allowMixed = false,
) {
  const keys = current.parties.filter(
    (p) => !before || before.parties.includes(p),
  );
  const rows: FeatureRow[] = [],
    excluded: { number: number; reason: string }[] = [];
  const features = [
    ...keys.map((p) => `Wurzelanteil ${p}`),
    "Wurzelanteil Rest",
    "Beteiligung",
    ...(before
      ? [...keys.map((p) => `Swing ${p}`), "Swing Rest", "Beteiligungsswing"]
      : []),
  ];
  for (const r of current.rows) {
    const old = before?.rows.find((p) => p.number === r.number);
    if (
      !allowMixed &&
      (new Set(current.rows.map((p) => `${p.release}:${p.preliminary}`)).size >
        1 ||
        (before &&
          new Set(before.rows.map((p) => `${p.release}:${p.preliminary}`))
            .size > 1))
    ) {
      excluded.push({
        number: r.number,
        reason: "Datenstände innerhalb der Wahl sind gemischt.",
      });
      continue;
    }
    if (
      before &&
      (!old ||
        (!allowMixed && r.preliminary !== old.preliminary) ||
        (!allowUnknown && (!r.identity || !old.identity)) ||
        (r.identity && old.identity && r.identity !== old.identity))
    ) {
      excluded.push({
        number: r.number,
        reason:
          "Fehlender/abweichender Zuschnitt oder unterschiedlicher Ergebnisstatus.",
      });
      continue;
    }
    const rest = 100 - keys.reduce((s, p) => s + r.shares[p], 0),
      raw = { ...r.shares, REST: rest, Beteiligung: r.turnout };
    const values = [
      ...keys.map((p) => Math.sqrt(r.shares[p] / 100)),
      Math.sqrt(Math.max(0, rest) / 100),
      r.turnout / 100,
    ];
    if (old) {
      const oldRest = 100 - keys.reduce((s, p) => s + old.shares[p], 0);
      values.push(
        ...keys.map((p) => (r.shares[p] - old.shares[p]) / 100),
        (rest - oldRest) / 100,
        (r.turnout - old.turnout) / 100,
      );
    }
    rows.push({ number: r.number, name: r.name, values, raw });
  }
  // Feature scaling is explicit and shared across every start/resample.
  const means = features.map(
    (_, j) =>
      rows.reduce((sum, r) => sum + r.values[j], 0) / Math.max(1, rows.length),
  );
  const scales = features.map(
    (_, j) =>
      Math.sqrt(
        rows.reduce((sum, r) => sum + (r.values[j] - means[j]) ** 2, 0) /
          Math.max(1, rows.length),
      ) || 1,
  );
  return {
    rows: rows.map((r) => ({
      ...r,
      values: r.values.map((v, j) => (v - means[j]) / scales[j]),
    })),
    features,
    excluded,
    parties: keys,
  };
}
const distance = (a: number[], b: number[]) =>
  a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0);
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function nearest(row: number[], centres: number[][]) {
  let best = 0;
  for (let k = 1; k < centres.length; k++)
    if (distance(row, centres[k]) < distance(row, centres[best])) best = k;
  return best;
}
function fit(points: number[][], k: number, seed: number) {
  const rng = random(seed);
  const centres = [points[Math.floor(rng() * points.length)].slice()];
  while (centres.length < k) {
    const weights = points.map((p) =>
        Math.min(...centres.map((c) => distance(p, c))),
      ),
      sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 1e-12)
      throw new Error("Weniger unterschiedliche Wahlkreismuster als Gruppen.");
    let pick = rng() * sum,
      index = weights.length - 1;
    for (let i = 0; i < weights.length; i++) {
      pick -= weights[i];
      if (weights[i] > 0 && pick <= 0) {
        index = i;
        break;
      }
    }
    centres.push(points[index].slice());
  }
  let labels = points.map((p) => nearest(p, centres));
  for (let iteration = 0; iteration < 100; iteration++) {
    const next = centres.map((c, j) => {
      const group = points.filter((_, i) => labels[i] === j);
      if (!group.length) return c;
      return c.map(
        (_, d) => group.reduce((s, p) => s + p[d], 0) / group.length,
      );
    });
    const changed = next.some((c, j) => distance(c, centres[j]) > 1e-12);
    centres.splice(0, centres.length, ...next);
    labels = points.map((p) => nearest(p, centres));
    if (!changed) break;
  }
  if (new Set(labels).size !== k)
    throw new Error("Leere Gruppe: kleinere Gruppenzahl wählen.");
  return {
    labels,
    centres,
    sse: points.reduce((s, p, i) => s + distance(p, centres[labels[i]]), 0),
  };
}
function ward(points: number[][], k: number) {
  const groups = points.map((point, i) => ({
    members: [i],
    centre: point.slice(),
  }));
  while (groups.length > k) {
    let pair: [number, number] = [0, 1],
      minimum = Infinity;
    for (let a = 0; a < groups.length; a++)
      for (let b = a + 1; b < groups.length; b++) {
        const left = groups[a],
          right = groups[b],
          cost =
            ((left.members.length * right.members.length) /
              (left.members.length + right.members.length)) *
            distance(left.centre, right.centre);
        if (cost < minimum) {
          minimum = cost;
          pair = [a, b];
        }
      }
    const [a, b] = pair,
      left = groups[a],
      right = groups[b],
      size = left.members.length + right.members.length;
    groups[a] = {
      members: [...left.members, ...right.members],
      centre: left.centre.map(
        (v, j) =>
          (v * left.members.length + right.centre[j] * right.members.length) /
          size,
      ),
    };
    groups.splice(b, 1);
  }
  const labels = new Array<number>(points.length);
  groups.forEach((g, label) =>
    g.members.forEach((i) => {
      labels[i] = label;
    }),
  );
  return {
    labels,
    centres: groups.map((g) => g.centre),
    sse: points.reduce(
      (s, p, i) => s + distance(p, groups[labels[i]].centre),
      0,
    ),
  };
}
export function adjustedRand(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null;
  const combinations = (n: number) => (n * (n - 1)) / 2;
  const cells = new Map<string, number>(),
    left = new Map<number, number>(),
    right = new Map<number, number>();
  a.forEach((v, i) => {
    const key = `${v}:${b[i]}`;
    cells.set(key, (cells.get(key) || 0) + 1);
    left.set(v, (left.get(v) || 0) + 1);
    right.set(b[i], (right.get(b[i]) || 0) + 1);
  });
  const sum = (m: Map<unknown, number>) =>
      [...m.values()].reduce((s, n) => s + combinations(n), 0),
    x = sum(left),
    y = sum(right),
    expected = (x * y) / combinations(a.length),
    denominator = (x + y) / 2 - expected;
  if (Math.abs(denominator) < 1e-12)
    return Math.abs(sum(cells) - expected) < 1e-12 ? 1 : 0;
  return (sum(cells) - expected) / denominator;
}
export function clusterDistricts(
  rows: FeatureRow[],
  k: number,
  method: "kmeans" | "ward" = "kmeans",
) {
  if (
    !Number.isInteger(k) ||
    k < 2 ||
    k > 6 ||
    rows.length < Math.max(10, k * 2)
  )
    throw new Error(
      "Mindestens zehn vollständige Wahlkreise und mindestens zwei je Gruppe erforderlich.",
    );
  const points = rows.map((r) => r.values);
  if (points.some((p) => p.some((v) => !Number.isFinite(v))))
    throw new Error("Ungültige Merkmale.");
  const starts = Array.from({ length: 8 }, (_, i) =>
    fit(points, k, 100 + i),
  ).sort((a, b) => a.sse - b.sse);
  const wardResult = ward(points, k),
    best = method === "ward" ? wardResult : starts[0];
  const silhouette =
    points.reduce((sum, p, i) => {
      const own = points.map((q, j) => ({
        d: Math.sqrt(distance(p, q)),
        label: best.labels[j],
        j,
      }));
      const same = own.filter((q) => q.label === best.labels[i] && q.j !== i);
      if (!same.length) return sum;
      const a = same.reduce((s, q) => s + q.d, 0) / same.length;
      const b = Math.min(
        ...best.centres.map((_, label) => {
          const other = own.filter((q) => q.label === label);
          return label === best.labels[i] || !other.length
            ? Infinity
            : other.reduce((s, q) => s + q.d, 0) / other.length;
        }),
      );
      return sum + (b - a) / Math.max(a, b, 1e-12);
    }, 0) / points.length;
  const stability: number[] = [];
  let failedResamples = 0;
  for (let s = 0; s < 12; s++) {
    const rng = random(1000 + s);
    const indices = points
      .map((_, i) => ({ i, r: rng() }))
      .sort((a, b) => a.r - b.r)
      .slice(0, Math.ceil(points.length * 0.8))
      .map((x) => x.i);
    try {
      const fitted =
        method === "ward"
          ? ward(
              indices.map((i) => points[i]),
              k,
            )
          : fit(
              indices.map((i) => points[i]),
              k,
              2000 + s,
            );
      const agreement = adjustedRand(
        best.labels,
        points.map((p) => nearest(p, fitted.centres)),
      );
      if (agreement != null) stability.push(agreement);
    } catch {
      failedResamples++;
    }
  }
  return {
    labels: best.labels,
    sse: best.sse,
    silhouette,
    methodAgreement: adjustedRand(starts[0].labels, wardResult.labels),
    startAgreement:
      starts.reduce(
        (s, r) => s + (adjustedRand(starts[0].labels, r.labels) ?? 0),
        0,
      ) / starts.length,
    resampleAgreement: stability.length
      ? stability.reduce((a, b) => a + b, 0) / stability.length
      : null,
    failedResamples,
  };
}
