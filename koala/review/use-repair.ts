import { useState } from "react";
import { trpc } from "@/koala/trpc-config";
import { LangCode } from "@/koala/shared-types";
import {
  compare,
  removeParens,
} from "@/koala/quiz-evaluators/evaluator-utils";

interface UseRepairProps {
  cardId: number;
  targetText: string;
  langCode: LangCode;
}

interface RepairResult {
  transcription: string;
  isMatch: boolean;
}

export const useRepair = ({
  cardId,
  targetText,
  langCode,
}: UseRepairProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const repairCard = trpc.editCard.useMutation();

  const processAudio = async (
    base64Audio: string,
  ): Promise<RepairResult> => {
    setIsProcessing(true);

    try {
      const { result } = await transcribeAudio.mutateAsync({
        audio: base64Audio,
        lang: langCode,
        targetText: targetText,
      });

      const isMatch = compare(result, removeParens(targetText));

      await repairCard
        .mutateAsync({
          id: cardId,
          lastFailure: 0,
        })
        .then(() => console.log("Card repaired successfully"));

      return {
        transcription: result,
        isMatch,
      };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    processAudio,
    isProcessing,
  };
};
