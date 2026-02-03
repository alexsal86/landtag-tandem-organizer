
# Plan: Fixes fuer Aufgabenansicht und weitere Probleme

## Zusammenfassung der 5 Probleme

| # | Problem | Loesung |
|---|---------|---------|
| 1 | Abstand zwischen Frist-Icon und Verlinkungs-Icon bei Tasks | CSS-Anpassung: Button-Padding reduzieren |
| 2 | Fehler beim Aktivieren/Deaktivieren von Mitteilungen | RLS-Policy oder Fehlerbehandlung im Hook pruefen |
| 3 | Avatar-Hintergruende weiss auf weiss im hellen Modus | Fallback-Farbe anpassen |
| 4 | Profilbild-Upload funktioniert nicht | Storage-Bucket-Zugriff pruefen |
| 5 | Einhorn-Animation auf Meine Arbeit erweitern | UnicornAnimation in MyWorkTasksTab integrieren |

---

## 1. Layout-Fix: Abstand zwischen Frist und Verlinkung entfernen

### Ursache

Das Problem liegt im `Button`-Styling des Navigate-Buttons. Der Button hat `h-7 w-7` was 28px ist, aber auch internen Padding durch `size="icon"`. Da der Container kein `gap` mehr hat, muss der Navigate-Button nahtlos an die Frist anschliessen.

### Loesung

Den Navigate-Button mit weniger horizontalem Spacing stylen:

**Datei: `src/components/tasks/TaskCard.tsx` (Zeile 275-280)**

```typescript
// VORHER:
<Button
  variant="ghost"
  size="icon"
  className="h-7 w-7 flex-shrink-0"
  onClick={() => onNavigate(task.id)}
>

// NACHHER:
<Button
  variant="ghost"
  size="icon"
  className="h-7 w-7 flex-shrink-0 ml-0"
  onClick={() => onNavigate(task.id)}
>
```

Das reicht vermutlich nicht aus. Das Problem ist, dass der Button intrinsisches Padding hat.

**Bessere Loesung**: Den Button direkt auf `p-0` setzen oder ein kleineres `size` verwenden:

```typescript
<Button
  variant="ghost"
  size="sm"
  className="h-6 w-6 p-0 flex-shrink-0"
  onClick={() => onNavigate(task.id)}
>
  <ExternalLink className="h-3 w-3" />
</Button>
```

**Gleiche Aenderung in TaskListRow.tsx (Zeile 240-247)**

---

## 2. Fehler beim Aktivieren/Deaktivieren von Mitteilungen

### Ursache

Basierend auf der Fehleranalyse und dem Code in `useTeamAnnouncements.ts`:

- Die `updateAnnouncement` Funktion (Zeile 200-217) ruft `supabase.from("team_announcements").update(data).eq("id", id)` auf
- Das Problem koennte sein, dass die RLS-Policy nur dem `author_id` das Update erlaubt, aber die Pruefung fehlerhaft ist
- Oder: Das optimistische UI-Update nach `toast.success` schlaegt fehl wegen eines Netzwerkfehlers beim `fetchAnnouncements()`

### Beobachtung

Der Fehler tritt auf, die Aenderung wird aber in der Datenbank gespeichert (nach Neuladen sichtbar). Das deutet auf ein Problem mit dem Realtime-Callback oder der `fetchAnnouncements()`-Funktion hin.

### Loesung

Im Hook `useTeamAnnouncements.ts` die Fehlerbehandlung verbessern:

**Datei: `src/hooks/useTeamAnnouncements.ts` (Zeile 200-217)**

```typescript
const updateAnnouncement = async (id: string, data: Partial<CreateAnnouncementData & { is_active: boolean }>) => {
  // Optimistisches Update der lokalen State VORHER
  const previousAnnouncements = [...announcements];
  
  // Optimistisch die lokalen States aktualisieren
  setAnnouncements(prev => prev.map(a => 
    a.id === id ? { ...a, ...data } : a
  ));
  
  // Auch activeAnnouncements aktualisieren falls noetig
  if (data.is_active !== undefined) {
    if (data.is_active) {
      // Aktiviert - aus activeAnnouncements neu berechnen bei fetchAnnouncements
    } else {
      // Deaktiviert - sofort aus activeAnnouncements entfernen
      setActiveAnnouncements(prev => prev.filter(a => a.id !== id));
    }
  }
  
  try {
    const { error } = await supabase
      .from("team_announcements")
      .update(data)
      .eq("id", id);

    if (error) throw error;

    toast.success("Mitteilung aktualisiert");
    // Kein fetchAnnouncements() hier - das Realtime-Subscription uebernimmt das
    return true;
  } catch (error) {
    console.error("Error updating announcement:", error);
    // Rollback bei Fehler
    setAnnouncements(previousAnnouncements);
    toast.error("Fehler beim Aktualisieren");
    return false;
  }
};
```

---

## 3. Avatar-Hintergruende weiss im hellen Modus

### Ursache

In `src/components/layout/AppHeader.tsx` (Zeile 208):

```typescript
<AvatarFallback className="text-[10px]">
  {onlineUser.display_name?.charAt(0) || "?"}
</AvatarFallback>
```

Der `AvatarFallback` hat keine explizite Hintergrundfarbe. Im Dark Mode funktioniert es, weil der Standard-Hintergrund dunkel ist. Im Light Mode ist der Hintergrund aber weiss und der Text ebenso.

### Loesung

Explizite Hintergrund- und Textfarben setzen:

**Datei: `src/components/layout/AppHeader.tsx` (Zeile 208-210)**

```typescript
// VORHER:
<AvatarFallback className="text-[10px]">

// NACHHER:
<AvatarFallback className="text-[10px] bg-muted text-foreground">
```

Alternative mit mehr Kontrast:

```typescript
<AvatarFallback className="text-[10px] bg-primary/20 text-primary-foreground dark:bg-primary/30 dark:text-white">
```

---

## 4. Profilbild-Upload funktioniert nicht

### Ursache

Der Code in `EditProfile.tsx` (Zeile 106-124) versucht in einen `avatars` Storage-Bucket hochzuladen:

```typescript
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('avatars')  // <-- Bucket muss existieren und public sein
  .upload(fileName, file, { 
    upsert: true,
    contentType: file.type 
  });
```

Das Problem ist wahrscheinlich:
1. Der `avatars` Bucket existiert nicht
2. Oder die RLS-Policies erlauben keinen Upload

### Loesung

1. **Storage Bucket erstellen** - muss im Supabase Dashboard erfolgen:
   - Bucket-Name: `avatars`
   - Public: Ja (damit die URLs oeffentlich abrufbar sind)

2. **RLS-Policies hinzufuegen**:
   ```sql
   -- INSERT Policy: User kann eigene Avatare hochladen
   CREATE POLICY "Users can upload their own avatar" ON storage.objects
   FOR INSERT WITH CHECK (
     bucket_id = 'avatars' AND 
     auth.uid()::text = (storage.foldername(name))[1]
   );
   
   -- UPDATE Policy: User kann eigene Avatare aktualisieren
   CREATE POLICY "Users can update their own avatar" ON storage.objects
   FOR UPDATE USING (
     bucket_id = 'avatars' AND 
     auth.uid()::text = (storage.foldername(name))[1]
   );
   
   -- SELECT Policy: Jeder kann Avatare lesen
   CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
   FOR SELECT USING (bucket_id = 'avatars');
   ```

3. **Bessere Fehlerbehandlung im Code** (optional aber empfohlen):

**Datei: `src/pages/EditProfile.tsx` (Zeile 137-143)**

```typescript
} catch (error: any) {
  console.error('Error uploading file:', error);
  // Spezifischere Fehlermeldung
  const errorMessage = error?.message?.includes('bucket') 
    ? "Der Avatar-Speicher ist nicht konfiguriert. Bitte kontaktieren Sie den Administrator."
    : "Das Bild konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut.";
  toast({
    title: "Upload-Fehler",
    description: errorMessage,
    variant: "destructive",
  });
```

---

## 5. Einhorn-Animation auf Meine Arbeit erweitern

### Aktuelle Situation

Die `UnicornAnimation` ist nur in `TasksView.tsx` integriert. Sie wird bei Task-, Subtask- und Todo-Completion getriggert.

### Loesung

Die gleiche Logik in `MyWorkTasksTab.tsx` einbauen:

**Datei: `src/components/my-work/MyWorkTasksTab.tsx`**

**Import hinzufuegen (Zeile 20):**
```typescript
import { UnicornAnimation } from "@/components/UnicornAnimation";
```

**State hinzufuegen (nach Zeile 74):**
```typescript
const [showUnicorn, setShowUnicorn] = useState(false);
```

**In handleToggleComplete triggern (Zeile 200-201):**
```typescript
// Nach erfolgreichem Complete
setShowUnicorn(true);
toast({ title: "Aufgabe erledigt und archiviert" });
```

**In handleToggleSubtaskComplete triggern (Zeile 217):**
```typescript
setShowUnicorn(true);
toast({ title: "Unteraufgabe erledigt" });
```

**Komponente am Ende rendern (vor dem letzten schliessenden Tag):**
```typescript
{/* Unicorn Animation */}
<UnicornAnimation 
  isVisible={showUnicorn} 
  onAnimationComplete={() => setShowUnicorn(false)} 
/>
```

---

## 6. Admin-konfigurierbare Einhorn-Grafik (Diskussion)

### Optionen

Es gibt mehrere Ansaetze, die Animation ueber den Admin-Bereich konfigurierbar zu machen:

| Option | Aufwand | Beschreibung |
|--------|---------|--------------|
| A) Einfacher Toggle | Gering | Admin kann Animation ein/ausschalten (global oder pro Benutzer) |
| B) Vordefinierte Animationen | Mittel | Auswahl aus 3-5 verschiedenen Animationen (Einhorn, Feuerwerk, Konfetti, etc.) |
| C) Benutzerdefinierte Grafik | Hoch | Admin kann eigene SVG/GIF hochladen |

### Empfohlener Ansatz: Option B

1. **Neue Tabelle** `app_settings` erweitern um:
   - `completion_animation`: Enum ('unicorn', 'confetti', 'firework', 'none')
   
2. **Admin-UI** in den Einstellungen:
   - Dropdown zur Auswahl der Animation
   - Vorschau-Button um die Animation zu testen

3. **Animation-Komponente** erweitern:
   ```typescript
   // CompletionAnimation.tsx
   export function CompletionAnimation({ type, isVisible, onComplete }) {
     switch(type) {
       case 'unicorn': return <UnicornAnimation ... />;
       case 'confetti': return <ConfettiAnimation ... />;
       case 'firework': return <FireworkAnimation ... />;
       default: return null;
     }
   }
   ```

### Naechste Schritte fuer Admin-Konfiguration

Dies wuerde ich als separates Feature empfehlen. Soll ich dafuer einen eigenen Plan erstellen?

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderung |
|-------|-----------|
| `TaskCard.tsx` | Zeile 275-280: Button-Styling fuer nahtlose Aneinanderreihung |
| `TaskListRow.tsx` | Zeile 240-247: Button-Styling fuer nahtlose Aneinanderreihung |
| `useTeamAnnouncements.ts` | Zeile 200-217: Optimistisches Update und bessere Fehlerbehandlung |
| `AppHeader.tsx` | Zeile 208-210: AvatarFallback mit expliziten Farben |
| `EditProfile.tsx` | Zeile 137-143: Bessere Fehlermeldung, plus Storage-Bucket erstellen |
| `MyWorkTasksTab.tsx` | Import, State, Trigger in Handlers, Komponente rendern |

