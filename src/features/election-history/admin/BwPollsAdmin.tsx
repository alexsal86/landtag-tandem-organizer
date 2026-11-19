import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { isRecord } from "@/utils/typeSafety";
import { useFullState } from "@/features/election-analysis/research/workspaceHooks";
import { officialStateParties } from "@/features/election-analysis/research/simulator/model";
import { useBwPolls } from "@/features/election-analysis/research/simulator/useBwPolls";
import {
  pollDate,
  pollPartyBasis,
  POLL_FEATURED_PARTIES,
  POLL_METHODS,
  type BwPoll,
} from "@/features/election-analysis/research/simulator/polls";

export function BwPollsAdmin() {
  const polls = useBwPolls(true);
  const state = useFullState(2026);
  const client = useQueryClient();
  const [editing, setEditing] = useState<BwPoll>();
  const [formVersion, setFormVersion] = useState(0);
  const saved = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id?: string;
      values: Omit<BwPoll, "id">;
    }) => {
      const { error } = await (id
        ? supabase
            .from("election_analysis_bw_polls")
            .update(values)
            .eq("id", id)
            .select("id")
            .single()
        : supabase.from("election_analysis_bw_polls").insert(values));
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setEditing(undefined);
      setFormVersion((version) => version + 1);
      await client.invalidateQueries({ queryKey: ["bw-polls"] });
    },
  });
  const [validation, setValidation] = useState("");
  const ids = state.data?.map((party) => party.party) ?? [
    ...POLL_FEATURED_PARTIES,
  ];
  const additional = ids.filter(
    (id) => !POLL_FEATURED_PARTIES.some((featured) => id === featured),
  );
  const storedShares = isRecord(editing?.shares) ? editing.shares : {};
  const formFields = [
    ["institute", "Institut", "text"],
    ["commissioner", "Auftraggeber", "text"],
    ["published_on", "Veröffentlichung", "date"],
    ["field_start", "Befragung von", "date"],
    ["field_end", "Befragung bis", "date"],
    ["respondents", "Befragte", "number"],
    ["source_url", "Quellenlink (HTTPS)", "url"],
  ] as const;
  const edit = (poll?: BwPoll) => {
    saved.reset();
    setValidation("");
    setEditing(poll);
    setFormVersion((version) => version + 1);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidation("");
    saved.reset();
    const form = new FormData(event.currentTarget);
    const read = (key: string) => String(form.get(key) ?? "").trim();
    try {
      const values: Omit<BwPoll, "id"> = {
        institute: read("institute"),
        commissioner: read("commissioner"),
        published_on: read("published_on"),
        field_start: read("field_start"),
        field_end: read("field_end"),
        respondents: Number(read("respondents")),
        method: read("method"),
        question_type: read("question_type"),
        source_url: read("source_url"),
        is_published: form.has("is_published"),
        shares: Object.fromEntries(
          ids
            .filter((id) => read(`share-${id}`) !== "")
            .map((id) => [id, Number(read(`share-${id}`))]),
        ),
        others: Number(read("others")),
      };
      if (
        values.field_start > values.field_end ||
        values.field_end > values.published_on
      )
        throw new Error(
          "Der Befragungszeitraum muss spätestens am Veröffentlichungstag enden.",
        );
      if (new URL(values.source_url).protocol !== "https:")
        throw new Error("Bitte einen HTTPS-Quellenlink angeben.");
      pollPartyBasis(officialStateParties(state.data ?? []), 5375109, {
        ...values,
        id: editing?.id ?? "",
      });
      saved.mutate({ id: editing?.id, values });
    } catch (error) {
      setValidation(
        error instanceof Error ? error.message : "Die Eingaben sind ungültig.",
      );
    }
  };
  const shareField = (id: string, required: boolean) => (
    <label key={id} className="space-y-1 text-sm">
      <span>{id} (%)</span>
      <Input
        type="number"
        min={0}
        max={100}
        step="0.01"
        required={required}
        name={`share-${id}`}
        defaultValue={
          typeof storedShares[id] === "number" ? storedShares[id] : ""
        }
      />
    </label>
  );
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">
          Landestrends Baden-Württemberg
        </h3>
        <a
          href="https://www.wahlrecht.de/umfragen/landtage/baden-wuerttemberg.htm"
          target="_blank"
          rel="noreferrer"
          className="text-sm underline"
        >
          Umfrageübersicht auf Wahlrecht.de
        </a>
      </div>
      <form
        key={formVersion}
        onSubmit={submit}
        className="space-y-4 rounded-lg border bg-card p-4"
      >
        <fieldset disabled={saved.isPending} className="space-y-4">
          <legend className="font-medium">
            {editing ? "Umfrage bearbeiten" : "Umfrage erfassen"}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {formFields.map(([key, label, type]) => (
              <label key={key} className="space-y-1 text-sm">
                <span>{label}</span>
                <Input
                  name={key}
                  type={type}
                  required={key !== "commissioner"}
                  min={key === "respondents" ? 1 : undefined}
                  defaultValue={editing?.[key] ?? ""}
                />
              </label>
            ))}
            <label className="space-y-1 text-sm">
              <span>Erhebungsmethode</span>
              <select
                name="method"
                defaultValue={editing?.method ?? "Nicht angegeben"}
                className="h-10 w-full rounded-md border bg-background px-2"
              >
                {POLL_METHODS.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Art der Umfrage</span>
              <select
                name="question_type"
                defaultValue={editing?.question_type ?? "Sonntagsfrage"}
                className="h-10 w-full rounded-md border bg-background px-2"
              >
                <option>Sonntagsfrage</option>
                <option>Projektion</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {POLL_FEATURED_PARTIES.map((id) => shareField(id, true))}
            <label className="space-y-1 text-sm">
              <span>Sonstige (%)</span>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                name="others"
                required
                defaultValue={editing?.others ?? ""}
              />
            </label>
          </div>
          {!!additional.length && (
            <details open={additional.some((id) => id in storedShares)}>
              <summary className="cursor-pointer text-sm">
                Weitere einzeln ausgewiesene Parteien
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {additional.map((id) => shareField(id, false))}
              </div>
            </details>
          )}
          <p className="text-sm text-muted-foreground">
            Einzelwerte und „Sonstige“ müssen zusammen 100 % ergeben. Weitere
            Parteien nur eintragen, wenn sie in der Quelle separat ausgewiesen
            sind.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked={editing?.is_published ?? false}
            />
            Im Simulator veröffentlichen
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={!state.data}>
              Speichern
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={() => edit()}>
                Abbrechen
              </Button>
            )}
          </div>
        </fieldset>
        {(validation || saved.error || state.error) && (
          <p role="alert" className="text-sm text-destructive">
            {validation || saved.error?.message || state.error?.message}
          </p>
        )}
        {saved.isSuccess && (
          <p role="status" className="text-sm">
            Umfrage gespeichert.
          </p>
        )}
      </form>
      {polls.isPending && <p role="status">Umfragen werden geladen …</p>}
      {polls.error && (
        <p role="alert">Umfragen können derzeit nicht geladen werden.</p>
      )}
      {polls.data?.map((poll) => (
        <article
          key={poll.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
        >
          <div>
            <p className="font-medium">
              {poll.institute} · {pollDate(poll.published_on)}
            </p>
            <p className="text-sm text-muted-foreground">
              {poll.question_type} · {poll.method} ·{" "}
              {poll.respondents.toLocaleString("de-DE")} Befragte ·{" "}
              {poll.is_published ? "Veröffentlicht" : "Entwurf"}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => edit(poll)}>
            Bearbeiten
          </Button>
        </article>
      ))}
    </section>
  );
}
