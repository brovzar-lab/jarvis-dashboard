import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '../services/paperclip';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}
