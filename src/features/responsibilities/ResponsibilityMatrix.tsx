import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopicSelector } from "@/components/topics/TopicSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResponsibilities } from "./useResponsibilities";
import { findCoverageGaps, referenceOf } from "./suggest";

export function ResponsibilityMatrix() {
  const model = useResponsibilities();
  const { isAdmin } = useResolvedUserRole();
  const [params] = useSearchParams();
  const [selectedPerson, setSelectedPerson] = useState(
    params.get("employee") ?? "",
  );
  const [catalogKind, setCatalogKind] = useState("committee");
  const [name, setName] = useState("");
  const [regionKind, setRegionKind] = useState("gemeinde");
  const [district, setDistrict] = useState("none");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [focus, setFocus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const districts = useQuery({
    queryKey: ["responsibility-election-districts"],
    enabled: isAdmin,
    queryFn: async () => {
      const r = await supabase
        .from("election_districts")
        .select("id,district_name")
        .order("district_name");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  if (model.isLoading) return <p>Lade Zuständigkeiten …</p>;
  if (model.error || !model.data)
    return (
      <p role="alert">
        Zuständigkeiten konnten nicht geladen werden. {model.error?.message}
      </p>
    );
  const data = model.data;
  const columns = [
    ...data.topics
      .filter((t) => t.is_active)
      .map((t) => ({ id: t.id, name: t.label, kind: "topic" })),
    ...data.committees
      .filter((t) => t.is_active)
      .map((t) => ({ ...t, kind: "committee" })),
    ...data.regions
      .filter((t) => t.is_active)
      .map((t) => ({ ...t, kind: "region" })),
  ];
  const gaps = findCoverageGaps(data, data.responsibilities);
  const person = data.people.find((p) => p.id === selectedPerson);
  const edit = async (
    userId: string,
    kind: string,
    reference: string,
    level: string | null,
  ) => {
    try {
      setError("");
      await model.change.mutateAsync({ userId, kind, reference, level });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };
  const catalogItems =
    catalogKind === "committee" ? data.committees : data.regions;
  const catalogAction = async (merge: boolean) => {
    if (!model.tenantId) return;
    setBusy(true);
    setError("");
    try {
      const result = merge
        ? await supabase.rpc("merge_responsibility_catalog", {
            p_tenant: model.tenantId,
            p_kind: catalogKind,
            p_source: source,
            p_target: target,
          })
        : await supabase.rpc("save_responsibility_catalog", {
            p_tenant: model.tenantId,
            p_kind: catalogKind,
            p_name: name,
            p_region_kind: regionKind,
            ...(district !== "none" ? { p_election_district: district } : {}),
          });
      if (result.error) throw result.error;
      setName("");
      setSource("");
      setTarget("");
      await model.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Katalog konnte nicht gespeichert werden.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4 p-4">
      <h2 className="text-xl font-semibold">Zuständigkeiten & Matrix</h2>
      <p className="text-sm text-muted-foreground">
        P = Primär · S = Sekundär · — = nicht zuständig. Zuständigkeiten
        schlagen Personen vor; die Übergabe bestätigen Sie selbst.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <p className={gaps.length ? "text-destructive" : ""}>
        {gaps.length
          ? `Lücken: ${gaps.map((g) => g.name).join(", ")}`
          : "Alle aktiven Bereiche sind abgedeckt."}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Personen und Zuständigkeiten</caption>
          <thead>
            <tr>
              <th className="p-2 text-left">Person</th>
              {columns.map((c) => (
                <th className="p-2" key={`${c.kind}:${c.id}`}>
                  <span className="block text-xs text-muted-foreground">
                    {c.kind === "topic"
                      ? "Thema"
                      : c.kind === "committee"
                        ? "Ausschuss"
                        : "Region"}
                  </span>
                  <span
                    className={
                      gaps.some((g) => g.kind === c.kind && g.id === c.id)
                        ? "text-destructive"
                        : ""
                    }
                  >
                    {c.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.people.map((p) => (
              <tr key={p.id}>
                <th className="p-2 text-left">
                  <Button
                    variant="link"
                    onClick={() => setSelectedPerson(p.id)}
                  >
                    {p.name}
                  </Button>
                </th>
                {columns.map((c) => {
                  const r = data.responsibilities.find(
                    (r) =>
                      r.user_id === p.id &&
                      r.kind === c.kind &&
                      referenceOf(r) === c.id,
                  );
                  return (
                    <td className="p-2 text-center" key={`${c.kind}:${c.id}`}>
                      {r?.level === "primary" ? (
                        <strong>P</strong>
                      ) : r ? (
                        "S"
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Label>Zuständigkeitsprofil</Label>
      <Select value={selectedPerson} onValueChange={setSelectedPerson}>
        <SelectTrigger>
          <SelectValue placeholder="Person auswählen" />
        </SelectTrigger>
        <SelectContent>
          {data.people.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {person && (
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="font-semibold">{person.name}</h3>
          {isAdmin && (
            <>
              <Label>Themen hinzufügen (zunächst Sekundär)</Label>
              <TopicSelector
                selectedTopicIds={data.responsibilities
                  .filter((r) => r.user_id === person.id && r.kind === "topic")
                  .map(referenceOf)}
                onTopicsChange={(ids) => {
                  const previous = data.responsibilities
                    .filter(
                      (r) => r.user_id === person.id && r.kind === "topic",
                    )
                    .map(referenceOf);
                  void (async () => {
                    for (const id of ids.filter((id) => !previous.includes(id)))
                      await edit(person.id, "topic", id, "secondary");
                    for (const id of previous.filter((id) => !ids.includes(id)))
                      await edit(person.id, "topic", id, null);
                  })();
                }}
              />
            </>
          )}
          {columns.map((c) => {
            const r = data.responsibilities.find(
              (r) =>
                r.user_id === person.id &&
                r.kind === c.kind &&
                referenceOf(r) === c.id,
            );
            return (
              <div
                className="flex items-center justify-between gap-3"
                key={`${c.kind}:${c.id}`}
              >
                <span>{c.name}</span>
                {isAdmin ? (
                  <Select
                    disabled={model.change.isPending}
                    value={r?.level ?? "none"}
                    onValueChange={(v) =>
                      void edit(
                        person.id,
                        c.kind,
                        c.id,
                        v === "none" ? null : v,
                      )
                    }
                  >
                    <SelectTrigger
                      className="w-40"
                      aria-label={`${c.name}: Zuständigkeit`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zuständig</SelectItem>
                      <SelectItem value="primary">Primär</SelectItem>
                      <SelectItem value="secondary">Sekundär</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span>
                    {r?.level === "primary" ? "Primär" : r ? "Sekundär" : "—"}
                  </span>
                )}
              </div>
            );
          })}
          {data.responsibilities
            .filter((r) => r.user_id === person.id && r.kind === "role_focus")
            .map((r) => (
              <div className="flex items-center gap-3" key={r.role_focus}>
                {r.role_focus} ({r.level === "primary" ? "Primär" : "Sekundär"})
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      disabled={model.change.isPending}
                      onClick={() =>
                        void edit(
                          person.id,
                          "role_focus",
                          referenceOf(r),
                          r.level === "primary" ? "secondary" : "primary",
                        )
                      }
                    >
                      Stufe wechseln
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={model.change.isPending}
                      onClick={() =>
                        void edit(person.id, "role_focus", referenceOf(r), null)
                      }
                    >
                      Entfernen
                    </Button>
                  </>
                )}
              </div>
            ))}
          {isAdmin && (
            <div className="flex gap-2">
              <Input
                aria-label="Rollenfokus"
                placeholder="Rollenfokus"
                maxLength={120}
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
              <Button
                disabled={!focus.trim() || model.change.isPending}
                onClick={() => {
                  void edit(person.id, "role_focus", focus.trim(), "primary");
                  setFocus("");
                }}
              >
                Hinzufügen
              </Button>
            </div>
          )}
        </div>
      )}
      {isAdmin && (
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="font-semibold">Ausschüsse & Regionen verwalten</h3>
          <Select
            value={catalogKind}
            onValueChange={(v) => {
              setCatalogKind(v);
              setSource("");
              setTarget("");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="committee">Ausschüsse</SelectItem>
              <SelectItem value="region">Regionen</SelectItem>
            </SelectContent>
          </Select>
          <Input
            aria-label="Neuer Katalogeintrag"
            placeholder="Name"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {catalogKind === "region" && (
            <>
              <Select value={regionKind} onValueChange={setRegionKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stadtteil">Stadtteil</SelectItem>
                  <SelectItem value="gemeinde">Gemeinde</SelectItem>
                </SelectContent>
              </Select>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder="Wahlkreis verknüpfen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    Ohne Wahlkreisverknüpfung
                  </SelectItem>
                  {districts.data?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.district_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {districts.error && (
                <p role="alert">Wahlkreise konnten nicht geladen werden.</p>
              )}
            </>
          )}
          <Button
            disabled={busy || !name.trim()}
            onClick={() => void catalogAction(false)}
          >
            Anlegen
          </Button>
          <p className="text-sm text-muted-foreground">
            Zusammenführen überträgt Zuständigkeiten zum Ziel; bei Doppelungen
            bleibt Primär erhalten. Der Quelleintrag wird aufgelöst.
          </p>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue placeholder="Quelle" />
            </SelectTrigger>
            <SelectContent>
              {catalogItems.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue placeholder="Ziel" />
            </SelectTrigger>
            <SelectContent>
              {catalogItems
                .filter((c) => c.id !== source)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            disabled={busy || !source || !target || source === target}
            onClick={() => void catalogAction(true)}
          >
            Quelle mit Ziel zusammenführen
          </Button>
        </div>
      )}
    </section>
  );
}
