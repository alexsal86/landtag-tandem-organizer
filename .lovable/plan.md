
Ziel: Die beiden Bugs diesmal an den tatsächlichen Ursachen beheben (nicht nur Symptome).

1) Diagnose (aus Code + Logs)
- Das Jour-Fixe-Flackern kommt sehr wahrscheinlich aus `MeetingsView` (nicht nur aus `MyWorkJourFixeTab`):
  - In `useMeetingsData.ts` hängen mehrere `useEffect`s von Loader-Funktionen aus `useMeetingSidebarData.ts` ab.
  - Diese Loader sind aktuell nicht stabil memoisiert; dadurch werden Effekte bei jedem Render neu ausgelöst.
  - Ergebnis: wiederholte parallele Supabase-Requests, Token-Lock-Warnungen (`gotrue lock`), und „zeigt Daten → leert Daten → lädt neu“.
- Team-Tab:
  - `MyWorkTeamTab.tsx` behandelt Membership-Fehler/Teilantworten nicht robust (silent fail ⇒ leere Liste).
  - Rollenlogik ist zwischen `MyWorkView` (global `user_roles`) und Team-Tab (tenant membership) inkonsistent.

2) Umsetzungsplan

A. Jour-Fixe-Flackern stabil beheben
- Datei: `src/components/meetings/hooks/useMeetingSidebarData.ts`
  - Alle Loader (`loadLinkedQuickNotes`, `loadMeetingLinkedTasks`, `loadMeetingLinkedCaseItems`, `loadMeetingRelevantDecisions`, `loadMeetingUpcomingAppointments`, `loadStarredAppointments`) mit `useCallback` stabilisieren.
  - Pro Loader Request-Guard einbauen (requestId/in-flight), damit veraltete Antworten nicht mehr State überschreiben.
  - Bei transienten Fehlern keine destruktiven Resets auf `[]` für Entscheidungen/Linked-Daten; bestehende Daten beibehalten.
- Datei: `src/components/meetings/hooks/useMeetingsData.ts`
  - Meeting-Datenladen zentralisieren in eine stabile `hydrateSelectedMeetingData(meetingId, meetingDate)`-Funktion.
  - Doppelte Trigger aus Deep-Link-/Auto-Select-/Selected-Meeting-Pfaden entfernen (einheitlicher Ladepfad, keine Mehrfachstarts).
  - Nur laden, wenn `selectedMeeting.id` sich wirklich ändert.

B. Team-Tab robust machen
- Datei: `src/components/my-work/MyWorkTeamTab.tsx`
  - Membership-Query mit explizitem Error-Handling (nicht mehr stillschweigend als „keine Mitarbeiter“ interpretieren).
  - Rollenentscheidung vereinheitlichen: tenant-membership zuerst, optionaler Fallback auf `user_roles` nur wenn Membership für aktuellen User fehlt.
  - Fallback für Mitarbeiter-IDs ergänzen:
    - Wenn aus Membership keine Mitarbeiter ableitbar sind, aber Admin-Rechte vorliegen: ergänzend über `employee_settings.admin_id = currentUser` laden.
  - Bei Teilfehlern trotzdem vorhandene Profile/Mitglieder rendern (degradierter Modus statt leerer Liste).

C. Konsistenz in Tab-Sichtbarkeit
- Datei: `src/components/MyWorkView.tsx`
  - Team-Tab-Sichtbarkeit und Team-Count-Entscheidung an die gleiche tenant-basierte Rollenlogik anlehnen, damit kein „Tab sichtbar, aber intern gesperrt/leer“ mehr entsteht.

3) Technische Details
- Hauptursache Flackern: instabile Funktionsreferenzen + effect-dependency loops + konkurrierende async updates.
- Schutzmaßnahmen:
  - `useCallback` für Loader
  - in-flight/request-version Guards
  - „keep previous data on transient error“
  - zentraler Ladepfad pro ausgewähltem Meeting

4) Abnahme-Check nach Umsetzung
- Jour Fixe (`/meetings`):
  - Entscheidungsliste bleibt stabil sichtbar (kein zyklisches Leeren/Neuladen).
  - Konsole: deutliche Reduktion/kein Spam von `@supabase/gotrue-js lock`-Warnungen.
- Team (`/mywork?tab=team`):
  - Mitarbeiterliste wird wieder angezeigt.
  - Bei Teilfehlern erscheinen mindestens verfügbare Mitglieder statt kompletter Leerzustand.
  - Rollenabhängige Sichtbarkeit ist konsistent zwischen Tab-Navigation und Tab-Inhalt.
