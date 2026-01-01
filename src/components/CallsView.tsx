import { useState } from "react";
import { Phone, Plus, Calendar, Clock, User, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

export const CallsView = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b bg-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Phone className="h-6 w-6 text-primary" />
              Anrufe
            </h1>
            <p className="text-muted-foreground mt-1">
              Verwalten Sie Ihre Anrufe und Telefonnotizen
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Neuer Anruf
          </Button>
        </div>

        {/* Search */}
        <div className="mt-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Anrufe durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Empty State */}
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Phone className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg mb-2">Keine Anrufe vorhanden</CardTitle>
              <CardDescription className="text-center max-w-md mb-4">
                Sie haben noch keine Anrufe protokolliert. Erstellen Sie einen neuen Anrufeintrag, um Telefonnotizen zu verwalten.
              </CardDescription>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Ersten Anruf erstellen
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
