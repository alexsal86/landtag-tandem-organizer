import { useState } from "react";
import { useCaseFiles, CaseFile, CASE_TYPES, CASE_STATUSES } from "@/hooks/useCaseFiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  Briefcase, 
  Users, 
  FileText, 
  CheckSquare, 
  Calendar,
  Mail,
  LayoutGrid,
  List,
  Filter
} from "lucide-react";
import { CaseFileCreateDialog } from "./case-files/CaseFileCreateDialog";
import { CaseFileCard } from "./case-files/CaseFileCard";
import { CaseFileDetail } from "./case-files/CaseFileDetail";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function CaseFilesView() {
  const { caseFiles, loading } = useCaseFiles();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCaseFile, setSelectedCaseFile] = useState<CaseFile | null>(null);

  const filteredCaseFiles = caseFiles.filter((cf) => {
    const matchesSearch = 
      cf.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cf.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cf.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cf.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || cf.status === statusFilter;
    const matchesType = typeFilter === "all" || cf.case_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const statusCounts = {
    all: caseFiles.length,
    active: caseFiles.filter(cf => cf.status === 'active').length,
    pending: caseFiles.filter(cf => cf.status === 'pending').length,
    closed: caseFiles.filter(cf => cf.status === 'closed').length,
    archived: caseFiles.filter(cf => cf.status === 'archived').length,
  };

  if (selectedCaseFile) {
    return (
      <CaseFileDetail 
        caseFileId={selectedCaseFile.id} 
        onBack={() => setSelectedCaseFile(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Briefcase className="h-8 w-8" />
            FallAkten
          </h1>
          <p className="text-muted-foreground mt-1">
            Zentrale Verwaltung von Sachverhalten mit verknüpften Dokumenten, Kontakten und Aufgaben
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neue FallAkte
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter("all")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.all}</div>
            <p className="text-sm text-muted-foreground">Gesamt</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-green-500" onClick={() => setStatusFilter("active")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.active}</div>
            <p className="text-sm text-muted-foreground">Aktiv</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-yellow-500" onClick={() => setStatusFilter("pending")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.pending}</div>
            <p className="text-sm text-muted-foreground">Wartend</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-blue-500" onClick={() => setStatusFilter("closed")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.closed}</div>
            <p className="text-sm text-muted-foreground">Abgeschlossen</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-gray-500" onClick={() => setStatusFilter("archived")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.archived}</div>
            <p className="text-sm text-muted-foreground">Archiviert</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suchen nach Titel, Beschreibung, Aktenzeichen oder Tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {CASE_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Typen</SelectItem>
                  {CASE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Case Files List */}
      {loading ? (
        <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredCaseFiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Keine FallAkten gefunden</h3>
            <p className="text-muted-foreground text-center mt-2">
              {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                ? "Versuchen Sie andere Filterkriterien."
                : "Erstellen Sie Ihre erste FallAkte, um Sachverhalte zentral zu verwalten."}
            </p>
            {!searchTerm && statusFilter === "all" && typeFilter === "all" && (
              <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Erste FallAkte erstellen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
          {filteredCaseFiles.map((caseFile) => (
            <CaseFileCard
              key={caseFile.id}
              caseFile={caseFile}
              viewMode={viewMode}
              onClick={() => setSelectedCaseFile(caseFile)}
            />
          ))}
        </div>
      )}

      <CaseFileCreateDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onSuccess={(cf) => setSelectedCaseFile(cf)}
      />
    </div>
  );
}
