# Type-Migration-Regeln

Dieses Dokument bündelt das kleine Type-Hardening-Paket für die anstehende breitere Strict-TypeScript-Migration. Es ergänzt das bestehende Error-Handling in `src/utils/errorHandler.ts` um schlanke Guards, Helper-Typen und Normalisierer in `src/utils/typeSafety.ts`.

## Häufigste Fehlermuster aus den vorhandenen `typecheck:*`-Scripts

Die aktuelle Fehlerlage aus den vorhandenen `typecheck:*`-Scripts zeigt vor allem wiederkehrende Strictness-Probleme:

- **Implizite `any`-Parameter (`TS7006`)** bei Callback-Argumenten wie `event`, `session`, `open`, `group`, `cmd` oder `ref`.
- **Implizite `any`-Destrukturierung (`TS7031`)** bei Props wie `className`, `variant` oder `session`.
- **Null-/Undefined-Zugriffe** in Hooks und Async-Flows, die später unter `strictNullChecks`/`noUncheckedIndexedAccess` aufbrechen.
- **Unscharfe Supabase-Antworten** (`data`/`error` werden zu spät oder gar nicht typisiert bzw. normalisiert).
- **Untypisierte Event-Handler** in React-Komponenten, typischerweise `e`, `event`, `open` oder Inline-Callbacks.

> Hinweis: Ein Teil der momentanen Compiler-Ausgabe besteht zusätzlich aus Infrastrukturfehlern wie fehlend aufgelösten React-Modulen (`TS2307`, `TS2875`). Für die Migrationsregeln relevant sind hier die wiederkehrenden Typmuster innerhalb der Anwendung.

## Gemeinsame Utilities

Verwende bevorzugt die zentralen Helfer aus `src/utils/typeSafety.ts`:

- `isRecord`, `hasOwnProperty`, `hasStringProperty`: Guards für `unknown`-Eingaben statt direkter Objekt-Casts.
- `isPresent`, `assertPresent`: Guards für `null`-/`undefined`-lastige States und Props.
- `toArray`: Normalisiert Einzelwert/Array/`null` zu einem sauberen Array.
- `invokeCallback`: Entfernt optionales Callback-Branching am Aufrufort.
- `normalizeSupabaseResult`, `requireSupabaseData`: Typisierte und früh normalisierte Verarbeitung von Supabase-Responses.
- `HookResult`, `HookTuple`, `createHookResult`, `createHookTuple`: Explizite Hook-Rückgaben statt impliziter/ad-hoc Rückgabeformen.

## Verbindliche Migrationsregeln

### 1. `unknown` statt `any`

- Neue API-, Event-, Parser- und Error-Eingaben werden als `unknown` angenommen.
- Ein Narrowing erfolgt ausschließlich über Guards (`isRecord`, `hasOwnProperty`, `instanceof`, diskriminierte Unions).
- `any` ist nur in klar abgegrenzten Interop-Randfällen erlaubt und muss kommentiert werden.

### 2. Keine stillen Non-Null-Assertions ohne Guard

- Kein `value!`, solange nicht direkt davor eine Absicherung stattfindet.
- Bevorzugt `assertPresent(value, '...')` oder eine explizite Guard-Klausel.
- `null`-lastige Hook-States bleiben im Typ sichtbar, bis sie aktiv normalisiert wurden.

### 3. Hook-Rückgaben explizit typisieren

- Jeder neue Hook exportiert ein benanntes Interface oder ein klar typisiertes Tuple.
- Bevorzugte Formen:
  - Objektform mit `HookResult<TData, TError>` oder projektspezifischem Interface.
  - Tuple-Form mit `HookTuple<TData, TError>` nur bei stabiler Positionssemantik.
- Keine untypisierten Mischrückgaben wie `return { data, loading, extra }` ohne expliziten Rückgabetyp.

### 4. Supabase-Responses sofort typisiert und normalisiert verarbeiten

- Direkt nach dem Query die Rückgabe normalisieren, nicht erst tief im Render-/Hook-Code.
- Beispielablauf:
  1. Query ausführen.
  2. Antwort typisiert entgegennehmen.
  3. Mit `normalizeSupabaseResult()` oder `requireSupabaseData()` weiterverarbeiten.
  4. Erst dann State setzen oder Domänenlogik aufrufen.
- `error` wird nicht als truthy/falsy Nebenbedingung „mitgeschleppt“, sondern unmittelbar in eine stabile Form überführt.

### 5. Optionale Callback-Parameter zentral behandeln

- Optionalen Funktionen keine impliziten `any`-Parameter geben.
- Signaturen mit `OptionalCallback<[Arg1, Arg2]>` oder benannten Funktions-Typen definieren.
- Am Aufrufort bevorzugt `invokeCallback(callback, value)` statt wiederholter `if (callback)`-Blöcke.

### 6. Event-Handler immer konkret typisieren

- Keine untypisierten `e`-/`event`-Parameter.
- React-Handler werden als konkrete Handler-Typen oder über explizite Event-Typen deklariert, z. B. `React.ChangeEvent<HTMLInputElement>`.
- Inline-Handler bei komplexerer Logik in benannte Funktionen mit Rückgabetyp extrahieren.

### 7. Destrukturierte Props/Callback-Parameter brauchen vorab einen Typ

- Keine Destrukturierung aus untypisierten Parametern.
- Statt `({ className, variant }) => ...` immer zuerst Props-/Options-Typ definieren.
- Gleiches gilt für Supabase-Callbacks, Hook-Optionen und Renderer-Funktionen.

## Empfohlenes Migrationsvorgehen pro Datei

1. `any`- und untypisierte Callback-Stellen identifizieren.
2. Eingaben auf `unknown` oder konkrete Domänentypen umstellen.
3. `null`-/`undefined`-Pfad mit `isPresent`/`assertPresent` schließen.
4. Supabase-Resultate früh normalisieren.
5. Hook-Rückgaben explizit typisieren.
6. Erst danach feinere Domänen- und UI-Typen nachziehen.



## Verbindliche Interop-`any`-Governance (ab 2026-03-25)

1. **Klassifizierung aller verbleibenden `any`**
   - Jede Stelle wird als `entfernbar` oder `echte Interop-Grenze` geführt (siehe `report:any-usage:classify`).
2. **Interop-`any` nur in Adapterdateien**
   - Erlaubte Boundary-Scope: `**/adapters/**`, `**/interop/**` oder dedizierte Adapter-Dateien.
   - In UI/Hooks (`src/components/**`, `src/pages/**`, `src/hooks/**`) sind explizite `any` grundsätzlich unzulässig.
3. **Ausnahmeformat ist verpflichtend**
   - Kommentar im lokalen Kontext: `any-exception <TICKET-ID>: <Kurzbegründung> due:YYYY-MM-DD wrapper:<typedWrapperFn>`.
4. **Typed Wrapper Pflicht pro Ausnahme**
   - Zu jeder Interop-Ausnahme gehört eine benannte Wrapper-Funktion, die die unscharfe Boundary in ein stabiles Domänen-Interface übersetzt.
5. **Ablösetermin pro Ausnahme**
   - Jede Ausnahme trägt einen konkreten Zieltermin (`due:YYYY-MM-DD`) und wird bei Erreichen aktiv aus dem Backlog entfernt oder neu geplant.

## Übergangsregel für `no-explicit-any`

- Global ist `@typescript-eslint/no-explicit-any` aktuell auf **`warn`** gesetzt, damit die Migration inkrementell erfolgen kann.
- Für spätere Verschärfung sind Datei-Scopes für `error` bereits im Lint-Setup vorbereitet, aber standardmäßig deaktiviert.
- Aktivierung erfolgt erst, wenn Any-Delta, CI-Stabilität und Team-Kapazität für den jeweiligen Scope dokumentiert sind.

## Abschlusskriterium für `any`

- Zielbild: **keine unbegründeten `any`** im produktiven Scope.
- Zulässig sind ausschließlich dokumentierte Interop-Ausnahmen mit Inline-Marker `INTEROP-ANY: <Grund> | <Ticket> | <Sunset-Termin>`.
- Jeder PR muss ein Pflichtfeld **„Any-Delta vorher/nachher“** ausfüllen (Base, Head, Delta).
- Nach jedem Merge wird die Baseline neu gemessen (`report:any-usage:total`, `report:any-usage:clusters`, `report:any-usage:files`) und in `docs/strict-progress.md` nachgeführt.
