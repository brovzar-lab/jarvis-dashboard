import { useQuery } from '@tanstack/react-query';
import { fetchCalendar } from '../services/integrations';

export function useCalendar() {
  return useQuery({
    queryKey: ['calendar'],
    queryFn: fetchCalendar,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
