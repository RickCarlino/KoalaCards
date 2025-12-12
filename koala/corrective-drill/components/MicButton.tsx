import { Button } from "@mantine/core";
import { IconMicrophone, IconPlayerStopFilled } from "@tabler/icons-react";

export function MicButton(props: {
  isRecording: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const icon = props.isRecording ? (
    <IconPlayerStopFilled size={18} />
  ) : (
    <IconMicrophone size={18} />
  );
  return (
    <Button
      onClick={props.onClick}
      disabled={props.disabled}
      leftSection={icon}
      color={props.isRecording ? "red" : "pink"}
      variant={props.isRecording ? "filled" : "light"}
    >
      {props.isRecording ? "Stop" : "Speak"}
    </Button>
  );
}
