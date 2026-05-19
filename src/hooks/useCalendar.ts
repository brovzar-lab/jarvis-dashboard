import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCalendar } from '../services/integrations';

// Returns ms until the next occurrence of the given hour (0-23) in local time
function msUntilHour(hour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

const REFRESH_HOURS = [8, 14, 19]; // 8am, 2pm, 7pm

export function useCalendar() {
  const qc = useQueryClient();

  // Schedule forced refetches at 8am, 2pm, 7pm local time
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    function scheduleNext(hour: number) {
      const delay = msUntilHour(hour);
      const t = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['calendar'] });
        // Reschedule for the next day
        scheduleNext(hour);
      }, delay);
      timers.push(t);
    }

    for (const h of REFRESH_HOURS) scheduleNext(h);
    return () => timers.forEach(clearTimeout);
  }, [qc]);

  return useQuery({
    queryKey: ['calendar'],
    queryFn: fetchCalendar,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
