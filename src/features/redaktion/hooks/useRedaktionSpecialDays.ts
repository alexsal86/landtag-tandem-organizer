import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { DEFAULT_SPECIAL_DAYS } from "@/utils/dashboard/specialDays";
import { fetchSpecialDays } from "@/features/redaktion/utils/fetchSpecialDays";

export function useRedaktionSpecialDays() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["dashboard-special-days", currentTenant?.id],
    queryFn: () => fetchSpecialDays(currentTenant?.id),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    initialData: DEFAULT_SPECIAL_DAYS,
  });
}
