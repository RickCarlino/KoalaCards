export const languageExchangeIceServers = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

const DEFAULT_ICE_GATHERING_TIMEOUT_MS = 1_500;

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

export function createPlaceholderVideoStream(): MediaStream | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.fillStyle = "#101418";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f8f9fa";
  context.font = "24px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    "Screen share available when learner starts sharing",
    canvas.width / 2,
    canvas.height / 2,
  );

  return canvas.captureStream(1);
}

export async function waitForIceGatheringComplete(
  peerConnection: RTCPeerConnection,
  timeoutMs = DEFAULT_ICE_GATHERING_TIMEOUT_MS,
): Promise<void> {
  if (peerConnection.iceGatheringState === "complete") {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      peerConnection.removeEventListener(
        "icegatheringstatechange",
        onStateChange,
      );
    };

    const onStateChange = () => {
      if (peerConnection.iceGatheringState !== "complete") {
        return;
      }

      cleanup();
      resolve();
    };

    peerConnection.addEventListener(
      "icegatheringstatechange",
      onStateChange,
    );
  });
}
