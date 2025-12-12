import {
  DailyWritingProgress,
  WritingPracticeFeedback,
} from "@/koala/components/writing-practice/types";
import { useWordDefinitions } from "@/koala/components/writing-practice/useWordDefinitions";
import { LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import { notifications } from "@mantine/notifications";
import { useCallback, useState } from "react";

export type WritingPracticeStep = "writing" | "feedback";

type UseWritingPracticeInput = {
  deckId: number;
  langCode: LangCode;
};

export function useWritingPractice({
  deckId,
  langCode,
}: UseWritingPracticeInput) {
  const [step, setStep] = useState<WritingPracticeStep>("writing");
  const [essay, setEssay] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [feedback, setFeedback] = useState<WritingPracticeFeedback | null>(
    null,
  );
  const [loadingReview, setLoadingReview] = useState(false);

  const dailyWritingProgressQuery = trpc.getDailyWritingProgress.useQuery(
    {},
    { refetchOnWindowFocus: false },
  );

  const gradeWriting = trpc.gradeWriting.useMutation({
    onSuccess: (data) => {
      setFeedback(data);
      setLoadingReview(false);
      setStep("feedback");
      void dailyWritingProgressQuery.refetch();
    },
    onError: (error) => {
      notifications.show({
        title: "Review Failed",
        message: error.message,
        color: "red",
      });
      setLoadingReview(false);
    },
  });

  const corrected = feedback?.fullCorrection ?? "";
  const progress: DailyWritingProgress | null =
    dailyWritingProgressQuery.data ?? null;

  const wordDefinitions = useWordDefinitions({
    deckId,
    langCode,
    prompt: selectedPrompt,
    essay,
    corrected,
  });

  const handleReview = useCallback(() => {
    if (!essay.trim()) {
      return;
    }

    setLoadingReview(true);
    setFeedback(null);
    wordDefinitions.actions.reset();

    gradeWriting.mutate({
      prompt: selectedPrompt.trim() ? selectedPrompt : "Not set.",
      text: essay,
      deckId,
    });
  }, [
    deckId,
    essay,
    gradeWriting,
    selectedPrompt,
    wordDefinitions.actions,
  ]);

  const handleWriteMore = useCallback(() => {
    setStep("writing");
    setSelectedPrompt("");
    setEssay("");
    setFeedback(null);
    wordDefinitions.actions.reset();
  }, [wordDefinitions.actions]);

  return {
    step,
    setStep,
    deckId,
    langCode,
    selectedPrompt,
    setSelectedPrompt,
    essay,
    setEssay,
    feedback,
    corrected,
    loadingReview,
    progress,
    selectedWords: wordDefinitions.selectedWords,
    definitions: wordDefinitions.definitions,
    definitionsLoading: wordDefinitions.definitionsLoading,
    definitionsError: wordDefinitions.definitionsError,
    actions: {
      review: handleReview,
      writeMore: handleWriteMore,
      toggleWord: wordDefinitions.actions.toggleWord,
      explain: wordDefinitions.actions.explain,
      createCards: wordDefinitions.actions.createCards,
    },
  };
}
