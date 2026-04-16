
Ziel: Nicht weiter “herumdoktern”, sondern den funktionierenden Stand von vor heute Abend wiederherstellen und erst danach gezielt neu prüfen.

1. Sofortmaßnahme: auf den letzten funktionierenden Stand vor den heutigen Push-Änderungen zurückgehen
- Kein weiterer manueller Gegenfix auf dem aktuellen Stand.
- Stattdessen den Projektstand über den Verlauf/History auf den Zustand zurücksetzen, als Push noch funktionierte.
- Das ist hier der sicherste Weg, weil heute Abend mehrere miteinander verkoppelte Stellen geändert wurden.

2. Was heute Abend sehr wahrscheinlich zusammen kaputt gemacht wurde
- `src/main.tsx`
  - Registrierung wurde auf den unified Worker `/sw.js?v=2026-04-15-v1` umgestellt.
- `public/sw.js`
  - wurde zum kombinierten COI- und Push-Service-Worker gemacht.
- `src/hooks/useNotifications.tsx`
  - VAPID-Abruf, Repair-/Renew-Logik und SW-Registrierung wurden mehrfach geändert.
- `supabase/functions/_shared/security.ts`
  - CORS-/Origin-Logik wurde erweitert.
- Zusätzlich existieren Test-/Diagnose-Komponenten mit hart codierter Push-URL (`src/components/VapidKeyTest.tsx`), die leicht für Verwirrung sorgen.

3. Warum ich einen echten Rollback empfehle statt noch eines Fixes
- Der aktuelle Fehler ist nicht mehr nur ein einzelner Bug.
- Es wurden heute gleichzeitig geändert:
  - Service-Worker-Architektur
  - Push-Registrierung
  - VAPID-Key-Fetch
  - Auto-Renew-/Repair-Logik
  - Edge-Function-CORS
- Wenn dein Ziel ausdrücklich “Stand wie vorher” ist, ist History-Revert sauberer und risikoärmer als ein weiterer Schätzwert-Fix.

4. Recovery-Plan nach dem Rollback
- Schritt A: auf den letzten funktionierenden Stand vor heute Abend zurücksetzen
- Schritt B: Push-Aktivierung einmal unverändert testen
- Schritt C: nur wenn dann wirklich noch nötig, genau eine minimale Änderung neu einführen
  - nicht mehrere gleichzeitig
  - nach jeder Einzeländerung direkt testen

5. Falls wir nach dem Rollback erneut an Push arbeiten
Nur in dieser Reihenfolge, einzeln:
- zuerst nur Diagnose des tatsächlichen Fehlers
- dann höchstens eine gezielte Änderung
- keine gleichzeitige Änderung an:
  - `main.tsx`
  - `public/sw.js`
  - `useNotifications.tsx`
  - Edge-Function-CORS

Technische Einordnung
- Der größte Rückschritts-Kandidat ist der Wechsel von einem getrennten, iframe-aware COI-Worker zu einem global registrierten unified `sw.js`.
- Dazu kommt die neue direkte VAPID-GET-Logik in `useNotifications.tsx`.
- Der aktuelle Zustand ist also nicht “ein kleiner Defekt”, sondern ein veränderter Push-Stack.

Konkreter Umsetzungsplan nach deiner Freigabe
1. Über History auf den letzten Stand vor den heutigen Push-Änderungen zurückgehen.
2. Danach nur die push-relevanten Dateien prüfen:
   - `src/main.tsx`
   - `public/sw.js`
   - `src/hooks/useNotifications.tsx`
   - `supabase/functions/_shared/security.ts`
3. Push erneut testen.
4. Erst wenn der alte Stand wider Erwarten auch nicht mehr funktioniert, eine minimal-invasive Ursacheanalyse machen.
5. Danach maximal eine isolierte Korrektur umsetzen und wieder testen.

Erwartetes Ergebnis
- Schnellster Weg zurück zu einem bekannten funktionierenden Zustand
- Kein weiteres Verschlimmbessern durch zusätzliche Gegenänderungen
- Saubere Basis, von der aus man echte Ursachen wieder getrennt prüfen kann
