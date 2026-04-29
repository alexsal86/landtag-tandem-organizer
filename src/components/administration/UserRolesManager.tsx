import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { getErrorMessage } from "@/utils/errorHandler";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { NewUserForm } from "@/components/admin/NewUserForm";
import { CreateDemoUsers } from "@/dev/CreateDemoUsers";
import { Users, Plus, Trash2 } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "abgeordneter", label: "Abgeordneter (Admin)" },
  { value: "bueroleitung", label: "Büroleitung" },
  { value: "mitarbeiter", label: "Mitarbeiter" },
  { value: "praktikant", label: "Praktikant" },
] as const;

type RoleValue = typeof ROLE_OPTIONS[number]["value"];

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type UserRole = {
  user_id: string;
  role: RoleValue;
};

export function UserRolesManager() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    if (currentTenant) loadData();
  }, [currentTenant]);

  const loadData = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const { data: memberships } = await supabase
        .from('user_tenant_memberships')
        .select('user_id')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);

      if (!memberships?.length) {
        setProfiles([]);
        setRoles([]);
        return;
      }

      const userIds = memberships.map((m: Record<string, any>) => m.user_id);
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds).order('display_name'),
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      ]);
      setProfiles(profilesRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (error) {
      debugConsole.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (targetUserId: string, role: RoleValue | "none") => {
    try {
      setBusyUserId(targetUserId);
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", targetUserId);
      if (delErr) throw delErr;
      if (role !== "none" && user) {
        const { error: insErr } = await supabase.from("user_roles").insert([{ user_id: targetUserId, role, assigned_by: user.id }]);
        if (insErr) throw insErr;
      }
      const { data: newRoles } = await supabase.from("user_roles").select("user_id, role");
      setRoles((newRoles as UserRole[]) || []);
      toast({ title: "Gespeichert", description: "Rolle erfolgreich aktualisiert." });
    } catch (error: unknown) {
      debugConsole.error(error);
      toast({ title: "Fehler", description: getErrorMessage(error) || "Änderung fehlgeschlagen.", variant: "destructive" });
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Benutzerrollen
        </CardTitle>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" />Neuer Benutzer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuen Benutzer erstellen</DialogTitle></DialogHeader>
              <NewUserForm onSuccess={loadData} />
            </DialogContent>
          </Dialog>
          <CreateDemoUsers />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-9 w-56 ml-auto" />
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Benutzer</TableHead>
                <TableHead className="text-right">Rolle</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={p.avatar_url ?? undefined} alt={p.display_name ?? "Avatar"} />
                        <AvatarFallback>{(p.display_name ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.display_name || "Unbekannter Benutzer"}</span>
                        <span className="text-xs text-muted-foreground">{p.user_id}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Select value={roles.find(r => r.user_id === p.user_id)?.role ?? "none"} onValueChange={(val) => updateUserRole(p.user_id, val as RoleValue | "none")} disabled={busyUserId === p.user_id}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine Rolle</SelectItem>
                        {ROLE_OPTIONS.map(role => (<SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {p.user_id !== user?.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
                            <AlertDialogDescription>{p.display_name} wird unwiderruflich aus dem System entfernt. Alle zugehörigen Daten werden gelöscht.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => {
                              try {
                                const { data, error } = await supabase.functions.invoke('manage-tenant-user', { body: { action: 'deleteUser', userId: p.user_id, tenantId: currentTenant?.id } });
                                if (error || !data?.success) throw new Error(data?.error || 'Löschen fehlgeschlagen');
                                toast({ title: "Benutzer gelöscht" });
                                loadData();
                              } catch (error: unknown) {
                                toast({ title: "Fehler", description: getErrorMessage(error), variant: "destructive" });
                              }
                            }}>Unwiderruflich löschen</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
