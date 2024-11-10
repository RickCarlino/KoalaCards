import { Button } from "@mantine/core";
import { trpc } from "../trpc-config";

type FlagButtonProps = {
  cardID: number;
  onClick: () => void;
};

export const FlagButton = (props: FlagButtonProps) => {
  const flagCard = trpc.flagCard.useMutation();
  const handleFlagClick = () => {
    flagCard.mutate({ cardID: props.cardID });
    props.onClick();
  };

  return (
    <Button variant="outline" color="yellow" onClick={handleFlagClick}>
      Ignore Card
    </Button>
  );
};
