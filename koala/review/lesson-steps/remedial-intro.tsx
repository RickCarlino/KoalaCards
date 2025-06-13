import { CardUI } from "../types";
import { IntroCard } from "./intro-card";

export const RemedialIntro: CardUI = (props) => {
  return <IntroCard {...props} isRemedial={true} />;
};
