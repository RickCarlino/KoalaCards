import { HOTKEYS } from "@/pages/study";
import { Button, Grid, Text, Container, Table } from "@mantine/core";
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
          <Table>
            <tbody>
              <tr>
                <td>
                  <strong>Quiz type:</strong>
                </td>
                <td>{props.lessonType}</td>
              </tr>
              <tr>
                <td>
                  <strong>(A) What you said:</strong>
                </td>
                <td>{props.userTranscription}</td>
              </tr>
              <tr>
                <td>
                  <strong>(B) Term:</strong>
                </td>
                <td>{props.term}</td>
              </tr>
              <tr>
                <td>
                  <strong>(C) Definition:</strong>
                </td>
                <td>{props.definition}</td>
              </tr>
              <tr>
                <td>
                  <strong>Why it's wrong:</strong>
                </td>
                <td>{props.rejectionText}</td>
              </tr>
              <tr>
                <td colSpan={2}>{linkToEditPage(props.cardId)}</td>
              </tr>
            </tbody>
          </Table>
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
