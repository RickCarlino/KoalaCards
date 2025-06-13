import { CardUI } from "../types";
import { QuizCard } from "./quiz-card";

export const Speaking: CardUI = (props) => {
  return <QuizCard {...props} quizType="speaking" />;
};
