/** get_analysis_district_series accepts at most ten explicitly selected election years. */
export function districtSeriesYearBatches(years: readonly number[]): number[][] {
  const unique = [...new Set(years)];
  const batches: number[][] = [];
  for (let index = 0; index < unique.length; index += 10) batches.push(unique.slice(index, index + 10));
  return batches;
}
