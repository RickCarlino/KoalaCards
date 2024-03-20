import { HOTKEYS } from "@/pages/study";
import { Button, Grid, Text, Container, Table } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import Link from "next/link";
import { playAudio } from "./play-audio";

export function linkToEditPage(id: number) {
  return <Link href={["cards", id].join("/")}>Edit Card</Link>;
}

function FailureTable(props: {
  cardId: number;
  definition: string;
  lessonType: string;
  rejectionText: string;
  term: string;
  userTranscription: string;
}) {
  type RowProps = {
    title: string;
    value: string;
    key: string;
  };
  const start: RowProps = {
    title: "Quiz type",
    value: props.lessonType,
    key: "lessonType",
  };
  const end: RowProps = {
    title: "Why it's wrong",
    value: props.rejectionText,
    key: "rejectionText",
  };
  const userTranscription: RowProps = {
    title: "(A) What you said",
    value: props.userTranscription,
    key: "userTranscription",
  };
  const term = { title: "(B) Term", value: props.term, key: "term" };
  const definition = {
    title: "(C) Definition",
    value: props.definition,
    key: "definition",
  };
  const IS_LISTENING = props.lessonType === "listening";
  /**
   * You answered a previous question incorrectly.
Quiz type	speaking
Why it's wrong	The input sentence is incomplete and does not provide enough context to determine if it is grammatically correct in Korean.
(A) What you said	몰라요.
(C) Definition	How much is this?
(B) Term	이것은 얼마입니까?
   */
  const rows = [
    start,
    userTranscription,
    IS_LISTENING ? definition : term,
    IS_LISTENING ? term : definition,
    end,
  ];
  return (
    <Table>
      <tbody>
        {rows.map((row: RowProps) => (
          <tr key={row.key}>
            <td>
              <strong>{row.title}</strong>
            </td>
            <td>{row.value}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={2}>{linkToEditPage(props.cardId)}</td>
        </tr>
      </tbody>
    </Table>
  );
}
export function QuizFailure(props: {
  id: number;
  cardId: number;
  term: string;
  definition: string;
  lessonType: string;
  userTranscription: string;
  rejectionText: string;
  audio: string;
  onFlag: () => void;
  onDiscard?: () => void;
  onClose: () => void;
}) {
  const doClose = async () => {
    await playAudio(props.audio);
    await playAudio(props.audio);
    props.onClose();
  };
  useHotkeys([
    [HOTKEYS.AGREE, doClose],
    [HOTKEYS.FLAG, props.onFlag],
    [HOTKEYS.DISAGREE, () => props.onDiscard?.()],
  ]);
  return (
    <Container size="xs">
      <Grid justify="center" align="center">
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
          <FailureTable {...props} />
          <Grid>
            <Grid.Col span={4}>
              <Button onClick={doClose}>
                Agree ({HOTKEYS.AGREE.toUpperCase()})
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
