import { CardUI } from "../types";
import { QuizCard } from "./quiz-card";

export const NewWordOutro: CardUI = (props) => {
  return <QuizCard {...props} quizType="newWordOutro" />;
};
