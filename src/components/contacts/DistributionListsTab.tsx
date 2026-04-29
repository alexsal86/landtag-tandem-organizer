import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users, Edit, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { DistributionListForm } from "@/features/contacts/components/DistributionListForm";
import { DistributionList } from "./hooks/useContactsViewState";
import type { DistributionListMember } from "./hooks/useContactsDistributionLists";

interface DistributionListsTabProps {
  distributionLists: DistributionList[];
  distributionListsLoading: boolean;
  creatingDistribution: boolean;
  editingDistributionListId: string | null;
  setCreatingDistribution: (v: boolean) => void;
  setEditingDistributionListId: (v: string | null) => void;
  fetchDistributionLists: () => void;
  deleteDistributionList: (id: string) => void;
  fetchDistributionListMembers: (distributionListId: string) => Promise<DistributionListMember[]>;
  onContactClick: (id: string) => void;
}

export function DistributionListsTab({
  distributionLists,
  distributionListsLoading,
  creatingDistribution,
  editingDistributionListId,
  setCreatingDistribution,
  setEditingDistributionListId,
  fetchDistributionLists,
  deleteDistributionList,
  fetchDistributionListMembers,
  onContactClick,
}: DistributionListsTabProps) {
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const [membersByList, setMembersByList] = useState<Record<string, DistributionListMember[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<Set<string>>(new Set());

  const deleteTargetList = distributionLists.find((list) => list.id === deleteListId) ?? null;

  const handleConfirmDelete = () => {
    if (!deleteListId) return;
    deleteDistributionList(deleteListId);
    setDeleteListId(null);
  };

  const toggleMembers = async (listId: string) => {
    if (expandedLists.has(listId)) {
      setExpandedLists((prev) => {
        const next = new Set(prev);
        next.delete(listId);
        return next;
      });
      return;
    }

    setExpandedLists((prev) => new Set(prev).add(listId));

    if (membersByList[listId]) {
      return;
    }

    setLoadingMembers((prev) => new Set(prev).add(listId));
    try {
      const members = await fetchDistributionListMembers(listId);
      setMembersByList((prev) => ({ ...prev, [listId]: members }));
    } finally {
      setLoadingMembers((prev) => {
        const next = new Set(prev);
        next.delete(listId);
        return next;
      });
    }
  };

  if (creatingDistribution || editingDistributionListId) {
    return (
      <DistributionListForm
        distributionListId={editingDistributionListId || undefined}
        onSuccess={() => {
          setCreatingDistribution(false);
          setEditingDistributionListId(null);
          fetchDistributionLists();
        }}
        onBack={() => {
          setCreatingDistribution(false);
          setEditingDistributionListId(null);
        }}
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
          <CardContent className="pt-0 space-y-4">
            {list.description && <p className="text-sm text-muted-foreground">{list.description}</p>}

            <div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => void toggleMembers(list.id)}>
                Mitglieder anzeigen
                {expandedLists.has(list.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>

            {expandedLists.has(list.id) && (
              <div>
                <p className="text-sm font-medium mb-2">Mitglieder ({list.member_count}):</p>
                <div className="border rounded-md overflow-hidden">
                  {loadingMembers.has(list.id) ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">Mitglieder werden geladen...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-8 text-xs">Name</TableHead>
                          <TableHead className="h-8 text-xs">E-Mail</TableHead>
                          <TableHead className="h-8 text-xs hidden sm:table-cell">Organisation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(membersByList[list.id] || []).map((member) => (
                          <TableRow key={member.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onContactClick(member.id)}>
                            <TableCell className="py-1.5 text-sm font-medium">{member.name}</TableCell>
                            <TableCell className="py-1.5 text-sm text-muted-foreground">{member.email || "–"}</TableCell>
                            <TableCell className="py-1.5 text-sm text-muted-foreground hidden sm:table-cell">{member.organization || "–"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
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
