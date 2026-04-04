import { trpc } from "@/koala/trpc-config";
import {
  debugLanguageExchange,
  LANGUAGE_EXCHANGE_CONNECT_POLL_INTERVAL_MS,
  LANGUAGE_EXCHANGE_POLL_INTERVAL_MS,
} from "@/koala/language-exchange";
import {
  languageExchangeIceServers,
  stopMediaStream,
  waitForIceGatheringComplete,
} from "@/koala/language-exchange-client";
import { useLanguageExchangeSounds } from "@/koala/language-exchange-sounds";
import {
  Affix,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as React from "react";
import { useSession } from "next-auth/react";

type ActiveLearnerCall = {
  requestId: number;
  statusText: string;
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function LanguageExchangeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const [isVisible, setIsVisible] = React.useState(true);
  const [dismissedRequestId, setDismissedRequestId] = React.useState<
    number | null
  >(null);
  const [incomingBusyId, setIncomingBusyId] = React.useState<
    number | null
  >(null);
  const [activeCall, setActiveCall] =
    React.useState<ActiveLearnerCall | null>(null);
  const peerRef = React.useRef<RTCPeerConnection | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const appliedOfferSdpRef = React.useRef<string | null>(null);
  const isSubmittingAnswerRef = React.useRef(false);
  const sounds = useLanguageExchangeSounds();

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      const nextVisible = document.visibilityState === "visible";
      debugLanguageExchange("learner.visibility", {
        isVisible: nextVisible,
      });
      setIsVisible(nextVisible);
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, []);

  const stateQuery = trpc.getLanguageExchangeState.useQuery(
    {
      isVisible,
      activeRequestId: activeCall?.requestId,
    },
    {
      enabled: status === "authenticated",
      refetchOnWindowFocus: false,
      refetchInterval: () => {
        if (!isVisible) {
          return false;
        }

        if (activeCall) {
          return LANGUAGE_EXCHANGE_CONNECT_POLL_INTERVAL_MS;
        }

        return LANGUAGE_EXCHANGE_POLL_INTERVAL_MS;
      },
    },
  );
  const answerMutation = trpc.answerLanguageExchangeRequest.useMutation();
  const submitAnswerMutation =
    trpc.submitLanguageExchangeAnswer.useMutation();
  const endMutation = trpc.endLanguageExchangeRequest.useMutation();
  const activeRequest = stateQuery.data?.activeRequest ?? null;
  const incomingRequest = stateQuery.data?.incomingRequest ?? null;
  const hasLoadedState = stateQuery.status === "success";

  React.useEffect(() => {
    debugLanguageExchange("learner.query", {
      sessionStatus: status,
      isVisible,
      enabled: stateQuery.data?.enabled ?? null,
      incomingRequestId: incomingRequest?.id ?? null,
      activeRequestId: activeRequest?.id ?? null,
      hasGuestOffer: Boolean(activeRequest?.guestOfferSdp),
      hasLearnerAnswer: Boolean(activeRequest?.learnerAnswerSdp),
      activeCallRequestId: activeCall?.requestId ?? null,
      activeCallStatus: activeCall?.statusText ?? null,
    });
  }, [
    activeCall?.requestId,
    activeCall?.statusText,
    activeRequest?.guestOfferSdp?.sdp,
    activeRequest?.id,
    activeRequest?.learnerAnswerSdp?.sdp,
    incomingRequest?.id,
    isVisible,
    stateQuery.data?.enabled,
    status,
  ]);

  const cleanupCallResources = React.useCallback(() => {
    sounds.stopLoopingSound();
    peerRef.current?.close();
    peerRef.current = null;
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    appliedOfferSdpRef.current = null;
    isSubmittingAnswerRef.current = false;
  }, [sounds]);

  React.useEffect(() => {
    return () => {
      cleanupCallResources();
    };
  }, [cleanupCallResources]);

  React.useEffect(() => {
    const incomingRequestId = incomingRequest?.id ?? null;
    if (incomingRequestId === null) {
      setDismissedRequestId(null);
    }
  }, [incomingRequest?.id]);

  const handleCallEnded = React.useCallback(
    (message?: string) => {
      cleanupCallResources();
      setActiveCall(null);
      void sounds.playHangupTone();
      if (message) {
        notifications.show({
          title: "Language Exchange",
          message,
          color: "gray",
        });
      }
    },
    [cleanupCallResources, sounds],
  );

  React.useEffect(() => {
    if (
      !activeCall ||
      !hasLoadedState ||
      stateQuery.isFetching ||
      incomingBusyId === activeCall.requestId
    ) {
      return;
    }

    if (!activeRequest || activeRequest.id !== activeCall.requestId) {
      handleCallEnded("Call ended.");
    }
  }, [
    activeCall,
    activeRequest,
    handleCallEnded,
    hasLoadedState,
    incomingBusyId,
    stateQuery.isFetching,
  ]);

  React.useEffect(() => {
    const peer = peerRef.current;
    const activeRequestId = activeCall?.requestId;
    const offer = activeRequest?.guestOfferSdp;

    if (
      !activeRequestId ||
      !activeRequest ||
      activeRequest.id !== activeRequestId
    ) {
      return;
    }

    if (!peer || !offer) {
      return;
    }

    if (appliedOfferSdpRef.current === offer.sdp) {
      return;
    }

    if (isSubmittingAnswerRef.current) {
      return;
    }

    const applyOffer = async () => {
      try {
        appliedOfferSdpRef.current = offer.sdp;
        debugLanguageExchange("learner.offer.apply-start", {
          requestId: activeRequestId,
          offerLength: offer.sdp.length,
        });
        setActiveCall((current) => {
          if (!current || current.requestId !== activeRequestId) {
            return current;
          }

          return {
            ...current,
            statusText: "Connecting...",
          };
        });

        await peer.setRemoteDescription(offer);
        debugLanguageExchange("learner.offer.applied", {
          requestId: activeRequestId,
        });
        const answer = await peer.createAnswer();
        debugLanguageExchange("learner.answer.created", {
          requestId: activeRequestId,
        });
        await peer.setLocalDescription(answer);
        await waitForIceGatheringComplete(peer);

        if (
          peerRef.current !== peer ||
          peer.signalingState === "closed" ||
          !peer.localDescription?.sdp
        ) {
          debugLanguageExchange("learner.answer.skipped", {
            requestId: activeRequestId,
            peerStillActive: peerRef.current === peer,
            signalingState: peer.signalingState,
            hasLocalDescription: Boolean(peer.localDescription?.sdp),
          });
          return;
        }

        isSubmittingAnswerRef.current = true;
        debugLanguageExchange("learner.answer.upload-start", {
          requestId: activeRequestId,
          answerLength: peer.localDescription.sdp.length,
        });
        await submitAnswerMutation.mutateAsync({
          requestId: activeRequestId,
          answer: {
            type: "answer",
            sdp: peer.localDescription.sdp,
          },
        });
        debugLanguageExchange("learner.answer.uploaded", {
          requestId: activeRequestId,
        });
      } catch (error: unknown) {
        debugLanguageExchange("learner.offer.apply-failed", {
          requestId: activeRequestId,
          message: errorMessage(
            error,
            "Could not connect this language exchange call.",
          ),
        });
        notifications.show({
          title: "Call failed",
          message: errorMessage(
            error,
            "Could not connect this language exchange call.",
          ),
          color: "red",
        });
        handleCallEnded();
      } finally {
        isSubmittingAnswerRef.current = false;
        stateQuery.refetch();
      }
    };

    void applyOffer();
  }, [
    activeCall?.requestId,
    activeRequest?.id,
    activeRequest?.guestOfferSdp?.sdp,
    handleCallEnded,
    submitAnswerMutation,
    stateQuery.refetch,
  ]);

  const handleAnswer = async (requestId: number) => {
    setIncomingBusyId(requestId);
    sounds.stopLoopingSound();
    debugLanguageExchange("learner.answer.start", { requestId });

    let localStream: MediaStream | null = null;

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      debugLanguageExchange("learner.answer.mic-granted", { requestId });
      const stream = localStream;

      const claimed = await answerMutation.mutateAsync({ requestId });
      const request = claimed.request;
      if (!request) {
        throw new Error("Call no longer available.");
      }
      debugLanguageExchange("learner.answer.claimed", {
        requestId: request.id,
        hasGuestOffer: Boolean(request.guestOfferSdp),
      });

      cleanupCallResources();

      const peer = new RTCPeerConnection({
        iceServers: languageExchangeIceServers,
      });
      debugLanguageExchange("learner.peer-created", {
        requestId: request.id,
      });
      peerRef.current = peer;
      localStreamRef.current = stream;

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        debugLanguageExchange("learner.remote-track", {
          requestId: request.id,
          streamId: stream?.id ?? null,
        });
        if (stream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          void remoteAudioRef.current.play().catch(() => undefined);
        }
      };

      peer.onconnectionstatechange = () => {
        const connectionState = peer.connectionState;
        debugLanguageExchange("learner.connection-state", {
          requestId: request.id,
          state: connectionState,
        });
        if (connectionState === "connected") {
          sounds.stopLoopingSound();
          void sounds.playConnectedTone();
        }

        if (connectionState === "failed") {
          sounds.stopLoopingSound();
        }

        if (connectionState === "disconnected") {
          sounds.stopLoopingSound();
        }

        setActiveCall((current) => {
          if (!current || current.requestId !== request.id) {
            return current;
          }

          if (connectionState === "connected") {
            return {
              ...current,
              statusText: "Connected",
            };
          }

          if (connectionState === "failed") {
            return {
              ...current,
              statusText: "Connection failed",
            };
          }

          if (connectionState === "disconnected") {
            return {
              ...current,
              statusText: "Connection lost",
            };
          }

          return current;
        });
      };

      setActiveCall({
        requestId: request.id,
        statusText: request.guestOfferSdp
          ? "Connecting..."
          : "Waiting for caller...",
      });
      setDismissedRequestId(null);
      void stateQuery.refetch();
    } catch (error: unknown) {
      stopMediaStream(localStream);
      debugLanguageExchange("learner.answer.failed", {
        requestId,
        message: errorMessage(
          error,
          "Could not answer this language exchange call.",
        ),
      });
      notifications.show({
        title: "Answer failed",
        message: errorMessage(
          error,
          "Could not answer this language exchange call.",
        ),
        color: "red",
      });
    } finally {
      setIncomingBusyId(null);
    }
  };

  const handleHangUp = async () => {
    const requestId = activeCall?.requestId;
    debugLanguageExchange("learner.hang-up", {
      requestId: requestId ?? null,
    });

    cleanupCallResources();
    setActiveCall(null);
    void sounds.playHangupTone();

    if (!requestId) {
      return;
    }

    try {
      await endMutation.mutateAsync({ requestId });
      await stateQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Hang up failed",
        message: errorMessage(error, "Could not end the call cleanly."),
        color: "red",
      });
    }
  };

  const showIncomingPrompt =
    Boolean(stateQuery.data?.enabled) &&
    !activeCall &&
    incomingRequest !== null &&
    incomingRequest.id !== dismissedRequestId;

  React.useEffect(() => {
    if (!showIncomingPrompt || incomingBusyId !== null) {
      sounds.stopLoopingSound();
      return;
    }

    void sounds.startIncomingRingtone();

    return () => {
      sounds.stopLoopingSound();
    };
  }, [incomingBusyId, showIncomingPrompt, sounds]);

  return (
    <>
      {children}
      <audio ref={remoteAudioRef} autoPlay playsInline hidden />
      {showIncomingPrompt ? (
        <Affix position={{ bottom: 20, right: 20 }} zIndex={300}>
          <Paper p="md" radius="lg" shadow="lg">
            <Stack gap="sm">
              <Group justify="space-between" align="center" gap="sm">
                <Text fw={600}>Language exchange</Text>
                <Badge color="pink">Incoming</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                A Korean speaker is waiting now.
              </Text>
              <Group justify="flex-end">
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => setDismissedRequestId(incomingRequest.id)}
                >
                  Not now
                </Button>
                <Button
                  size="xs"
                  color="pink"
                  loading={incomingBusyId === incomingRequest.id}
                  onClick={() => handleAnswer(incomingRequest.id)}
                >
                  Answer
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Affix>
      ) : null}
      {activeCall ? (
        <Affix position={{ bottom: 20, right: 20 }} zIndex={301}>
          <Paper p="md" radius="lg" shadow="lg">
            <Stack gap="sm">
              <Group justify="space-between" align="center" gap="sm">
                <Text fw={600}>Language exchange</Text>
                <Badge color="pink">{activeCall.statusText}</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Keep studying while you talk.
              </Text>
              <Group justify="flex-end">
                <Button size="xs" color="red" onClick={handleHangUp}>
                  Hang up
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Affix>
      ) : null}
    </>
  );
}
