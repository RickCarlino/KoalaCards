import {
  ActionIcon,
  Flex,
  Group,
  Stack,
  Tooltip,
  Text,
  Box,
  Progress,
  Menu,
  useMantineTheme,
} from "@mantine/core";
import {
  IconArchive,
  IconDoorExit,
  IconEdit,
  IconMicrophone,
  IconPlayerPlayFilled,
  IconPlayerSkipForwardFilled,
  IconPlayerStopFilled,
  IconLetterF,
  IconMessage,
  IconDots,
} from "@tabler/icons-react";
import React from "react";
import { CardReviewProps } from "./types";
import { HOTKEYS } from "./hotkeys";
import { useMediaQuery } from "@mantine/hooks";

interface ControlBarProps extends CardReviewProps {
  currentStepUuid: string;
  isRecording: boolean;
  onRecordClick: () => void;
  onArchiveClick: () => void;
  onPlayAudio: () => void;
  progress?: number;
  cardsRemaining?: number;
  onOpenAssistant?: () => void;
  disableRecord?: boolean;
  onFail?: () => void;
}

const getRecordLabel = (recordDisabled: boolean, isRecording: boolean) => {
  if (recordDisabled) {
    return "Recording disabled after success";
  }
  if (isRecording) {
    return `Stop recording (${HOTKEYS.RECORD})`;
  }
  return `Record a response (${HOTKEYS.RECORD})`;
};

type ControlBarMenuProps = {
  onEdit: () => void;
  onArchive: () => void;
  onSkip: () => void;
  onFail: () => void;
};

function ControlBarMenu({
  onEdit,
  onArchive,
  onSkip,
  onFail,
}: ControlBarMenuProps) {
  return (
    <Menu shadow="md" width={240}>
      <Menu.Target>
        <ActionIcon
          variant="outline"
          size={44}
          radius="xl"
          color="pink.7"
          aria-label="More"
        >
          <IconDots size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component="a"
          href="/"
          leftSection={<IconDoorExit size={16} />}
        >
          Exit lesson
        </Menu.Item>
        <Menu.Item onClick={onEdit} leftSection={<IconEdit size={16} />}>
          Edit card ({HOTKEYS.EDIT.toUpperCase()})
        </Menu.Item>
        <Menu.Item
          onClick={onArchive}
          leftSection={<IconArchive size={16} />}
        >
          Archive card ({HOTKEYS.ARCHIVE.toUpperCase()})
        </Menu.Item>
        <Menu.Item
          onClick={onSkip}
          leftSection={<IconPlayerSkipForwardFilled size={16} />}
        >
          Next card ({HOTKEYS.SKIP.toUpperCase()})
        </Menu.Item>
        <Menu.Item
          onClick={onFail}
          leftSection={<IconLetterF size={16} />}
        >
          Fail card ({HOTKEYS.FAIL.toUpperCase()})
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export const ControlBar: React.FC<ControlBarProps> = (props) => {
  const {
    card,
    onSkip,
    onGiveUp,
    isRecording,
    onRecordClick,
    onArchiveClick,
    onPlayAudio,
    itemType,
  } = props;

  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  const recordDisabled = props.disableRecord === true;
  const recordLabel = getRecordLabel(recordDisabled, isRecording);
  const playDisabled = itemType === "speaking";
  const playLabel = playDisabled
    ? "Audio disabled during speaking quiz"
    : `Play audio (${HOTKEYS.PLAY})`;

  const pct = props.progress ?? undefined;
  const recordSize = isMobile ? 64 : 72;
  const recordVariant = isRecording ? "filled" : "outline";
  const recordAriaLabel = isRecording
    ? "Stop recording"
    : "Start recording";

  const handleFailClick = () => {
    if (props.onFail) {
      props.onFail();
      return;
    }
    onGiveUp(card.uuid);
  };
  const handleSkipClick = () => onSkip(card.uuid);

  return (
    <Stack gap="xs">
      {pct !== undefined && (
        <Group gap="xs" align="center" justify="space-between">
          <Text size="xs" c="pink.7">
            {Math.round(pct)}%
          </Text>
          <Box flex={1}>
            <Progress value={pct} color="pink.6" radius="xl" size="md" />
          </Box>
        </Group>
      )}

      <Flex align="center" gap="md">
        <Group gap="xs" justify="flex-start" wrap="nowrap" flex={1}>
          <ControlBarMenu
            onEdit={openCardEditor}
            onArchive={onArchiveClick}
            onSkip={handleSkipClick}
            onFail={handleFailClick}
          />
        </Group>

        <Tooltip label={recordLabel}>
          <ActionIcon
            variant={recordVariant}
            size={recordSize}
            radius="xl"
            onClick={recordDisabled ? undefined : onRecordClick}
            color="pink.7"
            disabled={recordDisabled}
            aria-label={recordAriaLabel}
          >
            {isRecording ? (
              <IconPlayerStopFilled size={28} />
            ) : (
              <IconMicrophone size={28} />
            )}
          </ActionIcon>
        </Tooltip>

        <Group gap="xs" justify="flex-end" wrap="nowrap" flex={1}>
          {props.onOpenAssistant && (
            <Tooltip label="Open assistant">
              <ActionIcon
                variant="outline"
                size={44}
                radius="xl"
                onClick={props.onOpenAssistant}
                color="pink.7"
                aria-label="Open assistant"
              >
                <IconMessage size={20} />
              </ActionIcon>
            </Tooltip>
          )}

          <Tooltip label={playLabel}>
            <ActionIcon
              variant="outline"
              size={44}
              radius="xl"
              onClick={onPlayAudio}
              color="pink.7"
              disabled={playDisabled}
              aria-label="Play audio"
            >
              <IconPlayerPlayFilled size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Flex>
    </Stack>
  );
};
