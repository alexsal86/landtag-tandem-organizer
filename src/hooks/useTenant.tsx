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

      console.log('🏢 Available tenants:', tenantsData);

      // Set current tenant from localStorage or default to first tenant
      const savedTenantId = localStorage.getItem('currentTenantId');
      let currentTenantToSet = null;

      if (savedTenantId) {
        currentTenantToSet = tenantsData.find(t => t.id === savedTenantId) || null;
        console.log('🏢 Restored tenant from localStorage:', currentTenantToSet);
      }

      if (!currentTenantToSet && tenantsData.length > 0) {
        currentTenantToSet = tenantsData[0];
        console.log('🏢 Using first available tenant:', currentTenantToSet);
      }

      setCurrentTenant(currentTenantToSet);
      if (currentTenantToSet) {
        localStorage.setItem('currentTenantId', currentTenantToSet.id);
        console.log('🏢 Current tenant set to:', currentTenantToSet.name);
      } else {
        console.warn('⚠️ No tenant available for user');
      }
    } catch (error) {
      console.error('Error in fetchTenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTenant = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
      localStorage.setItem('currentTenantId', tenantId);
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