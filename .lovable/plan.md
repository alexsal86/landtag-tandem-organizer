
# Plan: Monatssoll-Berechnung korrigieren & Admin-Zeiterfassungsübersicht

## Zusammenfassung der Probleme

### Problem 1: Monatssoll-Berechnung falsch
**Aktueller Zustand:**
- Die Datenbank speichert `hours_per_month = 171` als statischen Wert
- Das entspricht `39.5h/Woche * 52 Wochen / 12 Monate = 171h` (Durchschnitt)
- **Aber:** Für Januar 2026 gibt es nur 20 Arbeitstage (abzüglich Wochenenden und Feiertagen)
- Korrektes Soll: `7.9h/Tag × 20 Tage = 158 Stunden`

**Lösung:**
- Das Monatssoll muss **dynamisch** berechnet werden:
  1. `dailyHours = hours_per_week / days_per_week` (z.B. 39.5 / 5 = 7.9h)
  2. `monthlyTarget = dailyHours × tatsächliche Arbeitstage im Monat`
  3. Arbeitstage = Kalendertage - Wochenenden - Feiertage

**Betroffene Dateien:**
- `TimeTrackingView.tsx` - bereits korrekt (Zeile 210-211 berechnet dynamisch)
- `MyWorkTimeTrackingTab.tsx` - **FALSCH** (Zeile 114: `hours_per_month / days_per_month`)
- `EmployeeInfoTab.tsx` - zeigt statischen Wert (info-only, aber irreführend)

### Problem 2: Neue Admin-Zeiterfassungsübersicht

Eine umfassende Übersicht für den Abgeordneten (Admin) fehlt, die:
1. Alle Mitarbeiter-Zeiteinträge anzeigt
2. Abwesenheitshistorie (Urlaub, Krankheit, Überstundenabbau, Arzttermine) mit Entscheidungen zeigt
3. Direkte Bearbeitung aller Zeiteinträge ermöglicht
4. Überstundenkorrekturen (z.B. auf Null setzen) ermöglicht
5. Monatliche Übersichten pro Mitarbeiter bietet

---

## Technische Änderungen

### Änderung 1: MyWorkTimeTrackingTab.tsx - dailyHours korrigieren

**Datei:** `src/components/my-work/MyWorkTimeTrackingTab.tsx`
**Zeile 112-115:**

```typescript
// ALT (falsch):
const dailyHours = useMemo(() => {
  if (!employeeSettings) return 8;
  return employeeSettings.hours_per_month / employeeSettings.days_per_month;
}, [employeeSettings]);

// NEU (korrekt):
const dailyHours = useMemo(() => {
  if (!employeeSettings) return 7.9;
  // Tägliche Arbeitszeit = Wochenstunden / Arbeitstage pro Woche
  return employeeSettings.hours_per_week / (employeeSettings.days_per_week || 5);
}, [employeeSettings]);
```

**Zusätzlich:** Interface erweitern (Zeile 28-32):
```typescript
interface EmployeeSettingsRow {
  hours_per_week: number;
  hours_per_month: number;
  days_per_month: number;
  days_per_week: number; // NEU
}
```

**Query anpassen (Zeile 84):**
```typescript
supabase.from("employee_settings")
  .select("hours_per_week, hours_per_month, days_per_month, days_per_week")
  .eq("user_id", user.id).single(),
```

### Änderung 2: Neue Komponente AdminTimeTrackingView

**Neue Datei:** `src/components/AdminTimeTrackingView.tsx`

Diese umfassende Admin-Übersicht enthält:

**2.1 Mitarbeiter-Auswahl mit Tabs:**
- Dropdown oder Tabs zur Auswahl des Mitarbeiters
- Schnellübersicht mit Soll/Ist pro Monat
- Überstundensaldo-Anzeige

**2.2 Monats-Zeittabelle:**
- Alle Zeiteinträge des ausgewählten Mitarbeiters für den Monat
- Bearbeitungs-Button pro Zeile (öffnet `AdminTimeEntryEditor`)
- Anzeige von: Datum, Start, Ende, Brutto, Pause, Netto, Notizen, Bearbeitet-Badge
- Farbliche Hervorhebung: Feiertage grün, Krankheit orange, Urlaub blau

**2.3 Abwesenheitshistorie:**
- Tabelle mit allen Anträgen des Mitarbeiters
- Spalten: Typ, Zeitraum, Status, Entscheidung durch, Entscheidungsdatum
- Filter nach Jahr
- Badge-Farben: Urlaub 🏖️ blau, Krank 🤒 orange, Arzttermin 🏥 lila, Überstundenabbau ⏰ amber

**2.4 Saldo-Korrektur-Funktion:**
```typescript
// Beispiel: Überstunden auf Null korrigieren
const handleOvertimeCorrection = async (userId: string, correctionMinutes: number, reason: string) => {
  // Erstellt einen speziellen Korrektur-Eintrag
  await supabase.from("time_entry_corrections").insert({
    user_id: userId,
    correction_date: format(new Date(), "yyyy-MM-dd"),
    correction_minutes: correctionMinutes, // negativ = Stunden abziehen
    reason: reason,
    created_by: adminUserId,
  });
};
```

**2.5 SQL-Migration für Korrekturtabelle:**
```sql
CREATE TABLE IF NOT EXISTS public.time_entry_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  correction_date date NOT NULL DEFAULT CURRENT_DATE,
  correction_minutes integer NOT NULL, -- positiv = hinzufügen, negativ = abziehen
  reason text NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE time_entry_corrections ENABLE ROW LEVEL SECURITY;

-- Nur Admins können Korrekturen erstellen/lesen
CREATE POLICY "Admins can manage corrections" ON time_entry_corrections
  FOR ALL USING (public.is_admin(auth.uid()));

-- Mitarbeiter können eigene Korrekturen sehen
CREATE POLICY "Users can view own corrections" ON time_entry_corrections
  FOR SELECT USING (user_id = auth.uid());
```

### Änderung 3: Integration in EmployeesView

**Datei:** `src/components/EmployeesView.tsx`

**Neuer Button im Header (nach Zeile 1297):**
```tsx
<Button 
  variant="outline" 
  onClick={() => navigate("/employee?tab=timetracking")}
  className="flex items-center gap-2"
>
  <Clock className="h-4 w-4" />
  Zeiterfassung
</Button>
```

**Oder: Neuer Tab in der Ansicht:**
```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Übersicht</TabsTrigger>
    <TabsTrigger value="timetracking">Zeiterfassung</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    {/* Bestehende Mitarbeiterliste */}
  </TabsContent>
  <TabsContent value="timetracking">
    <AdminTimeTrackingView />
  </TabsContent>
</Tabs>
```

### Änderung 4: Admin-Zeiteinträge bearbeiten (bereits vorhanden, erweitern)

**Datei:** `src/components/AdminTimeEntryEditor.tsx`

Zusätzliche Features:
- Löschen-Button mit Bestätigung
- Historie der Änderungen anzeigen
- Duplikat-Prüfung (falls bereits Eintrag an diesem Tag existiert)

### Änderung 5: EmployeeInfoTab - Dynamisches Monatssoll anzeigen

**Datei:** `src/components/EmployeeInfoTab.tsx`

Statt statisches `hours_per_month` zu zeigen, Hinweis ergänzen:

```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm text-muted-foreground">
      Stunden/Monat (Durchschnitt)
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-semibold">
      {employeeSettings.hours_per_month}h
    </div>
    <div className="text-xs text-muted-foreground">
      Tatsächliches Soll variiert je nach Arbeitstagen im Monat
    </div>
  </CardContent>
</Card>
```

---

## Struktur der AdminTimeTrackingView

```text
AdminTimeTrackingView
├── Header
│   ├── Mitarbeiter-Dropdown
│   └── Monat-Navigation (← Januar 2026 →)
│
├── Übersichtskarten
│   ├── Soll (dynamisch berechnet)
│   ├── Ist (gearbeitete Stunden)
│   ├── Saldo (+/- Überstunden)
│   └── Abwesenheiten (Tage)
│
├── Tabs
│   ├── "Zeiteinträge"
│   │   └── Tabelle mit allen Einträgen + Bearbeiten-Button
│   ├── "Abwesenheiten"
│   │   └── Tabelle mit Urlaub/Krank/Arzt/Überstundenabbau + Status
│   └── "Korrekturen"
│       ├── Bisherige Korrekturen anzeigen
│       └── "Korrektur hinzufügen" Button
│
└── Dialoge
    ├── AdminTimeEntryEditor (bearbeiten)
    └── CorrectionDialog (Saldo korrigieren)
```

---

## Zusammenfassung der Änderungen

| # | Datei/Ressource | Problem | Lösung |
|---|-----------------|---------|--------|
| 1 | `MyWorkTimeTrackingTab.tsx` | dailyHours falsch berechnet | `hours_per_week / days_per_week` verwenden |
| 2 | SQL-Migration | Keine Korrektur-Tabelle | `time_entry_corrections` erstellen |
| 3 | Neue Komponente | Admin fehlt Überblick | `AdminTimeTrackingView.tsx` erstellen |
| 4 | `EmployeesView.tsx` | Kein Zugang zur Admin-Zeiterfassung | Tab/Button hinzufügen |
| 5 | `EmployeeInfoTab.tsx` | Statischer Wert irreführend | Hinweis "variiert je Monat" |
| 6 | `AdminTimeEntryEditor.tsx` | Basis vorhanden | Erweitern um Löschen + Historie |

---

## Erwartete Ergebnisse

1. **Korrektes Monatssoll:** Januar 2026 zeigt 158 Stunden statt 171
2. **Admin-Übersicht:** Abgeordneter hat zentrale Anlaufstelle für alle Zeiterfassungsdaten
3. **Abwesenheits-Transparenz:** Historie aller Anträge mit Entscheidungen sichtbar
4. **Saldo-Korrektur:** Überstunden können administrativ auf beliebigen Wert korrigiert werden
5. **Audit-Trail:** Alle Änderungen werden protokolliert und sind nachvollziehbar
