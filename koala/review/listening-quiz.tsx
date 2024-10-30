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

type Phase = "play" | "record" | "done";

const DEFAULT_STATE = {
  successfulAttempts: 0,
  isRecording: false,
  phase: "play" as Phase,
  isProcessing: false,
  transcriptionFailed: false,
};

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
      successfulAttempts: 0,
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

      console.log([transcription, card.term].join(" VS "));

      if (transcription.trim() === card.term.trim()) {
        setState((prevState) => ({
          ...prevState,
          successfulAttempts: prevState.successfulAttempts + 1,
          phase: "done",
        }));
      } else {
        // Transcription did not match
        setState((prevState) => ({
          ...prevState,
          transcriptionFailed: true,
          phase: "record",
        }));
      }
    } catch (error) {
      console.error(error);
      setState((prevState) => ({
        ...prevState,
        transcriptionFailed: true,
        phase: "record",
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
          showTerm={state.successfulAttempts === 0 || isDictation}
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
          onRecordClick={handleRecordClick}
          onPlayAudioAgain={() => playAudio(card.termAudio)}
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
  useHotkeys([["space", () => onPlayClick()]]);

  return (
    <Stack>
      {isDictation && (
        <Center>
          <Text size="xl">NEW CARD</Text>
        </Center>
      )}
      {showTerm && <Text>Term: {term}</Text>}
      {isDictation && <Text>Meaning: {definition}</Text>}
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
  onRecordClick: () => void;
  onPlayAudioAgain: () => void;
  onFailClick: () => void;
};

// Record Phase Component
const RecordPhase = ({
  isDictation,
  isRecording,
  isProcessing,
  transcriptionFailed,
  term,
  onRecordClick,
  onPlayAudioAgain,
  onFailClick,
}: RecordPhaseProps) => {
  useHotkeys([["space", () => !isProcessing && onRecordClick()]]);
  const recordingText = isRecording ? "Stop Recording" : "Begin Recording";
  const buttonLabel = isProcessing ? "Processing..." : recordingText;
  const header = isDictation ? `NEW: ${term}` : "Record What You Hear";

  return (
    <Stack>
      <Center>
        <Text size="xl">{header}</Text>
      </Center>
      {transcriptionFailed && (
        <Text>The transcription did not match. Please try again.</Text>
      )}
      <Button onClick={onRecordClick} disabled={isProcessing}>
        {buttonLabel}
      </Button>
      <Button onClick={onPlayAudioAgain}>Play Audio Again</Button>
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
      <Text size="xl">Select Difficulty</Text>
    </Center>
    <Text>Term: {term}</Text>
    <Text>Definition: {definition}</Text>
    <DifficultyButtons
      current={undefined}
      onSelectDifficulty={onDifficultySelect}
    />
  </Stack>
);
