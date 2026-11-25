import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { MapPin, Building2 } from 'lucide-react';

const ElectionDistrictsView = lazyWithRetry(() =>
  import('@/features/election-districts/components/ElectionDistrictsView').then((module) => ({ default: module.ElectionDistrictsView })),
);
const KarlsruheDistrictsView = lazyWithRetry(() =>
  import('@/components/karlsruhe/KarlsruheDistrictsView').then((module) => ({ default: module.KarlsruheDistrictsView })),
);

export const MapsView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'wahlkreise');

  // Browser back/forward and pasted links set the tab through the URL.
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Keep the map parameters of the other tab so links survive switching.
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('tab', value);
      return next;
    }, { replace: true });
  };

  const mapSwitcher = (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Kartenansicht</p>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid h-auto w-full grid-cols-1 gap-0 overflow-hidden rounded-lg border bg-transparent p-0">
          <TabsTrigger value="wahlkreise" className="justify-start gap-2 rounded-none px-3 py-2.5 first:rounded-t-lg last:rounded-b-lg data-[state=active]:bg-[#f0f2ed] dark:data-[state=active]:bg-[#292c26] data-[state=active]:shadow-none"><MapPin className="h-4 w-4" />Wahlkreise BW</TabsTrigger>
          <TabsTrigger value="stadtteile" className="justify-start gap-2 rounded-none px-3 py-2.5 first:rounded-t-lg last:rounded-b-lg data-[state=active]:bg-[#f0f2ed] dark:data-[state=active]:bg-[#292c26] data-[state=active]:shadow-none"><Building2 className="h-4 w-4" />Stadtteile Karlsruhe</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );

  return (
    <div className="h-full min-h-0">
      <Suspense fallback={<div className="p-3">{mapSwitcher}<p role="status" className="mt-3 text-sm text-muted-foreground">Karte wird geladen…</p></div>}>
        {activeTab === 'wahlkreise' && <ElectionDistrictsView sidebarHeader={mapSwitcher} />}
        {activeTab === 'stadtteile' && <KarlsruheDistrictsView sidebarHeader={mapSwitcher} />}
      </Suspense>
    </div>
  );
};

export default MapsView;
