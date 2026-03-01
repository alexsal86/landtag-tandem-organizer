import { Link } from "react-router-dom";
import { Network, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StakeholderNetworkWidget } from "@/components/dashboard/StakeholderNetworkWidget";

export function StakeholderNetworkPage() {
  return (
    <Card className="bg-card shadow-card border-border">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              Stakeholder-Netzwerk
            </CardTitle>
            <CardDescription>
              Visualisiert Beziehungen zwischen Organisationen über gemeinsame Tags.
            </CardDescription>
          </div>
          <Link to="/contacts/new?contact_type=organization">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Stakeholder hinzufügen
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[620px]">
          <StakeholderNetworkWidget />
        </div>
      </CardContent>
    </Card>
  );
}
