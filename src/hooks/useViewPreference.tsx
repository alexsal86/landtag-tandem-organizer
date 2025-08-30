import { useState, useEffect } from 'react';

export type ViewType = 'card' | 'list';

interface UseViewPreferenceProps {
  key: string;
  defaultView?: ViewType;
}

export const useViewPreference = ({ key, defaultView = 'card' }: UseViewPreferenceProps) => {
  const [viewType, setViewType] = useState<ViewType>(() => {
    const saved = localStorage.getItem(`viewPreference_${key}`);
    return (saved as ViewType) || defaultView;
  });

  useEffect(() => {
    localStorage.setItem(`viewPreference_${key}`, viewType);
  }, [key, viewType]);

  return { viewType, setViewType };
};