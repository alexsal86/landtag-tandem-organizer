
# Plan: LetterTemplateManager Dialog-Button wiederherstellen (ohne Nested-Dialog-Fehler)

## Problem

Der LetterTemplateManager verwendet intern eigene `Dialog`-Komponenten fuer "Neues Template erstellen", "Template bearbeiten" und "Vorschau". Wenn der Manager selbst in einem aeusseren `Dialog` gerendert wird (wie vorher in der Administration), entstehen **verschachtelte Dialoge** -- das verursacht React Error #185 und die fehlende `aria-describedby`-Warnung.

## Loesung

Den Button und die Anzeige des LetterTemplateManagers wiederherstellen, aber **ohne Dialog**. Stattdessen wird ein einfacher Show/Hide-Toggle verwendet: Klick auf den Button blendet den LetterTemplateManager inline ein, ein weiterer Klick blendet ihn wieder aus.

## Aenderung in `src/pages/Administration.tsx`

**1. State wieder einfuehren:**

```
const [showLetterTemplateManager, setShowLetterTemplateManager] = useState(false);
```

**2. "letters"-Sektion anpassen:**

```
case "letters":
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Briefvorlagen</CardTitle>
          <CardDescription>
            Oeffnen Sie den Template-Designer fuer Briefvorlagen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowLetterTemplateManager(!showLetterTemplateManager)}>
            {showLetterTemplateManager ? "Manager schliessen" : "Brief-Template-Manager oeffnen"}
          </Button>
        </CardContent>
      </Card>

      {showLetterTemplateManager && <LetterTemplateManager />}

      <div className="grid gap-6 md:grid-cols-2">
        ...Absenderinformationen + Informationsbloecke...
      </div>
    </div>
  );
```

Damit wird der LetterTemplateManager **inline** angezeigt (nicht in einem Dialog), und seine eigenen internen Dialoge funktionieren fehlerfrei.

## Zusammenfassung

| Datei | Aenderung |
|-------|-----------|
| `src/pages/Administration.tsx` | `showLetterTemplateManager`-State zurueck, Button mit Inline-Toggle statt Dialog |

Keine weiteren Dateien betroffen. Kein aeusserer Dialog mehr = kein Nested-Dialog-Fehler.
