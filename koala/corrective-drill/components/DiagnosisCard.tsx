import { Stack, Text, Title } from "@mantine/core";
import type { CorrectiveDrillLesson } from "@/koala/types/corrective-drill";

export function DiagnosisCard(props: {
  diagnosis: CorrectiveDrillLesson["diagnosis"];
  targetLabel?: string;
  contrastLabel?: string | null;
}) {
  return (
    <Stack gap={8}>
      <Title order={4}>Diagnosis</Title>
      <Text c="red">❌ {props.diagnosis.original}</Text>
      <Text c="green" fw={700} style={{ fontSize: 18 }}>
        ✅ {props.diagnosis.corrected}
      </Text>
      {props.targetLabel ? (
        <Text size="sm" c="dimmed">
          {props.targetLabel}
        </Text>
      ) : null}
      {props.contrastLabel ? (
        <Text size="sm" c="dimmed">
          Contrast: {props.contrastLabel}
        </Text>
      ) : null}
      <Text size="sm">{props.diagnosis.error_explanation}</Text>
    </Stack>
  );
}
