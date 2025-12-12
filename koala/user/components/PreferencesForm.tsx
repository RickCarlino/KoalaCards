import { EditableUserSettings } from "@/koala/user/types";
import {
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";

function parseFiniteNumber(value: number | string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type NumberSettingKey =
  | "playbackSpeed"
  | "cardsPerDayMax"
  | "dailyWritingGoal"
  | "playbackPercentage";

type BoolSettingKey = "writingFirst" | "performCorrectiveReviews";

const numberSetters: Record<
  NumberSettingKey,
  (settings: EditableUserSettings, value: number) => EditableUserSettings
> = {
  playbackSpeed: (settings, value) => ({
    ...settings,
    playbackSpeed: value,
  }),
  cardsPerDayMax: (settings, value) => ({
    ...settings,
    cardsPerDayMax: value,
  }),
  dailyWritingGoal: (settings, value) => ({
    ...settings,
    dailyWritingGoal: value,
  }),
  playbackPercentage: (settings, value) => ({
    ...settings,
    playbackPercentage: value,
  }),
};

const boolSetters: Record<
  BoolSettingKey,
  (settings: EditableUserSettings, value: boolean) => EditableUserSettings
> = {
  writingFirst: (settings, value) => ({
    ...settings,
    writingFirst: value,
  }),
  performCorrectiveReviews: (settings, value) => ({
    ...settings,
    performCorrectiveReviews: value,
  }),
};

export function PreferencesForm(props: {
  settings: EditableUserSettings;
  onChange: (next: EditableUserSettings) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const setNumber = (
    field: NumberSettingKey,
    rawValue: number | string,
  ) => {
    const parsed = parseFiniteNumber(rawValue);
    if (parsed === null) {
      return;
    }
    props.onChange(numberSetters[field](props.settings, parsed));
  };

  const setBool = (field: BoolSettingKey, checked: boolean) => {
    props.onChange(boolSetters[field](props.settings, checked));
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Title order={4} mb="sm">
        Preferences
      </Title>

      <Stack gap="md">
        <Stack gap={6}>
          <Text size="sm" fw={600}>
            Audio playback speed
          </Text>
          <Slider
            min={0.5}
            max={2}
            step={0.05}
            value={props.settings.playbackSpeed}
            onChange={(val) => setNumber("playbackSpeed", val)}
            marks={[
              { value: 0.5, label: "0.5x" },
              { value: 1, label: "1x" },
              { value: 1.5, label: "1.5x" },
              { value: 2, label: "2x" },
            ]}
          />
        </Stack>

        <NumberInput
          label="New cards per day target"
          description="Weekly target is 7× this value; daily new adjusts to meet it."
          value={props.settings.cardsPerDayMax}
          onChange={(value) => setNumber("cardsPerDayMax", value)}
          min={1}
          max={50}
          required
        />

        <NumberInput
          label="Daily writing goal (characters)"
          description="Set your daily writing practice target."
          value={props.settings.dailyWritingGoal}
          onChange={(value) => setNumber("dailyWritingGoal", value)}
          min={1}
          step={50}
          required
        />

        <SegmentedControl
          fullWidth
          value={String(props.settings.playbackPercentage)}
          onChange={(value) => setNumber("playbackPercentage", value)}
          data={[
            { label: "Always (100%)", value: "1" },
            { label: "Usually (66%)", value: "0.66" },
            { label: "Sometimes (33%)", value: "0.33" },
            { label: "Never (0%)", value: "0" },
          ]}
        />
        <Text size="xs" c="dimmed">
          Controls how often your recording is replayed right after you
          speak, to reinforce pronunciation.
        </Text>

        <Switch
          checked={props.settings.writingFirst}
          onChange={(event) =>
            setBool("writingFirst", event.currentTarget.checked)
          }
          label="Require daily writing before card review"
          description="Prioritize writing practice by requiring it before card review"
          size="md"
          color="blue"
        />

        <Switch
          checked={props.settings.performCorrectiveReviews}
          onChange={(event) =>
            setBool(
              "performCorrectiveReviews",
              event.currentTarget.checked,
            )
          }
          label="Perform corrective reviews"
          description="After a review session, optionally run a short corrective speaking drill"
          size="md"
          color="blue"
        />

        <Group justify="flex-end" mt="sm">
          <Button
            type="button"
            loading={props.isSaving}
            onClick={props.onSave}
          >
            Save Settings
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
