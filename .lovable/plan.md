

# Plan: Dashboard-Layout umstrukturieren -- Greeting neben News, WidgetQuickAccess unten

## Gewuenschtes Layout

```text
+---------------------------------------------+
| Begruessung (40%)   | Nachrichten (60%)     |
| Guten Abend, Alex!  | News-Feed             |
| Wetter, Termine     |                       |
+---------------------------------------------+
| QuickActions (volle Breite)                 |
+---------------------------------------------+
| WidgetQuickAccess (volle Breite)            |
| [Notizen] [Anrufe] [Timer] ...             |
| Widget-Inhalt                               |
+---------------------------------------------+
```

## Aenderungen

### 1. DashboardGreetingSection.tsx -- WidgetQuickAccess entfernen

Die Komponente rendert aktuell beides: Greeting-Text (links) und WidgetQuickAccess (rechts). Der WidgetQuickAccess wird herausgeloest:

- Den `activeWidget`-State und die `WidgetQuickAccess`-Einbindung entfernen
- Das Layout vereinfachen: Kein Flex-Row mehr, nur noch der TypewriterText
- Die `hidden lg:flex`-Spalte mit `WidgetQuickAccess` wird komplett entfernt

**Vorher:**
```tsx
<div className="mb-6 flex items-start gap-4">
  <div className="flex-1 min-w-0">
    <TypewriterText ... />
  </div>
  <div className="hidden lg:flex flex-col gap-2 w-[420px]">
    <WidgetQuickAccess ... />
  </div>
</div>
```

**Nachher:**
```tsx
<div>
  <TypewriterText ... />
</div>
```

### 2. CustomizableDashboard.tsx -- Neues Layout

- `WidgetQuickAccess` direkt importieren und den State (`activeWidget`) hier verwalten
- Grid-Layout: Greeting (40%) neben News (60%)
- QuickActions darunter
- WidgetQuickAccess ganz unten (volle Breite)

**Neues Layout:**
```tsx
{/* Greeting (40%) + News (60%) nebeneinander */}
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
  <div className="lg:col-span-2">
    <DashboardGreetingSection />
  </div>
  <div className="lg:col-span-3">
    <h2 className="text-2xl font-bold mb-4">Aktuelle Nachrichten</h2>
    <NewsWidget />
  </div>
</div>

{/* QuickActions */}
<div className="mb-6">
  <QuickActionsWidget ... />
</div>

{/* WidgetQuickAccess (Notes, Anrufe, Timer) */}
<div className="mb-8">
  <WidgetQuickAccess activeWidget={activeWidget} onWidgetChange={setActiveWidget} />
</div>
```

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/dashboard/DashboardGreetingSection.tsx` | WidgetQuickAccess entfernen, Layout vereinfachen, `activeWidget`-State entfernen |
| `src/components/CustomizableDashboard.tsx` | WidgetQuickAccess importieren, `activeWidget`-State hinzufuegen, Grid-Layout 40/60 |

