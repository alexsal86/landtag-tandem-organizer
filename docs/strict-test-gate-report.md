# Strict-Test-Gate-Report für Welle 1 / Welle 2

Stand: 2026-03-18

## Gate-Kriterien

Vor einer Strict-Aktivierung gilt ein Modul in diesem Report nur dann als **freigegeben**, wenn die folgenden Punkte aus den bestehenden Richtlinien mindestens erfüllt sind:

- `docs/architecture-guidelines.md`: mindestens ein Happy-Path- und ein Negativtest; Supabase wird bei Datenzugriff gemockt.
- `docs/ci-quality-gates.md`: die priorisierten Kernflows bleiben pro Modul in den dokumentierten Positiv- und Negativpfaden sichtbar.

## Welle 1 – priorisierte Hooks

| Modul | Happy Path | Negativpfad | Supabase-Mock bei Datenzugriff | Strict-Migration blockieren? | Begründung |
|---|---|---|---|---|---|
| `src/hooks/useAuth.tsx` | Ja | Ja | Ja | Nein | Dedizierte Hook-Tests decken Session-Wiederherstellung, Sign-out, Auth-State-Wechsel und Guard-Verhalten ab; damit ist der dokumentierte Flow „Auth / Tenant-Wechsel“ auf Hook-Ebene belastbar genug. |
| `src/hooks/useTenant.tsx` | Ja | Ja | Ja | Nein | Dedizierte Tests decken leeren User-Kontext, erfolgreiche Tenant-Auflösung, Storage-Persistenz, Legacy-Key-Bereinigung und Fehlerpfade ab; das passt zu den CI-Negativpfaden für fehlende Session/Tenant-Zuordnung. |
| `src/hooks/useNotifications.tsx` | Ja | Ja | Ja | Nein | Dedizierte Hook-Tests sichern Laden, `markAllAsRead`, Optimistic Update und Rollback bei Persistenzfehlern ab; damit ist der priorisierte Read/Unread-Flow vor Strict-Aktivierung ausreichend abgesichert. |
| `src/hooks/useLetterArchiving.tsx` | Ja | Ja | Ja | Nein | Dedizierte Hook-Tests sichern PDF-/Dokument-Archivierung, Statuswechsel auf `sent` sowie den destruktiven Fehlerpfad bei fehlendem User/Tenant-Kontext ab. |

## Welle 2 – Services / Features im aktuellen Strict-Zuschnitt

| Modul | Happy Path | Negativpfad | Supabase-Mock bei Datenzugriff | Strict-Migration blockieren? | Begründung |
|---|---|---|---|---|---|
| `src/services/headerRenderer.ts` | Nein (kein dedizierter Test gefunden) | Nein (kein dedizierter Test gefunden) | Nicht relevant | Ja | Runtime-Logik mit Fallbacks, JSON-Parsing und Fetch-/PDF-Seitenwirkungen hat aktuell keine explizite Testbasis; vor weiterer Strict-Verschärfung sollten mindestens Rendering-Erfolg und Fallback bei Fehlern abgesichert werden. |
| `src/features/matrix-widget/api.ts` | Nein (kein dedizierter Test gefunden) | Nein (kein dedizierter Test gefunden) | Nein | Ja | Der Service kapselt Edge-Function-Aufrufe und Supabase-Queries, aber es existiert keine direkte Testabdeckung für erfolgreiche Invokes/Selects oder Fehlerwürfe; die Typmigration sollte deshalb bis zu dedizierten API-Tests blockiert bleiben. |
| `src/features/matrix-widget/types.ts` | Nicht erforderlich | Nicht erforderlich | Nicht relevant | Nein | Reine Typdefinitionen ohne Laufzeitlogik; ein Blocker für Strict-Aktivierung ergibt sich hier nicht aus fehlenden Laufzeittests. |

## Hinweise für die nächste Freigaberunde

1. **Welle 1 kann für die priorisierten Hooks weiterlaufen**, weil die in `docs/ci-quality-gates.md` priorisierten Flows jetzt mit Happy-Path- und Negativtests auf Hook-Ebene sichtbar sind.
2. **Welle 2 sollte für `headerRenderer.ts` und `matrix-widget/api.ts` vorerst blockiert bleiben**, bis dedizierte Unit-Tests die Erfolgs- und Fehlerpfade absichern.
3. **Supabase-Mocks bleiben Pflicht**, sobald Datenzugriff stattfindet; neue Tests in Welle 2 sollten daher keine echten Client-Aufrufe verwenden.
