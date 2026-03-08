
**Planung für das Refactoring der Vorgangs-Entscheidungen im Zeitstrahl**

1. **Verschieben des "Entscheidung stellen"-Buttons**
   - Der Bereich "Verknüpfte Entscheidungen" in der linken Spalte des Vorgang-Details wird komplett entfernt.
   - Der Button "Entscheidung stellen" wird in die Interaktionsleiste (neben Anruf, Mail, Treffen etc.) verschoben.

2. **Erweiterte Datenabfrage für Entscheidungen**
   - Die Ladelogik (`loadLinkedDecisions`) wird erweitert, um neben Titel und Status auch die Beschreibung (`description`) sowie die Teilnehmer (`task_decision_participants`) und deren Antworten (`task_decision_responses`) abzufragen.
   - Dadurch können die Empfänger (durch Abgleich mit den Team-Mitgliedern) und das aktuelle Abstimmungsergebnis ermittelt werden.

3. **Anpassung des Zeitstrahl-Eintrags (UI & Logik)**
   - **Pending-Status:** Solange keine Antwort vorliegt, wird das Kreis-Icon im Zeitstrahl als Sanduhr (`Hourglass`) dargestellt (gelb/orange).
   - **Abgeschlossen:** Sobald Antworten vorliegen oder die Entscheidung archiviert ist, wechselt das Icon auf den Richterhammer (`Gavel`) oder einen Haken (grün) und das Ergebnis wird angezeigt.
   - **Kein "Status: active":** Der technische Text "Status: active" wird aus dem Zeitstrahl entfernt.
   - **Hover/Tooltip:** Beim Hovern über den Eintrag (Kreis oder Text) öffnet sich eine kompakte Karte (HoverCard). Diese zeigt:
     - **An wen:** Die Namen der Teilnehmer.
     - **Was/Warum:** Den Titel und (falls vorhanden) eine gekürzte Beschreibung.
     - **Ergebnis:** Sobald vorhanden, wird hier das genaue Resultat (z. B. "Zustimmung", "Ablehnung", "Rückfrage") direkt im Tooltip aufgelistet.

4. **Klickverhalten & Inline-Detail**
   - Die Einträge für Entscheidungen im Zeitstrahl werden klickbar.
   - Ein Klick öffnet ein Overlay/Dialog (die bestehende Komponente `TaskDecisionDetails`) direkt in "Meine Arbeit", sodass der Nutzer die vollständige Historie und Kommentare der Entscheidung ansehen kann, ohne die Seite zu verlassen.
   - Das Layout des Zeitstrahls wird dahingehend angepasst, dass klickbare Elemente visuell hervorgehoben werden (z. B. Hover-Effekt auf dem Hintergrund).

5. **Dauerhafte Sichtbarkeit**
   - Entscheidungen werden unabhängig von ihrem Lebenszyklus-Status (`active` oder `archived`) dauerhaft chronologisch im Zeitstrahl des Vorgangs verankert.
