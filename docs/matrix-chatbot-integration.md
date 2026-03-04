# Matrix-Chatbot für www.alexander-salomon.de im Landtagssystem integrieren

## Ziel

Besucher:innen der Webseite sollen:

1. schnell Antworten auf häufige Fragen bekommen,
2. bei Bedarf direkt eine Anfrage an das Team senden,
3. und alles soll im bestehenden Landtag-Tandem-Organizer nachvollziehbar und bearbeitbar sein.

## Empfohlene Gesamtarchitektur

- **Frontend-Widget auf der Website**
  - kleines Chat-Widget (z. B. unten rechts), das über Matrix kommuniziert.
- **Matrix Homeserver + Bot-User**
  - entweder eigener Homeserver (Synapse) oder gehosteter Anbieter.
  - Bot-User übernimmt Begrüßung, FAQ-Antworten, Routing an Menschen.
- **Bridge-Service (Middleware)**
  - verbindet Matrix-Ereignisse mit Supabase/Organizer.
  - erstellt bei relevanten Chats automatisch Kontakte, Tasks oder Follow-ups.
- **Landtagssystem (bestehende App)**
  - Inbox-Ansicht für eingehende Anfragen.
  - Status-Workflow: neu → in Bearbeitung → beantwortet.

## Warum Matrix hier gut passt

- Offener Standard, keine enge Vendor-Bindung.
- Ende-zu-Ende-fähig, wenn später vertrauliche Kommunikation relevant wird.
- Bots, Bridges und Moderation sind etabliert.
- Multi-Client-fähig (Web, Mobile, interne Tools).

## Umsetzungsvarianten

## Variante A (MVP, 2-4 Wochen)

- Website-Widget mit „Web-Chat“-Komponente.
- Ein zentraler Matrix-Raum für Website-Anfragen.
- Bot mit FAQ-Antworten (regelbasiert + kleine Wissensbasis).
- Bridge legt zu jeder neuen Konversation einen Datensatz im Organizer an.

**Vorteil:** schnell live, überschaubare Komplexität.

## Variante B (Skalierbar, 4-8 Wochen)

- Pro Anfrage eigener Matrix-Raum oder Thread.
- Automatische Zuweisung an zuständige Person (z. B. nach Thema/Wahlkreis).
- SLA/Reminder-Logik im Organizer.
- Wissensdatenbank + semantische Suche für bessere Erstantworten.

**Vorteil:** klarere Prozesse, teamfähig bei höherem Anfragevolumen.

## Integrationsdesign im Landtagssystem

## 1) Datenmodell ergänzen (Supabase)

Vorschlag für neue Tabellen:

- `chat_conversations`
  - `id`, `tenant_id`, `channel` (`matrix`), `matrix_room_id`, `status`, `topic`, `created_at`
- `chat_messages`
  - `id`, `conversation_id`, `sender_type` (`visitor`/`bot`/`staff`), `sender_id`, `content`, `created_at`
- `chat_handoffs`
  - `id`, `conversation_id`, `reason`, `assigned_to`, `handoff_at`, `resolved_at`

Optional:

- `chat_intents` (erkannte Anliegen + Confidence)
- `chat_feedback` (War diese Antwort hilfreich?)

## 2) Prozesslogik

1. Besucher startet Chat im Widget.
2. Bot begrüßt und fragt nach Anliegen (Themenauswahl + Freitext).
3. Bot versucht FAQ/Knowledge-Antwort.
4. Wenn ungelöst oder explizit gewünscht: **Handover an Team**.
5. Bridge erstellt/aktualisiert Eintrag im Organizer (Inbox + ggf. Task).
6. Team antwortet aus interner Oberfläche; Antwort wird via Matrix zurückgespielt.

## 3) Routing-Regeln (praxisnah)

- Thema „Bürgerbüro“ → Team A
- Thema „Presse“ → Team B
- Thema „Landtagsrede/Anfrage“ → Team C
- Keine Zuordnung → allgemeine Inbox + Priorität „normal“

Mit dieser einfachen Regelmatrix startet ihr ohne KI-Overhead.

## Bot-Logik: sinnvoller Start

## FAQ-Layer (deterministisch)

- feste Antwortbausteine für wiederkehrende Fragen:
  - Sprechzeiten
  - Kontaktwege
  - Zuständigkeiten
  - Termine/Veranstaltungen

## KI-Layer (optional, danach)

- nur für semantische Suche in freigegebenen Inhalten.
- Guardrails:
  - keine Fakten ohne Quelle,
  - bei Unsicherheit immer Handover anbieten,
  - Logging für Qualitätskontrolle.

## Datenschutz & Compliance (DE-Kontext)

- Datenschutzhinweis im Widget (Zweck, Speicherdauer, Kontakt).
- Einwilligung für Verarbeitung personenbezogener Daten im Chat.
- PII-Minimierung (z. B. keine sensiblen Daten aktiv abfragen).
- Löschkonzept:
  - z. B. Rohchats nach X Monaten anonymisieren,
  - strukturierte Vorgänge nach interner Aufbewahrungsfrist.
- Rollen/Rechte im Organizer (nur berechtigte Mitarbeitende sehen Konversationen).

## Technischer Stack (empfohlen)

- **Matrix:** Synapse oder gehostet
- **Bot:** Node.js mit matrix-bot-sdk oder mautrix-basierte Lösung
- **Bridge:** Supabase Edge Function/Webhook-Service
- **Organizer:** bestehendes React + Supabase System
- **Monitoring:** Sentry + strukturierte Logs (Conversation-ID als Correlation-ID)

## Konkreter Rollout-Plan

## Phase 1: Discovery (1 Woche)

- Top-20 Bürgeranfragen sammeln.
- Routing-Verantwortliche und Servicezeiten definieren.
- Datenschutz-Check mit Standardtexten.

## Phase 2: MVP bauen (2-3 Wochen)

- Matrix-Bot + Widget live in Staging.
- FAQ-Antworten + Handover.
- Organizer-Inbox für Chat-Anfragen.

## Phase 3: Produktivstart (1 Woche)

- Soft Launch auf Teilseite.
- Tägliches Review von Fehlantworten.
- FAQ und Routing nachjustieren.

## Phase 4: Ausbau

- KI-Suche auf freigegebener Wissensbasis.
- SLA-Reporting (Antwortzeiten, Lösungsquote).
- Automatisierte Nachfass-Workflows.

## KPIs für den Erfolg

- Anteil automatisiert beantworteter Anfragen.
- Zeit bis zur ersten qualifizierten Antwort.
- Übergabequote an menschliches Team.
- Zufriedenheit nach Chat (1-5 Sterne oder Daumen).
- Anzahl unbearbeiteter Fälle > 24h.

## Empfehlung für den Start

Für euren Kontext ist **Variante A als MVP** am sinnvollsten: schnell starten, Bürgernutzen sofort sichtbar machen, dann in 4-6 Wochen gezielt auf Variante B erweitern.

Entscheidend ist nicht die „größte KI“, sondern ein belastbarer Handover-Prozess ins Landtagssystem mit klaren Zuständigkeiten.
