import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Tenant {
  id: string;
  name: string;
  description?: string;
  settings: any; // Changed from Record<string, any> to any to match Json type
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface UserTenantMembership {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tenant?: Tenant;
}

interface TenantContextType {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  memberships: UserTenantMembership[];
  loading: boolean;
  switchTenant: (tenantId: string) => void;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [memberships, setMemberships] = useState<UserTenantMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    if (!user) {
      setTenants([]);
      setCurrentTenant(null);
      setMemberships([]);
      setLoading(false);
      return;
    }

    try {
      console.log('🏢 Fetching tenant memberships for user:', user.id);
      
      // Clean up legacy global key (one-time migration)
      const legacyKey = 'currentTenantId';
      if (localStorage.getItem(legacyKey)) {
        localStorage.removeItem(legacyKey);
        console.log('🧹 Cleaned up legacy tenant storage key');
      }
      
      // User-specific storage key for tenant isolation
      const tenantStorageKey = `currentTenantId_${user.id}`;
      
      // Fetch user's tenant memberships with tenant details
      const { data: membershipData, error: membershipError } = await supabase
        .from('user_tenant_memberships')
        .select(`
          *,
          tenant:tenants(*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (membershipError) {
        console.error('❌ Error fetching tenant memberships:', membershipError);
        return;
      }

      console.log('🏢 Tenant memberships:', membershipData);

      const membershipsWithTenants = membershipData || [];
      const tenantsData = membershipsWithTenants
        .map(m => m.tenant)
        .filter(Boolean) as Tenant[];

      setMemberships(membershipsWithTenants);
      setTenants(tenantsData);

      console.log('🏢 Available tenants for user:', tenantsData.map(t => t.name));

      // Set current tenant from user-specific localStorage or default to first tenant
      const savedTenantId = localStorage.getItem(tenantStorageKey);
      let currentTenantToSet = null;

      if (savedTenantId) {
        // Only use if tenant exists in user's available tenants
        currentTenantToSet = tenantsData.find(t => t.id === savedTenantId) || null;
        
        if (currentTenantToSet) {
          console.log('🏢 Restored tenant from localStorage:', currentTenantToSet.name);
        } else {
          // Stored tenant is not accessible - remove it
          console.warn('⚠️ Stored tenant not accessible for this user, clearing localStorage');
          localStorage.removeItem(tenantStorageKey);
        }
      }

      // Fallback to first available tenant
      if (!currentTenantToSet && tenantsData.length > 0) {
        currentTenantToSet = tenantsData[0];
        console.log('🏢 Using first available tenant:', currentTenantToSet.name);
      }

      setCurrentTenant(currentTenantToSet);
      if (currentTenantToSet) {
        localStorage.setItem(tenantStorageKey, currentTenantToSet.id);
        console.log('🏢 Current tenant set to:', currentTenantToSet.name);
      } else {
        console.warn('⚠️ No tenant available for user - user may need tenant assignment');
        localStorage.removeItem(tenantStorageKey);
      }
    } catch (error) {
      console.error('Error in fetchTenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTenant = (tenantId: string) => {
    if (!user) return;
    
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
      // Use user-specific key for tenant isolation
      localStorage.setItem(`currentTenantId_${user.id}`, tenantId);
      console.log('🏢 Switched to tenant:', tenant.name);
    }
  };

  const refreshTenants = async () => {
    setLoading(true);
    await fetchTenants();
  };

  useEffect(() => {
    fetchTenants();
  }, [user]);

  const value = {
    tenants,
    currentTenant,
    memberships,
    loading,
    switchTenant,
    refreshTenants,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
};