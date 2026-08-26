import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { hasPasscode, subscribeToPasscodeChanges } from './passcode-storage';

type PasscodeGateValue = {
  enabled: boolean;
  locked: boolean;
  lock: () => void;
  unlock: () => void;
};

const PasscodeGateContext = createContext<PasscodeGateValue | null>(null);

export function usePasscodeGate() {
  const context = useContext(PasscodeGateContext);
  if (!context) throw new Error('usePasscodeGate must be used within PasscodeGateProvider.');
  return context;
}

export function PasscodeGateProvider({
  enabled,
  initiallyLocked,
  children,
}: {
  enabled: boolean;
  initiallyLocked: boolean;
  children: ReactNode;
}) {
  const [verifierExists, setVerifierExists] = useState(enabled);
  const [locked, setLocked] = useState(initiallyLocked);

  useEffect(() => {
    setVerifierExists(enabled);
    setLocked(initiallyLocked);
  }, [enabled, initiallyLocked]);

  useEffect(
    () =>
      subscribeToPasscodeChanges(() => {
        void hasPasscode().then(setVerifierExists);
      }),
    [],
  );

  const lock = useCallback(() => {
    if (verifierExists) setLocked(true);
  }, [verifierExists]);
  const unlock = useCallback(() => setLocked(false), []);
  const value = useMemo(
    () => ({ enabled: verifierExists, locked, lock, unlock }),
    [lock, locked, unlock, verifierExists],
  );

  return <PasscodeGateContext.Provider value={value}>{children}</PasscodeGateContext.Provider>;
}
