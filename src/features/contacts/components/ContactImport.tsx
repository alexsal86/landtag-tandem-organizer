import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useContactImport } from "@/components/contact-import/hooks/useContactImport";
import { ImportSteps } from "@/components/contact-import/ImportSteps";
import { ContactImportDuplicateDialog } from "@/components/contacts/ContactImportDuplicateDialog";

export function ContactImport() {
  const {
    data, fieldMappings, step, progress, importedCount, skippedCount, errors,
    duplicateWarnings, currentDuplicate, duplicateStrategy, setDuplicateStrategy,
    handleFileUpload, updateFieldMapping, proceedToPreview, startImport, reset, downloadTemplate,
    handleDuplicateSkip, handleDuplicateOverwrite, handleDuplicateMerge, handleDuplicateImportAnyway, handleDuplicateApplyToAll,
  } = useContactImport();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Kontakte importieren</h2>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />Vorlage herunterladen
        </Button>
      </div>

      <ImportSteps
        step={step} data={data} fieldMappings={fieldMappings}
        progress={progress} importedCount={importedCount} skippedCount={skippedCount}
        errors={errors} duplicateWarnings={duplicateWarnings}
        duplicateStrategy={duplicateStrategy} setDuplicateStrategy={setDuplicateStrategy}
        handleFileUpload={handleFileUpload} updateFieldMapping={updateFieldMapping}
        proceedToPreview={proceedToPreview} startImport={startImport} reset={reset}
      />

      {currentDuplicate && (
        <ContactImportDuplicateDialog
          open={!!currentDuplicate}
          newContact={currentDuplicate.newContact}
          duplicates={currentDuplicate.duplicates}
          onSkip={handleDuplicateSkip}
          onOverwrite={handleDuplicateOverwrite}
          onMerge={handleDuplicateMerge}
          onImportAnyway={handleDuplicateImportAnyway}
          onApplyToAll={handleDuplicateApplyToAll}
        />
      )}
    </div>
  );
}
