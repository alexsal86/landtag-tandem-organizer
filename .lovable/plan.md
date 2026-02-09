
# Plan: 3 kritische Entscheidungssystem-Fehler endgueltig beheben

## Analyse der Root Causes

### Issue 1: Entscheidungen verschwinden nach Abstimmung

**Root Cause identifiziert:** Die Datenbank-Trigger-Funktion `auto_archive_completed_decisions` wird bei jedem INSERT in `task_decision_responses` ausgeloest. Sie ruft `check_and_archive_decision()` auf, die automatisch den Status auf `'archived'` setzt, sobald alle Teilnehmer abgestimmt haben UND keine offenen Rueckfragen existieren.

Das bedeutet: Sobald der letzte Teilnehmer seine Stimme abgibt, wird die Entscheidung **sofort automatisch archiviert**.

**Frontend-Problem:** Beide Ansichten (DecisionOverview.tsx und MyWorkDecisionsTab.tsx) laden nur aktive Entscheidungen fuer die Tabs "Fuer mich", "Beantwortet", "Von mir":
- `MyWorkDecisionsTab` Zeile 81/94: `.in("task_decisions.status", ["active", "open"])` -- archivierte werden nicht geladen
- `DecisionOverview` Zeile 188/219: `.in('task_decisions.status', ['active', 'open'])` -- gleiche Filterung

Der "Beantwortet"-Tab filtert nach `d.isParticipant && d.hasResponded && !d.isCreator`, aber da die Entscheidung bereits archiviert ist, wird sie gar nicht erst geladen. Sie taucht auch nicht unter "Archiv" auf, weil der Archiv-Tab in `MyWorkDecisionsTab` gar nicht existiert.

In `DecisionOverview` gibt es zwar einen Archiv-Tab, aber die Filter-Logik in Zeile 777 filtert "Beantwortet" auf `d.status !== 'archived'`, wodurch auto-archivierte Entscheidungen dort ebenfalls nicht erscheinen.

**Loesung:** Das Auto-Archivieren abschalten und stattdessen nur eine visuelle Markierung als "Entschieden/Abgeschlossen" vornehmen. Die Entscheidung bleibt aktiv, bis der Ersteller sie manuell archiviert. Nur bei einer manuellen Archivierung wird der Status geaendert.

Konkret:
1. **DB-Migration:** Den Trigger `trigger_auto_archive_decisions` auf `task_decision_responses` entfernen (DROP TRIGGER). Die Trigger-Funktion und die Helper-Funktion bleiben erhalten fuer zukuenftigen Gebrauch, aber der automatische Trigger wird deaktiviert.
2. **Alternativ:** Den `check_archive_after_creator_response` Trigger ebenfalls entfernen, da dieser nach dem Beantworten einer Rueckfrage ebenfalls auto-archiviert.
3. Die Entscheidungskarten zeigen bereits visuell an, ob alle abgestimmt haben (gruener "Entschieden"-Badge). Das reicht als Indikator.

### Issue 2: Fehler beim Archivieren/Wiederherstellen/Bearbeiten in TaskDecisionDetails

**Root Cause:** In der Netzwerkanalyse ist eine fehlgeschlagene PATCH-Anfrage zu sehen:
```
PATCH https://...supabase.co/rest/v1/task_decisions?id=eq.8f23d4ec-...
Error: Failed to fetch
```

Das `TaskDecisionDetails.tsx` sieht nach der letzten Korrektur korrekt aus (Zeile 187-196 verwendet kein `.select()`). Aber der **Fehler kommt von der `DecisionEditDialog`-Interaktion** -- dort wird beim Speichern (Zeile 112-119) ein UPDATE durchgefuehrt, der korrekt aussieht.

Nach weiterer Analyse: Die RLS-Policies sind bereinigt und korrekt (nur eine UPDATE-Policy: `"Users can update their decisions"` mit `tenant_id + created_by` Pruefung, ohne WITH CHECK).

Der "Failed to fetch"-Fehler im Netzwerk-Log deutet auf ein **Netzwerk-/Timing-Problem** hin, nicht auf eine RLS-Blockade. Der Fehler tritt auf, weil:
1. Der User klickt "Speichern" im Edit-Dialog
2. Die PATCH-Anfrage wird gesendet
3. Gleichzeitig navigiert der User oder das Frontend schließt den Dialog
4. Die laufende Anfrage wird abgebrochen ("Failed to fetch")

**Aber:** Der User meldet explizit, dass Archivieren/Wiederherstellen/Bearbeiten Fehler zeigt. Da die DB-Logs keine Fehler zeigen und die Operations tatsaechlich funktionieren (Daten werden gespeichert), liegt das Problem im Frontend-Error-Handling.

Moegliche weitere Ursache: Die `loadDecisionDetails()` Funktion (Zeile 64-142) laedt die Entscheidung mit `.eq('id', decisionId).single()`. Wenn der Status nach einer Archivierung auf `'archived'` gesetzt wurde, koennte die **SELECT RLS-Policy** die Zeile fuer Nicht-Ersteller ausblenden. Die SELECT-Policy erlaubt:
- `created_by = auth.uid()` ODER
- `visible_to_all = true` ODER  
- User ist Teilnehmer

Fuer den Ersteller sollte das funktionieren. Wenn der Ersteller archiviert und dann `onArchived()` aufruft, wird die Liste neu geladen -- aber da die Entscheidung jetzt `archived` ist, wird sie in der aktiven Liste nicht mehr gefunden.

**Loesung:** 
1. Im `TaskDecisionDetails` sicherstellen, dass nach dem Archivieren der Dialog sofort geschlossen wird OHNE die Daten nochmal zu laden
2. `onArchived` wird aufgerufen um die uebergeordnete Liste zu aktualisieren
3. Statt `.single()` in `loadDecisionDetails` einen Check einbauen, ob die Entscheidung existiert (`.maybeSingle()`)

### Issue 3: Standard-Teilnehmer bei TaskDecisionCreator und NoteDecisionCreator

**Root Cause im TaskDecisionCreator (Zeile 92-142):** Die `loadProfiles`-Funktion liest NICHT aus `localStorage`. Sie selektiert nur Abgeordnete automatisch (Zeile 113-134). Die `default_decision_participants`-Logik fehlt hier komplett.

**Root Cause im NoteDecisionCreator:** Der Code sieht korrekt aus (Zeile 110-130). Aber ein Timing-Problem: Die `loadProfiles` Funktion wird durch den useEffect bei `[open, currentTenant?.id]` getriggert. Wenn `open` schnell hintereinander wechselt oder `currentTenant` sich aendert, wird die Funktion mehrfach aufgerufen und das `setSelectedUsers` wird ueberschrieben.

Zusaetzlich: Der Zustand `selectedUsers` wird bei jeder Dialog-Oeffnung zurueckgesetzt, weil `loadProfiles` bei jedem `open === true` aufgerufen wird und `setSelectedUsers` in beiden Code-Pfaden (defaults oder fallback) aufgerufen wird.

**Loesung:** In **beiden** Creatorn die Default-Teilnehmer-Logik einheitlich implementieren:
1. `TaskDecisionCreator.tsx`: `localStorage.getItem('default_decision_participants')` abfragen, bevor der Abgeordneten-Fallback greift
2. `NoteDecisionCreator.tsx`: Sicherstellen, dass die Defaults nicht ueberschrieben werden (Flag `hasLoadedDefaults`)

---

## Technische Details

### Fix 1: Auto-Archivierung deaktivieren

**DB-Migration:**

```sql
-- Auto-Archivierungs-Trigger entfernen
-- Die Entscheidung bleibt aktiv bis der Ersteller sie manuell archiviert
DROP TRIGGER IF EXISTS trigger_auto_archive_decisions ON public.task_decision_responses;
DROP TRIGGER IF EXISTS trigger_check_archive_on_creator_response ON public.task_decision_responses;
```

Die Funktionen `auto_archive_completed_decisions`, `check_archive_after_creator_response` und `check_and_archive_decision` bleiben erhalten (keine Aenderung), da sie nicht aufgerufen werden, wenn die Trigger entfernt sind.

### Fix 2: TaskDecisionDetails Fehlerbehandlung

**Datei:** `src/components/task-decisions/TaskDecisionDetails.tsx`

- `loadDecisionDetails()`: `.single()` durch `.maybeSingle()` ersetzen und NULL-Check hinzufuegen
- `archiveDecision()`: Nach erfolgreichem Update sofort `onArchived()` und `onClose()` aufrufen -- kein Reload der Details noetig
- Das Restore-Feature fehlt im TaskDecisionDetails komplett (es gibt nur Archivieren, kein Wiederherstellen). Das Wiederherstellen funktioniert ueber die Dropdown-Menues in DecisionOverview und MyWorkDecisionsTab, deren Code korrekt aussieht.

Aenderungen:
```typescript
// loadDecisionDetails - Zeile 83: .single() -> .maybeSingle()
const { data: decisionData, error: decisionError } = await supabase
  .from('task_decisions')
  .select(...)
  .eq('id', decisionId)
  .maybeSingle();

if (decisionError) throw decisionError;
if (!decisionData) {
  // Decision not accessible (archived/deleted)
  toast({ title: "Info", description: "Diese Entscheidung ist nicht mehr verfuegbar." });
  onClose();
  return;
}
```

### Fix 3: Standard-Teilnehmer in TaskDecisionCreator

**Datei:** `src/components/task-decisions/TaskDecisionCreator.tsx`

In der `loadProfiles`-Funktion (Zeile 92-142), nach dem Laden der Profile und Tenant-Members, die Default-Teilnehmer aus localStorage pruefen:

```typescript
const loadProfiles = async () => {
  // ... existing profile loading code ...
  
  setProfiles(data || []);
  
  // Check for default participants from settings FIRST
  let defaultIds: string[] = [];
  try {
    const stored = localStorage.getItem('default_decision_participants');
    if (stored) defaultIds = JSON.parse(stored);
  } catch (e) {}
  
  if (defaultIds.length > 0 && tenantData?.tenant_id) {
    const { data: tenantMembers } = await supabase
      .from('user_tenant_memberships')
      .select('user_id')
      .eq('tenant_id', tenantData.tenant_id)
      .eq('is_active', true);
    
    const tenantUserIds = new Set(tenantMembers?.map(m => m.user_id) || []);
    const validDefaults = defaultIds.filter(id => 
      tenantUserIds.has(id) && id !== userData.user.id
    );
    
    if (validDefaults.length > 0) {
      setSelectedUsers(validDefaults);
      setProfilesLoaded(true);
      return; // Early return - don't fall through to Abgeordneter
    }
  }
  
  // Fallback: Pre-select Abgeordneter (existing logic)
  // ...
};
```

### Fix 3b: NoteDecisionCreator robuster machen

**Datei:** `src/components/shared/NoteDecisionCreator.tsx`

Die aktuelle Logik sieht zwar korrekt aus, aber der `useEffect` laeuft bei jedem Oeffnen. Wenn der User den Dialog oeffnet, werden die Defaults geladen, aber wenn `currentTenant?.id` sich kurz danach aktualisiert, laeuft `loadProfiles` erneut und setzt die Auswahl zurueck. 

Loesung: Ein Flag `hasLoadedDefaults` hinzufuegen, das verhindert, dass die Auswahl beim zweiten Aufruf ueberschrieben wird:

```typescript
const [hasInitialized, setHasInitialized] = useState(false);

useEffect(() => {
  if (open && currentTenant?.id) {
    loadProfiles();
  }
  if (!open) {
    setHasInitialized(false); // Reset when dialog closes
  }
}, [open, currentTenant?.id]);

const loadProfiles = async () => {
  // Profile laden immer
  // ...
  setProfiles(filteredProfiles);
  
  // Aber Auswahl nur beim ersten Mal setzen
  if (hasInitialized) return;
  setHasInitialized(true);
  
  // Default-Teilnehmer Logik...
};
```

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| DB-Migration | Auto-Archivierungs-Trigger entfernen |
| Bearbeiten | `src/components/task-decisions/TaskDecisionDetails.tsx` (`.maybeSingle()`, Fehlerbehandlung) |
| Bearbeiten | `src/components/task-decisions/TaskDecisionCreator.tsx` (Default-Teilnehmer aus localStorage) |
| Bearbeiten | `src/components/shared/NoteDecisionCreator.tsx` (hasInitialized Flag) |

## Reihenfolge

1. **DB-Migration** - Auto-Archivierungs-Trigger entfernen (behebt Punkt 1 und teilweise Punkt 2)
2. **TaskDecisionDetails** - Fehlerbehandlung mit `.maybeSingle()` verbessern (behebt Punkt 2)
3. **TaskDecisionCreator** - Default-Teilnehmer aus localStorage (behebt Punkt 3)
4. **NoteDecisionCreator** - Robustere Initialisierung (behebt Punkt 3)
5. Browser-Test aller Aenderungen
