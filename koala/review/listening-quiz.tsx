import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Stack, Text, Box, Title, Group } from "@mantine/core";
import { textShadowStyle } from "../styles";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState } from "react";
import { playFX } from "../play-fx";
import { compare } from "../quiz-evaluators/evaluator-utils";
import { useUserSettings } from "../settings-provider";
import { FailButton } from "./fail-button";
import { DifficultyButtons } from "./grade-buttons";
import { HOTKEYS } from "./hotkeys";
import { Quiz, QuizComp } from "./types";
import { VisualDiff } from "./visual-diff";
import { LangCode } from "../shared-types";

type Phase = "play" | "record" | "done";

const DEFAULT_STATE = {
  isRecording: false,
  phase: "play" as Phase,
  isProcessing: false,
  userInput: undefined as string | undefined,
};

export const ListeningQuiz: QuizComp = ({
  quiz,
  onGraded,
  onComplete,
}) => {
  const card = quiz.quiz;
  // State variables
  const [state, setState] = useState(DEFAULT_STATE);
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);
  const { playbackPercentage } = useUserSettings();
  useEffect(() => {
    setState({
      isRecording: false,
      phase: "play",
      isProcessing: false,
      userInput: "",
    });
    playFX("/listening-beep.wav");
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
      setState((prevState) => ({ ...prevState, userInput: undefined }));
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
      const base64Audio = await blobToBase64(
        await convertBlobToWav(audioBlob),
      );
      const { result: transcription } = await transcribeAudio.mutateAsync({
        audio: base64Audio,
        lang: card.langCode as LangCode,
        targetText: card.term,
      });

      const OK = compare(card.term, transcription);
      if (OK) {
        await playAudio(card.definitionAudio);
        await playAudio(card.termAudio);
        Math.random() < playbackPercentage &&
          (await playAudio(base64Audio));
        setState((prevState) => {
          return {
            ...prevState,
            phase: "done",
            userInput: transcription,
          };
        });
      } else {
        // Transcription did not match
        await playAudio(card.termAudio);
        setState((prevState) => ({
          ...prevState,
          userInput: transcription,
        }));
      }
    } catch (error) {
      console.error(error);
      setState((prevState) => ({
        ...prevState,
        userInput: "Error occurred during transcription.",
      }));
    } finally {
      setState((prevState) => ({ ...prevState, isProcessing: false }));
    }
  }

  const handleFailClick = async () => {
    await playAudio(card.termAudio);
    await playAudio(card.termAudio);
    await playAudio(card.termAudio);
    await playAudio(card.definitionAudio);

    onGraded(Grade.AGAIN);
    onComplete({
      status: "fail", // TODO: Create new "self-fail" status.
      feedback: "You gave up.",
      userResponse: "",
    });
  };

  const handleDifficultySelect = (grade: Grade) => {
    onGraded(grade);
    onComplete({
      status: "pass",
      feedback: "",
      userResponse: "",
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
          userInput={state.userInput}
          term={card.term}
          onRecordClick={handleRecordClick}
          onPlayClick={() => playAudio(card.termAudio)}
          onFailClick={handleFailClick}
        />
      );
    case "done":
      return (
        <DonePhase
          quiz={card}
          userInput={state.userInput}
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
    <Stack gap="md">
      <Title order={2} ta="center" size="h3" style={textShadowStyle}>
        Listen and Repeat
      </Title>
      {showTerm && (
        <Text size="lg" fw={500}>
          {term}
        </Text>
      )}
      {isDictation && <Text size="md">Definition: {definition}</Text>}
      <Box my="md">
        <Button
          onClick={onPlayClick}
          fullWidth
          size="lg"
          h={50}
          color="pink"
        >
          Listen to Audio and Proceed
        </Button>
      </Box>
      <FailButton onClick={onFailClick} />
    </Stack>
  );
};

type RecordPhaseProps = {
  isDictation: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  userInput: string | undefined;
  term: string;
  onRecordClick: () => void;
  onPlayClick: () => void;
  onFailClick: () => void;
};

// Record Phase Component
const RecordPhase = ({
  isDictation,
  isRecording,
  isProcessing,
  userInput,
  term,
  onRecordClick,
  onPlayClick,
  onFailClick,
}: RecordPhaseProps) => {
  useHotkeys([
    [
      HOTKEYS.RECORD,
      (e) => {
        e.preventDefault(); // Prevent buttons from getting pushed due to spacebar press.
        !isProcessing && onRecordClick();
      },
    ],
    [HOTKEYS.PLAY, () => !isProcessing && onPlayClick()],
  ]);
  const recordingText = isRecording ? "Stop Recording" : "Begin Recording";
  const buttonLabel = isProcessing ? "Processing..." : recordingText;
  const color = isRecording ? "red" : "pink";
  const header = isDictation
    ? `Repeat the Phrase: ${term}`
    : "Repeat the Phrase Without Reading";
  return (
    <Stack gap="md">
      <Title order={2} ta="center" size="h3" style={textShadowStyle}>
        {header}
      </Title>
      {userInput ? <VisualDiff expected={term} actual={userInput} /> : ""}
      <Box my="md">
        <Button
          color={color}
          onClick={onRecordClick}
          disabled={isProcessing}
          fullWidth
          size="lg"
          h={50}
        >
          {buttonLabel}
        </Button>
      </Box>
      <Group grow>
        <Button onClick={onPlayClick} size="md" color="pink">
          Play Audio Again
        </Button>
        <FailButton onClick={onFailClick} />
      </Group>
    </Stack>
  );
};

type DonePhaseProps = {
  quiz: Quiz;
  userInput: string | undefined;
  onDifficultySelect: (grade: Grade) => void;
};

// Done Phase Component
const DonePhase = ({
  userInput,
  onDifficultySelect,
  quiz,
}: DonePhaseProps) => {
  const { term, definition } = quiz;
  return (
    <Stack gap="md">
      <Title order={2} ta="center" size="h3" style={textShadowStyle}>
        Select Next Review Date
      </Title>
      <VisualDiff expected={term} actual={userInput || term} />
      <Text size="md" fw={500}>
        Definition: {definition}
      </Text>
      <Box mt="md">
        <DifficultyButtons
          quiz={quiz}
          current={undefined}
          onSelectDifficulty={onDifficultySelect}
        />
      </Box>
    </Stack>
  );
};
