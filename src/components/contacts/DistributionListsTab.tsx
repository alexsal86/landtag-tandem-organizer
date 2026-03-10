import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users, Edit, Trash2 } from "lucide-react";
import { DistributionListForm } from "@/components/DistributionListForm";
import { DistributionList } from "./hooks/useContactsViewState";

interface DistributionListsTabProps {
  distributionLists: DistributionList[];
  distributionListsLoading: boolean;
  creatingDistribution: boolean;
  editingDistributionListId: string | null;
  setCreatingDistribution: (v: boolean) => void;
  setEditingDistributionListId: (v: string | null) => void;
  fetchDistributionLists: () => void;
  deleteDistributionList: (id: string) => void;
  onContactClick: (id: string) => void;
}

export function DistributionListsTab({
  distributionLists, distributionListsLoading, creatingDistribution, editingDistributionListId,
  setCreatingDistribution, setEditingDistributionListId, fetchDistributionLists, deleteDistributionList, onContactClick,
}: DistributionListsTabProps) {
  const [deleteListId, setDeleteListId] = useState<string | null>(null);

  const deleteTargetList = distributionLists.find((list) => list.id === deleteListId) ?? null;

  const handleConfirmDelete = () => {
    if (!deleteListId) return;
    deleteDistributionList(deleteListId);
    setDeleteListId(null);
  };

  if (creatingDistribution || editingDistributionListId) {
    return (
      <DistributionListForm
        distributionListId={editingDistributionListId || undefined}
        onSuccess={() => { setCreatingDistribution(false); setEditingDistributionListId(null); fetchDistributionLists(); }}
        onBack={() => { setCreatingDistribution(false); setEditingDistributionListId(null); }}
      />
    );
  }

  if (distributionListsLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Verteiler werden geladen...</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {distributionLists.map((list) => (
        <Card key={list.id} className="bg-card shadow-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <CardTitle className="text-lg">{list.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{list.member_count} Kontakte{list.topic && ` • ${list.topic}`}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditingDistributionListId(list.id)}><Edit className="h-4 w-4" />Bearbeiten</Button>
                <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => setDeleteListId(list.id)}>
                  <Trash2 className="h-4 w-4" />Löschen
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {list.description && <p className="text-sm text-muted-foreground mb-4">{list.description}</p>}
            {list.members.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Mitglieder ({list.members.length}):</p>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8 text-xs">Name</TableHead>
                        <TableHead className="h-8 text-xs">E-Mail</TableHead>
                        <TableHead className="h-8 text-xs hidden sm:table-cell">Organisation</TableHead>
                        <TableHead className="h-8 text-xs hidden md:table-cell">Kategorie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.members.map((member) => (
                        <TableRow key={member.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onContactClick(member.id)}>
                          <TableCell className="py-1.5 text-sm font-medium">{member.name}</TableCell>
                          <TableCell className="py-1.5 text-sm text-muted-foreground">{member.email || '–'}</TableCell>
                          <TableCell className="py-1.5 text-sm text-muted-foreground hidden sm:table-cell">{member.organization || '–'}</TableCell>
                          <TableCell className="py-1.5 hidden md:table-cell">
                            {member.category && (
                              <Badge variant="outline" className="text-xs">
                                {member.category === "citizen" ? "Bürger" : member.category === "colleague" ? "Kollege" : member.category === "business" ? "Wirtschaft" : member.category === "media" ? "Medien" : member.category === "lobbyist" ? "Lobbyist" : member.category}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {distributionLists.length === 0 && (
        <Card className="bg-card shadow-card border-border">
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine Verteiler vorhanden</h3>
            <p className="text-muted-foreground mb-4">Erstellen Sie Ihren ersten Verteiler, um Kontakte zu organisieren.</p>
            <Button className="gap-2" onClick={() => setCreatingDistribution(true)}><Plus className="h-4 w-4" />Ersten Verteiler erstellen</Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(deleteListId)} onOpenChange={(open) => { if (!open) setDeleteListId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verteiler löschen?</DialogTitle>
            <DialogDescription>
              {deleteTargetList
                ? `Sind Sie sicher, dass Sie den Verteiler "${deleteTargetList.name}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`
                : "Möchten Sie diesen Verteiler wirklich löschen?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteListId(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
