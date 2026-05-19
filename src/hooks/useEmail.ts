import { useQuery } from '@tanstack/react-query';
import { fetchEmails } from '../services/integrations';

export function useEmail() {
  return useQuery({
    queryKey: ['email'],
    queryFn: fetchEmails,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
