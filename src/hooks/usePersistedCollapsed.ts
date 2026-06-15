import { useState, useEffect, useLayoutEffect } from "react";

function readCollapsed(
  ns: (key: string) => string,
  key: string,
  legacyKey: string | null,
  defaultCollapsed: boolean,
): boolean {
  const own = localStorage.getItem(ns(key));
  if (own !== null) return own === "true";
  if (legacyKey !== null) {
    const legacy = localStorage.getItem(ns(legacyKey));
    if (legacy !== null) return legacy === "true";
  }
  return defaultCollapsed;
}

export function usePersistedCollapsed(
  ns: (key: string) => string,
  key: string,
  legacyKey: string | null,
  defaultCollapsed: boolean,
  callsign: string,
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [value, setValue] = useState(() => readCollapsed(ns, key, legacyKey, defaultCollapsed));

  // The initial read above may run before `callsign` is known (ns unprefixed),
  // picking up stale/default data left by a previous session's own pre-login
  // read/write. Re-read with the correctly-prefixed ns once callsign resolves.
  useLayoutEffect(() => {
    if (!callsign) return;
    setValue(readCollapsed(ns, key, legacyKey, defaultCollapsed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callsign]);

  useEffect(() => {
    if (!callsign) return;
    localStorage.setItem(ns(key), value.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, callsign]);

  return [value, setValue];
}
