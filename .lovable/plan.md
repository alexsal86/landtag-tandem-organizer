
# Plan: Pressemitteilungen mit Ghost CMS Integration

## Uebersicht

Ein neues Modul "Pressemitteilungen" in der Dokumentenverwaltung, das den bestehenden Lexical-Editor nutzt und einen mehrstufigen Freigabe-Workflow implementiert. Am Ende wird die Pressemitteilung per Edge Function an die Ghost CMS Admin API uebermittelt.

## Warum ein eigener Workflow statt Entscheidungen/Aufgaben?

- **Entscheidungen** sind fuer Ja/Nein/Rueckfrage-Abstimmungen konzipiert -- nicht fuer iterative Textueberarbeitung
- **Aufgaben** haben keinen eingebauten Review-Zyklus
- Der bestehende **Brief-Workflow** (LetterEditor) ist das perfekte Vorbild: Er hat bereits den Zyklus Entwurf -> Pruefung -> Genehmigt -> Versendet mit Reviewer-Zuweisung
- Fuer Pressemitteilungen wird ein angepasster Workflow verwendet, der **mehrfache Schleifen** explizit unterstuetzt (Abgeordneter kann zurueckweisen mit Kommentar)

## Workflow-Design

```text
Mitarbeiter                          Abgeordneter
    |                                     |
    | 1. Erstellt Pressemitteilung        |
    |    (Status: Entwurf)                |
    |                                     |
    | 2. Sendet zur Freigabe ---------->  |
    |    (Status: Zur Freigabe)           |
    |                                     |
    |                              3a. Genehmigt
    |                                (Status: Freigegeben)
    |                                     |
    |                              3b. Lehnt ab + Kommentar
    |  <---------- Zurueck an Mitarbeiter |
    |    (Status: Ueberarbeitung)         |
    |                                     |
    | 4. Ueberarbeitet und sendet         |
    |    erneut zur Freigabe -------->    |
    |    (Schleife beliebig oft)          |
    |                                     |
    | 5. Nach Freigabe:                   |
    |    [An Ghost senden] Button         |
    |    (Status: Veroeffentlicht)        |
    |                                     |
```

Statusfluss: `draft` -> `pending_approval` -> `approved` / `revision_requested` -> `pending_approval` -> `approved` -> `published`

## Datenbank-Design

### Neue Tabelle: `press_releases`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid PK | |
| tenant_id | uuid NOT NULL | Mandantentrennung |
| created_by | uuid NOT NULL | Ersteller (Mitarbeiter) |
| title | text NOT NULL | Titel / Ueberschrift |
| content | text NOT NULL | Plaintext-Inhalt (Lexical) |
| content_html | text | HTML-Version |
| content_nodes | jsonb | Lexical EditorState JSON |
| slug | text | URL-Slug fuer Ghost |
| excerpt | text | Kurzfassung / Teaser |
| feature_image_url | text | Titelbild-URL |
| tags | text[] | Tags fuer Ghost |
| meta_title | text | SEO-Titel |
| meta_description | text | SEO-Beschreibung |
| status | text NOT NULL DEFAULT 'draft' | Workflow-Status |
| submitted_at | timestamptz | Zeitpunkt der Freigabeanfrage |
| submitted_by | uuid | Wer hat zur Freigabe gesendet |
| approved_at | timestamptz | Zeitpunkt der Genehmigung |
| approved_by | uuid | Wer hat genehmigt (Abgeordneter) |
| revision_comment | text | Kommentar bei Ablehnung |
| revision_requested_at | timestamptz | Zeitpunkt der Ablehnnung |
| revision_requested_by | uuid | Wer hat abgelehnt |
| published_at | timestamptz | Zeitpunkt der Ghost-Veroeffentlichung |
| ghost_post_id | text | ID des Posts in Ghost |
| ghost_post_url | text | URL des veroeffentlichten Posts |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

### RLS-Policies

- Mitarbeiter im selben Tenant koennen alle Pressemitteilungen sehen und bearbeiten (im Status `draft` und `revision_requested`)
- Abgeordneter kann alle sehen und den Status zu `approved` oder `revision_requested` aendern
- Alle authentifizierten Tenant-Mitglieder haben Lesezugriff

```sql
CREATE POLICY "Tenant members can view press releases"
ON press_releases FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM user_tenant_memberships
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "Tenant members can insert press releases"
ON press_releases FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM user_tenant_memberships
  WHERE user_id = auth.uid() AND is_active = true
) AND created_by = auth.uid());

CREATE POLICY "Tenant members can update press releases"
ON press_releases FOR UPDATE
USING (tenant_id IN (
  SELECT tenant_id FROM user_tenant_memberships
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "Creator can delete draft press releases"
ON press_releases FOR DELETE
USING (created_by = auth.uid() AND status = 'draft');
```

## Edge Function: `publish-to-ghost`

Eine neue Supabase Edge Function, die:
1. Die Pressemitteilung aus der DB laedt
2. Einen JWT fuer die Ghost Admin API generiert (mit dem Admin API Key)
3. Den Inhalt als HTML an Ghost sendet (`POST /ghost/api/admin/posts/`)
4. Die Ghost-Post-ID und URL zurueckspeichert

### Ghost API Key Handling

Zwei neue Secrets werden benoetigt:
- `GHOST_ADMIN_API_KEY`: Der Admin API Key aus Ghost (Format: `{id}:{secret}`)
- `GHOST_API_URL`: Die Ghost-Blog-URL (z.B. `https://meine-webseite.de`)

### JWT-Generierung fuer Ghost

```typescript
// Ghost Admin API Key format: {id}:{secret}
const [keyId, keySecret] = adminApiKey.split(':');

// Create JWT header and payload
const header = { alg: 'HS256', typ: 'JWT', kid: keyId };
const now = Math.floor(Date.now() / 1000);
const payload = { iat: now, exp: now + 300, aud: '/admin/' };

// Sign with HMAC-SHA256 using the hex-decoded secret
```

### Ghost Post-Erstellung

```typescript
const ghostPayload = {
  posts: [{
    title: pressRelease.title,
    html: pressRelease.content_html,  // Ghost konvertiert HTML zu Lexical
    status: 'published',              // Direkt veroeffentlichen
    tags: pressRelease.tags?.map(t => ({ name: t })) || [],
    excerpt: pressRelease.excerpt || undefined,
    feature_image: pressRelease.feature_image_url || undefined,
    meta_title: pressRelease.meta_title || undefined,
    meta_description: pressRelease.meta_description || undefined,
    slug: pressRelease.slug || undefined,
  }]
};

const response = await fetch(
  `${ghostUrl}/ghost/api/admin/posts/?source=html`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Ghost ${token}`,
      'Content-Type': 'application/json',
      'Accept-Version': 'v5.0'
    },
    body: JSON.stringify(ghostPayload)
  }
);
```

## UI-Komponenten

### 1. Neuer Tab in DocumentsView

Ein vierter Tab "Presse" wird neben Dokumente, Briefe und E-Mails hinzugefuegt:

```text
[Dokumente] [Briefe] [E-Mails] [Presse]
```

### 2. PressReleasesList -- Listenansicht

Zeigt alle Pressemitteilungen mit:
- Status-Badge (farbcodiert: Grau=Entwurf, Orange=Zur Freigabe, Gelb=Ueberarbeitung, Gruen=Freigegeben, Blau=Veroeffentlicht)
- Titel, Ersteller, Datum
- Filter nach Status
- Button "Neue Pressemitteilung"

### 3. PressReleaseEditor -- Haupteditor

Aehnlich dem LetterEditor, aber spezialisiert fuer Pressemitteilungen:

```text
+---[Sidebar]---+---[Editor]-----------------------------+
| Metadaten     | EnhancedLexicalEditor                   |
|               |                                         |
| Titel         | [Toolbar: Bold, Italic, H1, H2, ...]   |
| Slug          |                                         |
| Excerpt       | Inhalt der Pressemitteilung...           |
| Tags          |                                         |
| Titelbild-URL |                                         |
| SEO-Titel     |                                         |
| SEO-Beschr.   |                                         |
|               |                                         |
| --- Status -- |                                         |
| [Entwurf]     |                                         |
|               |                                         |
| --- Aktionen  |                                         |
| [Speichern]   |                                         |
| [Zur Freigabe]|                                         |
|               |                                         |
| --- Workflow  |                                         |
| Historie...   |                                         |
+---------------+-----------------------------------------+
```

#### Workflow-Aktionen je nach Rolle und Status:

| Status | Mitarbeiter | Abgeordneter |
|--------|-------------|--------------|
| Entwurf | Bearbeiten, Zur Freigabe senden | Bearbeiten |
| Zur Freigabe | Nur lesen | Genehmigen, Zurueckweisen (mit Kommentar) |
| Ueberarbeitung | Bearbeiten, Erneut zur Freigabe | Lesen |
| Freigegeben | An Ghost senden | An Ghost senden |
| Veroeffentlicht | Link zur Webseite anzeigen | Link zur Webseite anzeigen |

### 4. Zurueckweisung mit Kommentar

Wenn der Abgeordnete zurueckweist, erscheint ein Dialog:
- Textfeld fuer Aenderungswuensche / Kommentar
- Der Kommentar wird als `revision_comment` gespeichert und dem Mitarbeiter angezeigt
- Der Kommentar ist im Editor in einer gelben Info-Box sichtbar

### 5. Ghost-Versand-Bestaetigung

Vor dem Senden an Ghost erscheint ein Bestaetigungsdialog:
- Vorschau der wichtigsten Felder (Titel, Excerpt, Tags)
- Hinweis "Wird auf [Ghost-URL] veroeffentlicht"
- Bestaetigungs-Button

## Technische Umsetzung -- Dateien

| Datei | Typ | Beschreibung |
|-------|-----|--------------|
| **Migration SQL** | DB | Tabelle `press_releases` erstellen mit RLS |
| **supabase/functions/publish-to-ghost/index.ts** | Edge Function | Ghost Admin API Integration |
| **src/components/press/PressReleasesList.tsx** | Neu | Listenansicht mit Status-Filter |
| **src/components/press/PressReleaseEditor.tsx** | Neu | Editor mit Sidebar-Metadaten und Workflow |
| **src/components/press/PressReleaseStatusBadge.tsx** | Neu | Status-Badges mit Farben |
| **src/components/press/GhostPublishDialog.tsx** | Neu | Bestaetigungsdialog vor Ghost-Versand |
| **src/components/press/RevisionCommentDialog.tsx** | Neu | Dialog fuer Zurueckweisung mit Kommentar |
| **src/components/DocumentsView.tsx** | Aenderung | Neuer Tab "Presse" hinzufuegen |

## Ablauf der Implementierung

1. **Secrets einrichten**: `GHOST_ADMIN_API_KEY` und `GHOST_API_URL` muessen als Supabase Secrets hinterlegt werden
2. **Datenbank**: Migration fuer `press_releases`-Tabelle
3. **Edge Function**: `publish-to-ghost` mit JWT-Generierung und Ghost API-Aufruf
4. **UI-Komponenten**: PressReleasesList, PressReleaseEditor, Dialoge
5. **DocumentsView**: Tab-Integration
6. **Rollen-Pruefung**: Abgeordneter-Rolle wird per `supabase.rpc('is_admin')` geprueft (da `abgeordneter` = Admin-Rolle im System)

## Hinweise

- Ghost nutzt ebenfalls Lexical als Editor-Format -- der Inhalt wird aber als HTML gesendet, da Ghost HTML automatisch in sein Lexical-Format konvertiert. Das ist der empfohlene Weg laut Ghost-Dokumentation.
- Der `EnhancedLexicalEditor` wird wiederverwendet (gleicher Editor wie in Briefen und Wissen).
- Die Schleife Ueberarbeitung -> Zur Freigabe -> Genehmigt kann beliebig oft durchlaufen werden.
- Nach der Veroeffentlichung wird die Ghost-Post-URL gespeichert und als Link angezeigt.
