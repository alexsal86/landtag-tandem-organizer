import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Undo2, XCircle } from "lucide-react";

export function getLeaveTypeBadge(type: string) {
  switch (type) {
    case "vacation":
      return <Badge className="bg-palette-blue/20 text-palette-blue border-palette-blue/30">🏖️ Urlaub</Badge>;
    case "sick":
      return <Badge className="bg-palette-orange/20 text-palette-orange border-palette-orange/30">🤒 Krank</Badge>;
    case "medical":
      return <Badge className="bg-palette-purple/20 text-palette-purple border-palette-purple/30">🏥 Arzttermin</Badge>;
    case "overtime_reduction":
      return <Badge className="bg-palette-amber/20 text-palette-amber border-palette-amber/30">⏰ Überstundenabbau</Badge>;
    default:
      return <Badge variant="outline">Sonstiges</Badge>;
  }
}

export function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-palette-green/20 text-palette-green">
          <CheckCircle className="h-3 w-3 mr-1" /> Genehmigt
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-palette-red/20 text-palette-red">
          <XCircle className="h-3 w-3 mr-1" /> Abgelehnt
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-palette-yellow/20 text-palette-yellow">
          <AlertCircle className="h-3 w-3 mr-1" /> Offen
        </Badge>
      );
    case "cancel_requested":
      return (
        <Badge className="bg-palette-orange/20 text-palette-orange">
          <Undo2 className="h-3 w-3 mr-1" /> Stornierung
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
