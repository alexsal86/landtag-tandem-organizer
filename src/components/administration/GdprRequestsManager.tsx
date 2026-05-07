import type { JSX } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Shield, Plus, Download, Play, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { notify } from "@/lib/notify";

type GdprRequest = {
  id: string;
  tenant_id: string;
  request_type: "export" | "delete";
  status: "pending" | "approved" | "processing" | "completed" | "rejected" | "failed";
  subject_contact_id: string | null;
  subject_email: string | null;
  subject_name: string | null;
  reason: string | null;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  processed_at: string | null;
  result_storage_path: string | null;
  error_message: string | null;
  created_at: string;
};

const statusVariant = (s: GdprRequest["status"]) => {
  if (s === "completed") return "default";
  if (s === "failed" || s === "rejected") return "destructive";
  if (s === "processing" || s === "approved") return "secondary";
  return "outline";
};

export function GdprRequestsManager(): JSX.Element {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    request_type: "export" as "export" | "delete",
    subject_email: "",
    subject_name: "",
    subject_contact_id: "",
    reason: "",
  });

  const requestsQuery = useQuery({
    queryKey: ["gdpr_requests", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from("gdpr_requests")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as GdprRequest[];
    },
    enabled: !!currentTenant?.id,
    staleTime: 30_000,
  });

  const createRequest = async () => {
    if (!currentTenant?.id || !user) return;
    if (!form.subject_email && !form.subject_contact_id) {
      notify.error("Bitte E-Mail oder Kontakt-ID angeben");
      return;
    }
    const { error } = await supabase.from("gdpr_requests").insert({
      tenant_id: currentTenant.id,
      request_type: form.request_type,
      subject_email: form.subject_email || null,
      subject_name: form.subject_name || null,
      subject_contact_id: form.subject_contact_id || null,
      reason: form.reason || null,
      requested_by: user.id,
    });
    if (error) {
      notify.error("Fehler", { description: error.message
});
      return;
    }
    notify.success("Anfrage erstellt");
    setOpen(false);
    setForm({ request_type: "export", subject_email: "", subject_name: "", subject_contact_id: "", reason: "" });
    void requestsQuery.refetch();
  };

  const approveDelete = async (req: GdprRequest) => {
    if (!user) return;
    if (req.requested_by === user.id) {
      notify.error("Vier-Augen-Prinzip", { description: "Genehmigung erfordert zweiten Admin."
});
      return;
    }
    const { error } = await supabase
      .from("gdpr_requests")
      .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", req.id);
    if (error) {
      notify.error("Fehler", { description: error.message
});
      return;
    }
    notify.success("Freigegeben");
    void requestsQuery.refetch();
  };

  const runRequest = async (req: GdprRequest) => {
    const { error } = await supabase.functions.invoke("gdpr-process", {
      body: { request_id: req.id },
    });
    if (error) {
      notify.error("Fehler", { description: error.message
});
      return;
    }
    notify.success("Verarbeitung abgeschlossen");
    void requestsQuery.refetch();
  };

  const downloadExport = async (req: GdprRequest) => {
    if (!req.result_storage_path) return;
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(req.result_storage_path, 3600);
    if (error || !data) {
      notify.error("Download nicht möglich", { description: error?.message
});
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" /> DSGVO-Anfragen
          </h2>
          <p className="text-body text-muted-foreground">
            Auskunfts- und Löschanfragen verwalten. Löschungen erfordern Vier-Augen-Prinzip.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Neue Anfrage</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>DSGVO-Anfrage erstellen</DialogTitle>
              <DialogDescription>
                Auskunft (Export als ZIP) oder Löschung (Anonymisierung).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Typ</Label>
                <Select
                  value={form.request_type}
                  onValueChange={(v) => setForm({ ...form, request_type: v as "export" | "delete" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="export">Auskunft (Export)</SelectItem>
                    <SelectItem value="delete">Löschung (Anonymisierung)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>E-Mail der betroffenen Person</Label>
                <Input
                  value={form.subject_email}
                  onChange={(e) => setForm({ ...form, subject_email: e.target.value })}
                  placeholder="person@example.com"
                />
              </div>
              <div>
                <Label>Name (optional)</Label>
                <Input
                  value={form.subject_name}
                  onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Kontakt-ID (optional, präziser)</Label>
                <Input
                  value={form.subject_contact_id}
                  onChange={(e) => setForm({ ...form, subject_contact_id: e.target.value })}
                  placeholder="UUID"
                />
              </div>
              <div>
                <Label>Begründung</Label>
                <Textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createRequest}>Anlegen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Anfragen</CardTitle>
          <CardDescription>Letzte 100 Anfragen Ihres Tenants.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Betroffen</TableHead>
                <TableHead>Begründung</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(requestsQuery.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-caption">
                    {format(parseISO(r.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.request_type === "delete" ? "destructive" : "secondary"}>
                      {r.request_type === "delete" ? "Löschung" : "Auskunft"}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell className="text-caption">
                    {r.subject_name || r.subject_email || r.subject_contact_id?.slice(0, 8) || "—"}
                  </TableCell>
                  <TableCell className="text-caption max-w-xs truncate">{r.reason ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.request_type === "delete" && r.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => approveDelete(r)}>
                        <Check className="mr-1 h-3 w-3" /> Freigeben
                      </Button>
                    )}
                    {((r.request_type === "export" && r.status === "pending") || r.status === "approved") && (
                      <Button size="sm" onClick={() => runRequest(r)}>
                        <Play className="mr-1 h-3 w-3" /> Ausführen
                      </Button>
                    )}
                    {r.request_type === "export" && r.status === "completed" && r.result_storage_path && (
                      <Button size="sm" variant="outline" onClick={() => downloadExport(r)}>
                        <Download className="mr-1 h-3 w-3" /> ZIP
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(requestsQuery.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Keine Anfragen.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
