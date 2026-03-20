

## Zwei Korrekturen am RSVP-E-Mail-System

### Problem 1: Alter Link in E-Mails

Der Code in `send-event-invitation/index.ts` (Zeile 239) enthält bereits die korrekte URL `https://www.alexander-salomon.de/einladung/...`. Die Edge Function wurde aber nach der letzten Codeänderung möglicherweise nicht neu deployed — Edge Functions liefern immer den zuletzt **deployten** Stand aus, nicht den im Repo.

**Umsetzung:** Edge Function `send-event-invitation` neu deployen.

### Problem 2: Fehlende Empfänger-Auswahl beim Hinweis-Versand

Der „Hinweis senden"-Dialog (`noteTarget`) bietet aktuell nur drei Optionen:
- Nur Zugesagte
- Nur Vorbehalt
- Zugesagte + Vorbehalt

Es fehlen: „Nur Abgesagte", „Nur Ausstehende" und „Alle" (wirklich alle).

**Umsetzung in `EventRSVPManager.tsx`:**

1. `noteTarget`-Typ erweitern um `'declined' | 'invited' | 'everyone'`
2. Select-Optionen im Note-Dialog ergänzen:
   - Nur Zugesagte
   - Nur Vorbehalt
   - Zugesagte + Vorbehalt
   - Nur Abgesagte
   - Nur Ausstehende
   - Alle
3. `sendNote`-Logik anpassen: bei `'everyone'` alle RSVPs als Ziel nehmen, bei `'invited'`/`'declined'` den jeweiligen Status filtern
4. Button „Hinweis senden" auch sichtbar machen, wenn es Abgesagte oder Ausstehende gibt (aktuell nur bei accepted/tentative)

