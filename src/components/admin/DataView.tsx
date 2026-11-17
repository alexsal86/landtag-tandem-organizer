import { lazy, Suspense } from 'react';

const ElectionAnalysis = lazy(() => import('@/features/election-analysis/ElectionAnalysis'));

export function DataView() {
  return <div className="h-full overflow-y-auto p-4 font-sans md:p-6">
    <Suspense fallback={<p role="status">Wahlanalyse wird geladen …</p>}>
      <ElectionAnalysis />
    </Suspense>
  </div>;
}
