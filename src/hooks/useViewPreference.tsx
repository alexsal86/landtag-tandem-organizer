import { useUserPreference } from '@/hooks/useUserPreference';

export type ViewType = 'card' | 'list';

interface UseViewPreferenceProps {
  key: string;
  defaultView?: ViewType;
}

export const useViewPreference = ({ key, defaultView = 'card' }: UseViewPreferenceProps) => {
  const [viewType, setViewType] = useUserPreference<ViewType>(`viewPreference_${key}`, defaultView);
  return { viewType, setViewType };
};
