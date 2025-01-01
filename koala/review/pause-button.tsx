import { Button } from "@mantine/core";
import { trpc } from "../trpc-config";

type PauseButtonProps = {
  cardID: number;
  onClick: () => void;
};

export const PauseReviewButton = (props: PauseButtonProps) => {
  const pauseCard = trpc.pauseCard.useMutation();
  const handlePauseClick = () => {
    pauseCard.mutate({ cardID: props.cardID });
    props.onClick();
  };

  return (
    <Button variant="outline" color="yellow" onClick={handlePauseClick}>
      Pause Reviews
    </Button>
  );
};
