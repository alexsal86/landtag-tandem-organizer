# Globale Wissensfragen

Das globale Erstellen-Menü steht in der linken Navigation neben der Suche, im mobilen Kopfbereich und in den Kopfzeilen der Detailseiten bereit. Es enthält „Schnelle Notiz“ und, mit `knowledge.write`, „Wissensfrage stellen“. Die bisherigen bereichsbezogenen Aktionen bleiben erhalten.

`Strg + Alt + F` beziehungsweise `⌘ + ⌥ + F` öffnet den vorhandenen Fragedialog. Während eines offenen Dialogs, bei Wiederholungsereignissen und während einer Texteingabekomposition öffnet dieser Shortcut keinen weiteren Dialog. Der zentrale Host ist unter `GlobalOverlays` dauerhaft eingebunden und nach Nutzer und Büro getrennt; ein Büro- oder Nutzerwechsel verwirft den offenen Dialog.

Die globale Suche bietet die Aktion auch bei vorhandenen Suchbegriffen an und übernimmt den aktuellen Text als Fragetitel, begrenzt auf 300 Zeichen. Bestehende Vorschläge ähnlicher Fragen führen zur Frage im Bereich `/wissen`. Nach dem Erstellen bleibt die aktuelle Seite bestehen. Die Erfolgsmeldung bietet „Frage öffnen“ an. Menü und Dialog berücksichtigen die Fokusrückgabe; alle Wege verwenden dieselbe revisions- und berechtigungsgeprüfte Wissens-RPC.

Keine neue Migration erforderlich. Auf ausdrücklichen Nutzerwunsch keine Tests angelegt oder ausgeführt; statische TypeScript-Prüfung für Wissen und die globale Anwendung.

Verifikation: `npm run typecheck:knowledge` und `npm exec -- tsc -p tsconfig.app.json --noEmit --types vite/client` erfolgreich. Beim unveränderten globalen Standardaufruf verhindert das vorhandene `@types/react-grid-layout`-Stub-Paket die automatische Typbibliothekserkennung (TS2688); der zweite Aufruf verwendet deshalb die expliziten Vite-Typen, wie bereits die Wissens-Konfiguration.
