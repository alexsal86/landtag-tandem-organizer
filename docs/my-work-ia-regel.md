# Verbindliche IA-Regel für „Meine Arbeit“

## Geltungsbereich
Diese Regel ist verbindlich für die Informationsarchitektur im Bereich **Meine Arbeit**.

## Tab-Zuordnung
- Der Tab **„Anliegen“** zeigt ausschließlich Datensätze aus **`case_items`** (Inbox/Arbeitskorb).
- Der Tab **„Vorgänge & Akten“** zeigt ausschließlich Datensätze aus **`case_files`** (Dossier-Ebene).

## Eskalationsrichtung
- Die Eskalationslogik **`suggest-case-escalations`** dient als Brücke **nur in eine Richtung**:
  - von **`case_items`** nach **`case_files`**.
- UI-Aktionen zur Überführung/Zuordnung werden im Tab **„Anliegen“** angeboten.
- Der Tab **„Vorgänge & Akten“** enthält keine `case_items`-Segmentierung.
