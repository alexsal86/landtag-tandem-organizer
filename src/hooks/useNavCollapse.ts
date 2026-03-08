import { useCallback } from 'react';
import { useUserPreference } from '@/hooks/useUserPreference';

export function useNavCollapse() {
  const [isCollapsed, setIsCollapsed] = useUserPreference<boolean>('nav-collapsed', false);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, [setIsCollapsed]);

  const collapse = useCallback(() => {
    setIsCollapsed(true);
  }, [setIsCollapsed]);

  const expand = useCallback(() => {
    setIsCollapsed(false);
  }, [setIsCollapsed]);

  return {
    isCollapsed,
    toggle,
    collapse,
    expand,
    setIsCollapsed,
  };
}
