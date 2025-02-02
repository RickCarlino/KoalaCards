import { Button } from "@mantine/core";

type EditButtonProps = {
  cardID: number;
};

export const EditButton = (props: EditButtonProps) => {
  return (
    <Button
      variant="outline"
      color="yellow"
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        window.open(`/cards/${props.cardID}`, "_blank");
        e.currentTarget.blur(); // Removes focus from the button
      }}
    >
      Edit Card
    </Button>
  );
};
