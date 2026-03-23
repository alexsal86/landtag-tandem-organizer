

## Build Error Fix + Sender Settings Restructuring

### 1. Fix Build Error in MyWorkCasesWorkspace.tsx

**Problem**: Lines 819 and 842 set `status` to values (`"entscheidung_abwartend"` and a generic `string`) that don't match the `CaseItemsRow` type's allowed status enum (`"antwort_ausstehend" | "archiviert" | "erledigt" | "in_klaerung" | "neu"`).

**Fix**: Cast the mapped result with `as CaseItemsRow[]` or cast the status value with `as CaseItemsRow['status']` on both lines.

### 2. Move SenderInformationManager from "Adressfeld" Tab to "Allgemein" Tab

**Current state**: The `<SenderInformationManager />` component is rendered at the bottom of the "Adressfeld" (block-address) tab in `TemplateFormTabs.tsx` (line 269).

**Change**: Move it into the "Allgemein" (general) tab, below the existing sender dropdown, so all sender-related settings are in one place.

### 3. Expand SenderInformationManager to Show All Editable Fields

**Current state**: The `SenderInformationManager` dialog only allows editing `name`, `email`, and `is_default`. But the `sender_information` table has many more fields:

- `organization` (currently just copied from name)
- `landtag_street`, `landtag_house_number`, `landtag_postal_code`, `landtag_city`
- `wahlkreis_street`, `wahlkreis_house_number`, `wahlkreis_postal_code`, `wahlkreis_city`, `wahlkreis_email`
- `phone`, `fax`
- `website`, `facebook_profile`, `instagram_profile`
- `return_address_line`

**Change**: Expand the create/edit dialog in `SenderInformationManager.tsx` to include all these fields, grouped logically:

- **Allgemein**: Name, Organisation, Rücksendezeile
- **Landtag-Adresse**: Straße, Hausnummer, PLZ, Stadt, E-Mail
- **Wahlkreis-Adresse**: Straße, Hausnummer, PLZ, Stadt, E-Mail
- **Kontakt**: Telefon, Fax, Website
- **Social Media**: Facebook, Instagram

The card list view will also show more info (organization, address summary).

### Files to Edit

| File | Change |
|---|---|
| `src/components/my-work/MyWorkCasesWorkspace.tsx` | Cast status values to fix build errors |
| `src/components/letter-templates/TemplateFormTabs.tsx` | Remove `<SenderInformationManager />` from block-address tab, add it to general tab |
| `src/components/administration/SenderInformationManager.tsx` | Expand form to include all `sender_information` fields |

