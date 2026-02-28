import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useCaseFiles, CaseFile, CASE_STATUSES } from "@/hooks/useCaseFiles";
import { useCaseFileTypes } from "@/hooks/useCaseFileTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Layers,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { icons, LucideIcon } from "lucide-react";
import { CaseFileCreateDialog } from "./case-files/CaseFileCreateDialog";
import { CaseFileCard } from "./case-files/CaseFileCard";
import { CaseFileDetail } from "./case-files/CaseFileDetail";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type ViewStyle = "flat" | "grouped";

export function CaseFilesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { caseFiles, loading } = useCaseFiles();
  const { caseFileTypes, loading: typesLoading } = useCaseFileTypes();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewStyle, setViewStyle] = useState<ViewStyle>("flat");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCaseFile, setSelectedCaseFile] = useState<CaseFile | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const hasInitializedGroups = useRef(false);

  // Handle URL action parameter for QuickActions
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-casefile') {
      setCreateDialogOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  // Group case files by type
  const groupedCaseFiles = useMemo(() => {
    const groups = new Map<string, CaseFile[]>();
    
    // Initialize groups based on types order
    caseFileTypes.forEach(type => {
      groups.set(type.name, []);
    });
    
    // Add "unknown" group for types not in database
    groups.set('_unknown', []);
    
    filteredCaseFiles.forEach(cf => {
      const typeName = cf.case_type || 'general';
      if (groups.has(typeName)) {
        groups.get(typeName)!.push(cf);
      } else {
        groups.get('_unknown')!.push(cf);
      }
    });
    
    // Remove empty groups
    for (const [key, value] of groups) {
      if (value.length === 0) {
        groups.delete(key);
      }
    }
    
    return groups;
  }, [filteredCaseFiles, caseFileTypes]);

  // Initialize groups once when data becomes available, then preserve user expand/collapse choices
  useEffect(() => {
    if (!hasInitializedGroups.current && groupedCaseFiles.size > 0) {
      setExpandedGroups(new Set(groupedCaseFiles.keys()));
      hasInitializedGroups.current = true;
      return;
    }

    // Keep only groups that still exist and preserve explicit user collapse choices
    setExpandedGroups((prev) => {
      if (groupedCaseFiles.size === 0) return prev;

      const next = new Set<string>();
      for (const groupName of groupedCaseFiles.keys()) {
        if (prev.has(groupName)) {
          next.add(groupName);
        }
      }

      if (next.size === prev.size && Array.from(next).every((group) => prev.has(group))) {
        return prev;
      }

      return next;
    });
  }, [groupedCaseFiles]);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const expandAll = () => {
    setExpandedGroups(new Set(groupedCaseFiles.keys()));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const getTypeConfig = (typeName: string) => {
    return caseFileTypes.find(t => t.name === typeName);
  };

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  const statusCounts = {
    all: caseFiles.length,
    active: caseFiles.filter(cf => cf.status === 'active').length,
    pending: caseFiles.filter(cf => cf.status === 'pending').length,
    closed: caseFiles.filter(cf => cf.status === 'closed').length,
    archived: caseFiles.filter(cf => cf.status === 'archived').length,
  };

  if (selectedCaseFile) {
    return (
      <div className="space-y-6 p-6">
        <CaseFileDetail 
          caseFileId={selectedCaseFile.id} 
          onBack={() => setSelectedCaseFile(null)} 
        />
      </div>
    );
  }

  const isLoading = loading || typesLoading;

  return (
    <div className="space-y-6 p-6">
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
            <div className="flex gap-2 flex-wrap">
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
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Typen</SelectItem>
                  {caseFileTypes.map(type => (
                    <SelectItem key={type.id} value={type.name}>
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: type.color }}
                        />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex border rounded-md">
                <Button
                  variant={viewStyle === "flat" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewStyle("flat")}
                  title="Flache Ansicht"
                >
                  {viewMode === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </Button>
                <Button
                  variant={viewStyle === "grouped" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewStyle("grouped")}
                  title="Gruppierte Ansicht"
                >
                  <Layers className="h-4 w-4" />
                </Button>
              </div>
              {viewStyle === "flat" && (
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
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Case Files List */}
      {isLoading ? (
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
      ) : viewStyle === "grouped" ? (
        <div className="space-y-4">
          {/* Expand/Collapse All */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Alle aufklappen
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Alle zuklappen
            </Button>
          </div>

          {/* Grouped View */}
          {Array.from(groupedCaseFiles.entries()).map(([typeName, files]) => {
            const typeConfig = getTypeConfig(typeName);
            const TypeIcon = getIconComponent(typeConfig?.icon);
            const isExpanded = expandedGroups.has(typeName);

            return (
              <Collapsible
                key={typeName}
                open={isExpanded}
                onOpenChange={() => toggleGroup(typeName)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: typeConfig?.color || '#6b7280' }}
                          />
                          {TypeIcon && <TypeIcon className="h-5 w-5" style={{ color: typeConfig?.color }} />}
                          <CardTitle className="text-lg">
                            {typeConfig?.label || typeName}
                          </CardTitle>
                          <Badge variant="secondary" className="ml-2">
                            {files.length}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                        {files.map((caseFile) => (
                          <CaseFileCard
                            key={caseFile.id}
                            caseFile={caseFile}
                            viewMode={viewMode}
                            onClick={() => setSelectedCaseFile(caseFile)}
                            caseFileTypes={caseFileTypes}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
          {filteredCaseFiles.map((caseFile) => (
            <CaseFileCard
              key={caseFile.id}
              caseFile={caseFile}
              viewMode={viewMode}
              onClick={() => setSelectedCaseFile(caseFile)}
              caseFileTypes={caseFileTypes}
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
