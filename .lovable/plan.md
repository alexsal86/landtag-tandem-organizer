

# Empfaengeradresse: Performance-Optimierung ContactSelector

## Problem

Der `ContactSelector` laedt beim Rendern sofort **alle ~1.100 Kontakte** plus deren Usage-Stats aus der Datenbank. Das passiert bei jedem Oeffnen des Brief-Editors, auch wenn der Benutzer die Kontaktauswahl nie benutzt.

## Loesung

Zwei Massnahmen:

### 1. Lazy Loading: Kontakte erst beim Oeffnen laden

Aktuell laedt `fetchContacts()` im `useEffect` sofort beim Mount. Stattdessen wird der Fetch erst ausgeloest, wenn der Benutzer den Dropdown oeffnet (`isOpen` wird `true`).

### 2. Server-seitige Suche statt Client-Filter

Statt alle 1.100 Kontakte zu laden und im Browser zu filtern, wird die Suche per `.ilike()` an Supabase delegiert. Die initiale Anzeige (ohne Suchbegriff) wird auf die Top-20 Kontakte begrenzt (Favoriten + haeufig genutzt + alphabetisch).

## Aenderungen

| Datei | Aenderung |
|---|---|
| `src/components/ContactSelector.tsx` | Lazy-Load bei `isOpen`, serverseitige Suche mit Limit, Debounce der Sucheingabe |

### Technische Details

**ContactSelector.tsx:**

1. `useEffect` fuer `fetchContacts` bekommt `isOpen` als Trigger statt `currentTenant` alleine
2. Neuer Parameter `limit` (default 20) fuer die initiale Abfrage
3. Suchbegriff wird per `debounce(300ms)` an eine neue `searchContacts(term)` Funktion uebergeben, die per `.or('name.ilike.%term%,organization.ilike.%term%,email.ilike.%term%')` sucht
4. Usage-Stats werden nur fuer die geladenen Kontakte abgefragt (`.in('contact_id', loadedIds)`) statt fuer alle
5. Favoriten werden immer zuerst geladen (separater schneller Query mit `.eq('is_favorite', true).limit(10)`)

**Erwartetes Ergebnis:**
- Ohne Suche: ~20-30 Kontakte geladen statt 1.100
- Mit Suche: Nur passende Kontakte vom Server, reagiert nach 300ms Tipp-Pause
- Erstes Oeffnen des Popovers: Daten werden erst dann geladen

