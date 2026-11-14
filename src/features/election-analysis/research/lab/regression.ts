export interface RegressionPoint {
  number: number;
  name: string;
  x: number;
  y: number;
}
function fit(points: RegressionPoint[]) {
  const n = points.length,
    meanX = points.reduce((s, p) => s + p.x, 0) / n,
    meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let xx = 0,
    xy = 0;
  for (const p of points) {
    xx += (p.x - meanX) ** 2;
    xy += (p.x - meanX) * (p.y - meanY);
  }
  if (![meanX, meanY, xx, xy].every(Number.isFinite))
    throw new Error("Zahlenbereich des Strukturmerkmals ist zu groß.");
  if (xx <= 1e-12)
    throw new Error("Das Strukturmerkmal hat keine ausreichende Streuung.");
  const slope = xy / xx,
    intercept = meanY - slope * meanX;
  return { slope, intercept, meanX, meanY, xx };
}
/** Univariate OLS with intercept. Diagnostics are descriptive, no causal or spatial claims. */
export function linearModel(points: RegressionPoint[]) {
  if (
    points.length < 10 ||
    new Set(points.map((p) => p.number)).size !== points.length ||
    points.some((p) => ![p.x, p.y].every(Number.isFinite))
  )
    throw new Error(
      "Mindestens zehn eindeutige vollständige Wahlkreise erforderlich.",
    );
  const model = fit(points);
  const residuals = points.map((p) => ({
    ...p,
    predicted: model.intercept + model.slope * p.x,
    residual: p.y - (model.intercept + model.slope * p.x),
  }));
  const sse = residuals.reduce((s, p) => s + p.residual ** 2, 0),
    sst = points.reduce((s, p) => s + (p.y - model.meanY) ** 2, 0),
    variance = sse / (points.length - 2);
  let looSum = 0,
    looPairs = 0;
  for (let i = 0; i < points.length; i++) {
    try {
      const other = fit(points.filter((_, j) => i !== j));
      looSum +=
        (points[i].y - other.intercept - other.slope * points[i].x) ** 2;
      looPairs++;
    } catch {
      /* Degenerate holdouts are excluded and counted. */
    }
  }
  return {
    ...model,
    n: points.length,
    rSquared: sst > 1e-12 ? 1 - sse / sst : null,
    rmse: Math.sqrt(sse / points.length),
    looRmse: looPairs ? Math.sqrt(looSum / looPairs) : null,
    looPairs,
    residuals: residuals.map((p) => {
      const leverage = 1 / points.length + (p.x - model.meanX) ** 2 / model.xx;
      return {
        ...p,
        leverage,
        cooksDistance:
          variance > 1e-12 && leverage < 1
            ? ((p.residual ** 2 / (2 * variance)) * leverage) /
              (1 - leverage) ** 2
            : null,
      };
    }),
  };
}
