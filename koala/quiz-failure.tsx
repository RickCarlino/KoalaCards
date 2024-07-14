import { HOTKEYS } from "@/pages/study";
import { Button, Grid, Text, Container, Table } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import Link from "next/link";
import { playAudio } from "./play-audio";
import { YOU_HIT_FAIL } from "./study_reducer";

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
  const IS_LISTENING = props.lessonType === "listening";
  const start: RowProps = {
    title: "Task",
    value: IS_LISTENING ? "Translate to English" : "Say in Target Language",
    key: "lessonType",
  };
  /**
   * You answered a previous question incorrectly.
   Quiz type	speaking
   Why it's wrong	The input sentence is incomplete and does not provide enough context to determine if it is grammatically correct in Korean.
   (A) What you said	몰라요.
   (C) Definition	How much is this?
   (B) Term	이것은 얼마입니까?
   */
  let rows: RowProps[];
  if (IS_LISTENING) {
    rows = [
      start,
      {
        title: "Prompt",
        value: props.term,
        key: "1",
      },
      {
        title: "Response",
        value: props.userTranscription,
        key: "2",
      },
      {
        title: "Expected",
        value: props.definition,
        key: "3",
      },
    ];
  } else {
    rows = [
      start,
      {
        title: "Prompt",
        value: props.term, // KO
        key: "4",
      },
      {
        title: "Response",
        value: props.userTranscription, // KO
        key: "5",
      },
      {
        title: "Expected",
        value: props.definition, // EN
        key: "6",
      },
      {
        title: "Response Translation",
        value: props.rejectionText, // EN
        key: "7",
      },
    ];
  }
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
  playbackAudio: string;
  onFlag: () => void;
  onDiscard?: () => void;
  onClose: () => void;
}) {
  const youHitFail = props.rejectionText == YOU_HIT_FAIL;
  const doClose = async () => {
    await playAudio(props.playbackAudio);
    await playAudio(props.playbackAudio);
    props.onClose();
  };
  useHotkeys([
    [HOTKEYS.AGREE, doClose],
    [HOTKEYS.FLAG, props.onFlag],
    [HOTKEYS.DISAGREE, () => !youHitFail && props.onDiscard?.()],
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
              <Button disabled={youHitFail} onClick={props.onDiscard}>
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
