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
