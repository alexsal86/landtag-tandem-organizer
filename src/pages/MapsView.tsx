import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ElectionDistrictsView } from '@/features/election-districts/components/ElectionDistrictsView';
import { KarlsruheDistrictsView } from '@/components/karlsruhe/KarlsruheDistrictsView';
import { MapPin, Building2 } from 'lucide-react';

export const MapsView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'wahlkreise');

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  const mapSwitcher = (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Kartenansicht</p>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 p-1">
          <TabsTrigger value="wahlkreise" className="justify-start gap-2"><MapPin className="h-4 w-4" />Wahlkreise BW</TabsTrigger>
          <TabsTrigger value="stadtteile" className="justify-start gap-2"><Building2 className="h-4 w-4" />Stadtteile Karlsruhe</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );

  return (
    <div className="h-full min-h-0">
      {activeTab === 'wahlkreise' && <ElectionDistrictsView sidebarHeader={mapSwitcher} />}
      {activeTab === 'stadtteile' && <KarlsruheDistrictsView sidebarHeader={mapSwitcher} />}
    </div>
  );
};

export default MapsView;
