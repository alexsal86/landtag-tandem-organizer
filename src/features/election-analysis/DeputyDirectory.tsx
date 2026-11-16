import { useAuth } from '@/hooks/useAuth';
import { useAdministrationAccess } from '@/components/administration/useAdministrationAccess';
import { ElectionDeputyDirectory } from '@/features/election-history/ElectionDeputyDirectory';

export default function DeputyDirectory() {
  const { user, loading } = useAuth();
  const access = useAdministrationAccess(user?.id, undefined, loading);
  return <ElectionDeputyDirectory readOnly canEditPortraits={access.isSuperAdmin} />;
}
