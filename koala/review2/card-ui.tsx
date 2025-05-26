import React from "react";
import { ItemType, Quiz } from "./logic";

type CardReviewProps = {
  card: Quiz;
  itemType: ItemType;
  onProceed: () => void;
};

type CardUI = React.FC<CardReviewProps>;

const cardUIs: Record<ItemType, CardUI> = {
  newWordIntro: ({ card }) => <div>TODO: New Word Intro: {card.uuid}</div>,
  newWordOutro: ({ card }) => <div>TODO: New Word Outro: {card.uuid}</div>,
  listening: ({ card }) => <div>TODO: Listening: {card.uuid}</div>,
  speaking: ({ card }) => <div>TODO: Speaking: {card.uuid}</div>,
  remedialIntro: ({ card }) => <div>TODO: Remedial Intro: {card.uuid}</div>,
  remedialOutro: ({ card }) => <div>TODO: Remedial Outro: {card.uuid}</div>,
  feedback: ({ card }) => <div>TODO: Feedback: {card.uuid}</div>,
  pending: ({ card }) => <div>TODO: Waiting on: {card.uuid}</div>,
};

export const CardReview = (props: CardReviewProps) => {
  const { card, itemType }: CardReviewProps = props;
  const unknown = <div>TODO: Unknown Item Type: {card.uuid}</div>;
  const CardUI = cardUIs[itemType] || unknown;
  return <CardUI {...props} card={card} itemType={itemType} />;
};
