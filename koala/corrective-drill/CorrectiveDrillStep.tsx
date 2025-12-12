import { Button, Group, Text } from "@mantine/core";
import type { CorrectiveDrillLesson } from "@/koala/types/corrective-drill";
import type { Step } from "@/koala/corrective-drill/corrective-drill-helpers";
import { MicButton } from "@/koala/corrective-drill/components/MicButton";
import { DiagnosisCard } from "@/koala/corrective-drill/components/DiagnosisCard";
import { IconPlayerPlayFilled } from "@tabler/icons-react";

export function CorrectiveDrillStep(props: {
  lesson: CorrectiveDrillLesson;
  step: Step;
  isStepPassed: boolean;
  isAudioPlaying: boolean;
  isRecording: boolean;
  heard: string;
  lastMatch: boolean | null;
  grading: boolean;
  gradeText: string | null;
  onListenAgain: () => void;
  onStartDiagnosis: () => void;
  onMicToggle: () => void;
}) {
  if (props.step.type === "diagnosis") {
    return (
      <>
        <DiagnosisCard
          diagnosis={props.lesson.diagnosis}
          targetLabel={props.lesson.target.label}
          contrastLabel={props.lesson.contrast?.label || null}
        />
        <DiagnosisActions
          isAudioPlaying={props.isAudioPlaying}
          isStepPassed={props.isStepPassed}
          onListenAgain={props.onListenAgain}
          onStart={props.onStartDiagnosis}
        />
      </>
    );
  }

  if (props.step.type === "target") {
    return (
      <ListenAndRepeatStep
        hint={props.lesson.target.example.en}
        text={props.lesson.target.example.text}
        isAudioPlaying={props.isAudioPlaying}
        isRecording={props.isRecording}
        isStepPassed={props.isStepPassed}
        heard={props.heard}
        lastMatch={props.lastMatch}
        onListenAgain={props.onListenAgain}
        onMicToggle={props.onMicToggle}
      />
    );
  }

  if (props.step.type === "contrast") {
    const example = props.lesson.contrast?.example;
    if (!example) {
      return null;
    }
    return (
      <ListenAndRepeatStep
        hint={example.en}
        text={example.text}
        isAudioPlaying={props.isAudioPlaying}
        isRecording={props.isRecording}
        isStepPassed={props.isStepPassed}
        heard={props.heard}
        lastMatch={props.lastMatch}
        onListenAgain={props.onListenAgain}
        onMicToggle={props.onMicToggle}
      />
    );
  }

  return (
    <>
      <Text fw={700} style={{ fontSize: 20 }}>
        {props.lesson.production.prompt_en}
      </Text>
      <Group justify="space-between" align="center">
        <MicButton
          isRecording={props.isRecording}
          onClick={props.onMicToggle}
          disabled={props.isAudioPlaying}
        />
      </Group>
      {props.grading ? (
        <Text size="sm" c="dimmed">
          Grading...
        </Text>
      ) : null}
      {props.gradeText ? <Text size="sm">{props.gradeText}</Text> : null}
    </>
  );
}

function DiagnosisActions(props: {
  isAudioPlaying: boolean;
  isStepPassed: boolean;
  onListenAgain: () => void;
  onStart: () => void;
}) {
  if (props.isStepPassed) {
    return null;
  }
  return (
    <Group justify="space-between" align="center">
      <Button
        leftSection={<IconPlayerPlayFilled size={16} />}
        variant="default"
        onClick={props.onListenAgain}
        disabled={props.isAudioPlaying}
      >
        Listen Again
      </Button>
      <Button onClick={props.onStart} variant="light">
        Start
      </Button>
    </Group>
  );
}

function ListenAndRepeatStep(props: {
  hint?: string;
  text: string;
  isAudioPlaying: boolean;
  isRecording: boolean;
  isStepPassed: boolean;
  heard: string;
  lastMatch: boolean | null;
  onListenAgain: () => void;
  onMicToggle: () => void;
}) {
  if (props.isStepPassed) {
    return null;
  }
  return (
    <>
      {props.hint ? (
        <Text size="sm" c="dimmed">
          {props.hint}
        </Text>
      ) : null}
      <Text fw={600}>{props.text}</Text>
      <Group justify="space-between" align="center">
        <Button
          leftSection={<IconPlayerPlayFilled size={16} />}
          variant="default"
          onClick={props.onListenAgain}
          disabled={props.isAudioPlaying}
        >
          Listen Again
        </Button>
        <MicButton
          isRecording={props.isRecording}
          onClick={props.onMicToggle}
          disabled={props.isAudioPlaying}
        />
        {props.heard ? (
          <Text size="sm" c={props.lastMatch ? "green" : "red"}>
            {props.heard}
          </Text>
        ) : null}
      </Group>
    </>
  );
}
