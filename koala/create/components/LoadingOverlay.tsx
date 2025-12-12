import { Loader, Overlay } from "@mantine/core";
import React from "react";

type LoadingOverlayProps = {
  visible: boolean;
};

export function LoadingOverlay(props: LoadingOverlayProps) {
  const { visible } = props;
  if (!visible) {
    return null;
  }

  return (
    <Overlay blur={2} opacity={0.6} color="#fff" zIndex={9999}>
      <Loader size="lg" variant="dots" />
    </Overlay>
  );
}
