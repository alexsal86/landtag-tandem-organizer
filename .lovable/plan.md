

## Problem

Wenn du in "Meine Arbeit / Jour Fixe" auf den Link klickst, navigiert die App zu `/meetings?id=<meeting-id>`. In `useMeetingsData.ts` gibt es zwei `useEffect`s, die beide auf `meetings` reagieren:

1. **Deep-Link-Effect** (Zeile 74): Sucht das Meeting mit der `id` aus der URL und wählt es aus
2. **Auto-Select-Effect** (Zeile 106): Wählt automatisch das nächste kommende Meeting, wenn `!selectedMeeting`

Beide laufen im selben Render-Zyklus, wenn `meetings` geladen wird. Da `selectedMeeting` zu dem Zeitpunkt noch `null` ist, überschreibt der Auto-Select das Deep-Link-Ergebnis — oder der Deep-Link findet das Meeting nicht in der Liste (z.B. bei vergangenen Meetings).

## Lösung

In `src/components/meetings/hooks/useMeetingsData.ts`:

1. **Auto-Select soll URL-Parameter respektieren**: Im Auto-Select-Effect (Zeile 106) prüfen, ob ein `id`-Parameter in der URL existiert. Falls ja, Auto-Select überspringen — der Deep-Link-Effect kümmert sich darum.

2. **Deep-Link-Meeting nachladen**: Falls das Meeting mit der URL-ID nicht in der geladenen `meetings`-Liste ist (z.B. ein vergangenes Meeting), dieses direkt aus der Datenbank laden und auswählen.

### Konkrete Änderungen (1 Datei)

**`src/components/meetings/hooks/useMeetingsData.ts`**:

- **Auto-Select-Effect** (Zeile ~106): Bedingung erweitern um `!searchParams.get('id')`, damit der Effect bei vorhandenem URL-Parameter nicht greift.

- **Deep-Link-Effect** (Zeile ~74): Fallback ergänzen — wenn das Meeting nicht in `meetings` gefunden wird, einzeln per `supabase.from('meetings').select(...).eq('id', urlMeetingId).single()` laden und dann auswählen.

