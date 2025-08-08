import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

// Roles in descending hierarchy
const ROLE_OPTIONS = [
  { value: "abgeordneter", label: "Abgeordneter (Admin)" },
  { value: "bueroleitung", label: "Büroleitung" },
  { value: "mitarbeiter", label: "Mitarbeiter" },
  { value: "praktikant", label: "Praktikant" },
] as const;

type RoleValue = typeof ROLE_OPTIONS[number]["value"]; // union type

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type UserRole = {
  user_id: string;
  role: RoleValue;
};

export default function RoleManagement() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // SEO basics
  useEffect(() => {
    document.title = "Rollen & Rechte verwalten | Admin";
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
    supabase
      .rpc("is_admin", { _user_id: user.id })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setIsAdmin(!!data);
      });
  }, [user]);

  // Load profiles and roles
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoadingData(true);

      const [{ data: profilesData, error: pErr }, { data: rolesData, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").order("display_name", { ascending: true, nullsFirst: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (pErr) console.error(pErr);
      if (rErr) console.error(rErr);

      setProfiles(profilesData || []);
      setRoles((rolesData as UserRole[]) || []);
      setLoadingData(false);
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
      // Remove all roles first, then set the selected one (if not none)
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", targetUserId);
      if (delErr) throw delErr;

      if (role !== "none") {
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert({ user_id: targetUserId, role, assigned_by: user.id });
        if (insErr) throw insErr;
      }

      // Refresh roles
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

  if (loading) return null;

  if (!isAdmin) {
    return (
      <main className="container mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Rechte verwalten</h1>
          <p className="text-muted-foreground">Sie besitzen keine Berechtigung, diese Seite zu sehen.</p>
        </header>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Rollen & Rechte verwalten</h1>
        <p className="text-muted-foreground">Weisen Sie Benutzern Rollen zu. Nur "Abgeordneter" hat Admin-Rechte.</p>
      </header>

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
    </main>
  );
}
