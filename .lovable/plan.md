

# Tenant-Isolation: Analyse und Bewertung

## Gesamtbild

Die Plattform hat **~190 Tabellen**, davon haben ca. **100 eine `tenant_id`-Spalte** und ca. **90 keine**. RLS ist auf allen Tabellen aktiviert (bis auf `widget_rate_limits`). Die Isolation ist grundsätzlich vorhanden, aber es gibt **drei Kategorien von Schwachstellen**.

---

## Kategorie 1: Globale Konfigurationstabellen ohne Tenant-Trennung (Strukturproblem)

Diese Tabellen haben **keine `tenant_id`** und werden von allen Tenants gemeinsam genutzt. Ein Admin in Tenant A kann Einträge verwalten, die auch für Tenant B gelten:

| Tabelle | Problem |
|---|---|
| `appointment_categories` | Admin jedes Tenants kann Kategorien verwalten, die global gelten |
| `appointment_locations` | Gleiches Problem |
| `tags` | Global geteilt |
| `task_categories` | Global geteilt |
| `case_file_types` | Global geteilt |
| `topics` | Global geteilt |
| `document_categories` | Global geteilt |
| `admin_status_options` | Global geteilt |
| `public_holidays` | Global geteilt |
| `notification_types` | Global geteilt |

**Risiko:** Ein Abgeordneter in Tenant A kann Kategorien löschen oder umbenennen, die auch Tenant B nutzt. Die SELECT-Policies erlauben allen authentifizierten Nutzern den Lesezugriff, was korrekt ist -- aber die Schreib-Policies prüfen nur die globale Rolle (`has_role`), nicht die Tenant-Zugehörigkeit.

## Kategorie 2: Mitarbeiter-/HR-Tabellen mit schwacher Tenant-Prüfung

| Tabelle | Policy-Basis |
|---|---|
| `employee_settings` | `admin_id = auth.uid()` oder `user_id = auth.uid()` -- kein Tenant-Check bei Insert |
| `employee_yearly_stats` | `user_roles` ohne Tenant-Bezug |
| `leave_requests` | `is_admin_of(user_id)` -- muss geprüft werden ob tenant-aware |
| `time_entry_corrections` | Unklar |
| `vacation_history` | `user_roles` ohne Tenant-Bezug |
| `sick_days` | `is_admin_of(user_id)` |

**Risiko:** Ein Abgeordneter könnte theoretisch auf HR-Daten von Mitarbeitern anderer Tenants zugreifen, wenn `is_admin_of` oder `user_roles`-Checks nicht mandantenspezifisch sind.

## Kategorie 3: Kind-Tabellen ohne eigene `tenant_id` (akzeptabel bei korrekten JOINs)

Tabellen wie `case_file_tasks`, `meeting_agenda_items`, `subtasks`, `task_comments` etc. haben keine eigene `tenant_id`, sondern beziehen die Isolation über JOINs auf die Eltern-Tabelle. **Das ist architektonisch korrekt**, solange die RLS-Policies korrekt über die Eltern-Tabelle (die eine `tenant_id` hat) filtern.

## Kategorie 4: Benutzerzentrierte Tabellen (korrekt)

`quick_notes`, `dashboard_layouts`, `habits`, `pomodoro_sessions`, `carryover_items` etc. filtern über `user_id = auth.uid()`. Das ist korrekt und mandantenunabhängig -- diese Daten gehören dem User, nicht dem Tenant.

---

## Fazit

| Aspekt | Bewertung |
|---|---|
| Kerngeschäftsdaten (Contacts, Cases, Tasks, Documents, Meetings) | Gut isoliert via `tenant_id` + RLS |
| Benutzerspezifische Daten (Notes, Habits, Settings) | Korrekt via `user_id` |
| Kind-Tabellen (Subtasks, Comments, Timeline) | Akzeptabel via JOIN-basierte RLS |
| **Globale Konfiguration** (Categories, Tags, Types) | **Nicht tenant-isoliert -- geteilte Verwaltung** |
| **HR-Daten** (Employee Stats, Vacation, Sick Days) | **Potenziell lückenhaft -- `user_roles` statt `user_tenant_memberships`** |
| `widget_rate_limits` | **RLS nicht aktiviert** |

## Empfehlung

Die zwei wichtigsten Verbesserungen wären:

1. **Globale Konfigurationstabellen mandantenfähig machen** -- `tenant_id` hinzufügen und RLS-Policies anpassen. Dies betrifft ~10 Tabellen. Alternativ bewusst als "Plattform-global" dokumentieren, falls gewünscht.

2. **HR-Policies härten** -- `employee_yearly_stats`, `vacation_history` und `public_holidays` von `user_roles` auf `user_tenant_memberships`-basierte Checks umstellen.

Soll ich eine dieser Verbesserungen als konkreten Umsetzungsplan ausarbeiten?

