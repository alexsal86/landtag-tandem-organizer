import { Card } from "@/components/ui/card";
import { MapPin, Navigation } from "lucide-react";
import { ElectionDistrict } from "@/hooks/useElectionDistricts";

interface KarlsruheMapProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict | null;
}

export function KarlsruheMap({ districts, onDistrictClick, selectedDistrict }: KarlsruheMapProps) {
  const getPartyColor = (party?: string) => {
    switch (party?.toLowerCase()) {
      case "fdp": return "rgb(234, 179, 8)"; // yellow-500
      case "grüne": return "rgb(34, 197, 94)"; // green-500
      case "cdu": return "rgb(59, 130, 246)"; // blue-500
      case "spd": return "rgb(239, 68, 68)"; // red-500
      default: return "rgb(107, 114, 128)"; // gray-500
    }
  };

  const getDistrictPosition = (districtNumber: number) => {
    // Map district numbers to positions on the mock map
    const positions = {
      49: { x: 45, y: 35 }, // Karlsruhe I
      50: { x: 35, y: 55 }, // Karlsruhe II
      51: { x: 25, y: 70 }, // Ettlingen
      52: { x: 65, y: 25 }, // Bruchsal
    };
    return positions[districtNumber as keyof typeof positions] || { x: 50, y: 50 };
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-background to-muted/50 rounded-lg overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.1)_0%,transparent_70%)]"></div>
      
      {/* Grid overlay for map feeling */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-12 grid-rows-8 h-full w-full">
          {Array.from({ length: 96 }).map((_, i) => (
            <div key={i} className="border border-muted-foreground/20"></div>
          ))}
        </div>
      </div>

      {/* City center marker */}
      <div 
        className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ left: "50%", top: "45%" }}
      >
        <div className="flex flex-col items-center">
          <MapPin className="h-6 w-6 text-primary animate-pulse" />
          <span className="text-xs font-medium bg-background/90 px-2 py-1 rounded shadow-sm mt-1">
            Karlsruhe
          </span>
        </div>
      </div>

      {/* Election Districts */}
      {districts.map((district) => {
        const position = getDistrictPosition(district.district_number);
        const isSelected = selectedDistrict?.id === district.id;
        
        return (
          <div
            key={district.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all duration-200 hover:scale-110 ${
              isSelected ? "scale-125 z-20" : "z-10"
            }`}
            style={{ 
              left: `${position.x}%`, 
              top: `${position.y}%`,
            }}
            onClick={() => onDistrictClick(district)}
          >
            <div 
              className={`w-16 h-16 rounded-full border-4 opacity-60 group-hover:opacity-90 transition-all flex items-center justify-center text-white font-bold text-sm shadow-lg ${
                isSelected ? "opacity-100 ring-4 ring-primary/50" : ""
              }`}
              style={{ 
                backgroundColor: getPartyColor(district.representative_party),
                borderColor: getPartyColor(district.representative_party)
              }}
            >
              {district.district_number}
            </div>
            <div className={`absolute -bottom-12 left-1/2 transform -translate-x-1/2 transition-opacity ${
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}>
              <Card className="px-3 py-2 shadow-lg min-w-max">
                <div className="text-center">
                  <span className="text-sm font-medium block">
                    WK {district.district_number}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    {district.district_name}
                  </span>
                  {district.representative_name && (
                    <span className="text-xs text-muted-foreground block">
                      {district.representative_name}
                    </span>
                  )}
                  {district.population && (
                    <span className="text-xs text-muted-foreground block">
                      {district.population.toLocaleString()} Einw.
                    </span>
                  )}
                </div>
              </Card>
            </div>
          </div>
        );
      })}

      {/* Compass */}
      <div className="absolute top-4 right-4 bg-background/90 p-2 rounded-full shadow-lg">
        <Navigation className="h-5 w-5 text-muted-foreground" style={{ transform: "rotate(45deg)" }} />
      </div>

      {/* Scale indicator */}
      <div className="absolute bottom-4 left-4 bg-background/90 px-3 py-1 rounded shadow-lg">
        <span className="text-xs text-muted-foreground">~20 km</span>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-background/90 px-3 py-1 rounded shadow-lg">
        <span className="text-xs text-muted-foreground">
          Klicken Sie auf einen Wahlkreis für Details
        </span>
      </div>
    </div>
  );
}