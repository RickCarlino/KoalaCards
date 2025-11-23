import {
  ActionIcon,
  Group,
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
  const recordLabel = recordDisabled
    ? "Recording disabled after success"
    : isRecording
      ? `Stop recording (${HOTKEYS.RECORD})`
      : `Record a response (${HOTKEYS.RECORD})`;
  const playDisabled = itemType === "speaking";
  const playLabel = playDisabled
    ? "Audio disabled during speaking quiz"
    : `Play audio (${HOTKEYS.PLAY})`;

  const pct = props.progress ?? undefined;

  return (
    <Box>
      {pct !== undefined && (
        <Box mb="xs">
          <Group gap="xs" align="center" justify="space-between">
            <Text size="xs" c="pink.7">
              {Math.round(pct)}%
            </Text>
            <Box style={{ flex: 1 }}>
              <Progress value={pct} color="pink.6" radius="xl" size="md" />
            </Box>
          </Group>
        </Box>
      )}

      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <Group gap="xs" justify="flex-start" wrap="nowrap">
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
              <Menu.Item
                onClick={openCardEditor}
                leftSection={<IconEdit size={16} />}
              >
                Edit card ({HOTKEYS.EDIT.toUpperCase()})
              </Menu.Item>
              <Menu.Item
                onClick={onArchiveClick}
                leftSection={<IconArchive size={16} />}
              >
                Archive card ({HOTKEYS.ARCHIVE.toUpperCase()})
              </Menu.Item>
              <Menu.Item
                onClick={() => onSkip(card.uuid)}
                leftSection={<IconPlayerSkipForwardFilled size={16} />}
              >
                Next card ({HOTKEYS.SKIP.toUpperCase()})
              </Menu.Item>
              <Menu.Item
                onClick={() =>
                  props.onFail ? props.onFail() : onGiveUp(card.uuid)
                }
                leftSection={<IconLetterF size={16} />}
              >
                Fail card ({HOTKEYS.FAIL.toUpperCase()})
              </Menu.Item>
              {false}
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Box style={{ justifySelf: "center" }}>
          <Tooltip label={recordLabel}>
            <ActionIcon
              variant={isRecording ? "filled" : "outline"}
              size={isMobile ? 64 : 72}
              radius="xl"
              onClick={recordDisabled ? undefined : onRecordClick}
              color="pink.7"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
              disabled={recordDisabled}
              aria-label={
                isRecording ? "Stop recording" : "Start recording"
              }
            >
              {isRecording ? (
                <IconPlayerStopFilled size={28} />
              ) : (
                <IconMicrophone size={28} />
              )}
            </ActionIcon>
          </Tooltip>
        </Box>

        <Group gap="xs" justify="flex-end" wrap="nowrap">
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
      </Box>
    </Box>
  );
};
