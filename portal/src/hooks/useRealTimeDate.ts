import { useState, useEffect } from 'react';

/**
 * Hook that triggers a re-render every minute, returning the current Date.
 * Useful for real-time UI updates (e.g. lesson status switching to 'Em Andamento' or 'Concluída').
 */
export function useRealTimeDate(intervalMs = 10000) {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, intervalMs);
    
    return () => clearInterval(timer);
  }, [intervalMs]);
  
  return now;
}
