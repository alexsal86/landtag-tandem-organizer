# Folgepakete und wissenschaftliches Konzept

P0–P3 schaffen gemeinsame Berechnungen, quellengestützte Versionen und begrenzte
Zugriffe. Der P4-Vergleich ist inzwischen separat implementiert. Seine Stimmenzerlegung bleibt
vorbereitet; P5 enthält inzwischen die unten abgegrenzte Mandats-/Kandidaturansicht;
P6 ist auf ausdrücklichen Nutzerwunsch als exploratives Labor umgesetzt.
Wissenschaftlich validierte Modelle, kausale Amtsinhabereffekte und Sitzsimulationen
bleiben ohne zusätzliche Daten und Prüfung deaktiviert.

## P4: Beteiligung, absolute Stimmen und deskriptiver Zusammenhang

Status: Tabellen, Streudiagramm und deskriptives Pearson-r sind im Reiter
„Beteiligung & Stimmen“ implementiert. Die folgende Zerlegung ist als reine
Funktion vorbereitet und noch nicht in der produktiven Oberfläche aktiviert.

Ein Punkt je räumlich vergleichbarem Wahlkreis: X = Änderung der Beteiligung in PP,
Y = Änderung des Parteianteils in PP. Die Tabelle muss dieselben Zahlen, Nenner,
Auswahljahre und Ausschlussgründe zeigen. Pearson-r optional, nur mit Anzahl gültiger
Paare, Streudiagramm, Ausreißerhinweis und Kennzeichnung „deskriptiv, nicht kausal“.
Fehlende Werte paarweise ausschließen und Zahl ausgeschlossener Wahlkreise ausweisen.
Kein Rückschluss auf individuelle Wählerentscheidungen.

Vorbereitete Definition einer exakten, symmetrischen Stimmenzerlegung:
`V = E × b × g × p`, mit Wahlberechtigten E, Beteiligungsquote b = W/E,
Gültigkeitsquote g = G/W und Parteianteil p = V/G (Quoten 0–1).
Für jede der 24 Reihenfolgen der vier Faktoren wird jeweils ein alter Faktor durch
den neuen ersetzt; die Änderung des Produkts wird diesem Faktor zugerechnet.
Der Mittelwert seiner Beiträge über alle Reihenfolgen ist der Shapley-Beitrag.
Alle vier Beiträge summieren sich exakt zu V_neu − V_alt, ohne willkürliche
Reihenfolge. Nicht als kausaler oder individueller Effekt interpretieren.
Bei fehlenden/Null-Nennern bleibt die Zerlegung unbekannt. Vor Aktivierung Tests
für Summenidentität, vertauschte Zeitrichtung, identische Wahlen, reine Ein-Faktor-
Änderung, Faktorpermutation und numerische Toleranz ergänzen und ausführen.

## P5: Mandate und Kandidaturen

Status: Erfasste Mandatszahlen, tatsächliche abgeschlossene Amtsdauern und explizite
Periodenvergleiche sind implementiert. Kandidaturvergleiche haben eine zentrale
Vollständigkeits- und Identitätsprüfung. Amtsinhabermodelle bleiben deaktiviert.

Voraussetzungen: veröffentlichte Perioden, bestätigte Wahlkreisverbindungen,
verifizierte Personenidentitäten und ausdrücklich geprüfte Vollständigkeit.
Mandatssegmente sind keine eigenständigen Wiederwahlen; Nachrücker zählen nicht
als Wahlsieg. Wiederwahl nur über dieselbe bestätigte Person und verschiedene
Wahlperioden. Historisches Zweitmandat und neue Landesliste getrennt ausweisen.
Amtsdauern brauchen tatsächliche individuelle Anfangs-/Endtermine; regulär erwartete
Enden dürfen keine bereits geleistete Mandatszeit erzeugen.

Ein Amtsinhabermodell erfordert alle Kandidaturen, auch erfolglose. Die vorhandene
Mandatsliste liefert diese Population nicht. Vor einer Aktivierung je Jahr/Partei/
Wahlkreis Vollständigkeitsmatrix, Kandidatur-/Personenverknüpfung, Wahlrechtswechsel
und Selektionsprobleme prüfen. Keine fehlenden Kandidaturen aus Mandaten ergänzen.

## P6 A: Wahlkreis-Typologie

Umgesetzt: k-means++ und hierarchisches Ward-Verfahren für eine Wahl oder zwei
ausdrücklich ausgewählte Wahlen; Hellinger-Transformation, Standardisierung,
Silhouette, ARI-Verfahrens-/Startwertvergleich und 12 Teilstichproben. Gruppen sind
explorativ. Grenzen/Status werden vor Zweijahresmerkmalen geprüft.

Gemeinsamer Gebietsstand oder dokumentierte Umrechnung erforderlich. Merkmale:
Parteianteile einschließlich Restkategorie, Beteiligung, langfristige Änderungen,
Schwankungen; Strukturmerkmale erst nach amtlichem Datenimport. Fehlende Werte
und kompositionale Anteile nicht unkritisch standardisieren. Explorativ k-means,
hierarchische Cluster und geeignete Transformationen vergleichen. Zahl der Cluster
über Stabilität, Resampling, Silhouette und fachliche Interpretierbarkeit bestimmen.
Ergebnisse mit Zeitfenster, Merkmalswahl, Skalierung und Unsicherheit veröffentlichen.
Keine dauerhaften politischen Etiketten als objektive Gebietsmerkmale ausgeben.

## P6 B: Regionale Strukturmodelle

Umgesetzt: lokaler CSV-Import von bis zu sechs Strukturmerkmalen für höchstens
70 Wahlkreise; jeweils ein erklärendes Merkmal, OLS mit Achsenabschnitt, R²,
RMSE, Leave-one-out-RMSE, Residuen, Hebelwerte und Cook-Distanz. Keine automatische
Beschaffung oder Bestätigung amtlicher Strukturquellen. Quelle, Bezugsjahr, Einheit
und Zuschnitt müssen vor Nutzung selbst geprüft werden.

Amtliche Altersstruktur, Bevölkerung, Urbanisierung, Arbeitsmarkt, Einkommen und
Bildung benötigen Bezugsjahr, Definition und räumliche Zuordnung. Zunächst einfache,
transparent dokumentierte Regressionsmodelle, Diagnose von Kollinearität, Ausreißern,
Residuen und räumlicher Abhängigkeit. Zeitlich/räumlich getrennte Validierung.
Hierarchische Modelle nur bei ausreichenden Beobachtungen und Datenqualität.
Ökologische Zusammenhänge sind keine Aussagen über individuelles Wahlverhalten.

## P6 C: Modellierte Wählerwanderung

Umgesetzt: vorhandene landesweite Modellwerte plus ausdrücklich parametrisierte
Sensitivitätsrechnung einer Partnerbeziehung. Bandbreiten sind Annahmen, keine
Konfidenzintervalle, keine identifizierte Gesamtmatrix oder lokalen Wanderungen.

Bestehende landesweite Schätzungen weiterverwenden. 2011 und 2021 enthalten
Bruttoströme; 2016 und 2026 überwiegend/ausschließlich Salden. Nicht vorhandene
Gegenströme bleiben unbekannt, ein Saldo bestimmt keine eindeutige Bruttomatrix.
Keine lokalen Ströme proportional auf Wahlkreise verteilen und als beobachtet ausgeben.
Eigene Modelle benötigen identifizierbare Randverteilungen, Restkategorie,
Nichtwählende, transparente Annahmen, Unsicherheitsintervalle und Sensitivitätsanalysen.
Eine erst-/zweitstimmenbezogene Aggregatdifferenz ist keine individuelle Wanderung.

## P6 D: Szenariolabor

Umgesetzt: hypothetischer uniformer Swing und eine ausdrücklich gewählte lokale
Abweichung, vollständige Restkategorie und Projektion auf Anteile ≥ 0 mit Summe
100. Korrekturen und Abweichungen vom angenommenen Landesziel sind sichtbar.
Keine Sitzberechnung oder tatsächlichen Direktmandatsprognosen.

Annahmen und Wahlsystem je Periode versionieren. Zunächst uniformer Swing als
explizite Annahme; danach regionale Varianten mit nachvollziehbaren Parametern.
Anteile müssen in 0–100 bleiben und einschließlich Restkategorie konsistent sein.
Direktmandate benötigen Kandidaturen, Sitzberechnung ein vollständig implementiertes
periodenspezifisches Wahlrecht einschließlich Hürden und Sonderfällen. Historische
amtliche Referenzwahlen, Rundungs-/Grenzfälle und Invarianten mathematisch testen,
bevor Sitzsimulationen aktiviert werden. Szenarien als hypothetische Rechnung,
nicht als belastbare Wahlprognose bezeichnen.

## Technische Aktivierung

Jedes Folgepaket erhält eigene Migrationen, reine fachliche Funktionen und Tests,
Jahr-/Gebiet-/Partei-begrenzte Queries, CSV, Quellen-/Methodeninformationen und
barrierearme Tabellen. Bestehende RLS und zentrale Super-Admin-Schreibrechte bleiben.
Keine personenbezogenen Wählerprofile oder individuelle Entscheidungsinferenz.
Freigabe erst nach dokumentierter Datenvollständigkeit und methodischer Prüfung.

## Verifikationsstand dieser Erweiterung

Auf Nutzerwunsch wurden automatisierte Tests ergänzt, aber nicht ausgeführt.
TypeScript wurde separat abgeglichen. Die Werkzeuge sind explorative Rechenhilfen,
keine behauptete wissenschaftliche oder rechtliche Freigabe. Die vorhandenen
Anforderungen zur späteren Validierung bleiben für entsprechende Aussagen gültig.
