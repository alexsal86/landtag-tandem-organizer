export interface SankeyLink {
  from: string;
  to: string;
  value: number;
}

export interface SankeyNode {
  id: string;
  total: number;
  x: number;
  y: number;
  height: number;
}

export interface SankeyBand {
  from: string;
  to: string;
  value: number;
  path: string;
}

export interface SankeyLayout {
  origins: SankeyNode[];
  destinations: SankeyNode[];
  bands: SankeyBand[];
  leftTotal: number;
  rightTotal: number;
  width: number;
  height: number;
}

export interface SankeyOptions {
  width?: number;
  height?: number;
  nodeWidth?: number;
  padding?: number;
}

const unique = (values: string[]) => [...new Set(values)];

/**
 * Bipartite Sankey: origins on the left, destinations on the right. Only finite,
 * positive amounts are drawn; a missing cell stays absent instead of becoming 0.
 * Both columns use their own scale, so widths are comparable within a column only.
 */
export function sankeyLayout(
  links: SankeyLink[],
  options: SankeyOptions = {},
): SankeyLayout {
  const width = options.width ?? 720;
  const height = options.height ?? 420;
  const nodeWidth = options.nodeWidth ?? 12;
  const padding = options.padding ?? 10;
  const valid = links.filter(
    (link) =>
      Number.isFinite(link.value) &&
      link.value > 0 &&
      link.from.length > 0 &&
      link.to.length > 0,
  );
  const origins = unique(valid.map((link) => link.from));
  const destinations = unique(valid.map((link) => link.to));
  const total = (ids: string[], key: "from" | "to") =>
    ids.map((id) =>
      valid
        .filter((link) => link[key] === id)
        .reduce((sum, link) => sum + link.value, 0),
    );
  const originTotals = total(origins, "from");
  const destinationTotals = total(destinations, "to");
  const leftTotal = originTotals.reduce((sum, value) => sum + value, 0);
  const rightTotal = destinationTotals.reduce((sum, value) => sum + value, 0);
  const column = (
    ids: string[],
    totals: number[],
    x: number,
    sum: number,
  ): SankeyNode[] => {
    const available = Math.max(0, height - padding * Math.max(0, ids.length - 1));
    const scale = sum > 0 ? available / sum : 0;
    let y = 0;
    return ids.map((id, index) => {
      const boxHeight = totals[index] * scale;
      const node = { id, total: totals[index], x, y, height: boxHeight };
      y += boxHeight + padding;
      return node;
    });
  };
  const left = column(origins, originTotals, 0, leftTotal);
  const right = column(destinations, destinationTotals, width - nodeWidth, rightTotal);
  const leftScale = leftTotal > 0 ? (height - padding * Math.max(0, origins.length - 1)) / leftTotal : 0;
  const rightScale = rightTotal > 0 ? (height - padding * Math.max(0, destinations.length - 1)) / rightTotal : 0;
  const offsets = new Map<string, number>();
  const bands: SankeyBand[] = valid.map((link) => {
    const source = left.find((node) => node.id === link.from)!;
    const target = right.find((node) => node.id === link.to)!;
    const sourceOffset = offsets.get(`from:${link.from}`) ?? 0;
    const targetOffset = offsets.get(`to:${link.to}`) ?? 0;
    offsets.set(`from:${link.from}`, sourceOffset + link.value);
    offsets.set(`to:${link.to}`, targetOffset + link.value);
    const x0 = source.x + nodeWidth;
    const x1 = target.x;
    const y0 = source.y + sourceOffset * leftScale;
    const y1 = target.y + targetOffset * rightScale;
    const h0 = link.value * leftScale;
    const h1 = link.value * rightScale;
    const curve = Math.max(24, (x1 - x0) / 2);
    const path = [
      `M ${x0} ${y0}`,
      `C ${x0 + curve} ${y0}, ${x1 - curve} ${y1}, ${x1} ${y1}`,
      `L ${x1} ${y1 + h1}`,
      `C ${x1 - curve} ${y1 + h1}, ${x0 + curve} ${y0 + h0}, ${x0} ${y0 + h0}`,
      "Z",
    ].join(" ");
    return { ...link, path };
  });
  return { origins: left, destinations: right, bands, leftTotal, rightTotal, width, height };
}
