import React from 'react';
import { AdministrationTabs } from '@/components/administration/AdministrationTabs';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

export default function Administration() {
  const { user, loading } = useAuth();
  const { currentTenant } = useTenant();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Lade...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Bitte melden Sie sich an, um auf die Administration zuzugreifen.</p>
      </div>
    );
  }

  return <AdministrationTabs />;
}