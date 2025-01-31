import { Button } from "@mantine/core";
import { trpc } from "../trpc-config";

type PauseButtonProps = {
  cardID: number;
  onClick: () => void;
};

export const PauseReviewButton = (props: PauseButtonProps) => {
  const pauseCard = trpc.pauseCard.useMutation();
  const handlePauseClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    pauseCard.mutate({ cardID: props.cardID });
    props.onClick();
    e.currentTarget.blur(); // Removes focus from the button
  };
  return (
    <Button variant="outline" color="yellow" onClick={handlePauseClick}>
      Pause Reviews
    </Button>
  );
};
