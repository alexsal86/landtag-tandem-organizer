import React, { createContext, useContext, useEffect, useState } from "react";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { debugConsole } from "@/utils/debugConsole";
import { safeGetItem, safeSetItem, safeRemoveItem } from "@/utils/storage";

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"] & {
  settings: Json;
};

type UserTenantMembershipRow = Database["public"]["Tables"]["user_tenant_memberships"]["Row"];
export type UserTenantMembership = UserTenantMembershipRow & {
  tenant?: Tenant | null;
};

type MembershipWithTenantQueryRow = UserTenantMembershipRow & {
  tenant: Database["public"]["Tables"]["tenants"]["Row"] | null;
};

interface TenantContextType {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  memberships: UserTenantMembership[];
  loading: boolean;
  switchTenant: (tenantId: string) => void;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const isMembershipWithTenant = (value: unknown): value is MembershipWithTenantQueryRow => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<MembershipWithTenantQueryRow>;
  return typeof candidate.id === "string" && "tenant" in candidate;
};

const normalizeMembershipData = (value: unknown): UserTenantMembership[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isMembershipWithTenant).map((membership) => ({
    ...membership,
    tenant: membership.tenant
      ? {
          ...membership.tenant,
          settings: membership.tenant.settings ?? {},
        }
      : null,
  }));
};

const isTenant = (tenant: UserTenantMembership["tenant"]): tenant is Tenant => {
  return tenant !== null && tenant !== undefined;
};

export const TenantProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
  const { user } = useAuth();
  const [tenantUserId, setTenantUserId] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [memberships, setMemberships] = useState<UserTenantMembership[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchTenants = async (isBackgroundRefresh = false): Promise<void> => {
    if (!user?.id) {
      setTenantUserId(null);
      setTenants([]);
      setCurrentTenant(null);
      setMemberships([]);
      setLoading(false);
      return;
    }

    // Only show loading spinner if we have no data yet (stale-while-revalidate)
    if (!isBackgroundRefresh) {
      setLoading(true);
    }

    try {
      debugConsole.log("🏢 Fetching tenant memberships for user:", user.id);

      const legacyKey = "currentTenantId";
      if (safeGetItem(legacyKey)) {
        safeRemoveItem(legacyKey);
        debugConsole.log("🧹 Cleaned up legacy tenant storage key");
      }

      const tenantStorageKey = `currentTenantId_${user.id}`;

      // Offline access uses only a previously verified snapshot for this user.
      // Server RLS is always checked again before queued writes are applied.
      if (!navigator.onLine) {
        const raw = safeGetItem(`tenant-memberships:${user.id}`);
        const cached = raw ? normalizeMembershipData(JSON.parse(raw)).filter(m => m.user_id === user.id && m.is_active) : [];
        const available = cached.map(m => m.tenant).filter(isTenant);
        const selected = available.find(t => t.id === safeGetItem(tenantStorageKey)) ?? available[0] ?? null;
        setTenantUserId(user.id);
        setMemberships(cached); setTenants(available); setCurrentTenant(selected);
        return;
      }

      const { data: membershipData, error: membershipError } = await supabase
        .from("user_tenant_memberships")
        .select(`
          *,
          tenant:tenants(*)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .returns();

      if (membershipError) {
        debugConsole.error("❌ Error fetching tenant memberships:", membershipError);
        setTenantUserId(user.id);
        safeRemoveItem(`tenant-memberships:${user.id}`);
        setTenants([]);
        setCurrentTenant(null);
        setMemberships([]);
        setLoading(false);
        return;
      }

      const membershipsWithTenants = normalizeMembershipData(membershipData);
      safeSetItem(`tenant-memberships:${user.id}`, JSON.stringify(membershipsWithTenants));
      debugConsole.log("🏢 Tenant memberships:", membershipsWithTenants);

      const tenantsData = membershipsWithTenants
        .map((membership) => membership.tenant)
        .filter(isTenant);

      setTenantUserId(user.id);
      setMemberships(membershipsWithTenants);
      setTenants(tenantsData);
      debugConsole.log("🏢 Available tenants for user:", tenantsData.map((tenant) => tenant.name));

      const savedTenantId = safeGetItem(tenantStorageKey);
      let currentTenantToSet: Tenant | null = null;

      if (savedTenantId) {
        currentTenantToSet = tenantsData.find((tenant) => tenant.id === savedTenantId) ?? null;

        if (currentTenantToSet) {
          debugConsole.log("🏢 Restored tenant from localStorage:", currentTenantToSet.name);
        } else {
          debugConsole.warn("⚠️ Stored tenant not accessible for this user, clearing localStorage");
          safeRemoveItem(tenantStorageKey);
        }
      }

      if (!currentTenantToSet && tenantsData.length > 0) {
        currentTenantToSet = tenantsData[0] ?? null;
        if (currentTenantToSet) {
          debugConsole.log("🏢 Using first available tenant:", currentTenantToSet.name);
        }
      }

      setCurrentTenant(currentTenantToSet);
      if (currentTenantToSet) {
        safeSetItem(tenantStorageKey, currentTenantToSet.id);
        debugConsole.log("🏢 Current tenant set to:", currentTenantToSet.name);
      } else {
        debugConsole.warn("⚠️ No tenant available for user - user may need tenant assignment");
        safeRemoveItem(tenantStorageKey);
      }
    } catch (error: unknown) {
      debugConsole.error("Error in fetchTenants:", error);
      // Preserve existing data on error — only clear on genuine user change (handled by the effect)
    } finally {
      setLoading(false);
    }
  };

  const switchTenant = (tenantId: string): void => {
    if (!user?.id) {
      return;
    }

    const tenant = tenants.find((availableTenant: Tenant) => availableTenant.id === tenantId) ?? null;
    if (!tenant) {
      return;
    }

    setCurrentTenant(tenant);
    safeSetItem(`currentTenantId_${user.id}`, tenantId);
    debugConsole.log("🏢 Switched to tenant:", tenant.name);
  };

  const refreshTenants = async (): Promise<void> => {
    setLoading(true);
    await fetchTenants(false);
  };

  useEffect((): void => {
    // Background refresh if we already have data (same user, token refresh)
    const hasExistingData = tenants.length > 0;
    void fetchTenants(hasExistingData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const reconnect = () => { void fetchTenants(true); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
    // Reconnect must revalidate membership for the current authenticated user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value: TenantContextType = {
    tenants: tenantUserId === user?.id ? tenants : [],
    currentTenant: tenantUserId === user?.id ? currentTenant : null,
    memberships: tenantUserId === user?.id ? memberships : [],
    loading: loading || (!!user && tenantUserId !== user.id),
    switchTenant,
    refreshTenants,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
};
