
# Plan: 6 Fixes fuer Meine Arbeit und Profilbilder

## Zusammenfassung

| # | Problem | Loesung |
|---|---------|---------|
| 1 | HTML-Tags in Aufgabenbeschreibungen unter "Mir zugewiesene Aufgaben" | RichTextDisplay in AssignedItemsSection.tsx verwenden |
| 2 | Aufgabe aus Notiz uebernimmt Prioritaet nicht | Priority-Mapping in QuickNotesList.tsx einbauen |
| 3 | Profilbild-Verzerrung und fehlende Fokus-Funktion | Image Cropper mit react-image-crop integrieren |
| 4 | Profilbild zeigt nach Upload ein altes Bild | Timestamp zur URL hinzufuegen und Cache-Busting |
| 5 | Ctrl + . fehlt in globaler Hilfe | Shortcut im AppNavigation Help-Dialog ergaenzen |
| 6 | Archivierte Mitteilungen reaktivieren schlaegt fehl | Fehlerbehandlung in useTeamAnnouncements verbessern |

---

## 1. HTML-Tags in Beschreibungen der Zugewiesenen Aufgaben

### Ursache

In `AssignedItemsSection.tsx` (Zeile 190-193) wird die Beschreibung als einfacher Text gerendert:

```typescript
{description && (
  <p className="text-sm text-muted-foreground line-clamp-2">
    {description.length > 150 ? `${description.substring(0, 150)}...` : description}
  </p>
)}
```

Das fuehrt dazu, dass HTML-Tags wie `<p>`, `<ul>`, `<b>` als roher Text angezeigt werden.

### Loesung

RichTextDisplay-Komponente verwenden (wie bereits in AssignedItemCard gemacht):

**Datei: `src/components/tasks/AssignedItemsSection.tsx`**

Import hinzufuegen:
```typescript
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
```

Zeile 190-193 ersetzen:
```typescript
{description && (
  <RichTextDisplay 
    content={description} 
    className="text-sm text-muted-foreground line-clamp-2" 
  />
)}
```

---

## 2. Aufgabe aus Notiz uebernimmt Prioritaet

### Ursache

In `QuickNotesList.tsx` (Zeile 871) wird die Prioritaet fest auf `medium` gesetzt:

```typescript
priority: 'medium',
```

Die `priority_level` der Notiz wird nicht ausgelesen oder gemappt.

### Loesung

Priority-Mapping einfuehren:
- Level 0 (Ohne) und Level 1 -> `low`
- Level 2 -> `medium`
- Level 3 -> `high`

**Datei: `src/components/shared/QuickNotesList.tsx` (Zeile 855-876)**

Vor der Task-Erstellung das Mapping durchfuehren:
```typescript
// Map note priority_level to task priority
const mapNotePriorityToTaskPriority = (level: number | undefined | null): 'low' | 'medium' | 'high' => {
  if (!level || level <= 1) return 'low';
  if (level === 2) return 'medium';
  return 'high'; // level 3 or higher
};

const taskPriority = mapNotePriorityToTaskPriority(note.priority_level);

// In der insert-Anweisung:
priority: taskPriority,
```

---

## 3. Profilbild-Verzerrung und fehlende Fokus-Funktion

### Ursache

Aktuell wird das Bild direkt hochgeladen ohne Bearbeitung. Wenn ein nicht-quadratisches Bild als rundes Avatar angezeigt wird, wirkt es verzerrt oder abgeschnitten an falscher Stelle.

### Loesung

Einen Image Cropper implementieren, der:
1. Quadratischen Ausschnitt ermoeglicht
2. Fokuspunkt verschieben laesst
3. Alle gaengigen Formate akzeptiert

**Ansatz:** Eine neue Komponente `ImageCropper.tsx` erstellen mit einem Canvas-basierten Cropper:

```typescript
// src/components/ui/ImageCropper.tsx
interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number; // Default 1 fuer quadratisch
}
```

**Funktionsweise:**
1. Benutzer waehlt ein Bild aus
2. Dialog oeffnet sich mit Cropper-UI
3. Benutzer zieht den quadratischen Rahmen auf den gewuenschten Bereich
4. "Zuschneiden" generiert einen Canvas-Crop als Blob
5. Blob wird hochgeladen

**Technische Umsetzung ohne externe Bibliothek:**
- Canvas API fuer das Cropping verwenden
- Drag-and-Drop fuer den Crop-Bereich
- Slider fuer Zoom

**Aenderung in EditProfile.tsx:**
1. Zwischenzustand `imageToEdit` hinzufuegen
2. Nach Dateiauswahl: Preview in Cropper zeigen
3. Nach Croppen: Blob hochladen

```typescript
const [imageToEdit, setImageToEdit] = useState<string | null>(null);
const [croppingFile, setCroppingFile] = useState<File | null>(null);

// Bei Dateiauswahl:
const handleFileSelect = (e) => {
  const file = e.target.files?.[0];
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = () => setImageToEdit(reader.result as string);
    reader.readAsDataURL(file);
    setCroppingFile(file);
  }
};

// Nach Crop:
const handleCropComplete = async (blob: Blob) => {
  setImageToEdit(null);
  // Upload blob statt original file
  const fileName = `${user.id}/avatar_${Date.now()}.webp`;
  // ... upload logic
};
```

---

## 4. Profilbild zeigt nach Upload ein altes Bild (Cache-Problem)

### Ursache

Der Dateiname ist immer `avatar.{ext}`. Beim zweiten Upload mit anderem Format (z.B. erst JPG, dann PNG) bleibt die alte URL im Browser-Cache. Die `publicUrl` hat keinen Cache-Buster.

### Loesung

1. **Einheitlicher Dateiname mit Timestamp:**
```typescript
const fileName = `${user.id}/avatar_${Date.now()}.webp`;
```

2. **Cache-Busting Query-Parameter an URL:**
```typescript
const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
setFormData(prev => ({
  ...prev,
  avatar_url: urlWithCacheBust
}));
```

3. **Alte Dateien loeschen (optional):**
```typescript
// Vor dem Upload alle alten avatare loeschen
const { data: existingFiles } = await supabase.storage
  .from('avatars')
  .list(user.id);

if (existingFiles?.length) {
  const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
  await supabase.storage.from('avatars').remove(filesToDelete);
}
```

**Zusammengefasster Upload-Code in EditProfile.tsx:**

```typescript
try {
  // Delete old avatars first
  const { data: existingFiles } = await supabase.storage
    .from('avatars')
    .list(user.id);

  if (existingFiles?.length) {
    await supabase.storage
      .from('avatars')
      .remove(existingFiles.map(f => `${user.id}/${f.name}`));
  }

  // Upload with unique timestamp-based filename
  const fileName = `${user.id}/avatar_${Date.now()}.webp`;
  
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, croppedBlob, { 
      contentType: 'image/webp' 
    });

  if (uploadError) throw uploadError;

  // Get URL with cache-buster
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
  
  setFormData(prev => ({
    ...prev,
    avatar_url: urlWithCacheBust
  }));
  
  toast({ title: "Bild hochgeladen" });
} catch (error) {
  // ...
}
```

---

## 5. Ctrl + . fehlt in globaler Hilfe

### Ursache

Der Shortcut `Ctrl + .` fuer "Neue Notiz erstellen" ist nicht im Hilfe-Dialog aufgelistet (AppNavigation.tsx, Zeile 547-563).

### Loesung

**Datei: `src/components/AppNavigation.tsx` (Zeile 559-562)**

Neuen Eintrag hinzufuegen:

```typescript
<div className="flex justify-between items-center">
  <span>Neue Notiz erstellen</span>
  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + .</kbd>
</div>
```

Nach "Neue Aufgabe" einfuegen.

---

## 6. Archivierte Mitteilungen reaktivieren schlaegt fehl

### Ursache

Basierend auf dem Code in `useTeamAnnouncements.ts` (Zeile 200-236) gibt es bereits ein optimistisches Update mit Rollback. Das Problem koennte sein:

1. Der Toast zeigt "Fehler" obwohl das Update erfolgreich war (weil der nachfolgende Fetch fehlschlaegt)
2. Die RLS-Policy erlaubt kein Update fuer archivierte Mitteilungen
3. Netzwerkfehler beim Polling nach dem Update

### Analyse des Codes

```typescript
try {
  const { error } = await supabase
    .from("team_announcements")
    .update(data)
    .eq("id", id);

  if (error) throw error;

  toast.success("Mitteilung aktualisiert");
  return true;
} catch (error) {
  // Rollback on error
  setAnnouncements(previousAnnouncements);
  setActiveAnnouncements(previousActiveAnnouncements);
  toast.error("Fehler beim Aktualisieren");
  return false;
}
```

Der Code sieht korrekt aus. Wenn der Benutzer nach Neuladen sieht, dass es funktioniert hat, dann ist das Problem wahrscheinlich:

1. Ein Fehler tritt **nach** dem erfolgreichen Update auf (z.B. Realtime-Subscription)
2. Oder die Supabase-Antwort wird als Fehler interpretiert

### Loesung

Detaillierteres Error-Logging und robustere Behandlung:

**Datei: `src/hooks/useTeamAnnouncements.ts` (Zeile 218-236)**

```typescript
try {
  const { data: updateData, error } = await supabase
    .from("team_announcements")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Update error details:", error);
    throw error;
  }

  // Update successful - update local state with returned data
  if (updateData) {
    setAnnouncements(prev => prev.map(a => 
      a.id === id ? { ...a, ...updateData } : a
    ));
    
    // Recalculate activeAnnouncements based on is_active state
    if (updateData.is_active) {
      const now = new Date();
      const isExpired = updateData.expires_at && new Date(updateData.expires_at) < now;
      const isScheduled = updateData.starts_at && new Date(updateData.starts_at) > now;
      
      if (!isExpired && !isScheduled) {
        // Add to active if not already there
        setActiveAnnouncements(prev => {
          if (prev.find(a => a.id === id)) return prev;
          return [...prev, { ...announcements.find(a => a.id === id)!, ...updateData }];
        });
      }
    }
  }

  toast.success("Mitteilung aktualisiert");
  return true;
} catch (error: any) {
  console.error("Error updating announcement:", error);
  console.error("Error code:", error?.code);
  console.error("Error message:", error?.message);
  
  // Rollback on error
  setAnnouncements(previousAnnouncements);
  setActiveAnnouncements(previousActiveAnnouncements);
  toast.error(`Fehler: ${error?.message || 'Unbekannter Fehler'}`);
  return false;
}
```

Ausserdem: RLS-Policy pruefen, ob `UPDATE` fuer alle Rollen erlaubt ist (nicht nur fuer `author_id`).

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| `AssignedItemsSection.tsx` | Import RichTextDisplay, Beschreibung damit rendern |
| `QuickNotesList.tsx` | Priority-Mapping Funktion, taskPriority aus note.priority_level |
| `EditProfile.tsx` | Image Cropper einbauen, Caching-Problem beheben, alte Dateien loeschen |
| Neue Datei: `ImageCropper.tsx` | Canvas-basierter Cropper mit Drag & Zoom |
| `AppNavigation.tsx` | Ctrl + . Shortcut in Hilfe-Dialog hinzufuegen |
| `useTeamAnnouncements.ts` | Detaillierteres Error-Logging, robustere State-Updates |

---

## Technische Details

### ImageCropper Komponente

Die Komponente wird als Modal implementiert:

```text
+--------------------------------------+
|  Profilbild zuschneiden              |
+--------------------------------------+
|                                      |
|    +------------------------+        |
|    |     Drag to move       |        |
|    |                        |        |
|    |    [Crop area 1:1]     |        |
|    |                        |        |
|    +------------------------+        |
|                                      |
|  Zoom: [========o=========]          |
|                                      |
|  [Abbrechen]        [Zuschneiden]    |
+--------------------------------------+
```

**Features:**
- Quadratischer Ausschnitt (1:1 Aspect Ratio)
- Drag zum Verschieben des Bildausschnitts
- Pinch-to-Zoom auf Touch-Geraeten
- Slider fuer Zoom-Level
- Vorschau des zugeschnittenen Bereichs
- Export als WebP fuer kleinere Dateigroesse

### Priority-Mapping Logik

```text
Notiz priority_level  ->  Task priority
-------------------------------------
0 (Keine)             ->  low
1 (Level 1)           ->  low
2 (Level 2)           ->  medium
3 (Level 3)           ->  high
```

### Cache-Busting Strategie

1. **Eindeutige Dateinamen:** `avatar_{timestamp}.webp` statt `avatar.jpg`
2. **Alte Dateien loeschen:** Vor jedem Upload werden bestehende Avatare geloescht
3. **Query-Parameter:** `?t={timestamp}` an URL anhaengen verhindert Browser-Caching
