

## Plan: Dossier-Seitenpanel (Split-Layout wie Kontakte)

### Ziel
Die Dossiers-Ansicht bekommt ein Split-Layout analog zu den Kontakten: Links ein schmales Seitenpanel mit Navigation (Eingang, Dossiers, Artikel) und ggf. Schnellzugriff-Elementen, rechts der eigentliche Inhalt.

### Änderungen

**Neue Datei: `src/features/dossiers/components/DossiersSidePanel.tsx`**
- Schmales Panel (280px, `border-r`) nach dem Vorbild von `ContactsSidePanel`
- Titel "Wissen" mit Kurzbeschreibung
- Drei Navigations-Buttons: 📥 Eingang, 📁 Dossiers, 📄 Artikel — mit aktiver Hervorhebung
- Anzahl-Badge für Eingang (ungelesene Einträge) und Dossiers (Gesamtzahl)
- Darunter: das bestehende `QuickCapture`-Widget für schnelle Inbox-Erfassung
- Bei Dossier-Detailansicht: Dossier-Liste im Panel anzeigen mit aktivem Dossier hervorgehoben, damit man zwischen Dossiers wechseln kann

**Geänderte Datei: `src/features/dossiers/components/DossiersMainView.tsx`**
- Tabs-Layout ersetzen durch `flex`-Split-Layout
- Links: `DossiersSidePanel` (activeTab + Setter)
- Rechts: Inhalt je nach activeTab (InboxView / DossierListView / KnowledgeBaseView)
- Container bekommt `h-app-headerless` für volle Höhe (wie ContactsView)
- Bei Dossier-Detail: Panel zeigt Dossier-Liste, rechts die Detailansicht

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/features/dossiers/components/DossiersSidePanel.tsx` | Neue Komponente — Navigation + QuickCapture |
| `src/features/dossiers/components/DossiersMainView.tsx` | Tabs → Split-Layout mit Side-Panel |

### Ergebnis
Statt horizontal wechselbarer Tabs gibt es ein dauerhaft sichtbares linkes Panel, das als zweite Navigationsebene dient — konsistent mit dem Kontakte-Layout.

