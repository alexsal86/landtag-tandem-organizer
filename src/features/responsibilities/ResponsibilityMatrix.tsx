import {
  Plus,
  Settings2,
  Search,
  AlertCircle,
  CheckCircle2,
  Eye,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AreaAssignmentPicker,
  PersonAssignment,
  PersonMark,
} from "./AssignmentPicker";
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
import {
  responsibilityCoverage,
  matchesResponsibilityArea,
  referenceOf,
  type ResponsibilityArea,
} from "./suggest";

export function ResponsibilityMatrix() {
  const model = useResponsibilities();
  const { isAdmin } = useResolvedUserRole();
  const [params] = useSearchParams();
  const [selectedPerson, setSelectedPerson] = useState(
    params.get("employee") ?? "",
  );
  const [view, setView] = useState<"areas" | "people">("areas");
  const [query, setQuery] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(!!params.get("employee"));
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
  const columns: ResponsibilityArea[] = [
    ...data.topics
      .filter((t) => t.is_active)
      .map((t) => ({ id: t.id, name: t.label, kind: "topic" as const })),
    ...data.committees
      .filter((t) => t.is_active)
      .map((t) => ({ ...t, kind: "committee" as const })),
    ...data.regions
      .filter((t) => t.is_active)
      .map((t) => ({ ...t, kind: "region" as const })),
  ];
  const coverage = (area: ResponsibilityArea) =>
    responsibilityCoverage(area, data.responsibilities);
  const gaps = columns.filter((area) => coverage(area).state !== "covered");
  const unassigned = gaps.filter(
    (area) => coverage(area).state === "unassigned",
  );
  const visibleAreas = columns
    .filter(
      (area) =>
        (!onlyGaps || coverage(area).state !== "covered") &&
        matchesResponsibilityArea(
          area,
          query,
          data.responsibilities,
          data.people,
        ),
    )
    .sort(
      (a, b) =>
        Number(coverage(a).state === "covered") -
        Number(coverage(b).state === "covered"),
    );
  const openProfile = (id: string) => {
    setError("");
    setSelectedPerson(id);
    setProfileOpen(true);
  };
  const selectedRows = (id: string) =>
    data.responsibilities.filter((r) => r.user_id === id);
  const assignedTo = (area: ResponsibilityArea, level: string) =>
    data.people.filter((p) =>
      data.responsibilities.some(
        (r) =>
          r.user_id === p.id &&
          r.kind === area.kind &&
          referenceOf(r) === area.id &&
          r.level === level,
      ),
    );

  const visiblePeople = data.people.filter((p) => {
    const rows = selectedRows(p.id);
    const term = query.trim().toLocaleLowerCase("de");
    const matches =
      !term ||
      p.name.toLocaleLowerCase("de").includes(term) ||
      columns.some(
        (a) =>
          a.name.toLocaleLowerCase("de").includes(term) &&
          rows.some((r) => r.kind === a.kind && referenceOf(r) === a.id),
      );
    return (
      matches &&
      (!onlyGaps ||
        gaps.some((a) =>
          rows.some((r) => r.kind === a.kind && referenceOf(r) === a.id),
        ))
    );
  });
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
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      return false;
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Zuständigkeiten</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Primär = erste Ansprechpersonen · Sekundär = fachliche
            Unterstützung. Mehrere Primärpersonen pro Bereich sind möglich.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            onClick={() => {
              setError("");
              setCatalogOpen(true);
            }}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Katalog verwalten
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div
        className={
          gaps.length
            ? "flex flex-wrap items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4"
            : "flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
        }
        role="status"
      >
        {gaps.length ? (
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
        )}
        <div className="flex-1">
          <p className="font-medium">
            {!columns.length
              ? "Noch keine aktiven Bereiche vorhanden."
              : gaps.length
                ? `${gaps.length} von ${columns.length} Bereichen ohne Primärzuständigkeit.`
                : "Alle Bereiche haben Primärzuständige."}
          </p>
          {!!unassigned.length && (
            <p className="text-sm text-muted-foreground">
              Davon {unassigned.length} vollständig unbesetzt.
            </p>
          )}
        </div>
        {(gaps.length > 0 || onlyGaps) && (
          <Button
            variant="outline"
            size="sm"
            aria-pressed={onlyGaps}
            onClick={() => {
              setOnlyGaps(!onlyGaps);
              setView("areas");
            }}
          >
            {onlyGaps ? "Alle anzeigen" : "Nur Lücken zeigen"}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-lg border bg-card p-1"
          role="group"
          aria-label="Zuständigkeitsansicht"
        >
          <Button
            size="sm"
            variant={view === "areas" ? "default" : "ghost"}
            aria-pressed={view === "areas"}
            onClick={() => setView("areas")}
          >
            Nach Bereich
          </Button>
          <Button
            size="sm"
            variant={view === "people" ? "default" : "ghost"}
            aria-pressed={view === "people"}
            onClick={() => {
              setView("people");
              setOnlyGaps(false);
            }}
          >
            Nach Person
          </Button>
        </div>
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            aria-label="Bereich oder Person suchen"
            placeholder="Bereich oder Person suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {view === "areas" ? (
        <div className="space-y-4">
          {(
            [
              { kind: "topic", label: "Themen" },
              { kind: "committee", label: "Ausschüsse" },
              { kind: "region", label: "Regionen" },
            ] as const
          ).map((group) => {
            const areas = visibleAreas.filter(
              (area) => area.kind === group.kind,
            );
            if (!areas.length) return null;
            return (
              <details
                open
                key={group.kind}
                className="group overflow-hidden rounded-xl border bg-card"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 bg-primary/5 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold">
                    {group.label} ({areas.length})
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {
                      areas.filter((a) => coverage(a).state !== "covered")
                        .length
                    }{" "}
                    ohne Primärzuständige
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="hidden grid-cols-[1.1fr_1.4fr_1.4fr] gap-4 border-y px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Bereich</span>
                  <span>Primär</span>
                  <span>Sekundär</span>
                </div>
                <div className="divide-y">
                  {areas.map((area) => (
                    <div
                      key={area.id}
                      className="grid gap-3 px-4 py-4 md:grid-cols-[1.1fr_1.4fr_1.4fr]"
                    >
                      <div>
                        <h4 className="font-medium">{area.name}</h4>
                        {coverage(area).state !== "covered" && (
                          <p className="mt-1 text-xs text-destructive">
                            {coverage(area).state === "unassigned"
                              ? "Niemand zuständig"
                              : "Nur sekundär besetzt"}
                          </p>
                        )}
                      </div>
                      {(["primary", "secondary"] as const).map((level) => (
                        <div key={level}>
                          <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                            {level === "primary" ? "Primär" : "Sekundär"}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {assignedTo(area, level).map((p) => (
                              <PersonAssignment
                                key={p.id}
                                person={p}
                                area={area}
                                level={level}
                                canEdit={isAdmin}
                                busy={model.change.isPending}
                                onChange={edit}
                              />
                            ))}
                            {isAdmin ? (
                              <AreaAssignmentPicker
                                area={area}
                                level={level}
                                people={data.people}
                                rows={data.responsibilities}
                                busy={model.change.isPending}
                                onChange={edit}
                              />
                            ) : !assignedTo(area, level).length ? (
                              <span className="text-sm text-muted-foreground">
                                Nicht besetzt
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
          {!visibleAreas.length && (
            <p className="rounded-lg border p-6 text-center text-muted-foreground">
              Keine passenden Bereiche gefunden.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visiblePeople.map((p) => {
            const rows = selectedRows(p.id);
            const areas = columns.filter((a) =>
              rows.some((r) => r.kind === a.kind && referenceOf(r) === a.id),
            );
            return (
              <article key={p.id} className="rounded-xl border bg-card p-4">
                <header className="mb-4 flex items-start gap-3">
                  <PersonMark {...p} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {
                        areas.filter((a) =>
                          rows.some(
                            (r) =>
                              r.kind === a.kind &&
                              referenceOf(r) === a.id &&
                              r.level === "primary",
                          ),
                        ).length
                      }{" "}
                      primär ·{" "}
                      {
                        areas.filter((a) =>
                          rows.some(
                            (r) =>
                              r.kind === a.kind &&
                              referenceOf(r) === a.id &&
                              r.level === "secondary",
                          ),
                        ).length
                      }{" "}
                      sekundär
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`${p.name}: Profil ${isAdmin ? "bearbeiten" : "ansehen"}`}
                    onClick={() => openProfile(p.id)}
                  >
                    {isAdmin ? (
                      <Plus className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </header>
                {(["primary", "secondary"] as const).map((level) => (
                  <div className="mt-3" key={level}>
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {level === "primary" ? "Primär" : "Sekundär"}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {areas
                        .filter((a) =>
                          rows.some(
                            (r) =>
                              r.kind === a.kind &&
                              referenceOf(r) === a.id &&
                              r.level === level,
                          ),
                        )
                        .map((a) => (
                          <PersonAssignment
                            key={`${a.kind}:${a.id}`}
                            person={p}
                            area={a}
                            level={level}
                            label={`${a.kind === "topic" ? "" : a.kind === "committee" ? "Ausschuss · " : "Region · "}${a.name}`}
                            canEdit={isAdmin}
                            busy={model.change.isPending}
                            onChange={edit}
                          />
                        ))}
                      {!areas.some((a) =>
                        rows.some(
                          (r) =>
                            r.kind === a.kind &&
                            referenceOf(r) === a.id &&
                            r.level === level,
                        ),
                      ) && (
                        <span className="text-sm text-muted-foreground">
                          Keine Bereiche
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {rows.some((r) => r.kind === "role_focus") && (
                  <div className="mt-4 border-t pt-3">
                    <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Rollenfokus
                    </h4>
                    <p className="text-sm">
                      {rows
                        .filter((r) => r.kind === "role_focus")
                        .map(referenceOf)
                        .join(" · ")}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
          {!visiblePeople.length && (
            <p className="col-span-full py-6 text-center text-muted-foreground">
              Keine passenden Mitarbeitenden gefunden.
            </p>
          )}
          <p className="col-span-full text-sm text-muted-foreground">
            Vollständig unbesetzte Bereiche lassen sich in „Nach Bereich“
            zuweisen.
          </p>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Sekundärzuständigkeit ist fachliche Unterstützung; die hinterlegte
        Abwesenheitsvertretung bleibt davon getrennt. Eine vorgeschlagene
        Ballübergabe bestätigen Sie weiterhin selbst.
      </p>
      <Dialog open={profileOpen && !!person} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Zuständigkeitsprofil{person ? ` · ${person.name}` : ""}
            </DialogTitle>
            <DialogDescription>
              Themen, Ausschüsse, Regionen und Rollenfokus{" "}
              {isAdmin ? "bearbeiten" : "ansehen"}.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
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
                      .filter(
                        (r) => r.user_id === person.id && r.kind === "topic",
                      )
                      .map(referenceOf)}
                    onTopicsChange={(ids) => {
                      const previous = data.responsibilities
                        .filter(
                          (r) => r.user_id === person.id && r.kind === "topic",
                        )
                        .map(referenceOf);
                      void (async () => {
                        for (const id of ids.filter(
                          (id) => !previous.includes(id),
                        ))
                          await edit(person.id, "topic", id, "secondary");
                        for (const id of previous.filter(
                          (id) => !ids.includes(id),
                        ))
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
                        {r?.level === "primary"
                          ? "Primär"
                          : r
                            ? "Sekundär"
                            : "—"}
                      </span>
                    )}
                  </div>
                );
              })}
              {data.responsibilities
                .filter(
                  (r) => r.user_id === person.id && r.kind === "role_focus",
                )
                .map((r) => (
                  <div className="flex items-center gap-3" key={r.role_focus}>
                    {r.role_focus} (
                    {r.level === "primary" ? "Primär" : "Sekundär"})
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
                            void edit(
                              person.id,
                              "role_focus",
                              referenceOf(r),
                              null,
                            )
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
                      void edit(
                        person.id,
                        "role_focus",
                        focus.trim(),
                        "primary",
                      );
                      setFocus("");
                    }}
                  >
                    Hinzufügen
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {isAdmin && (
        <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Katalog verwalten</DialogTitle>
              <DialogDescription>
                Ausschüsse und Regionen anlegen oder zusammenführen.{" "}
                <a className="underline" href="/themen">
                  Themen verwalten
                </a>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {error && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
              <h3 className="font-semibold">Ausschüsse & Regionen</h3>
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
                Zusammenführen überträgt Zuständigkeiten zum Ziel; bei
                Doppelungen bleibt Primär erhalten. Der Quelleintrag wird
                aufgelöst.
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
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
