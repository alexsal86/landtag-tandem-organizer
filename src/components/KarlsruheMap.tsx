import { Card } from "@/components/ui/card";
import { MapPin, Navigation } from "lucide-react";

export function KarlsruheMap() {
  // Mock data for Karlsruhe election districts
  const districts = [
    { id: 49, name: "Karlsruhe I", color: "hsl(var(--primary))", position: { x: 45, y: 35 } },
    { id: 50, name: "Karlsruhe II", color: "hsl(var(--secondary))", position: { x: 35, y: 55 } },
    { id: 51, name: "Ettlingen", color: "hsl(var(--accent))", position: { x: 25, y: 70 } },
    { id: 52, name: "Bruchsal", color: "hsl(var(--muted-foreground))", position: { x: 65, y: 25 } }
  ];

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
      {districts.map((district) => (
        <div
          key={district.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all duration-200 hover:scale-110"
          style={{ 
            left: `${district.position.x}%`, 
            top: `${district.position.y}%`,
          }}
        >
          <div 
            className="w-16 h-16 rounded-full border-4 opacity-60 group-hover:opacity-90 transition-opacity flex items-center justify-center text-white font-bold text-sm shadow-lg"
            style={{ 
              backgroundColor: district.color,
              borderColor: district.color
            }}
          >
            {district.id}
          </div>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Card className="px-2 py-1 shadow-lg">
              <span className="text-xs font-medium whitespace-nowrap">
                {district.name}
              </span>
            </Card>
          </div>
        </div>
      ))}

      {/* Compass */}
      <div className="absolute top-4 right-4 bg-background/90 p-2 rounded-full shadow-lg">
        <Navigation className="h-5 w-5 text-muted-foreground" style={{ transform: "rotate(45deg)" }} />
      </div>

      {/* Scale indicator */}
      <div className="absolute bottom-4 left-4 bg-background/90 px-3 py-1 rounded shadow-lg">
        <span className="text-xs text-muted-foreground">~20 km</span>
      </div>

      {/* Placeholder notice */}
      <div className="absolute bottom-4 right-4 bg-background/90 px-3 py-1 rounded shadow-lg">
        <span className="text-xs text-muted-foreground">
          Vorschau - Interaktive Karte folgt
        </span>
      </div>
    </div>
  );
}