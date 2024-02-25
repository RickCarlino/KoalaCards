import { HOTKEYS } from "@/pages/study";
import { Button, Grid, Text, Container } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import Link from "next/link";

export function linkToEditPage(id: number) {
  return <Link href={["cards", id].join("/")}>Edit Card</Link>;
}

export function QuizFailure(props: {
  id: number;
  cardId: number;
  term: string;
  definition: string;
  lessonType: string;
  userTranscription: string;
  rejectionText: string;
  onFlag: () => void;
  onDiscard?: () => void;
  onClose: () => void;
}) {
  useHotkeys([
    [HOTKEYS.CONTINUE, () => props.onClose()],
    [HOTKEYS.FLAG, props.onFlag],
    [HOTKEYS.DISAGREE, () => props.onDiscard?.()],
  ]);
  return (
    <Container size="xs">
      <Grid grow justify="center" align="center">
        <Grid.Col>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "20px",
            }}
          >
            <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Incorrect</h1>
          </header>
          <Text>You answered a previous question incorrectly.</Text>
          <Text>
            <strong>Quiz type:</strong> {props.lessonType}
          </Text>
          <Text>
            <strong>(A) What you said:</strong> {props.userTranscription}
          </Text>
          <Text>
            <strong>(B) Term:</strong> {props.term}
          </Text>
          <Text>
            <strong>(C) Definition:</strong> {props.definition}
          </Text>
          <Text>
            <strong>Why it's wrong:</strong> {props.rejectionText}
          </Text>
          <Text>{linkToEditPage(props.cardId)}</Text>
          <Grid grow justify="center" align="stretch" gutter="xs">
            <Grid.Col span={4}>
              <Button onClick={props.onClose}>
                Continue ({HOTKEYS.CONTINUE.toUpperCase()})
              </Button>
            </Grid.Col>
            <Grid.Col span={4}>
              <Button onClick={props.onDiscard}>
                Disagree ({HOTKEYS.DISAGREE.toUpperCase()})
              </Button>
            </Grid.Col>
            <Grid.Col span={4}>
              <Button onClick={props.onFlag}>
                Flag / Pause ({HOTKEYS.FLAG.toUpperCase()})
              </Button>
            </Grid.Col>
          </Grid>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
