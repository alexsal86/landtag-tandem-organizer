import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ElectionDistrictsView } from '@/components/ElectionDistrictsView';
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

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-3">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="wahlkreise" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Wahlkreise BW
              </TabsTrigger>
              <TabsTrigger value="stadtteile" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Stadtteile Karlsruhe
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'wahlkreise' && <ElectionDistrictsView />}
        {activeTab === 'stadtteile' && <KarlsruheDistrictsView />}
      </div>
    </div>
  );
};

export default MapsView;
