import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Plus, Save, X } from "lucide-react";

// Roles in descending hierarchy
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

type ConfigItem = {
  id: string;
  name: string;
  label: string;
  is_active: boolean;
  order_index: number;
};

export default function Administration() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Configuration states
  const [appointmentCategories, setAppointmentCategories] = useState<ConfigItem[]>([]);
  const [appointmentStatuses, setAppointmentStatuses] = useState<ConfigItem[]>([]);
  const [taskCategories, setTaskCategories] = useState<ConfigItem[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<ConfigItem[]>([]);
  const [editingItem, setEditingItem] = useState<{type: string, id: string, value: string} | null>(null);
  const [newItem, setNewItem] = useState<{type: string, value: string} | null>(null);

  // SEO basics
  useEffect(() => {
    document.title = "Administration | Admin";
    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", window.location.href);
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Check admin privilege
  useEffect(() => {
    if (!user) return;
    
    const checkAdminStatus = async () => {
      const [{ data: isAdminData }, { data: isSuperAdminData }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "bueroleitung" }),
        supabase.rpc("is_admin", { _user_id: user.id })
      ]);
      
      setIsAdmin(!!(isAdminData || isSuperAdminData));
      setIsSuperAdmin(!!isSuperAdminData);
    };
    
    checkAdminStatus();
  }, [user]);

  // Load all data
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoadingData(true);

      try {
        const [
          { data: profilesData, error: pErr },
          { data: rolesData, error: rErr },
          { data: appointmentCategoriesData, error: acErr },
          { data: appointmentStatusesData, error: asErr },
          { data: taskCategoriesData, error: tcErr },
          { data: taskStatusesData, error: tsErr }
        ] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, avatar_url").order("display_name", { ascending: true, nullsFirst: false }),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("appointment_categories").select("*").order("order_index"),
          supabase.from("appointment_statuses").select("*").order("order_index"),
          supabase.from("task_categories").select("*").order("order_index"),
          supabase.from("task_statuses").select("*").order("order_index")
        ]);

        if (pErr) console.error(pErr);
        if (rErr) console.error(rErr);
        if (acErr) console.error(acErr);
        if (asErr) console.error(asErr);
        if (tcErr) console.error(tcErr);
        if (tsErr) console.error(tsErr);

        setProfiles(profilesData || []);
        setRoles((rolesData as UserRole[]) || []);
        setAppointmentCategories(appointmentCategoriesData || []);
        setAppointmentStatuses(appointmentStatusesData || []);
        setTaskCategories(taskCategoriesData || []);
        setTaskStatuses(taskStatusesData || []);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    load();
  }, [user]);

  const roleByUser = useMemo(() => {
    const priority: Record<RoleValue, number> = {
      abgeordneter: 4,
      bueroleitung: 3,
      mitarbeiter: 2,
      praktikant: 1,
    } as any;
    const map = new Map<string, RoleValue | undefined>();
    roles.forEach((r) => {
      const current = map.get(r.user_id);
      if (!current) return map.set(r.user_id, r.role);
      if (priority[r.role] > priority[current]) map.set(r.user_id, r.role);
    });
    return map;
  }, [roles]);

  const setRole = async (targetUserId: string, role: RoleValue | "none") => {
    if (!user) return;
    try {
      setBusyUserId(targetUserId);
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", targetUserId);
      if (delErr) throw delErr;

      if (role !== "none") {
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert({ user_id: targetUserId, role, assigned_by: user.id });
        if (insErr) throw insErr;
      }

      const { data: newRoles } = await supabase.from("user_roles").select("user_id, role");
      setRoles((newRoles as UserRole[]) || []);

      toast({ title: "Gespeichert", description: "Rolle erfolgreich aktualisiert." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Fehler", description: e?.message ?? "Änderung fehlgeschlagen.", variant: "destructive" });
    } finally {
      setBusyUserId(null);
    }
  };

  const saveConfigItem = async (type: string, id: string, label: string) => {
    try {
      if (type === 'appointment_categories') {
        const { error } = await supabase.from('appointment_categories').update({ label }).eq('id', id);
        if (error) throw error;
        const { data } = await supabase.from('appointment_categories').select("*").order("order_index");
        setAppointmentCategories(data || []);
      } else if (type === 'appointment_statuses') {
        const { error } = await supabase.from('appointment_statuses').update({ label }).eq('id', id);
        if (error) throw error;
        const { data } = await supabase.from('appointment_statuses').select("*").order("order_index");
        setAppointmentStatuses(data || []);
      } else if (type === 'task_categories') {
        const { error } = await supabase.from('task_categories').update({ label }).eq('id', id);
        if (error) throw error;
        const { data } = await supabase.from('task_categories').select("*").order("order_index");
        setTaskCategories(data || []);
      } else if (type === 'task_statuses') {
        const { error } = await supabase.from('task_statuses').update({ label }).eq('id', id);
        if (error) throw error;
        const { data } = await supabase.from('task_statuses').select("*").order("order_index");
        setTaskStatuses(data || []);
      }
      
      setEditingItem(null);
      toast({ title: "Gespeichert", description: "Eintrag erfolgreich aktualisiert." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
    }
  };

  const addConfigItem = async (type: string, label: string) => {
    try {
      const name = label.toLowerCase().replace(/\s+/g, '_').replace(/[äöüß]/g, (char) => {
        const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
        return map[char] || char;
      });
      
      if (type === 'appointment_categories') {
        const { error } = await supabase.from('appointment_categories').insert({ name, label, order_index: 999 });
        if (error) throw error;
        const { data } = await supabase.from('appointment_categories').select("*").order("order_index");
        setAppointmentCategories(data || []);
      } else if (type === 'appointment_statuses') {
        const { error } = await supabase.from('appointment_statuses').insert({ name, label, order_index: 999 });
        if (error) throw error;
        const { data } = await supabase.from('appointment_statuses').select("*").order("order_index");
        setAppointmentStatuses(data || []);
      } else if (type === 'task_categories') {
        const { error } = await supabase.from('task_categories').insert({ name, label, order_index: 999 });
        if (error) throw error;
        const { data } = await supabase.from('task_categories').select("*").order("order_index");
        setTaskCategories(data || []);
      } else if (type === 'task_statuses') {
        const { error } = await supabase.from('task_statuses').insert({ name, label, order_index: 999 });
        if (error) throw error;
        const { data } = await supabase.from('task_statuses').select("*").order("order_index");
        setTaskStatuses(data || []);
      }
      
      setNewItem(null);
      toast({ title: "Hinzugefügt", description: "Neuer Eintrag erfolgreich erstellt." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Fehler", description: "Fehler beim Hinzufügen.", variant: "destructive" });
    }
  };

  const deleteConfigItem = async (type: string, id: string) => {
    try {
      if (type === 'appointment_categories') {
        const { error } = await supabase.from('appointment_categories').delete().eq('id', id);
        if (error) throw error;
        const { data } = await supabase.from('appointment_categories').select("*").order("order_index");
        setAppointmentCategories(data || []);
      } else if (type === 'appointment_statuses') {
        const { error } = await supabase.from('appointment_statuses').delete().eq('id', id);
        if (error) throw error;
        const { data } = await supabase.from('appointment_statuses').select("*").order("order_index");
        setAppointmentStatuses(data || []);
      } else if (type === 'task_categories') {
        const { error } = await supabase.from('task_categories').delete().eq('id', id);
        if (error) throw error;
        const { data } = await supabase.from('task_categories').select("*").order("order_index");
        setTaskCategories(data || []);
      } else if (type === 'task_statuses') {
        const { error } = await supabase.from('task_statuses').delete().eq('id', id);
        if (error) throw error;
        const { data } = await supabase.from('task_statuses').select("*").order("order_index");
        setTaskStatuses(data || []);
      }
      
      toast({ title: "Gelöscht", description: "Eintrag erfolgreich gelöscht." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Fehler", description: "Fehler beim Löschen.", variant: "destructive" });
    }
  };

  const ConfigTable = ({ title, items, type }: { title: string, items: ConfigItem[], type: string }) => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{title}</CardTitle>
          <Button 
            onClick={() => setNewItem({ type, value: '' })}
            disabled={!!newItem || !!editingItem}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Hinzufügen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bezeichnung</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {editingItem?.type === type && editingItem?.id === item.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={editingItem.value}
                        onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                        className="flex-1"
                      />
                      <Button 
                        size="sm" 
                        onClick={() => saveConfigItem(type, item.id, editingItem.value)}
                        className="gap-1"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setEditingItem(null)}
                        className="gap-1"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    item.label
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!(editingItem?.type === type && editingItem?.id === item.id) && (
                    <div className="flex gap-2 justify-end">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingItem({ type, id: item.id, value: item.label })}
                        disabled={!!editingItem || !!newItem}
                        className="gap-1"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => deleteConfigItem(type, item.id)}
                        disabled={!!editingItem || !!newItem}
                        className="gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {newItem?.type === type && (
              <TableRow>
                <TableCell>
                  <div className="flex gap-2">
                    <Input
                      value={newItem.value}
                      onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                      placeholder="Neue Bezeichnung eingeben..."
                      className="flex-1"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => addConfigItem(type, newItem.value)}
                      disabled={!newItem.value.trim()}
                      className="gap-1"
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setNewItem(null)}
                      className="gap-1"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  if (loading) return null;

  if (!isAdmin) {
    return (
      <main className="container mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Administration</h1>
          <p className="text-muted-foreground">Sie besitzen keine Berechtigung, diese Seite zu sehen.</p>
        </header>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="text-muted-foreground">Systemkonfiguration und Benutzerverwaltung</p>
      </header>

      <Tabs defaultValue="appointments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appointments">Termine</TabsTrigger>
          <TabsTrigger value="tasks">Aufgaben</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="roles">Rechte</TabsTrigger>}
        </TabsList>

        <TabsContent value="appointments" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConfigTable 
              title="Termin-Kategorien" 
              items={appointmentCategories} 
              type="appointment_categories" 
            />
            <ConfigTable 
              title="Termin-Status" 
              items={appointmentStatuses} 
              type="appointment_statuses" 
            />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConfigTable 
              title="Aufgaben-Kategorien" 
              items={taskCategories} 
              type="task_categories" 
            />
            <ConfigTable 
              title="Aufgaben-Status" 
              items={taskStatuses} 
              type="task_statuses" 
            />
          </div>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle>Benutzerrollen</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((p) => (
                        <TableRow key={p.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={p.avatar_url ?? undefined} alt={p.display_name ?? "Avatar"} />
                                <AvatarFallback>
                                  {(p.display_name ?? "U").charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium">{p.display_name || "Unbekannter Benutzer"}</span>
                                <span className="text-xs text-muted-foreground">{p.user_id}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Select
                              value={roleByUser.get(p.user_id) ?? "none"}
                              onValueChange={(val) => setRole(p.user_id, val as RoleValue | "none")}
                              disabled={busyUserId === p.user_id}
                            >
                              <SelectTrigger className="w-56 ml-auto">
                                <SelectValue placeholder="Rolle wählen" />
                              </SelectTrigger>
                              <SelectContent align="end">
                                <SelectItem value="none">Keine Rolle</SelectItem>
                                {ROLE_OPTIONS.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>
                                    {r.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
}