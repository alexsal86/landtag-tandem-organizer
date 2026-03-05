# Konzept: Kleines und Großes unter einem Hut (Anfrage, Petition, Fallakte)

## Ausgangspunkt
Im Büroalltag gibt es sehr unterschiedliche Vorgänge:
- **kurze Bürgeranfrage** (oft in 1–3 Interaktionen lösbar)
- **mittlerer Vorgang** (mehrere Rückfragen, Termine, Abstimmungen)
- **lange Petition/Fallakte** (monatelanger Verlauf, viele Dokumente/Beteiligte)

Ein reines Aufgabenmodell ist zu flach. Gleichzeitig wäre es unpraktisch, jede kleine Anfrage sofort als „große Akte“ zu behandeln.

## Leitprinzip
Nicht zwei getrennte Systeme bauen, sondern ein **einheitliches Vorgangsmodell mit zwei Ebenen**:

1. **Vorgang/Ticket** = operative Bearbeitungseinheit (immer vorhanden)
2. **Akte** = optionaler übergeordneter Container für komplexe/lange Sachverhalte

So entsteht ein gemeinsames Datenfundament, aber unterschiedliche Arbeitsansichten.

---

## 1) Domänenmodell

### Ebene A: `case_item` (ehem. Ticket/Vorgang)
`case_item` ist die kleinste fachliche Einheit für jeden Eingang.

Pflichtfelder:
- `id`, `tenant_id`
- `title`
- `kind` (`anfrage`, `beschwerde`, `hinweis`, `petition`, `sonstiges`)
- `status` (`neu`, `in_bearbeitung`, `wartet_extern`, `wartet_intern`, `erledigt`, `archiviert`)
- `priority` (`niedrig`, `mittel`, `hoch`, `kritisch`)
- `source_channel` (`email`, `telefon`, `social`, `persoenlich`, `brief`, `intern`)
- `owner_user_id`
- `created_at`, `updated_at`

Empfohlen:
- `contact_id`
- `topic`, `tags`
- `constituency_reference` (Wahlkreis/PLZ/Ort)
- `follow_up_at`, `due_at`
- `resolution_summary`
- `case_file_id` (nullable FK auf Akte)

### Ebene B: `case_file` (Akte)
`case_file` bündelt mehrere `case_item` oder auch einen einzelnen, eskalierten Vorgang.

Pflichtfelder:
- `id`, `tenant_id`
- `title`
- `status` (`offen`, `in_pruefung`, `entscheidung_noetig`, `abgeschlossen`, `archiviert`)
- `owner_user_id`
- `created_at`, `updated_at`

Empfohlen:
- `summary` (Lagebild)
- `risk_assessment`
- `stakeholder_map`
- `political_relevance`
- `next_milestone_at`

### Unterstrukturen (für beide Ebenen nutzbar)
- `case_interactions` (Kommunikation/Notizen/Meetings)
- `case_tasks` (konkrete To-dos)
- `case_participants`
- `case_attachments`

---

## 2) Lebenszyklus: vom Kleinen ins Große

### Standardpfad (klein)
1. Eingang erzeugt `case_item`.
2. Kommunikation + 1–2 Aufgaben.
3. Abschluss mit kurzer Ergebnisnotiz.

### Eskalationspfad (groß)
Ein `case_item` wird in eine Akte überführt, wenn z. B.:
- Laufzeit > X Tage (z. B. 21/30)
- mehrere beteiligte Stellen/Rollen
- rechtlich/politisch sensible Lage
- mehr als N Interaktionen oder Dokumente

Dann:
- entweder neue `case_file` erzeugen und `case_item.case_file_id` setzen,
- oder bestehender Akte zuordnen.

Wichtig: **Keine Datenverschiebung nötig**, nur Beziehung ergänzen.

---

## 3) UI-Ansichten (gleiche Daten, unterschiedliche Perspektive)

### A) Arbeitsansicht „Inbox & Vorgänge“ (für das Kleine)
- Neue Eingänge nach Kanal
- Mein Arbeitsplatz (mir zugewiesene offene Vorgänge)
- Wiedervorlage heute/nächste 7 Tage
- Überfällig

### B) Aktenansicht „Dossier“ (für das Große)
- Gesamtzusammenfassung/Lagebild
- Aggregierte Timeline über alle zugeordneten Vorgänge
- Beteiligte Institutionen/Stakeholder
- Risiken, Chancen, Entscheidungsstände
- Meilensteine und Dokumentenlage

### C) Verbindende Navigation
- Von jedem Vorgang direkter Link „in Akte öffnen“
- In jeder Akte Liste aller verknüpften Vorgänge
- Klare Badges: `Einzelvorgang` vs `Teil einer Akte`

---

## 4) Operative Regeln
- Jeder Eingang startet als `case_item`.
- Jede relevante Kommunikation wird als Interaction gespeichert.
- Aufgaben immer im Kontext (`case_item` oder `case_file`).
- „Erledigt“ nur mit dokumentierter Antwort/Entscheidung.
- Bei Eskalationskriterien Vorschlag „Akte anlegen“ (halbautomatisch).

---

## 5) Migration auf vorhandene Fallakten

### Phase 1: Begriffliche Harmonisierung
- „Ticket/Vorgang“ in der operativen Oberfläche nutzen.
- „Fallakte“ für komplexe Dossiers beibehalten.

### Phase 2: Datenmodell verbinden
- `case_items` einführen (oder bestehende Vorgangstabelle entsprechend erweitern).
- `case_item.case_file_id` als zentrale Brücke zu bestehenden Fallakten.

### Phase 3: Timeline vereinheitlichen
- `case_interactions` so aufbauen, dass sie sowohl Vorgangs- als auch Akten-Ansicht speisen.

### Phase 4: Eskalationsautomatik + KPI
- Regeln für Aktenvorschläge.
- Dashboard: Anteil Einzelvorgänge vs Aktenfälle, Durchlaufzeiten, Rückstau.

---

## 6) KPI-Set für „klein + groß“
- Median Erstreaktion (alle `case_items`)
- Median Abschlusszeit für Einzelvorgänge
- Anteil eskalierter Vorgänge (`case_item -> case_file`)
- Durchlaufzeit in Akten (vom ersten Eingang bis Abschluss)
- Überfälligkeitsquote (Vorgang + Akte)

---

## Empfehlung
Die beste Lösung ist ein **zweistufiges Modell**:
- **Vorgang (`case_item`)** für schnelle, kleine Bürgeranfragen.
- **Akte (`case_file`)** für längere, komplexe Petitionen/Sachverhalte.

So bleiben Prozesse für das Tagesgeschäft leichtgewichtig, ohne die Fähigkeit zu verlieren, große Fälle sauber und langfristig nachzuverfolgen.


## Implementierungsstand (aktuell im Code)
- Aktuell ist in der UI/DB primär `case_files` umgesetzt; `case_item` als eigene Entität ist noch nicht produktiv eingeführt.
- Die jetzige Umsetzung in `Meine Arbeit` und `Akten/FallAkten` ist damit eine **Zwischenstufe (Phase 0/1)**: gemeinsame Sichtlogik auf bestehende Fallakten, noch kein vollständiges Ticket-Datenmodell mit eigenen `ticket_interactions`-Tabellen.
- Nächster fachlicher Schritt ist daher, `case_item`/Ticket als explizite Entität einzuführen und mit `case_file` zu verknüpfen.

## Wichtige Korrektur zur Größenlogik
- Größe (`small`/`large`) sollte **langfristig als explizites Feld** gepflegt werden (`case_scale`) statt aus Freitext abzuleiten.
- Heuristiken dürfen maximal Übergangslösungen sein.
- Für den Übergang wird derzeit primär `case_type` verwendet; unbekannte Typen werden defaultmäßig als `small` behandelt, um das „groß“-Segment nicht künstlich zu überfrachten.
