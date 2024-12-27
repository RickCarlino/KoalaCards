import { trpc } from "@/koala/trpc-config";
import { RemixTypeDescriptions, RemixTypes } from "@/koala/remix-types";
import {
  Card,
  Stack,
  Button,
  Modal,
  Group,
  Text,
  Radio,
  RadioGroup,
} from "@mantine/core";
import { useState } from "react";

type RemixButtonProps = {
  card: {
    id: number;
    term: string;
    definition: string;
  };
};

export default function RemixButton(props: RemixButtonProps) {
  type Remix = Omit<typeof props.card & { kept?: boolean }, "id">;
  const { card } = props;
  const [opened, setOpened] = useState(false);
  const [remixes, setRemixes] = useState<Remix[]>([]);
  const [selectedType, setSelectedType] = useState<RemixTypes>(
    RemixTypes.CONJUGATION,
  );

  const createRemix = trpc.remix.useMutation({});
  const saveRemixCards = trpc.createRemixCards.useMutation();

  const handleRemix = async () => {
    if (!card?.id) return;

    const result = await createRemix.mutateAsync({
      cardID: card.id,
      type: selectedType,
    });
    setRemixes(result.map((r) => ({ ...r, kept: true })));
  };

  const handleKeep = (index: number) => {
    setRemixes((prev) => {
      const next = [...prev];
      next[index].kept = true;
      return next;
    });
  };

  const handleDiscard = (index: number) => {
    setRemixes((prev) => {
      const next = [...prev];
      next[index].kept = false;
      return next;
    });
  };

  const handleSaveRemixes = async () => {
    const result = await saveRemixCards.mutateAsync({
      cardId: card.id,
      remixes: remixes.filter((r) => r.kept),
    });
    console.log(result);
    setOpened(false);
  };

  let saveButton = <Button onClick={handleSaveRemixes}>Save Remixes</Button>;
  let loadButton = (
    <Button onClick={handleRemix} loading={createRemix.isLoading}>
      Load Remixes (Experimental Feature)
    </Button>
  );

  const remixModal = (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="Remix Card"
      size="lg"
      overlayProps={{ opacity: 0.5, blur: 1 }}
    >
      <Stack>
        <RadioGroup
          label="Select Remix Type"
          description="Choose the type of remix you want to apply to the card."
          value={selectedType.toString()}
          onChange={(value) => setSelectedType(Number(value) as RemixTypes)}
        >
          {Object.entries(RemixTypes)
            .filter(([key, _value]) => isNaN(Number(key)))
            .map(([key, value]) => (
              <Radio
                key={key}
                value={value.toString()}
                label={RemixTypeDescriptions[value as RemixTypes]}
              />
            ))}
        </RadioGroup>

        {loadButton}
        {remixes.length > 0 && (
          <Stack>
            {remixes.map((remix, index) => (
              <Card key={index} shadow="xs" padding="sm">
                <Text>{remix.term}</Text>
                <Text size="sm">{remix.definition}</Text>
                <Group mt="sm">
                  <Button
                    size="xs"
                    variant={remix.kept ? "filled" : "outline"}
                    onClick={() => handleKeep(index)}
                  >
                    Keep
                  </Button>
                  <Button
                    size="xs"
                    variant={!remix.kept ? "filled" : "outline"}
                    onClick={() => handleDiscard(index)}
                  >
                    Discard
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        {remixes.length > 0 && saveButton}
      </Stack>
    </Modal>
  );

  return (
    <>
      <Button variant="outline" onClick={() => setOpened(true)}>
        Remix
      </Button>
      {remixModal}
    </>
  );
}
