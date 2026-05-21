import { useState, useCallback } from 'react';

export function useCardAction(issueId: string, companyId: string, onRefresh: () => void) {
  const [isPending, setIsPending] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);
  const [didFail, setDidFail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const execute = useCallback(async (
    action: 'patch_issue' | 'add_comment',
    params: Record<string, unknown>
  ) => {
    if (isPending) return;
    setIsPending(true);
    setDidSucceed(false);
    setDidFail(false);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/paperclip-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params: { issueId, ...params }, companyId }),
      });
      if (res.ok) {
        setDidSucceed(true);
        onRefresh();
        setTimeout(() => setDidSucceed(false), 1200);
      } else {
        let msg = `Action failed (${res.status})`;
        try { const d = await res.json(); if (d?.error) msg = d.error; } catch { /* noop */ }
        setDidFail(true);
        setErrorMsg(msg);
        setTimeout(() => { setDidFail(false); setErrorMsg(null); }, 3000);
      }
    } catch (err) {
      setDidFail(true);
      setErrorMsg(String(err));
      setTimeout(() => { setDidFail(false); setErrorMsg(null); }, 3000);
    } finally {
      setIsPending(false);
    }
  }, [issueId, companyId, onRefresh, isPending]);

  return { execute, isPending, didSucceed, didFail, errorMsg };
}
