import { FeedbackStep } from "@/koala/components/writing-practice/FeedbackStep";
import { WritingStep } from "@/koala/components/writing-practice/WritingStep";
import { useWritingPractice } from "@/koala/components/writing-practice/useWritingPractice";
import { LangCode } from "@/koala/shared-types";
import { useRouter } from "next/router";

type WritingPracticeProps = {
  deckId: number;
  langCode: LangCode;
};

export function WritingPractice({
  deckId,
  langCode,
}: WritingPracticeProps) {
  const router = useRouter();
  const state = useWritingPractice({ deckId, langCode });

  const stepContent = {
    writing: (
      <WritingStep
        selectedPrompt={state.selectedPrompt}
        onSelectedPromptChange={state.setSelectedPrompt}
        essay={state.essay}
        onEssayChange={state.setEssay}
        loadingReview={state.loadingReview}
        progress={state.progress}
        onReview={state.actions.review}
      />
    ),
    feedback: (
      <FeedbackStep
        selectedPrompt={state.selectedPrompt}
        essay={state.essay}
        corrected={state.corrected}
        feedback={state.feedback}
        selectedWords={state.selectedWords}
        definitions={state.definitions}
        definitionsLoading={state.definitionsLoading}
        definitionsError={state.definitionsError}
        onToggleWord={state.actions.toggleWord}
        onExplain={() => void state.actions.explain()}
        onCreateCards={state.actions.createCards}
        onWriteMore={state.actions.writeMore}
        onStudyCards={() => void router.push(`/review/${deckId}`)}
      />
    ),
  };

  return stepContent[state.step];
}
