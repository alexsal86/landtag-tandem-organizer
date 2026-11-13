import { useTopicCatalogLinks } from "./useTopicCatalogLinks";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft } from "lucide-react";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
export function TopicConversionButton({
  topic,
  onConverted,
}: {
  topic: { id: string; label: string };
  onConverted: () => void | Promise<void>;
}) {
  const { isAdmin } = useResolvedUserRole();
  const links = useTopicCatalogLinks();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("committee");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const converted = links.data?.find((l) => l.topic_id === topic.id);
  if (converted)
    return (
      <Badge variant="secondary">
        Als {converted.kind === "committee" ? "Ausschuss" : "Region"} geführt
      </Badge>
    );
  if (!isAdmin) return null;
  const convert = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("convert_topic_to_catalog", {
        p_topic: topic.id,
        p_kind: kind === "committee" ? "committee" : "region",
        p_region_kind: kind === "committee" ? "gemeinde" : kind,
      });
      if (r.error) throw new Error(r.error.message);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["responsibilities"] }),
        cache.invalidateQueries({ queryKey: ["topic-catalog-links"] }),
        Promise.resolve(onConverted()),
      ]);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Umwandlung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label={`${topic.label}: Als Ausschuss oder Region führen`}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <ArrowRightLeft className="mr-2 h-4 w-4" />
        Bereichstyp ändern
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>„{topic.label}“ als Bereich führen</DialogTitle>
            <DialogDescription>
              Die Mitarbeiterzuständigkeiten werden übernommen. Das bisherige
              Thema bleibt mit allen Verknüpfungen erhalten, wird aber nicht
              mehr als aktives Thema angeboten. Der neue Bereich erscheint
              unmittelbar unter Zuständigkeiten.
            </DialogDescription>
          </DialogHeader>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger aria-label="Neuer Bereichstyp">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="committee">Ausschuss</SelectItem>
              <SelectItem value="stadtteil">Region · Stadtteil</SelectItem>
              <SelectItem value="gemeinde">Region · Gemeinde</SelectItem>
            </SelectContent>
          </Select>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button disabled={busy} onClick={() => void convert()}>
              {busy ? "Wird übernommen …" : "Zuständigkeiten übernehmen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
