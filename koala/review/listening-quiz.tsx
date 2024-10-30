import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Center, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState /*, useCallback*/ } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { QuizComp } from "./types";
import { FailButton } from "./fail-button";

export const ListeningQuiz: QuizComp = ({
  quiz: card,
  onGraded,
  onComplete,
}) => {
  // State variables
  const [successfulAttempts, setSuccessfulAttempts] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<"play" | "record" | "done">("play");
  const [transcriptionFailed, setTranscriptionFailed] = useState(false);
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  useEffect(() => {
    setSuccessfulAttempts(0);
    setIsRecording(false);
    setPhase("play");
    setTranscriptionFailed(false);
  }, [card.term]);

  const isDictation = card.lessonType === "dictation";
  const showTerm = successfulAttempts === 0 || isDictation;

  const handlePlayClick = async () => {
    await playAudio(card.termAudio);
    setPhase("record");
  };

  const handleRecordClick = () => {
    if (isRecording) {
      voiceRecorder.stop();
      setIsRecording(false);
    } else {
      setTranscriptionFailed(false); // Reset error message
      voiceRecorder.start();
      setIsRecording(true);
    }
  };

  async function handleRecordingResult(audioBlob: Blob) {
    setIsRecording(false);
    try {
      const base64Audio = await blobToBase64(await convertBlobToWav(audioBlob));
      const { result: transcription } = await transcribeAudio.mutateAsync({
        audio: base64Audio,
        lang: "ko",
        targetText: card.term,
      });

      if (transcription.trim() === card.term.trim()) {
        setSuccessfulAttempts((prev) => prev + 1);
        setPhase("done");
      } else {
        // Transcription did not match
        setTranscriptionFailed(true);
        setPhase("record"); // Stay in record phase
      }
    } catch (error) {
      setTranscriptionFailed(true);
      setPhase("record"); // Retry
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

  // Phase components mapping
  const phaseComponents = {
    play: (
      <PlayPhase
        isDictation={isDictation}
        showTerm={showTerm}
        term={card.term}
        definition={card.definition}
        onPlayClick={handlePlayClick}
        onFailClick={handleFailClick}
      />
    ),
    record: (
      <RecordPhase
        isDictation={isDictation}
        isRecording={isRecording}
        transcriptionFailed={transcriptionFailed}
        term={card.term}
        onRecordClick={handleRecordClick}
        onPlayAudioAgain={() => playAudio(card.termAudio)}
        onFailClick={handleFailClick}
      />
    ),
    done: (
      <DonePhase
        term={card.term}
        definition={card.definition}
        onDifficultySelect={handleDifficultySelect}
      />
    ),
  };

  return phaseComponents[phase] || <div>{`Unknown phase: ${phase}`}</div>;
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
}: PlayPhaseProps) => (
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

type RecordPhaseProps = {
  isDictation: boolean;
  isRecording: boolean;
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
  transcriptionFailed,
  term,
  onRecordClick,
  onPlayAudioAgain,
  onFailClick,
}: RecordPhaseProps) => {
  useHotkeys([["space", () => onRecordClick()]]);

  const recordLabel = isRecording ? "Stop Recording" : "Begin Recording";
  const header = isDictation ? `NEW: ${term}` : "Record What You Hear";

  return (
    <Stack>
      <Text size="xl">{header}</Text>
      {transcriptionFailed && (
        <Text>The transcription did not match. Please try again.</Text>
      )}
      <Button onClick={onRecordClick}>{recordLabel}</Button>
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
