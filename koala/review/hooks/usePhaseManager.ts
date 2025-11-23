import { useEffect, useState } from "react";

export function usePhaseManager<T extends string>(
  initialPhase: T,
  currentStepUuid: string,
  additionalResetStates?: () => void,
) {
  const [phase, setPhase] = useState<T>(initialPhase);

  useEffect(() => {
    setPhase(initialPhase);
    additionalResetStates?.();
  }, [currentStepUuid]);

  return { phase, setPhase };
}
