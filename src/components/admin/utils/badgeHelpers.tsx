import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Undo2, XCircle } from "lucide-react";

export function getLeaveTypeBadge(type: string) {
  switch (type) {
    case "vacation":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">🏖️ Urlaub</Badge>;
    case "sick":
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">🤒 Krank</Badge>;
    case "medical":
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200">🏥 Arzttermin</Badge>;
    case "overtime_reduction":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">⏰ Überstundenabbau</Badge>;
    default:
      return <Badge variant="outline">Sonstiges</Badge>;
  }
}

export function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" /> Genehmigt
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800">
          <XCircle className="h-3 w-3 mr-1" /> Abgelehnt
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <AlertCircle className="h-3 w-3 mr-1" /> Offen
        </Badge>
      );
    case "cancel_requested":
      return (
        <Badge className="bg-orange-100 text-orange-800">
          <Undo2 className="h-3 w-3 mr-1" /> Stornierung
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
