import { lazy, Suspense, useState } from 'react';

const DistrictBoundaryMap = lazy(() => import('@/features/election-history/DistrictBoundaryMap'));

/** The profile's existing confirmed geometry assignment authorizes this single-year map. */
export function ProfileBoundarySection(props: {
  year: number;
  number: number;
  name: string;
  confirmedGeometryYear?: number;
}) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-md border p-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">Wahlkreiskarte öffnen</summary>
    {open && <div className="mt-3 space-y-2">
      <p className="text-xs text-muted-foreground">Wahljahr {props.year} · {props.number}: {props.name}</p>
      <Suspense fallback={<p role="status">Lade Karte …</p>}>
        <DistrictBoundaryMap analysis={props} />
      </Suspense>
    </div>}
  </details>;
}
