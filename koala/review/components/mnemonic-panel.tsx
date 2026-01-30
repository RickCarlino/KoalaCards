import { Button, Group, Loader, Paper, Stack, Text } from "@mantine/core";
import React from "react";
import { isMnemonicEligible } from "@/koala/mnemonic";
import { trpc } from "@/koala/trpc-config";

type MnemonicPanelProps = {
  cardId: number;
  term: string;
};

type MnemonicState = "idle" | "loading" | "ready" | "error" | "empty";

const MNEMONIC_LABEL = "Mnemonic";
const MNEMONIC_PENDING_TEXT = "Generating mnemonic...";
const MNEMONIC_IDLE_TEXT = "Tap to generate a mnemonic.";
const MNEMONIC_ERROR_TEXT = "Mnemonic unavailable right now.";

const normalizeMnemonic = (value?: string | null) => (value ?? "").trim();

const resolveMnemonicState = (input: {
  isLoading: boolean;
  hasError: boolean;
  mnemonic: string;
  hasRequested: boolean;
}): MnemonicState => {
  if (input.isLoading) {
    return "loading";
  }
  if (!input.hasRequested) {
    return "idle";
  }
  if (input.hasError) {
    return "error";
  }
  if (input.mnemonic.length > 0) {
    return "ready";
  }
  return "empty";
};

const MnemonicLoading = () => (
  <Group gap="xs">
    <Loader size="xs" color="pink" />
    <Text size="sm" c="dimmed">
      {MNEMONIC_PENDING_TEXT}
    </Text>
  </Group>
);

const MnemonicPending = () => (
  <Text size="sm" c="dimmed">
    {MNEMONIC_PENDING_TEXT}
  </Text>
);

const MnemonicIdle = () => (
  <Text size="sm" c="dimmed">
    {MNEMONIC_IDLE_TEXT}
  </Text>
);

const MnemonicError = () => (
  <Text size="sm" c="dimmed">
    {MNEMONIC_ERROR_TEXT}
  </Text>
);

const MnemonicText = ({ mnemonic }: { mnemonic: string }) => (
  <Text size="sm">{mnemonic}</Text>
);

export const MnemonicPanel = ({ cardId, term }: MnemonicPanelProps) => {
  const canGenerate = isMnemonicEligible(term);
  const [hasRequested, setHasRequested] = React.useState(false);
  const { data, error, isLoading, mutate, reset } =
    trpc.generateMnemonic.useMutation();

  const requestMnemonic = React.useCallback(() => {
    if (!canGenerate) {
      return;
    }
    setHasRequested(true);
    mutate({ cardId });
  }, [cardId, canGenerate, mutate]);

  React.useEffect(() => {
    if (!canGenerate) {
      reset();
      setHasRequested(false);
      return;
    }
    reset();
    setHasRequested(false);
    requestMnemonic();
  }, [canGenerate, cardId, requestMnemonic, reset]);

  if (!canGenerate) {
    return null;
  }

  const mnemonic = normalizeMnemonic(data?.mnemonic);
  const state = resolveMnemonicState({
    isLoading,
    hasError: Boolean(error),
    mnemonic,
    hasRequested,
  });

  const contentByState: Record<MnemonicState, JSX.Element> = {
    idle: <MnemonicIdle />,
    loading: <MnemonicLoading />,
    empty: <MnemonicPending />,
    error: <MnemonicError />,
    ready: <MnemonicText mnemonic={mnemonic} />,
  };

  const buttonLabel = hasRequested ? "Try again" : "Generate mnemonic";

  const handleTryAgain = () => {
    if (isLoading) {
      return;
    }
    requestMnemonic();
  };

  return (
    <Paper withBorder radius="md" p="sm" bg="pink.0" w="100%" maw={420}>
      <Stack gap={6}>
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600} c="pink.7">
            {MNEMONIC_LABEL}
          </Text>
          <Button
            variant="subtle"
            size="xs"
            onClick={handleTryAgain}
            loading={isLoading}
          >
            {buttonLabel}
          </Button>
        </Group>
        {contentByState[state]}
      </Stack>
    </Paper>
  );
};
