

# Plan: Brief-Templates Administration Fix

## Problem-Analyse

Es gibt zwei separate Probleme:

### Problem 1: Administration zeigt "Keine Berechtigung" fuer Alexander

Die Administration-Seite hat eine **Race Condition**. Der Ablauf ist:

1. `isAdmin` wird mit `false` initialisiert (Zeile 77)
2. Auth-Loading endet -> Komponente rendert mit `isAdmin = false`
3. Zeile 681: `if (!isAdmin)` zeigt sofort "Sie besitzen keine Berechtigung"
4. Erst DANACH startet `checkAdminStatus()` asynchron
5. Wenn `currentTenant` noch nicht geladen ist, wird `checkAdminStatus` gar nicht aufgerufen (useEffect-Guard in Zeile 111)

Alexanders Rolle ist korrekt (`abgeordneter`), die RLS-Policies erlauben den Zugriff, aber die UI zeigt die Fehlermeldung bevor der asynchrone Check abgeschlossen ist. Bei Franziska funktioniert es moeglicherweise, weil ihr Browser schneller laedt oder sie den Admin-Bereich ueber eine andere Route erreicht.

**Loesung:** Ein separater `checkingAdmin`-State wird eingefuehrt, der `true` ist bis `checkAdminStatus()` abgeschlossen ist. Die "keine Berechtigung"-Meldung wird erst angezeigt, wenn der Check tatsaechlich fertig ist.

### Problem 2: LetterTemplateManager fehlt im Admin-Bereich

Die "Briefvorlagen"-Sektion in der Administration (Sidebar: Vorlagen -> Briefvorlagen) zeigt nur:
- SenderInformationManager (Absenderinformationen)
- InformationBlockManager (Informationsbloecke)

Der eigentliche **LetterTemplateManager** (Brief-Templates verwalten) ist dort NICHT eingebunden. Er ist nur ueber den `LetterTemplateSelector`-Dialog erreichbar, der beim Erstellen eines neuen Briefs erscheint. Das erklaert, warum man die Templates nicht in der Administration findet.

**Loesung:** Der LetterTemplateManager wird als drittes Element in die "letters"-Sektion der Administration eingefuegt.

---

## Aenderungen

### Datei: `src/pages/Administration.tsx`

**1. Neuen State `checkingAdmin` einfuehren:**

```text
const [isAdmin, setIsAdmin] = useState<boolean>(false);
const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
const [checkingAdmin, setCheckingAdmin] = useState<boolean>(true);  // NEU
```

**2. `checkAdminStatus` mit Loading-State:**

```text
const checkAdminStatus = async () => {
  if (!user) {
    setCheckingAdmin(false);
    return;
  }
  try {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();  // statt .single() -- verhindert Fehler bei fehlenden Zeilen
    
    setIsAdmin(roleData?.role === 'abgeordneter' || roleData?.role === 'bueroleitung');
    setIsSuperAdmin(roleData?.role === 'abgeordneter');
  } catch (error) {
    console.error('Error checking admin status:', error);
  } finally {
    setCheckingAdmin(false);  // NEU
  }
};
```

**3. Loading-Guard anpassen (Zeile 679-690):**

```text
if (loading || checkingAdmin) return null;  // Warten bis Admin-Check abgeschlossen

if (!isAdmin) {
  return (
    <main className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="text-muted-foreground">Sie besitzen keine Berechtigung...</p>
      </header>
    </main>
  );
}
```

**4. LetterTemplateManager Import hinzufuegen:**

```text
import LetterTemplateManager from "@/components/LetterTemplateManager";
```

**5. "letters"-Sektion erweitern (Zeile 1037-1057):**

Der LetterTemplateManager wird als ganzes Element ueber den beiden bestehenden Karten eingefuegt:

```text
case "letters":
  return (
    <div className="space-y-6">
      <LetterTemplateManager />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Absenderinformationen</CardTitle>
          </CardHeader>
          <CardContent>
            <SenderInformationManager />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Informationsbloecke</CardTitle>
          </CardHeader>
          <CardContent>
            <InformationBlockManager />
          </CardContent>
        </Card>
      </div>
    </div>
  );
```

---

## Zusammenfassung

| Datei | Aenderung |
|-------|-----------|
| `src/pages/Administration.tsx` | `checkingAdmin`-State + Loading-Guard, `.maybeSingle()`, LetterTemplateManager Import + Einbindung in "letters"-Sektion |

Keine Datenbank-Aenderungen noetig. Die RLS-Policies und Rollen sind korrekt konfiguriert.
