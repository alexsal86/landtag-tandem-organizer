

# Fix: 5 Code-Quality-Probleme (Codex-Audit)

## 1. State-Mutation in Contact-Import

**Datei:** `src/components/contact-import/hooks/useContactImport.ts` Zeile 159

`existingContacts.push(...)` mutiert den React-State direkt. Fix: durch `setExistingContacts(prev => [...prev, newEntry])` ersetzen.

## 2. Non-null Assertions absichern

**Datei:** `useContactImport.ts` Zeilen 40, 150, 158

`user!.id` und `currentTenant!.id` in async-Logik durch Early-Return-Guards ersetzen:
```ts
if (!user || !currentTenant) return;
```
Gleiches Muster in den ~25 betroffenen Dateien (GlobalSearchCommand, EditContact, DistributionListForm, etc.) — bei allen async-Funktionen Guards hinzufügen statt `!`-Assertions.

## 3. Leere catch-Blöcke mit minimalem Logging versehen

Zwei Kategorien:
- **Unkritisch (localStorage, cleanup):** `catch {}` bei `localStorage.setItem` oder `indexedDB.deleteDatabase` ist akzeptabel — hier `catch { /* best-effort */ }` Kommentar hinzufügen für Klarheit.
- **Kritisch (Matrix-Context, DaySlip DB-Ops):** Leere `catch {}` bei DB-Operationen oder Crypto-Recovery durch `catch (e) { debugConsole.warn(...) }` ersetzen. Betrifft ~8 Stellen in `MatrixClientContext.tsx` und ~3 in `useDaySlipStore.ts`.

## 4. JSON-Protocol-Parser: Speaker-Typ-Inkonsistenz

**Datei:** `src/utils/jsonProtocolParser.ts`

- Interface `JSONProtocolStructure.speeches[].speaker` ist `string`, aber `validateJSONProtocol` akzeptiert auch `{ name: string }` Objekte (Zeile 116)
- `parseJSONProtocol` schreibt `speech.speaker` direkt in `speaker_name` ohne Normalisierung

**Fix:** Speaker-Normalisierung in `parseJSONProtocol`:
```ts
speaker_name: typeof speech.speaker === 'object' ? speech.speaker.name : speech.speaker,
```
Plus Interface anpassen: `speaker: string | { name: string; ... }`

## 5. `no-explicit-any` bleibt bewusst `off`

Dies ist eine bewusste Entscheidung — bei ~200+ Dateien mit `any` wäre ein sofortiges Aktivieren kontraproduktiv. Stattdessen: schrittweise Typisierung in kritischen Modulen (bereits begonnen im Letter-Modul). Kein Handlungsbedarf in diesem Batch.

---

## Umfang

| Bereich | Dateien | Aufwand |
|---------|---------|---------|
| State-Mutation fix | 1 | Klein |
| Non-null Guards | ~25 | Mittel |
| Leere catches loggen | ~10 | Klein |
| Speaker-Typ normalisieren | 1 | Klein |

