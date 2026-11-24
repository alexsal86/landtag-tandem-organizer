import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";
import {
  configDeleteFailure, parseConfigImpact, summarizeConfigImpact, unknownImpact, type ConfigImpact,
} from "./configImpact";

interface ConfigDeleteDialogProps {
  tableName: string;
  item: { id: string; label: string | null; is_active: boolean | null };
  entityName: string;
  deleteWarning?: string;
  onDeleted: (id: string) => Promise<void> | void;
  onDeactivate: (id: string) => Promise<void> | void;
}

/**
 * Löschbestätigung mit Folgenabschätzung: zählt vor dem Löschen, wie viele
 * Datensätze den Eintrag verwenden, und bietet das Deaktivieren als sichere
 * Alternative an. Gelöscht wird über delete_config_item, das erneut zählt und
 * die hier angezeigte Zahl als Bestätigung verlangt; ohne belastbare Auskunft
 * ist das Löschen gesperrt.
 */
export function ConfigDeleteDialog({
  tableName, item, entityName, deleteWarning, onDeleted, onDeactivate,
}: ConfigDeleteDialogProps) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<ConfigImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setImpact(null);
    setError(null);
    setDeleteError(null);
    void supabase.rpc("config_delete_impact", { _table: tableName, _id: item.id }).then(({ data, error: rpcError }) => {
      if (cancelled) return;
      if (rpcError) {
        setImpact(unknownImpact());
        setError(rpcError.message);
        return;
      }
      setImpact(parseConfigImpact(data));
    });
    return () => { cancelled = true; };
  }, [open, item.id, tableName, reloadKey]);

  const handleDeactivate = async () => {
    setBusy(true);
    try {
      await onDeactivate(item.id);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!impact?.known) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const { error: rpcError } = await supabase.rpc("delete_config_item", {
        _table: tableName,
        _id: item.id,
        _expected_refs: impact.total,
      });
      if (rpcError) {
        // Die Datenbank hat die Zahl erneut geprüft; eine Abweichung heißt: neu prüfen.
        setDeleteError(configDeleteFailure(rpcError.code, rpcError.message).message);
        return;
      }
      await onDeleted(item.id);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const assessed = impact?.known === true;
  const referenced = assessed && impact.total > 0;
  const cascadesTodos = referenced && impact.references.some((reference) => reference.key === "todos");

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 w-8 p-0">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{entityName} löschen</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteWarning || `Sind Sie sicher, dass Sie "${item.label ?? ""}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!impact && (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm text-muted-foreground">Verwendung wird geprüft …</p>
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {impact && error && (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
            <p className="font-medium">Die Verwendung konnte nicht geprüft werden.</p>
            <p className="text-muted-foreground">
              Löschen ist bis zur erfolgreichen Prüfung gesperrt. Der Eintrag kann stattdessen deaktiviert werden.
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              Erneut prüfen
            </Button>
          </div>
        )}

        {impact && !error && !assessed && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
            <p className="font-medium">Die Verwendung konnte nicht geprüft werden.</p>
            <p className="text-muted-foreground">
              Löschen ist bis zur erfolgreichen Prüfung gesperrt. Der Eintrag kann stattdessen deaktiviert werden.
            </p>
          </div>
        )}

        {impact && !error && assessed && (
          referenced ? (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" aria-live="polite">
              <p className="font-medium">{summarizeConfigImpact(impact)}</p>
              <ul className="list-disc pl-5">
                {impact.references.map((reference) => (
                  <li key={reference.key}>
                    {reference.count} × {reference.label}
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">
                Deaktivieren erhält die Zuordnung und blendet den Eintrag nur für neue Auswahlen aus.
              </p>
              {cascadesTodos && (
                <p className="text-destructive">ToDos dieser Kategorie werden beim Löschen mitgelöscht.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Keine Verwendung gefunden.
            </p>
          )
        )}

        {deleteError && (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
            <p className="font-medium">Nicht gelöscht.</p>
            <p className="text-muted-foreground">{deleteError}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              Erneut prüfen
            </Button>
          </div>
        )}

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
          {item.is_active !== false && (
            <Button type="button" variant="secondary" disabled={busy || !impact} onClick={() => void handleDeactivate()}>
              Nur deaktivieren
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            disabled={busy || !assessed || Boolean(deleteError)}
            onClick={() => void handleDelete()}
          >
            {referenced ? "Trotzdem löschen" : "Löschen"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
