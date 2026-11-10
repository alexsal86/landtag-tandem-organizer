# Jahresroutinen: Design nach Mockup, 10. November 2026

Die hochgeladene HTML-Vorlage „Jahresroutinen 2026 – Mockup.html“ dient als Gestaltungsreferenz. Umgesetzt ist die aktuelle gemeinsame Jahresroutinen-Ansicht unter Regeln & Workflows; der ältere `AnnualTasksView` wird nicht als zweite Verwaltung ausgebaut.

## Umsetzung

- Jahresübersicht mit tatsächlichen Zahlen für überfällige, anstehende/heute fällige und erledigte Routinen.
- Zwölfteilige Monatsleiste mit Statusfarben, aktuellem Monat und Sprung zur jeweiligen Monatsgruppe.
- Filter Alle / Offen / Erledigt; leere Monate optional sichtbar. Die Jahreskennzahlen bleiben unabhängig vom Listenfilter.
- Monatsweise Zeitleiste mit farbigen Karten, Statussymbolen, Stichtag, relativer Tagesangabe, Systemaktion/Büroaufgabe und manueller/automatischer/pausierter Ausführung.
- Heute-Markierung, sortierte Stichtage, Beschreibung bei vorhandenen Daten und direktes Bearbeitungssymbol.
- „Neue Jahresroutine“ und „Bearbeiten“ verwenden den vorhandenen Regel-Assistenten. „Hinzufügen“ in einem leeren Monat belegt dort den Monat vor.
- Verknüpfte Büroaufgaben öffnen ihre bestehende Aufgabe statt erneut ausgeführt zu werden. Systemaktionen behalten die Bestätigung; Rechte, Sperren und bestehende Executor-Regeln bleiben erhalten.
- Uhrzeiten stammen aus der Konfiguration automatischer Routinen; keine fiktive Ausführungszeit für manuelle Routinen. Berliner Kalenderdatum und Tagesabstände berücksichtigen Jahreswechsel und Sommerzeit. Monatsende verwendet die bestehenden Fachregeln.
- Mobile Karten, Dunkelmodus, Tastaturfokus und reduzierte Bewegung. Hinzufügen ist auch ohne Hover sichtbar. Ungültige Stichtage bleiben zur Korrektur sichtbar.
- Datenverknüpfungen über Maps statt wiederholter linearer Suche; keine zusätzlichen Requests pro Karte.

Es sind keine neuen DB-Migrationen oder Edge-Functions für diese Designänderung nötig. Die Ansicht verwendet die bereits auf Main vorhandene gemeinsame Routinen-/Regel-Anbindung.

## Prüfung

- 80 gezielte Komponenten-, Kalender-/Routinen- und Selbsttest-Tests bestanden.
- Produktionsbuild mit dem lokal vorhandenen Tooling bestanden; dieses verwendet Vite 5.4.21, während der aktuelle Paketstand Vite 8 anfordert. Die Abhängigkeiten wurden für die Designänderung nicht geändert.
- Lint der geänderten Dateien ohne Fehler; vorhandene Warnungen im übergeordneten Regel-Manager bleiben.
- Playwright auf Desktop und Mobil: Filterzahlen, leere Monate, kein horizontaler Überlauf, Screenshots in Hell-/Dunkelmodus und mobile Karten; keine Browser-JavaScript-Fehler. Synthetische Anmeldung und abgefangene API-Aufrufe, keine Produktiv-Ausführung von Personalaktionen.
- Selbsttest-Center ergänzt um Statusfilter und Berliner Tagesgrenze; generierte Coverage-Dokumente mit dem aktuellen Schema-/Szenarienstand abgeglichen.
- Im breiteren lokalen Automatisierungslauf: 88 Tests bestanden, ein Test in `src/features/automation/domain/__tests__/workflowDefinition.test.ts` fehlgeschlagen (`accepts a valid workflow`). Dieser Test und die zugehörige Domain-Implementierung wurden nicht geändert. Der projektübergreifende Typecheck enthält ebenfalls bestehende Befunde; die neuen Darstellungsdateien und die neue Monatsvorbelegung haben dort keine Diagnosen.

## Bewusst nicht erweitert

Keine neue Ausführungslogik, kein separater Routineneditor, kein allgemeiner Entwurfs-/Konfliktschutz und keine Änderung an Personalaktionen. Historische Jahresauswahl und zusätzliche Suche können bei wachsendem Bestand später ergänzt werden; die vorliegende Ansicht bleibt auf das aktuelle Jahr fokussiert.
