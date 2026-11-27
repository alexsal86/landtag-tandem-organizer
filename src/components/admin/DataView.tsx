import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ElectionAnalysis = lazy(() => import('@/features/election-analysis/ElectionAnalysis'));
const ParlisView = lazy(() => import('@/features/parlis/ParlisView'));
const MinistryHistoryView = lazy(() => import('@/features/ministries-history/MinistryHistoryView'));

const bereiche = ['wahl', 'parlis', 'ministerien'] as const;
type Bereich = (typeof bereiche)[number];

export function DataView() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('bereich');
  const active: Bereich = bereiche.find(bereich => bereich === requested) ?? 'wahl';

  return (
    <div className="h-full overflow-y-auto p-4 font-sans md:p-6">
      <Tabs value={active} onValueChange={value => {
        const next = new URLSearchParams(params);
        if (value === 'wahl') next.delete('bereich');
        else next.set('bereich', value);
        setParams(next);
      }}>
        <TabsList className="h-auto flex-wrap" aria-label="Datenbereiche">
          <TabsTrigger value="wahl">Wahlanalyse</TabsTrigger>
          <TabsTrigger value="parlis">Parlamentarische Vorgänge</TabsTrigger>
          <TabsTrigger value="ministerien">Ministerien seit 1952</TabsTrigger>
        </TabsList>
        <TabsContent value="wahl">
          <Suspense fallback={<p role="status">Wahlanalyse wird geladen …</p>}>
            <ElectionAnalysis />
          </Suspense>
        </TabsContent>
        <TabsContent value="parlis">
          <Suspense fallback={<p role="status">Parlamentarische Vorgänge werden geladen …</p>}>
            <ParlisView />
          </Suspense>
        </TabsContent>
        <TabsContent value="ministerien">
          <Suspense fallback={<p role="status">Ministerienübersicht wird geladen …</p>}>
            <MinistryHistoryView />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
