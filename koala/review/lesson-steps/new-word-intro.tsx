import { CardUI } from "../types";
import { IntroCard } from "./intro-card";

export const NewWordIntro: CardUI = (props) => {
  return <IntroCard {...props} isRemedial={false} />;
};
