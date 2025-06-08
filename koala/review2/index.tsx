import { Box } from "@mantine/core";
import React from "react";
import { Feedback } from "./lesson-steps/feedback";
import { Listening } from "./lesson-steps/listening";
import { NewWordIntro } from "./lesson-steps/new-word-intro";
import { NewWordOutro } from "./lesson-steps/new-word-outro";
import { Pending } from "./lesson-steps/pending";
import { RemedialIntro } from "./lesson-steps/remedial-intro";
import { RemedialOutro } from "./lesson-steps/remedial-outro";
import { Speaking } from "./lesson-steps/speaking";
import { ControlBar } from "./control-bar";
import { CardReviewProps, CardUI, ItemType } from "./types";

const cardUIs: Record<ItemType, CardUI> = {
  newWordIntro: NewWordIntro,
  newWordOutro: NewWordOutro,
  listening: Listening,
  speaking: Speaking,
  remedialIntro: RemedialIntro,
  remedialOutro: RemedialOutro,
  feedback: Feedback,
  pending: Pending,
};

const UnknownCard: CardUI = ({ card }) => (
  <div>{`UNKNOWN CARD TYPE: ${card.uuid}`}</div>
);

interface CardReviewWithRecordingProps extends CardReviewProps {
  currentStepUuid: string;
  onRecordingComplete: (audio: string) => void;
}

export const CardReview: React.FC<CardReviewWithRecordingProps> = (
  props,
) => {
  const { itemType, currentStepUuid, onRecordingComplete } = props;

  const CardComponent = cardUIs[itemType] ?? UnknownCard;

  return (
    <Box
      style={{
        minHeight: "100vh",
        position: "relative",
        paddingBottom: "80px",
      }}
    >
      <Box p="md">
        <CardComponent {...props} />
      </Box>
      <Box
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "var(--mantine-color-pink-0)",
          borderTop: "1px solid var(--mantine-color-pink-2)",
          padding: "var(--mantine-spacing-sm)",
          zIndex: 100,
        }}
      >
        <ControlBar
          {...props}
          onRecordingComplete={onRecordingComplete}
          currentStepUuid={currentStepUuid}
        />
      </Box>
    </Box>
  );
};
