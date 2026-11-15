import { lazy, Suspense, useState } from 'react';
import type { ElectionPeriod, HistoricalDistrict } from './types';
const DistrictBoundaryMap = lazy(() => import('./DistrictBoundaryMap'));

/** Mount map code and start requests only after an explicit open action. */
export function DistrictBoundarySection({ period, district }: { period: ElectionPeriod | undefined; district: HistoricalDistrict }) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-md border p-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">Wahlkreiskarte öffnen</summary>
    {open && <div className="mt-3"><Suspense fallback={<p role="status">Lade Karte …</p>}><DistrictBoundaryMap key={`${period?.id}:${district.id}`} period={period} district={district} /></Suspense></div>}
  </details>;
}
