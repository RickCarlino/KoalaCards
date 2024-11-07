import { Button } from "@mantine/core";

type EditButtonProps = {
  cardID: number;
};

export const EditButton = (props: EditButtonProps) => {
  return (
    <Button
      variant="outline"
      color="yellow"
      onClick={() => {
        window.open(`/cards/${props.cardID}`, "_blank");
      }}
    >
      Edit Card
    </Button>
  );
};
