

## Problem

Die Route `/employee-meeting/:meetingId` (Zeile 45 in `routes.tsx`) hat einen eigenen Param-Namen `meetingId`, aber `Index.tsx` liest `{ section, subId }` aus `useParams()`. Dadurch sind sowohl `section` als auch `subId` `undefined`, und die Seite zeigt nichts an.

Die generische Route `/:section/:subId` (Zeile 49) würde korrekt funktionieren — `section` wäre "employee-meeting" und `subId` die Meeting-ID.

## Lösung

**Zeile 45 in `src/router/routes.tsx` entfernen.** Die generische `/:section/:subId`-Route übernimmt dann automatisch das Matching, und `Index.tsx` erkennt `section === "employee-meeting"` mit dem korrekten `subId`.

### Datei
- `src/router/routes.tsx` — Zeile 45 (`<Route path="/employee-meeting/:meetingId" .../>`) löschen

