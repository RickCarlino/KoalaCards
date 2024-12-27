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
import { unique } from "radash";

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
    RemixTypes.GRAMMAR,
  );

  const createRemix = trpc.remix.useMutation({});
  const saveRemixCards = trpc.createRemixCards.useMutation();

  const handleRemix = async () => {
    if (!card?.id) return;

    const result = await createRemix.mutateAsync({
      cardID: card.id,
      type: selectedType,
    });
    const oldOnes = remixes.filter((r) => r.kept);
    const newOnes = result.map((r) => ({ ...r, kept: false }));
    const combined = [...oldOnes, ...newOnes];
    const filtered = combined.filter(
      (r) => r.term !== card.term || r.definition !== card.definition,
    );
    const uniq = unique(filtered, (r) => r.term);
    setRemixes(uniq);
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
      Load Remixes
    </Button>
  );

  const remixModal = (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="🧪Remix Card (!EXPERIMENTAL!)"
      size="lg"
      overlayProps={{ opacity: 0.5, blur: 1 }}
    >
      <Stack>
        <RadioGroup
          label="Select a Remix Type"
          description="Remixing creates new cards from old ones."
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
      🧪Create Remix
      </Button>
      {remixModal}
    </>
  );
}
