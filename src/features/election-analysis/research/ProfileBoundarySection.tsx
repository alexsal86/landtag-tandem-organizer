import { lazy, Suspense } from 'react';

const DistrictBoundaryMap = lazy(() => import('@/features/election-history/DistrictBoundaryMap'));

/** The profile's existing confirmed geometry assignment authorizes this single-year map. */
export function ProfileBoundarySection(props: {
  year: number;
  number: number;
  name: string;
  confirmedGeometryYear?: number;
}) {
  return <section className="min-w-0 rounded-lg border bg-card text-card-foreground">
    <div className="space-y-1.5 p-6">
      <h3 className="text-lg font-semibold leading-none tracking-tight">Wahlkreiskarte</h3>
      <p className="text-xs text-muted-foreground">Wahljahr {props.year} · {props.number}: {props.name}</p>
    </div>
    <div className="px-6 pb-6">
      <Suspense fallback={<p role="status">Lade Karte …</p>}>
        <DistrictBoundaryMap key={`${props.year}:${props.number}`} analysis={props} />
      </Suspense>
    </div>
  </section>;
}
