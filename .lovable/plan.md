

# Refactoring: Alle 7 verbleibenden grossen Dateien

## 1. LetterTemplateManager.tsx (1.134 → ~150 Zeilen)

### `src/components/letter-templates/types.ts`
- Interfaces: LetterTemplate, SenderInformation, InformationBlock, GalleryImage, TabRect, MarginKey
- Hilfsfunktionen: extractStoragePathFromUrl, normalizeImageItem, normalizeLayoutBlockContentImages, createDefaultAttachmentElements

### `src/components/letter-templates/hooks/useLetterTemplateData.ts`
- State: templates, senderInfos, infoBlocks, formData, editingTemplate, galleryImages
- Daten laden: fetchTemplates, fetchSenderInfos, fetchInformationBlocks
- CRUD: handleCreateTemplate, handleUpdateTemplate, handleDeleteTemplate
- Form-Logik: resetForm, startEditing, cancelEditing, stripBlobUrls

### `src/components/letter-templates/TemplateFormTabs.tsx`
- renderTabsNavigation + renderCommonTabsContent (Zeilen 597-1028)
- Canvas, Header, Footer, Address, Info, Subject, Attachments, Layout, General Tabs

### `src/components/letter-templates/TemplateGrid.tsx`
- Template-Karten-Liste mit Preview-Dialog (Zeilen 1074-1104)

### Shell: `LetterTemplateManager.tsx` (~150 Zeilen)
- Orchestriert Settings-View, Create-View, Edit-View, Template-Liste

---

## 2. ContactImport.tsx (1.060 → ~120 Zeilen)

### `src/components/contact-import/types.ts`
- Interfaces: ImportData, FieldMapping
- Konstanten: FIELD_MAPPINGS, TARGET_FIELDS

### `src/components/contact-import/hooks/useContactImport.ts`
- Gesamte Import-Logik: Datei-Upload, Parsing (CSV/XLSX/VCF), Field-Mapping, Row-Processing, Duplikat-Handling

### `src/components/contact-import/ImportSteps.tsx`
- Step-UI-Komponenten: UploadStep, MappingStep, PreviewStep, ImportingStep, CompleteStep

### Shell: `ContactImport.tsx` (~120 Zeilen)

---

## 3. LetterPDFExport.tsx (1.033 → ~80 Zeilen)

### `src/components/letter-pdf/types.ts`
- Interfaces: Letter, LetterTemplate, LetterPDFExportProps

### `src/components/letter-pdf/usePDFData.ts`
- useEffect fuer Template, SenderInfo, InformationBlock, Attachments laden

### `src/components/letter-pdf/pdfGenerator.ts`
- convertHtmlToText, exportWithDIN5008Features, drawDebugGuides
- Gesamte PDF-Generierungslogik (Zeilen 132-1000+)

### Shell: `LetterPDFExport.tsx` (~80 Zeilen)

---

## 4. StakeholderView.tsx (993 → ~150 Zeilen)

### `src/components/stakeholders/hooks/useStakeholderTopics.ts`
- Topic-Loading, Local-Updates, Save/Cancel-Logik (Zeilen 68-195)

### `src/components/stakeholders/StakeholderGridView.tsx`
- Grid-Karten-Ansicht (Zeilen 352-700+)

### `src/components/stakeholders/StakeholderListView.tsx`
- Tabellen-Ansicht mit SortableTableHead (Zeilen 700-993)

### Shell: `StakeholderView.tsx` (~150 Zeilen)
- Helpers (getInitials, getCategoryColor), sortedStakeholders-Memo, View-Switch

---

## 5. ExpenseManagement.tsx (915 → ~120 Zeilen)

### `src/components/expenses/hooks/useExpenseData.ts`
- State + Daten laden: categories, expenses, budgets
- CRUD: addExpense, addCategory, setBudget, uploadReceipt, deleteExpense
- Berechnungen: getCurrentBudget, getTotalExpenses, getBalance, getCategoryExpenses

### `src/components/expenses/ExpenseSummaryCards.tsx`
- 3 Karten: Budget, Ausgaben, Saldo (Zeilen 425-468)

### `src/components/expenses/ExpenseTabContent.tsx`
- Tabs: Ausgaben-Tabelle, Kategorien, Budget, Uebersicht (Zeilen 470-915)

### Shell: `ExpenseManagement.tsx` (~120 Zeilen)

---

## 6. KnowledgeBaseView.tsx (897 → ~130 Zeilen)

### `src/components/knowledge/hooks/useKnowledgeData.ts`
- State + Daten laden: documents, documentTopicsMap, tenantId
- Realtime-Subscription, CRUD: create, save, delete, toggleLock
- Hydration: fetchCreatorNames, hydrateDocuments

### `src/components/knowledge/KnowledgeDocumentList.tsx`
- Sidebar-Dokumentliste mit Suche und Topic-Filter

### `src/components/knowledge/KnowledgeEditor.tsx`
- Editor-Bereich mit EnhancedLexicalEditor, Topic-Selector, Lock-Toggle

### Shell: `KnowledgeBaseView.tsx` (~130 Zeilen)

---

## 7. CreateAppointmentDialog.tsx (808 → ~120 Zeilen)

### `src/components/appointments/hooks/useCreateAppointment.ts`
- Form-Setup (Zod-Schema, useForm), Daten laden (categories, statuses, locations)
- Submit-Logik: onSubmit mit Kontakten, Gaesten, Recurrence, Files, Topics

### `src/components/appointments/AppointmentFormFields.tsx`
- Formular-Felder: Titel, Datum/Zeit, Ort, Prioritaet, Kategorie, Status, Ganztaegig, Kontakte, Gaeste, Recurrence, Topics

### Shell: `CreateAppointmentDialog.tsx` (~120 Zeilen)
- Dialog-Wrapper, orchestriert Hook + FormFields

