'use client';

import { useState, useEffect, useCallback } from 'react';

export function useMenuRefresh(refreshInterval: number = 30000) { // 30 seconds
  const [lastUpdate, setLastUpdate] = useState<number>(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMenu = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      const response = await fetch('/api/menu', { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setLastUpdate(Date.now());
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Menu refresh error:', err);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh on interval (disabled to prevent issues)
  // useEffect(() => {
  //   const interval = setInterval(refreshMenu, refreshInterval);
  //   return () => clearInterval(interval);
  // }, [refreshInterval, refreshMenu]);

  // Refresh when page becomes visible (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshMenu();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshMenu]);

  return {
    lastUpdate,
    isRefreshing,
    error,
    refreshMenu
  };
}
