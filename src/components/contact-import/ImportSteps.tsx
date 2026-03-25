import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Check, AlertCircle, Settings2 } from "lucide-react";
import { TARGET_FIELDS } from "./types";
import type { FieldMapping, ImportData } from "./types";

interface ImportStepsProps {
  step: string;
  data: ImportData[];
  fieldMappings: FieldMapping[];
  progress: number;
  importedCount: number;
  skippedCount: number;
  errors: string[];
  duplicateWarnings: string[];
  duplicateStrategy: "ask" | "skip" | "overwrite" | "merge" | "import";
  setDuplicateStrategy: (v: "ask" | "skip" | "overwrite" | "merge" | "import") => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateFieldMapping: (index: number, targetField: string) => void;
  proceedToPreview: () => void;
  startImport: () => void;
  reset: () => void;
}

export const ImportSteps: React.FC<ImportStepsProps> = ({
  step, data, fieldMappings, progress, importedCount, skippedCount, errors,
  duplicateWarnings, duplicateStrategy, setDuplicateStrategy,
  handleFileUpload, updateFieldMapping, proceedToPreview, startImport, reset,
}) => {
  if (step === "upload") {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center"><Upload className="h-5 w-5 mr-2" />Datei hochladen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Wählen Sie eine Datei aus</Label>
            <Input id="file-upload" type="file" accept=".csv,.xlsx,.xls,.ods,.vcf" onChange={handleFileUpload} className="mt-2" />
            <p className="text-sm text-muted-foreground mt-2">Unterstützte Formate: CSV, Excel (XLSX, XLS), OpenDocument (ODS), vCard (VCF)</p>
            <p className="text-sm text-muted-foreground mt-1">Tipp: Mit der Spalte <span className="font-medium">Verteiler</span> (mehrere Werte mit <span className="font-medium">;</span> getrennt) werden Kontakte automatisch Verteilerlisten zugeordnet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "mapping") {
    return (
      <Card>
        <CardHeader><CardTitle>Feldzuordnung</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Ordnen Sie die Spalten aus Ihrer Datei den entsprechenden Feldern zu:</p>
          <div className="space-y-2">
            {fieldMappings.map((mapping, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-1"><Label className="font-medium">{mapping.sourceField}</Label></div>
                <div className="flex-1">
                  <Select value={mapping.targetField || "none"} onValueChange={(value) => updateFieldMapping(index, value)}>
                    <SelectTrigger><SelectValue placeholder="Feld auswählen..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zuordnen</SelectItem>
                      {TARGET_FIELDS.map((field) => (<SelectItem key={field} value={field}>{field.replace(/_/g, " ")}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={proceedToPreview}>Weiter zur Vorschau</Button>
            <Button variant="outline" onClick={reset}>Zurücksetzen</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "preview") {
    return (
      <Card>
        <CardHeader><CardTitle>Vorschau</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{data.length} Kontakte werden importiert.</p>
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2"><Settings2 className="h-4 w-4" /><Label className="font-semibold">Duplikat-Behandlung:</Label></div>
              <Select value={duplicateStrategy} onValueChange={setDuplicateStrategy}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ask">Bei jedem Duplikat nachfragen</SelectItem>
                  <SelectItem value="skip">Alle Duplikate automatisch überspringen</SelectItem>
                  <SelectItem value="import">Alle Duplikate trotzdem importieren</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border rounded-md max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>{fieldMappings.filter((m) => m.targetField).map((m) => (<TableHead key={m.targetField}>{m.targetField.replace(/_/g, " ")}</TableHead>))}</TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 5).map((row, index) => (
                  <TableRow key={index}>{fieldMappings.filter((m) => m.targetField).map((m) => (<TableCell key={m.targetField}>{row[m.sourceField] || "-"}</TableCell>))}</TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={startImport}><FileText className="h-4 w-4 mr-2" />Import starten</Button>
            <Button variant="outline" onClick={() => {}}>Zurück zur Zuordnung</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "importing") {
    return (
      <Card>
        <CardHeader><CardTitle>Importiere Kontakte...</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-muted-foreground">{importedCount} von {data.length} Kontakte importiert</p>
        </CardContent>
      </Card>
    );
  }

  if (step === "complete") {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center"><Check className="h-5 w-5 mr-2 text-green-600" />Import abgeschlossen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="text-sm py-1 px-3">✓ {importedCount} importiert</Badge>
            {skippedCount > 0 && <Badge variant="outline" className="text-sm py-1 px-3">⊘ {skippedCount} übersprungen</Badge>}
            {errors.length > 0 && <Badge variant="destructive" className="text-sm py-1 px-3">✗ {errors.length} Fehler</Badge>}
          </div>
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">{errors.length} Fehler beim Import:</p>
                <div className="max-h-32 overflow-auto">{errors.slice(0, 5).map((e, i) => <p key={i} className="text-sm">{e}</p>)}{errors.length > 5 && <p className="text-sm">... und {errors.length - 5} weitere</p>}</div>
              </AlertDescription>
            </Alert>
          )}
          {duplicateWarnings.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <p className="font-medium mb-2 text-yellow-800">{duplicateWarnings.length} mögliche Duplikate:</p>
                <div className="max-h-32 overflow-auto">{duplicateWarnings.slice(0, 5).map((w, i) => <p key={i} className="text-sm text-yellow-700">{w}</p>)}</div>
              </AlertDescription>
            </Alert>
          )}
          <Button onClick={reset}>Neuen Import starten</Button>
        </CardContent>
      </Card>
    );
  }

  return null;
};
