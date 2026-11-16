# Abgeordnetenporträts über GitHub

Super-Admins können in der Personenansicht der Administration und unter
Wahlanalyse → Abgeordnete ein Bild hochladen, im festen 3:4-Rahmen verschieben
und zoomen sowie Quelle, Quellen-URL, Urheber und Lizenz angeben. Beim Ändern
werden das aktuelle Bild und der vorhandene Bildnachweis vorgefüllt.

Der Browser erzeugt WebP-Dateien mit 480 × 640 und 96 × 128 Pixeln und begrenzt
die Dateigröße über die Qualitätsstufe. Die Canvas-Neukodierung übernimmt keine
EXIF-/Kamera-Metadaten. Der Server prüft Format, Abmessungen und Dateigröße.

## Einmalige Einrichtung

1. Einen auf `alexsal86/landtag-tandem-organizer` beschränkten GitHub-Token
   bereitstellen: Fine-grained PAT, Repository permissions → Contents: Read and
   write. Der zugehörige Account muss auf `main` schreiben dürfen; bestehende
   Branch-Regeln werden nicht umgangen.
2. Im Supabase-Projekt unter Edge Function Secrets das Secret
   `GITHUB_DEPUTY_PORTRAITS_TOKEN` setzen. **Kein** `VITE_`-Präfix verwenden und
   den Token weder in Git noch in der Browser-Konfiguration speichern.
3. Die Funktion `save-deputy-portrait` deployen, JWT-Prüfung aktiviert lassen:
   `supabase functions deploy save-deputy-portrait --project-ref wawofclbehbkebjivdte`.
4. Lovable übernimmt den neuen Main-Commit und veröffentlicht ihn wie die übrigen
   Website-Änderungen. Ein Upload veröffentlicht die Lovable-Seite nicht selbst.

Der Token wird ausschließlich von der Edge Function genutzt. Vor jedem Upload
prüft sie den Benutzer über `requireAuth`, anschließend `is_superadmin` und die
Existenz der ausgewählten Mandatsverbindung unter der aufrufenden RLS-Identität.
Es gibt keine tenantbezogenen Schreibvorgänge, keinen Service-Role-Bypass und
keinen Upload in Supabase Storage. Repository, Branch und Pfadpräfix sind fest.

## Speicherung und Veröffentlichung

Die Edge Function schreibt ausschließlich
`public/images/abgeordnete/<connection_id>/`. Ein Git-Tree/Commit enthält beide
Bilder und `portrait.json`. Ein bestehendes Bild wird nur ersetzt, wenn seine
Version der vom Benutzer geöffneten Version entspricht. Gleichzeitige Commits
auf Main werden ohne Force-Push erneut auf dem aktuellen Head aufgebaut. Ein
neuerer Upload derselben Person erfordert das erneute Laden nach Veröffentlichung.

Die Anwendung ruft die Bilder über ihre eigene Domain auf. Es gibt keine
GitHub-Raw-Abhängigkeit und keine Supabase-Transfers beim Anzeigen der Bilder.
Kosten und Cache-Verhalten der Auslieferung richten sich nach dem Website-Hosting.
Die Upload-Anfrage läuft einmalig über die Edge Function.

Ohne Server-Secret oder deployed Function meldet die Oberfläche einen Fehler;
sie behauptet dann nicht, das Bild sei gespeichert. Nach einem bestätigten Commit
zeigt sie sofort eine lokale Vorschau mit Hinweis auf das ausstehende Deployment.

Es ist keine zusätzliche Datenbankmigration für die Porträts erforderlich. Die
vorhandenen Mandatsverbindungen müssen bereits eingerichtet sein. Bild- und
Quellenangaben sind nach Veröffentlichung öffentlich erreichbar.
