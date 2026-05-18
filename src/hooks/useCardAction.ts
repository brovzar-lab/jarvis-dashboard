import { useState, useCallback } from 'react';
import { isDemoMode } from '../services/paperclip';

export function useCardAction(issueId: string, companyId: string, onRefresh: () => void) {
  const [isPending, setIsPending] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);

  const execute = useCallback(async (
    action: 'patch_issue' | 'add_comment',
    params: Record<string, unknown>
  ) => {
    if (isPending) return;
    setIsPending(true);
    setDidSucceed(false);
    try {
      if (isDemoMode) {
        await new Promise(r => setTimeout(r, 400));
        setDidSucceed(true);
        onRefresh();
        setTimeout(() => setDidSucceed(false), 1200);
        return;
      }
      const res = await fetch('/api/paperclip-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params: { issueId, ...params }, companyId }),
      });
      if (res.ok) {
        setDidSucceed(true);
        onRefresh();
        setTimeout(() => setDidSucceed(false), 1200);
      }
    } finally {
      setIsPending(false);
    }
  }, [issueId, companyId, onRefresh, isPending]);

  return { execute, isPending, didSucceed };
}
