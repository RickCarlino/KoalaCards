import {
  Card,
  Group,
  Image,
  Progress,
  Stack,
  Text,
  Title,
  Container,
  Box,
  ActionIcon,
} from "@mantine/core";
import { flexGrowStyle } from "../styles";
import { useRouter } from "next/router";
import { Grade } from "femto-fsrs";
import { useEffect, useReducer, useState } from "react";
import { trpc } from "../trpc-config";
import { PauseReviewButton } from "./pause-button";
import { DifficultyButtons } from "./grade-buttons";
import { ListeningQuiz } from "./listening-quiz";
import { ReviewOver } from "./review-over";
import { SpeakingQuiz } from "./speaking-quiz";
import { Props, Quiz, QuizComp, QuizProps } from "./types";
import { EditButton } from "./edit-button";
import RemixButton from "../remix-button";
import { ReviewQuiz } from "./review-quiz";
import { reviewReducer } from "@/koala/review/review-reducer";

async function fetchAudioAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const UnknownQuiz: QuizComp = (props) => {
  const [currentGrade, setGrade] = useState<Grade>();
  const handleGrade = (grade: Grade) => {
    setGrade(grade);
    props.onGraded(grade);
    setGrade(undefined);
    props.onComplete({
      status: "pass",
      feedback: "Unknown quiz graded",
      userResponse: "???",
    });
  };
  return (
    <Card shadow="sm" p="lg" radius="md" withBorder>
      <Stack gap="md">
        <Title order={2} size="h3">
          Unknown Quiz ({props.quiz.quiz.lessonType})
        </Title>
        <Text>{props.quiz.quiz.definition}</Text>
        <Text>{props.quiz.quiz.term}</Text>
        <DifficultyButtons
          quiz={props.quiz.quiz}
          current={currentGrade}
          onSelectDifficulty={handleGrade}
        />
      </Stack>
    </Card>
  );
};

const quizComponents: Record<Quiz["lessonType"], QuizComp> = {
  new: ListeningQuiz,
  listening: ListeningQuiz,
  speaking: SpeakingQuiz,
  remedial: ReviewQuiz,
};

export const ReviewPage = (props: Props) => {
  const router = useRouter();
  const [state, dispatch] = useReducer(reviewReducer, {
    quizzes: [],
    currentQuizIndex: 0,
  });
  const gradeQuiz = trpc.gradeQuiz.useMutation();

  useEffect(() => {
    dispatch({ type: "LOAD_QUIZZES", quizzes: props.quizzes });
    if (props.quizzes.length > 0) {
      const firstQuiz = props.quizzes[0];
      fetchAudioAsBase64(firstQuiz.termAudio).then((audioBase64) => {
        dispatch({
          type: "UPDATE_AUDIO_URL",
          uuid: firstQuiz.uuid,
          audioBase64,
        });
      });
    }
  }, [props.quizzes]);

  const currentQuizState = state.quizzes[state.currentQuizIndex];

  if (currentQuizState) {
    const quiz = currentQuizState.quiz;
    const LessonComponent = quizComponents[quiz.lessonType] || UnknownQuiz;
    const done = state.quizzes.filter(
      (q) => !!(q.grade || q.serverGradingResult),
    ).length;
    const total = state.quizzes.length;
    const percentage = Math.round((done / total) * 100);

    const quizProps: QuizProps = {
      quiz: currentQuizState,
      onGraded(grade) {
        dispatch({ type: "SET_GRADE", grade, uuid: quiz.uuid });
        dispatch({ type: "NEXT_QUIZ" });
        const nextQuiz = state.quizzes[state.currentQuizIndex + 1];
        if (nextQuiz) {
          fetchAudioAsBase64(nextQuiz.quiz.termAudio).then(
            (audioBase64) => {
              dispatch({
                type: "UPDATE_AUDIO_URL",
                uuid: nextQuiz.quiz.uuid,
                audioBase64,
              });
            },
          );
        }
      },
      onComplete({ status, feedback, userResponse }) {
        dispatch({
          type: "SERVER_FEEDBACK",
          uuid: quiz.uuid,
          result: status,
          serverResponse: feedback,
          userResponse,
        });
      },
    };

    return (
      <Container size="lg" px={{ base: "xs", sm: "md" }} py="md">
        <Card
          shadow="sm"
          radius="md"
          withBorder
          w="100%"
          p={{ base: "sm", sm: "lg" }}
        >
          <Stack gap="md">
            {/* Image at the top on mobile, side by side on desktop */}
            {quiz.imageURL && (
              <Box mb={{ base: "md", md: 0 }}>
                <Image
                  src={quiz.imageURL}
                  fit="contain"
                  radius="md"
                  style={{
                    width: "100%",
                    height: "auto",
                    maxHeight: "300px",
                  }}
                />
              </Box>
            )}

            <Box>
              <LessonComponent {...quizProps} key={quiz.uuid} />
            </Box>

            <Stack gap="sm">
              <Group grow gap="sm">
                <PauseReviewButton
                  cardID={quiz.cardId}
                  onClick={() => dispatch({ type: "PAUSE_CURRENT_CARD" })}
                />
                <EditButton cardID={quiz.cardId} />
              </Group>
              <RemixButton
                card={{
                  id: quiz.cardId,
                  term: quiz.term,
                  definition: quiz.definition,
                }}
              />
            </Stack>

            {/* Progress information */}
            <Box>
              <Text size="sm" mb="xs">
                {props.quizzesDue} due today. {done} of {total} complete in
                current lesson.
              </Text>
              <Group gap="xs" align="center">
                <Progress
                  radius="xl"
                  size="md"
                  value={percentage || 1}
                  style={flexGrowStyle}
                />
                <ActionIcon
                  size="lg"
                  variant="subtle"
                  onClick={() =>
                    confirm("End lesson without saving?") &&
                    router.push("/")
                  }
                  aria-label="Return to home"
                >
                  ✕
                </ActionIcon>
              </Group>
            </Box>
          </Stack>
        </Card>
      </Container>
    );
  } else {
    const reviewOverProps = {
      state: state.quizzes,
      async onSave() {
        const grades = state.quizzes
          .filter((q) => {
            // Remove items with a `dontGrade` === true prop:
            return !q.quiz.dontGrade;
          })
          .map((q) => ({
            quizID: q.quiz.quizId,
            perceivedDifficulty:
              q.serverGradingResult === "fail" ? Grade.AGAIN : q.grade,
          }));
        await Promise.all(
          grades.map((grade) => {
            if (grade.perceivedDifficulty) {
              return gradeQuiz.mutateAsync({
                quizID: grade.quizID,
                perceivedDifficulty: grade.perceivedDifficulty,
              });
            }
            return Promise.resolve();
          }),
        );
        await props.onSave();
      },
      onUpdateDifficulty(uuid: string, grade: Grade) {
        dispatch({ type: "SET_GRADE", grade, uuid });
      },
    };
    return (
      <Container size="md" px={{ base: "xs", sm: "md" }} py="md">
        <ReviewOver {...reviewOverProps} />
      </Container>
    );
  }
};
