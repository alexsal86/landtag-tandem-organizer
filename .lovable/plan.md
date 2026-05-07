## Ziel

Strukturierte Fakten werden zu einer **wiederverwendbaren Bibliothek**, in jeder Vorbereitung als **Live-Referenz mit optionalem Override** einsetzbar. Pflege primär in einer eigenen Fakten-Tabelle, optional verknüpft mit einem Wissens-Dossier oder Kontakt.

## Datenmodell (neue Tabelle)

```sql
create table public.facts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  text text not null,
  source text,
  tags text[] default '{}',
  -- optionale Verknüpfungen
  dossier_id uuid references public.dossiers(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  -- Lifecycle
  is_archived boolean default false,
  valid_until date,           -- z. B. „Zahl gültig bis"
  usage_count int default 0,  -- wie oft schon eingebunden
  last_used_at timestamptz,
  created_by uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

RLS: tenant-basiert (analog zu `dossiers`). Indizes auf `tenant_id`, `dossier_id`, `contact_id`, GIN auf `tags` und Full-Text auf `text` für schnelle Suche.

`structured_facts` in `preparation_data` bleibt — aber jeder Eintrag bekommt zusätzlich:
```ts
type StructuredFact = {
  id: string;
  fact_id?: string;        // ← Referenz auf public.facts (NEU)
  text: string;            // bei fact_id leer = Live-Wert; gefüllt = lokaler Override
  source?: string;         // dito (Override-Quelle)
  link_type: 'general' | 'partner' | 'topic';
  link_id?: string;
};
```

Beim Rendern: ist `fact_id` gesetzt → Library-Wert anzeigen, sofern `text`/`source` leer; sonst lokaler Override mit dezentem „bearbeitet"-Badge und „Auf Original zurücksetzen"-Aktion.

## UI

**1. Neue Seite `/wissen/fakten`** (Eintrag in der bestehenden Wissen-Sidebar, neben Dossiers):
- Suchleiste (volltext + Tag-Filter)
- Tabelle: Text · Quelle · Tags · Dossier/Kontakt · zuletzt verwendet · Aktionen
- „+ Neuer Fakt" Inline-Editor
- Bulk-Aktionen: Tag setzen, archivieren

**2. In der Vorbereitung — Phase „Fakten":**
Aktueller `StructuredFactsPanel` bekommt einen zweiten Modus-Schalter `[Aus Bibliothek] [Eigener Fakt]`:
- **Aus Bibliothek**: Combobox mit Suche (Tags + Text), Vorschläge oben (Fakten aus verknüpftem Dossier oder zu einem der Gesprächspartner-Kontakte), per Klick übernommen → erzeugt Eintrag mit `fact_id`.
- **Eigener Fakt**: wie heute, freier Inline-Eintrag. Zusätzlicher Button „📚 In Bibliothek übernehmen" → legt Fact-Datensatz an und füllt `fact_id` nach.

Bestehende Zuordnung zu Partner/Thema und Filter-Chips bleiben unverändert.

**3. In Dossier-Detailansicht:**
Neue Karte „# FAKTEN (n)" zwischen den vorhandenen Sektionen — listet alle `facts.dossier_id = dossier.id`, inline-editierbar, „in aktueller Vorbereitung verwenden" wenn der Nutzer von einer Vorbereitung kommt (Deep-Link).

**4. In Kontakt-Detailansicht:**
Analoge Karte „Fakten zu diesem Kontakt".

## Hooks & Helpers

- `useFacts({ search, tags, dossierId, contactId })` — TanStack-Query mit `staleTime: 60s`.
- `useFactSuggestions(preparation)` — kombiniert Fakten mit `dossier_id` aus `LinkedItemsPanel`-Dossiers + Fakten zu allen Partner-`contact_id`.
- `useUpsertFact`, `useArchiveFact`, `useIncrementFactUsage` (RPC für `usage_count`/`last_used_at` atomar).

## Edge-Cases

- Wird ein Library-Fakt gelöscht/archiviert → in der Vorbereitung als „Quell-Fakt nicht mehr verfügbar" markiert, lokaler Cache-Text bleibt lesbar.
- Override entfernen → `text`/`source` aus `structured_facts` löschen, nur `fact_id` bleibt.
- Migration alter `structured_facts` ohne `fact_id` bleibt voll funktional (optionales Feld).

## Out of Scope

- Keine KI-Vorschläge zur Faktenextraktion (kann später an `generate-preparation-suggestions` Edge-Function angedockt werden).
- Kein Versionsverlauf (kann später analog `dossier_position_versions` ergänzt werden).
- Keine Druck-/PDF-Export-Anpassung.

## Risiko

Mittel — neue Tabelle plus RLS, plus zwei neue UI-Einstiegspunkte. Vorbereitungs-UI bleibt rückwärtskompatibel; Library-Funktion ist additiv.
