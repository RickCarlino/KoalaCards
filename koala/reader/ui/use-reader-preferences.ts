import { useEffect, useRef, useState } from "react";
import { trpc } from "@/koala/trpc-config";
import type { ReaderPreferences } from "../contracts";
import { resolveReaderPreferences } from "../preferences";

export function useReaderPreferences(
  initialPreferences: ReaderPreferences,
  enabled = true,
) {
  const [preferences, setPreferences] = useState(() =>
    resolveReaderPreferences(initialPreferences),
  );
  const mountedRef = useRef(false);
  const updatePreferences =
    trpc.updateReaderPreferencesRoute.useMutation();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const timeout = setTimeout(() => {
      updatePreferences.mutate(preferences);
    }, 500);
    return () => clearTimeout(timeout);
  }, [enabled, preferences]);

  return [preferences, setPreferences] as const;
}
