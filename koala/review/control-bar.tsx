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

function openCardEditor(cardId: number) {
  window.open(`/cards/${cardId}`, "_blank");
}

function getRecordLabel(params: {
  recordDisabled: boolean;
  isRecording: boolean;
}) {
  if (params.recordDisabled) {
    return "Recording disabled after success";
  }
  if (params.isRecording) {
    return `Stop recording (${HOTKEYS.RECORD})`;
  }
  return `Record a response (${HOTKEYS.RECORD})`;
}

function getPlayLabel(params: { playDisabled: boolean }) {
  if (params.playDisabled) {
    return "Audio disabled during speaking quiz";
  }
  return `Play audio (${HOTKEYS.PLAY})`;
}

function centerButtonSize(isMobile: boolean) {
  return isMobile ? 64 : 72;
}

function ProgressBar({ pct }: { pct: number | undefined }) {
  if (pct === undefined) {
    return null;
  }
  return (
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
  );
}

function MoreMenu(props: {
  onEdit: () => void;
  onArchive: () => void;
  onNext: () => void;
  onFail: () => void;
}) {
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
        <Menu.Item
          onClick={props.onEdit}
          leftSection={<IconEdit size={16} />}
        >
          Edit card ({HOTKEYS.EDIT.toUpperCase()})
        </Menu.Item>
        <Menu.Item
          onClick={props.onArchive}
          leftSection={<IconArchive size={16} />}
        >
          Archive card ({HOTKEYS.ARCHIVE.toUpperCase()})
        </Menu.Item>
        <Menu.Item
          onClick={props.onNext}
          leftSection={<IconPlayerSkipForwardFilled size={16} />}
        >
          Next card ({HOTKEYS.SKIP.toUpperCase()})
        </Menu.Item>
        <Menu.Item
          onClick={props.onFail}
          leftSection={<IconLetterF size={16} />}
        >
          Fail card ({HOTKEYS.FAIL.toUpperCase()})
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function RecordButton(props: {
  isRecording: boolean;
  isMobile: boolean;
  recordDisabled: boolean;
  recordLabel: string;
  onRecordClick: () => void;
}) {
  return (
    <Tooltip label={props.recordLabel}>
      <ActionIcon
        variant={props.isRecording ? "filled" : "outline"}
        size={centerButtonSize(props.isMobile)}
        radius="xl"
        onClick={props.recordDisabled ? undefined : props.onRecordClick}
        color="pink.7"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
        disabled={props.recordDisabled}
        aria-label={
          props.isRecording ? "Stop recording" : "Start recording"
        }
      >
        {props.isRecording ? (
          <IconPlayerStopFilled size={28} />
        ) : (
          <IconMicrophone size={28} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}

function AssistantButton(props: {
  onOpenAssistant: (() => void) | undefined;
}) {
  if (!props.onOpenAssistant) {
    return null;
  }
  return (
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
  );
}

function PlayButton(props: {
  playDisabled: boolean;
  playLabel: string;
  onPlayAudio: () => void;
}) {
  return (
    <Tooltip label={props.playLabel}>
      <ActionIcon
        variant="outline"
        size={44}
        radius="xl"
        onClick={props.onPlayAudio}
        color="pink.7"
        disabled={props.playDisabled}
        aria-label="Play audio"
      >
        <IconPlayerPlayFilled size={20} />
      </ActionIcon>
    </Tooltip>
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

  const theme = useMantineTheme();
  const isMobile =
    useMediaQuery(`(max-width: ${theme.breakpoints.sm})`) ?? false;

  const recordDisabled = props.disableRecord === true;
  const playDisabled = itemType === "speaking";
  const recordLabel = getRecordLabel({ recordDisabled, isRecording });
  const playLabel = getPlayLabel({ playDisabled });

  const pct = props.progress;
  const onEdit = () => openCardEditor(card.cardId);
  const onNext = () => onSkip(card.uuid);
  const onFail = () =>
    props.onFail ? props.onFail() : onGiveUp(card.uuid);

  return (
    <Box>
      <ProgressBar pct={pct} />

      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <Group gap="xs" justify="flex-start" wrap="nowrap">
          <MoreMenu
            onEdit={onEdit}
            onArchive={onArchiveClick}
            onNext={onNext}
            onFail={onFail}
          />
        </Group>

        <Box style={{ justifySelf: "center" }}>
          <RecordButton
            isRecording={isRecording}
            isMobile={isMobile}
            recordDisabled={recordDisabled}
            recordLabel={recordLabel}
            onRecordClick={onRecordClick}
          />
        </Box>

        <Group gap="xs" justify="flex-end" wrap="nowrap">
          <AssistantButton onOpenAssistant={props.onOpenAssistant} />
          <PlayButton
            playDisabled={playDisabled}
            playLabel={playLabel}
            onPlayAudio={onPlayAudio}
          />
        </Group>
      </Box>
    </Box>
  );
};
