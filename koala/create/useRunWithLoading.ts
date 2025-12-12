import { notifyError } from "@/koala/create/notify";
import React from "react";

export function useRunWithLoading() {
  const [loading, setLoading] = React.useState(false);

  const runWithLoading = React.useCallback(
    async (action: () => Promise<void>) => {
      setLoading(true);
      try {
        await action();
      } catch {
        notifyError();
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, runWithLoading };
}
