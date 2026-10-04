import { SegmentedControl, Slider, Stack, Text } from "@mantine/core";
import type { ReaderPreferences } from "../contracts";
import { READER_PREFERENCE_LIMITS } from "../preferences";

export function ReadingPreferencesControls({
  preferences,
  onChange,
  codeLineMode,
  onCodeLineModeChange,
}: {
  preferences: ReaderPreferences;
  onChange: (preferences: ReaderPreferences) => void;
  codeLineMode?: "scroll" | "wrap";
  onCodeLineModeChange?: (mode: "scroll" | "wrap") => void;
}) {
  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        Font size
      </Text>
      <Slider
        min={READER_PREFERENCE_LIMITS.fontSize.min}
        max={READER_PREFERENCE_LIMITS.fontSize.max}
        step={READER_PREFERENCE_LIMITS.fontSize.step}
        value={preferences.fontSize}
        onChange={(fontSize) => {
          onChange({ ...preferences, fontSize });
        }}
        color="pink"
      />
      <Text size="xs" c="dimmed">
        Line height
      </Text>
      <Slider
        min={READER_PREFERENCE_LIMITS.lineHeight.min}
        max={READER_PREFERENCE_LIMITS.lineHeight.max}
        step={READER_PREFERENCE_LIMITS.lineHeight.step}
        value={preferences.lineHeight}
        onChange={(lineHeight) => {
          onChange({ ...preferences, lineHeight });
        }}
        color="pink"
      />
      <Text size="xs" c="dimmed">
        Reading width
      </Text>
      <Slider
        min={READER_PREFERENCE_LIMITS.readingWidth.min}
        max={READER_PREFERENCE_LIMITS.readingWidth.max}
        step={READER_PREFERENCE_LIMITS.readingWidth.step}
        value={preferences.readingWidth}
        onChange={(readingWidth) => {
          onChange({ ...preferences, readingWidth });
        }}
        color="pink"
      />
      {codeLineMode && onCodeLineModeChange ? (
        <>
          <Text size="xs" c="dimmed">
            Code lines
          </Text>
          <SegmentedControl
            value={codeLineMode}
            onChange={(value) => {
              onCodeLineModeChange(value === "wrap" ? "wrap" : "scroll");
            }}
            data={[
              { label: "Scroll", value: "scroll" },
              { label: "Wrap", value: "wrap" },
            ]}
            size="xs"
            color="grape"
          />
        </>
      ) : null}
    </Stack>
  );
}
