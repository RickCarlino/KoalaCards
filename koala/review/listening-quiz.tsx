import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Center, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { QuizComp } from "./types";
import { FailButton } from "./fail-button";
import { HOTKEYS } from "./hotkeys";

type Phase = "play" | "record" | "done";

const DEFAULT_STATE = {
  isRecording: false,
  phase: "play" as Phase,
  isProcessing: false,
  transcriptionFailed: false,
};

function strip(input: string): string {
  return input.replace(/[^\p{L}]+/gu, "");
}

export const ListeningQuiz: QuizComp = ({
  quiz: card,
  onGraded,
  onComplete,
}) => {
  // State variables
  const [state, setState] = useState(DEFAULT_STATE);
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  useEffect(() => {
    setState({
      isRecording: false,
      phase: "play",
      isProcessing: false,
      transcriptionFailed: false,
    });
  }, [card.term]);

  const isDictation = card.lessonType === "dictation";

  const handlePlayClick = async () => {
    await playAudio(card.termAudio);
    setState((prevState) => ({ ...prevState, phase: "record" }));
  };

  const handleRecordClick = () => {
    if (state.isRecording) {
      voiceRecorder.stop();
      setState((prevState) => ({ ...prevState, isRecording: false }));
    } else {
      setState((prevState) => ({ ...prevState, transcriptionFailed: false }));
      voiceRecorder.start();
      setState((prevState) => ({ ...prevState, isRecording: true }));
    }
  };

  async function handleRecordingResult(audioBlob: Blob) {
    setState((prevState) => ({
      ...prevState,
      isRecording: false,
      isProcessing: true,
    }));
    try {
      const base64Audio = await blobToBase64(await convertBlobToWav(audioBlob));
      const { result: transcription } = await transcribeAudio.mutateAsync({
        audio: base64Audio,
        lang: "ko",
        targetText: card.term,
      });

      const OK = strip(transcription) === strip(card.term);
      console.log([strip(transcription), strip(card.term)].join(" VS "));
      console.log(OK ? "OK" : "FAIL");
      if (OK) {
        await playAudio(card.definitionAudio);
        await playAudio(card.termAudio);
        setState((prevState) => {
          return {
            ...prevState,
            phase: "done",
          };
        });
      } else {
        // Transcription did not match
        await playAudio(card.termAudio);
        setState((prevState) => ({
          ...prevState,
          transcriptionFailed: true,
        }));
      }
    } catch (error) {
      console.error(error);
      setState((prevState) => ({
        ...prevState,
        transcriptionFailed: true,
      }));
    } finally {
      setState((prevState) => ({ ...prevState, isProcessing: false }));
    }
  }

  const handleFailClick = () => {
    onGraded(Grade.AGAIN);
    onComplete({
      status: "fail",
      feedback: "You hit the FAIL button.",
      userResponse: "Not provided.",
    });
  };

  const handleDifficultySelect = (grade: Grade) => {
    onGraded(grade);
    onComplete({
      status: "pass",
      feedback: "",
      userResponse: "Not yet supported for listening quizzes.",
    });
  };

  switch (state.phase) {
    case "play":
      return (
        <PlayPhase
          isDictation={isDictation}
          showTerm={isDictation}
          term={card.term}
          definition={card.definition}
          onPlayClick={handlePlayClick}
          onFailClick={handleFailClick}
        />
      );
    case "record":
      return (
        <RecordPhase
          isDictation={isDictation}
          isRecording={state.isRecording}
          isProcessing={state.isProcessing}
          transcriptionFailed={state.transcriptionFailed}
          term={card.term}
          definition={card.definition}
          onRecordClick={handleRecordClick}
          onPlayClick={() => playAudio(card.termAudio)}
          onFailClick={handleFailClick}
        />
      );
    case "done":
      return (
        <DonePhase
          term={card.term}
          definition={card.definition}
          onDifficultySelect={handleDifficultySelect}
        />
      );
    default:
      return <div>{`Unknown phase: ${state.phase}`}</div>;
  }
};

type PlayPhaseProps = {
  isDictation: boolean;
  showTerm: boolean;
  term: string;
  definition: string;
  onPlayClick: () => void;
  onFailClick: () => void;
};

// Play Phase Component
const PlayPhase = ({
  isDictation,
  showTerm,
  term,
  definition,
  onPlayClick,
  onFailClick,
}: PlayPhaseProps) => {
  useHotkeys([[HOTKEYS.PLAY, () => onPlayClick()]]);

  return (
    <Stack>
      <Center>
        <Text size="xl">Listen and Repeat</Text>
      </Center>
      {showTerm && <Text>{term}</Text>}
      {isDictation && <Text>Definition: {definition}</Text>}
      <Button onClick={onPlayClick}>
        Listen to Audio and Proceed to Exercise
      </Button>
      <FailButton onClick={onFailClick} />
    </Stack>
  );
};

type RecordPhaseProps = {
  isDictation: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  transcriptionFailed: boolean;
  term: string;
  definition: string;
  onRecordClick: () => void;
  onPlayClick: () => void;
  onFailClick: () => void;
};

// Record Phase Component
const RecordPhase = ({
  isDictation,
  isRecording,
  isProcessing,
  transcriptionFailed,
  term,
  definition,
  onRecordClick,
  onPlayClick,
  onFailClick,
}: RecordPhaseProps) => {
  const [failures, setFailures] = useState(0);
  useEffect(() => {
    transcriptionFailed && setFailures((prev) => prev + 1);
  }, [transcriptionFailed]);
  useHotkeys([
    [HOTKEYS.RECORD, () => !isProcessing && onRecordClick()],
    [HOTKEYS.PLAY, () => !isProcessing && onPlayClick()],
  ]);
  const recordingText = isRecording ? "Stop Recording" : "Begin Recording";
  const buttonLabel = isProcessing ? "Processing..." : recordingText;
  const header = isDictation
    ? `Repeat the Phrase: ${term}`
    : "Repeat the Phrase Without Reading";
  return (
    <Stack>
      <Center>
        <Text size="xl">{header}</Text>
      </Center>
      {transcriptionFailed && (
        <Text>Pronunciation failure. Please try again.</Text>
      )}
      {failures > 2 && <Text>Hint: {definition}</Text>}
      <Button onClick={onRecordClick} disabled={isProcessing}>
        {buttonLabel}
      </Button>
      <Button onClick={onPlayClick}>Play Audio Again</Button>
      <FailButton onClick={onFailClick} />
    </Stack>
  );
};

type DonePhaseProps = {
  term: string;
  definition: string;
  onDifficultySelect: (grade: Grade) => void;
};

// Done Phase Component
const DonePhase = ({
  term,
  definition,
  onDifficultySelect,
}: DonePhaseProps) => (
  <Stack>
    <Center>
      <Text size="xl">How Well Did You Understand the Phrase?</Text>
    </Center>
    <Text>Term: {term}</Text>
    <Text>Definition: {definition}</Text>
    <DifficultyButtons
      current={undefined}
      onSelectDifficulty={onDifficultySelect}
    />
  </Stack>
);
