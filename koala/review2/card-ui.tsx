import { Box, Stack } from "@mantine/core";
import React from "react";
import { Feedback } from "./lesson-steps/feedback";
import { Listening } from "./lesson-steps/listening";
import { NewWordIntro } from "./lesson-steps/new-card-intro";
import { NewWordOutro } from "./lesson-steps/new-word-outro";
import { Pending } from "./lesson-steps/pending";
import { RemedialIntro } from "./lesson-steps/remedial-intro";
import { RemedialOutro } from "./lesson-steps/remedial-outro";
import { Speaking } from "./lesson-steps/speaking";
import { TopBar } from "./top-bar";
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

export const CardReview: React.FC<CardReviewProps> = (props) => {
  const { itemType } = props;

  const CardComponent = cardUIs[itemType] ?? UnknownCard;

  return (
    <Stack>
      <TopBar {...props} />
      <Box>
        <CardComponent {...props} />
      </Box>
    </Stack>
  );
};
