# Flussdiagramm: Button-Wege in **Meine Arbeit → Entscheidungen**

Dieses Diagramm beschreibt die Klick-Pfade, die aus dem Screen `Meine Arbeit / Entscheidungen` heraus über Buttons ausgelöst werden.

```mermaid
flowchart TD
    A[Meine Arbeit / Entscheidungen<br/>MyWorkDecisionsTab] --> B[Top-Bar]
    A --> C[Tabs]
    A --> D[Entscheidungskarte]
    A --> E[Sidebar]
    A --> F[Dialogs]

    %% Top Bar
    B --> B1[Suchen Input]
    B --> B2[Neue Entscheidung<br/>StandaloneDecisionCreator]
    B --> B3[Standard-Teilnehmer<br/>Settings-Button]
    B2 --> F1[Create-Dialog offen]
    B3 --> F2[DefaultParticipantsDialog offen]

    %% Tabs
    C --> C1[Für mich]
    C --> C2[Beantwortet]
    C --> C3[Von mir]
    C --> C4[Öffentlich]
    C1 --> L[Liste gefilterter Karten]
    C2 --> L
    C3 --> L
    C4 --> L

    %% Card main click
    D --> D0[Karte klicken]
    D0 --> F3[TaskDecisionDetails offen]

    %% Creator menu
    D --> D1[... Menü (nur Ersteller)]
    D1 --> D11[Bearbeiten]
    D1 --> D12[Archivieren]
    D1 --> D13[Aufgabe erstellen]
    D1 --> D14[Löschen]
    D11 --> F4[DecisionEditDialog offen]
    D12 --> S1[Status -> archived]
    D13 --> S2[Task in tasks erstellt]
    D14 --> F5[AlertDialog Löschen]
    F5 --> D141[Abbrechen]
    F5 --> D142[Löschen bestätigen]
    D142 --> S3[Entscheidung gelöscht]

    %% Metadata actions
    D --> D2[Kommentar-Button]
    D2 --> F6[DecisionComments offen]

    D --> D3[Datei-Anhänge Popover]
    D3 --> D31[Datei anklicken]
    D31 --> F7[AttachmentPreviewDialog offen]

    D --> D4[E-Mail-Anhänge Popover]
    D4 --> D41[E-Mail anklicken]
    D41 --> F8[EmailPreviewDialog offen]

    %% Response widget
    D --> D5[Antwort-Widget<br/>TaskDecisionResponse]
    D5 --> R0{Antwortmodus}

    R0 --> R1[Standard-Optionen]
    R0 --> R2[Single Acknowledgement]
    R0 --> R3[Single Freitext]
    R0 --> R4[Bereits geantwortet]

    R1 --> R11[Option ohne Kommentar]
    R1 --> R12[Option mit Kommentar/Dialog]
    R1 --> R13[Begründung auf/zu]
    R1 --> R14[Abbrechen Edit]
    R11 --> S4[Antwort speichern]
    R12 --> R121[Dialog: Abbrechen]
    R12 --> R122[Dialog: Senden]
    R122 --> S4

    R2 --> R21[Einzelbutton klicken]
    R2 --> R22[Abbrechen Edit]
    R21 --> S4

    R3 --> R31[Rückmeldung senden]
    R3 --> R32[Abbrechen Edit]
    R31 --> S4

    R4 --> R41[Ändern]
    R41 --> R1

    %% Activity block in card
    D --> D6[Letzte Aktivität]
    D6 --> D61[Antworten (Ersteller)]
    D6 --> D62[Antworten (Teilnehmer auf Creator-Response)]
    D61 --> D63[Inline-Editor Senden]
    D61 --> D64[Inline-Editor Abbrechen]
    D62 --> D63
    D62 --> D64
    D63 --> S5[Inline-Antwort gespeichert]

    %% Sidebar
    E --> E1[Rückfragen-Eintrag]
    E --> E2[Antworten auf dich]
    E --> E3[Begründungen]
    E --> E4[Letzte Aktivitäten Eintrag]
    E --> E5[5 weitere laden]

    E1 --> F3
    E2 --> F3
    E3 --> F3
    E4 --> F3
    E5 --> E4

    %% States
    S1 --> A
    S2 --> A
    S3 --> A
    S4 --> A
    S5 --> A
```

## Hinweise

- Einige Wege sind rollenabhängig (z. B. `...`-Menü nur für Ersteller, Antwortbuttons je nach Teilnehmerstatus).
- Mehrere Buttons führen in denselben Ziel-Dialog (`TaskDecisionDetails`), je nach Kontext mit Highlight auf Kommentar/Response.

## So kannst du das Diagramm ansehen

1. **In VS Code**:
   - Datei `docs/my-work-decisions-button-flowchart.md` öffnen.
   - `Strg+Shift+V` (oder Rechtsklick → **Open Preview**) drücken.
   - Die Mermaid-Grafik wird direkt im Markdown-Preview gerendert.

2. **Auf GitHub/GitLab**:
   - Die Datei im Repository öffnen.
   - Plattformen mit Mermaid-Support rendern den Block automatisch.

3. **Im Mermaid Live Editor** (falls lokal kein Rendering klappt):
   - https://mermaid.live öffnen.
   - Den Inhalt des ```mermaid```-Blocks aus dieser Datei einfügen.
