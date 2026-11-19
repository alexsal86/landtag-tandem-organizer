type CoordinateEncoding = {
  exactCount: number;
  grid?: { scale: number; translate: number };
};

type PackedHeader = {
  type: 'Topology';
  arcLengths: number[];
  coordinateEncoding: [CoordinateEncoding, CoordinateEncoding];
};

const exactValue = -2147483648;

/** Restore the original TopoJSON arcs from byte-separated numeric columns. */
export function decodeLosslessAreaTopology(buffer: ArrayBuffer) {
  const file = new DataView(buffer);
  const headerLength = file.getUint32(0, true);
  const header: PackedHeader = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)));
  const { arcLengths, coordinateEncoding, ...topology } = header;
  const pointCount = arcLengths.reduce((total, length) => total + length, 0);
  let offset = 4 + headerLength;

  const readColumn = (count: number, width: 4 | 8) => {
    const view = new DataView(new ArrayBuffer(count * width));
    for (let byte = 0; byte < width; byte++) {
      for (let index = 0; index < count; index++) {
        view.setUint8(index * width + byte, file.getUint8(offset++));
      }
    }
    return view;
  };

  const axes = coordinateEncoding.map(({ exactCount, grid }) => {
    const codes = grid ? readColumn(pointCount, 4) : undefined;
    const exact = readColumn(exactCount, 8);
    let exactIndex = 0;
    let gridIndex = 0;
    return Array.from({ length: pointCount }, (_, index) => {
      const code = codes?.getInt32(index * 4, true) ?? exactValue;
      if (!grid || code === exactValue) return exact.getFloat64(exactIndex++ * 8, true);
      gridIndex += code;
      return gridIndex * grid.scale + grid.translate;
    });
  });
  if (offset !== buffer.byteLength) throw new Error('Ungültige Gebietsgeometrie');

  let index = 0;
  const arcs = arcLengths.map(length => Array.from({ length }, () => {
    const point = [axes[0][index], axes[1][index]];
    index++;
    return point;
  }));
  return { ...topology, arcs };
}
