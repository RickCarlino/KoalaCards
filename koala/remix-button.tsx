import { trpc } from "@/koala/trpc-config";
import { Card, Stack, Button, Modal, Group, Text } from "@mantine/core";
import { useState } from "react";

type RemixButtonProps = {
  card: {
    id: number;
    term: string;
    definition: string;
  };
};

export default function RemixButton(props: RemixButtonProps) {
  type Remix = Omit<typeof card & { kept?: boolean }, "id">;
  const { card } = props;
  const [opened, setOpened] = useState(false);
  const [remixes, setRemixes] = useState<Remix[]>([]);
  const createRemix = trpc.remix.useMutation({});
  const saveRemixCards = trpc.createRemixCards.useMutation();
  const handleRemix = async () => {
    if (!card?.id) return;

    const result = await createRemix.mutateAsync({ cardID: card.id });
    setRemixes(result.map((r) => ({ ...r, kept: false })));
  };

  // Mark an item as "kept"
  const handleKeep = (index: number) => {
    setRemixes((prev) => {
      const next = [...prev];
      next[index].kept = true;
      return next;
    });
  };

  // Mark an item as "discarded"
  const handleDiscard = (index: number) => {
    setRemixes((prev) => {
      const next = [...prev];
      next[index].kept = false;
      return next;
    });
  };

  // Stub for saving the kept items
  const handleSaveRemixes = async () => {
    const result = await saveRemixCards.mutateAsync({
      cardId: card.id,
      remixes: remixes.filter((r) => r.kept),
    });
    console.log(result);
  };

  const hmm = (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="Remix Card"
      size="lg"
      overlayProps={{ opacity: 0.5, blur: 1 }}
    >
      <Stack>
        <Button onClick={handleRemix} loading={createRemix.isLoading}>
          Load Remixes (Experimental Feature)
        </Button>

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

        {remixes.length > 0 && (
          <Button onClick={handleSaveRemixes}>Save Remixes</Button>
        )}
      </Stack>
    </Modal>
  );

  return (
    <>
      <Button variant="outline" onClick={() => setOpened(true)}>
        Remix
      </Button>
      {hmm}
    </>
  );
}
