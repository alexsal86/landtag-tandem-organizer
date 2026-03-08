

## Drei Änderungen in `src/components/my-work/MyWorkCasesWorkspace.tsx`

### 1. Status-Badge entfernen (Zeile 1216)
Die Zeile `{caseFileStatusBadge(cf.status)}` in der FallAkten-Liste entfernen.

### 2. HTML in `current_status_note` rendern (Zeile 1231)
Statt `<p>...{cf.current_status_note}</p>` die vorhandene `RichTextDisplay`-Komponente verwenden oder zumindest `dangerouslySetInnerHTML` mit `sanitizeRichHtml` nutzen, damit der HTML-Inhalt gerendert statt als Rohtext angezeigt wird. Zusätzlich `truncate`/`line-clamp-1` beibehalten.

### 3. Suchfeld neben "Neu"-Button verschieben (Zeilen 1167-1188)
Das Suchfeld aus `CardContent` in den `CardHeader` verschieben, analog zur linken Spalte: Button und Suchfeld nebeneinander in einer Zeile rechts neben dem Titel.

**Vorher (rechte Spalte):**
```
Header: [FallAkten]              [+ Neu]
Content: [🔍 Suchfeld           ]
         [Liste...]
```

**Nachher:**
```
Header: [FallAkten]    [+ Neu] [🔍 Suchfeld]
Content: [Liste...]
```

**1 Datei, 3 Stellen.**

