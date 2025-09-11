import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Info, Layers, ZoomIn, ZoomOut } from "lucide-react";
import { KarlsruheMap } from "./KarlsruheMap";

export function ElectionDistrictsView() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wahlkreise Karlsruhe</h1>
          <p className="text-muted-foreground">
            Übersicht der Landtagswahlkreise in und um Karlsruhe
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Baden-Württemberg
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-3">
          <Card className="h-[600px]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Interaktive Karte
                  </CardTitle>
                  <CardDescription>
                    Wahlkreisgrenzen und Stadtteile von Karlsruhe
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Layers className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 h-[500px]">
              <KarlsruheMap />
            </CardContent>
          </Card>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Wahlkreis-Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Aktiver Wahlkreis</h4>
                  <p className="font-semibold">Klicken Sie auf einen Wahlkreis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistiken</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Wahlkreise</span>
                  <span className="font-medium">4</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Stadtbezirke</span>
                  <span className="font-medium">27</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Einwohner</span>
                  <span className="font-medium">~310.000</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Legende</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-primary/20 border-2 border-primary rounded"></div>
                  <span className="text-sm">Wahlkreis 49</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-secondary/20 border-2 border-secondary rounded"></div>
                  <span className="text-sm">Wahlkreis 50</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-accent/20 border-2 border-accent rounded"></div>
                  <span className="text-sm">Wahlkreis 51</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-muted/20 border-2 border-muted-foreground rounded"></div>
                  <span className="text-sm">Wahlkreis 52</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}