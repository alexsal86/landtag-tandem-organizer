# Wissen: Detailpanel, Schritt 15

Das Detailpanel hat eine feste Kopfzeile mit Status, Folgen-Toggle und Tastaturmenü. Antwort, Prüfung, Themen, Quellen, Details und Verlauf sind eigene Karten. Details sind zunächst geöffnet; die beiden aufklappbaren Abschnitte behalten ihren Zustand bei Datenaktualisierungen. Die bisher getrennten Aktionen „Überprüfung anfordern“ und „Veraltet melden“ bleiben unter Prüfung.

Die Themen-Combobox verwendet Command und Popover mit höchstens acht auswählbaren Einträgen einschließlich „Neu anlegen“. Die neue RPC `knowledge_qa_tag_suggestions` durchsucht vorhandene Wissensthemen und aktive Plattformthemen unter Invoker-RLS, blendet bereits vergebene Namen aus und liefert die Gesamtzahl. Themen bleiben auf die plattformweite Themenseite verlinkt. Chip-Namen umbrechen ohne feste Breite oder Abschneiden. Die Schreib-RPC prüft das Limit von fünf Themen und case-insensitive Duplikate weiterhin serverseitig.

Quellen haben beschriftete Felder in einem responsiven Raster. „Sonstiges“ ergänzt die bestehenden Quellentypen. URLs werden vor dem Speichern und Anzeigen auf HTTP(S) geprüft; externe Links behalten `noopener noreferrer`. Die Auswahl interner Dokumente und Fallakten nutzt weiterhin RLS.

## Migration

`supabase/migrations/20261111210000_knowledge_slide_management.sql` muss vor der neuen Oberfläche angewendet werden. Sie ergänzt Archivierungsgrund und Akteur, Wiederherstellen, revisionsgesichertes Zusammenführen mit Themenübernahme sowie die Themenvorschlags-RPC. Überschreitet die Themenvereinigung fünf Einträge, wird die gesamte Zusammenführung zurückgewiesen. Quellfrage, Antworten und Verlauf werden erhalten; die archivierte Quellfrage verweist auf das Ziel. Wiederherstellen hebt diesen Verweis auf; bereits zum Ziel kopierte Themen bleiben dort erhalten. Änderungen und Themenübernahmen werden über die bestehenden Audit-Trigger aufgezeichnet.

Die neue `knowledge_qa_manage`-Signatur enthält optional `p_reason` als achten Parameter; die bisherigen sieben Parameter bleiben kompatibel. Themenänderungen und -verwaltung teilen sich vor den Zeilensperren eine transaktionale Mandantensperre, damit Zusammenführen und Umbenennen dieselbe Sperrreihenfolge verwenden. Bestehende Migrationen werden nicht geändert. Die Enum-Erweiterung wird erst nach dem Commit verwendet, damit die Migration auch in einer einzelnen Transaktion angewendet werden kann.

## Prüfung

Auf ausdrücklichen Nutzerwunsch wurden keine Tests angelegt oder ausgeführt. Durchgeführt wurden die strenge TypeScript-Prüfung `npm run typecheck:knowledge` und Code-/Diff-Durchsicht. Die Migration wurde nicht auf einer Datenbank ausgeführt. Tastaturverhalten, Dark Mode und 375-px-Darstellung sind über die vorhandenen Radix-Primitiven und responsive Styles implementiert, aber nicht im Browser geprüft.
