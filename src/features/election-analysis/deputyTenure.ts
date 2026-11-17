interface DateRange { starts_on: string | null; ends_on: string | null }
export interface TenureSegment { start: number; width: number }

function day(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0,10)===value ? stamp/86400000 : null;
}

/** Union documented intervals, preserving their position and clipping future time. */
export function deputyTenureCoverage(period: DateRange & { expected_ends_on?: string | null }, mandates: DateRange[], today: string): { segments: TenureSegment[]; unknown: boolean } {
  const first = day(period.starts_on), last = day(period.ends_on ?? period.expected_ends_on), now = day(today);
  if (first===null || last===null || now===null || last<first) return { segments: [], unknown: mandates.length>0 };
  let unknown = false;
  const ranges: [number,number][] = [];
  for (const mandate of mandates) {
    const start = day(mandate.starts_on), end = day(mandate.ends_on);
    if (start===null || end===null || end<start) { unknown = true; continue; }
    const left = Math.max(first,start), right = Math.min(last,end,now);
    if (left<=right) ranges.push([left,right]);
  }
  ranges.sort((a,b) => a[0]-b[0]);
  const merged: [number,number][] = [];
  for (const range of ranges) {
    const prior = merged[merged.length-1];
    if (prior && range[0]<=prior[1]+1) prior[1] = Math.max(prior[1],range[1]);
    else merged.push([...range]);
  }
  const length = last-first+1;
  return { segments: merged.map(([start,end]) => ({ start:(start-first)/length*100,width:(end-start+1)/length*100 })),unknown };
}
