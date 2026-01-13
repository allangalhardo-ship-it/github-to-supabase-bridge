import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Generate a unique session token for this browser tab
const getSessionToken = () => {
  let token = sessionStorage.getItem('session_token');
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem('session_token', token);
  }
  return token;
};

export const useSessionTracker = () => {
  const { session } = useAuth();
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(null);
  const lastPathRef = useRef<string>('');
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const trackAction = useCallback(async (action: string, pagePath?: string) => {
    if (!session?.access_token) return;

    try {
      await supabase.functions.invoke('track-session', {
        body: {
          action,
          page_path: pagePath,
          session_token: getSessionToken(),
        },
      });
    } catch (error) {
      console.error('Failed to track session:', error);
    }
  }, [session?.access_token]);

  // Start session on mount
  useEffect(() => {
    if (!session?.access_token) return;

    const startSession = async () => {
      try {
        const { data } = await supabase.functions.invoke('track-session', {
          body: {
            action: 'start_session',
            page_path: location.pathname,
            session_token: getSessionToken(),
          },
        });
        
        if (data?.session_id) {
          sessionIdRef.current = data.session_id;
        }
      } catch (error) {
        console.error('Failed to start session:', error);
      }
    };

    startSession();

    // Send heartbeat every 2 minutes to keep session active
    heartbeatIntervalRef.current = setInterval(() => {
      trackAction('heartbeat');
    }, 120000);

    // End session on tab close
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery on page close
      const sessionToken = getSessionToken();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-session`;
      
      navigator.sendBeacon(url, JSON.stringify({
        action: 'end_session',
        session_token: sessionToken,
      }));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [session?.access_token, location.pathname, trackAction]);

  // Track page views
  useEffect(() => {
    if (!session?.access_token) return;
    if (lastPathRef.current === location.pathname) return;

    lastPathRef.current = location.pathname;
    trackAction('page_view', location.pathname);
  }, [location.pathname, session?.access_token, trackAction]);

  return { trackAction };
};

export default useSessionTracker;