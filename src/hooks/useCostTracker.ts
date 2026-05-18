import { useState, useEffect } from 'react';
import { getSessionCost, subscribe } from '../services/cost-tracker';

export function useCostTracker(): number {
  const [cost, setCost] = useState(getSessionCost());
  useEffect(() => subscribe(setCost), []);
  return cost;
}
