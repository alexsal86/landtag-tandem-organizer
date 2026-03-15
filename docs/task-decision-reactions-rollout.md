# Task-Decision Reactions: Rollout & Operations

## Migrationsreihenfolge
1. **Schema zuerst**: `task_decision_comment_reactions` + benötigte Indizes + RLS-Policies deployen.
2. **Backend-Flows**: Notification-Type (`task_decision_comment_reaction_received`) und ggf. Analytics-Felder/Views bereitstellen.
3. **Frontend danach**: Realtime-Subscription + inkrementelle UI-Updates ausrollen.
4. **Observability**: Dashboards/Logs für Reaction-INSERT/DELETE vor Go-Live prüfen.

## Backward Compatibility
- Kommentare ohne Reaktionen bleiben vollständig funktionsfähig (UI zeigt nur leere Reaktionsleiste).
- Bestehende Kommentare werden weiter geladen, weil Reaktionsdaten optional aggregiert werden.
- Fallback bei Realtime-Fehlern: Voll-Reload der Kommentaransicht.

## Stufenweiser Rollout
1. **Stage 1 – Internes Team**
   - Feature-Flag aktiv nur für internes Team.
   - Monitoring: Fehlerquote beim Togglen, Toast-Fehler, Realtime-Latenz.
2. **Stage 2 – Pilot-Mandanten**
   - Aktivierung für ausgewählte Teams.
   - Prüfen, ob Notification-Rate-Limit wirksam Spam reduziert.
3. **Stage 3 – Alle Nutzer:innen**
   - Global aktivieren.
   - Wöchentliche Review der Emoji-Nutzung und Fehlerraten.

## Monitoring & Produktmetriken (optional, datenschutzabhängig)
- Client trackt Reaction-INSERT/DELETE nur bei gesetztem Opt-in (`allowReactionAnalytics=true`).
- Beispiel-Auswertung „meistgenutzte Emojis je Team/Zeitraum“:

```sql
select
  c.decision_id,
  r.emoji,
  count(*) as uses
from task_decision_comment_reactions r
join task_decision_comments c on c.id = r.comment_id
where r.created_at >= now() - interval '30 days'
group by c.decision_id, r.emoji
order by uses desc;
```

> Für Team-spezifische Auswertung zusätzlich auf `tenant_id`/Team-Mapping joinen.
