import { useAuth, useUser } from '@clerk/expo';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

const MIN_RELOAD_INTERVAL_MS = 5 * 60_000;

/**
 * Re-fetch the Clerk user periodically so OAuth profile changes (name, avatar)
 * surface without a full re-auth. At most once every five minutes, on mount
 * and when the app returns to the foreground.
 */
export function useClerkUserRefresh() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const userRef = useRef(user);
  userRef.current = user;
  const lastReloadedAtRef = useRef(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    const reload = () => {
      if (Date.now() - lastReloadedAtRef.current < MIN_RELOAD_INTERVAL_MS) return;
      void userRef.current
        ?.reload()
        .catch(() => undefined)
        .finally(() => {
          lastReloadedAtRef.current = Date.now();
        });
    };
    reload();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => subscription.remove();
  }, [isLoaded, isSignedIn, userId]);
}
