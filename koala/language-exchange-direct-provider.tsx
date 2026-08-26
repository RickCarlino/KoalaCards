import {
  DIRECT_LANGUAGE_EXCHANGE_CONNECT_POLL_INTERVAL_MS,
  DIRECT_LANGUAGE_EXCHANGE_INCOMING_POLL_INTERVAL_MS,
  DIRECT_LANGUAGE_EXCHANGE_LEADER_TTL_MS,
  DIRECT_LANGUAGE_EXCHANGE_PRESENCE_HEARTBEAT_MS,
} from "@/koala/language-exchange-direct";
import {
  DIRECT_LANGUAGE_EXCHANGE_LEADER_STORAGE_KEY,
  DirectLanguageExchangeCallState,
  errorMessage,
  readJsonOrThrow,
} from "@/koala/language-exchange-direct-client";
import {
  createPlaceholderVideoStream,
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

type ActiveDirectCall = {
  callId: number;
  statusText: string;
};

type LearnerStateResponse = {
  enabled: boolean;
  incomingCall: DirectLanguageExchangeCallState | null;
  activeCall: DirectLanguageExchangeCallState | null;
};

type PresenceResponse = {
  enabled: boolean;
};

type LanguageExchangeAffixProps = {
  badgeLabel: string;
  children: React.ReactNode;
  message: string;
  zIndex: number;
};

type LeaderLease = {
  leaseId: string;
  expiresAt: number;
};

function LanguageExchangeAffix({
  badgeLabel,
  children,
  message,
  zIndex,
}: LanguageExchangeAffixProps) {
  return (
    <Affix position={{ bottom: 20, right: 20 }} zIndex={zIndex}>
      <Paper p="md" radius="lg" shadow="lg">
        <Stack gap="sm">
          <Group justify="space-between" align="center" gap="sm">
            <Text fw={600}>Language exchange</Text>
            <Badge color="pink">{badgeLabel}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {message}
          </Text>
          <Group justify="flex-end">{children}</Group>
        </Stack>
      </Paper>
    </Affix>
  );
}

type LanguageExchangeDirectViewProps = {
  activeCall: ActiveDirectCall | null;
  children: React.ReactNode;
  handleAnswer: (call: DirectLanguageExchangeCallState) => Promise<void>;
  handleDecline: (callId: number) => Promise<void>;
  handleHangUp: () => Promise<void>;
  handleToggleScreenShare: () => Promise<void>;
  incomingBusyId: number | null;
  incomingCall: DirectLanguageExchangeCallState | null;
  isSharingScreen: boolean;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  showIncomingPrompt: boolean;
};

function LanguageExchangeDirectView({
  activeCall,
  children,
  handleAnswer,
  handleDecline,
  handleHangUp,
  handleToggleScreenShare,
  incomingBusyId,
  incomingCall,
  isSharingScreen,
  remoteAudioRef,
  showIncomingPrompt,
}: LanguageExchangeDirectViewProps) {
  return (
    <>
      {children}
      <audio ref={remoteAudioRef} autoPlay playsInline hidden />
      {showIncomingPrompt && incomingCall ? (
        <LanguageExchangeAffix
          badgeLabel="Incoming"
          message="Someone is calling your language exchange link now."
          zIndex={302}
        >
          <Button
            size="xs"
            variant="subtle"
            loading={incomingBusyId === incomingCall.id}
            onClick={() => void handleDecline(incomingCall.id)}
          >
            Decline
          </Button>
          <Button
            size="xs"
            color="pink"
            loading={incomingBusyId === incomingCall.id}
            onClick={() => void handleAnswer(incomingCall)}
          >
            Answer
          </Button>
        </LanguageExchangeAffix>
      ) : null}
      {activeCall ? (
        <LanguageExchangeAffix
          badgeLabel={activeCall.statusText}
          message="Keep studying while you talk."
          zIndex={303}
        >
          <Button
            size="xs"
            variant="light"
            onClick={() => void handleToggleScreenShare()}
            disabled={activeCall.statusText !== "Connected"}
          >
            {isSharingScreen ? "Stop sharing" : "Share study screen"}
          </Button>
          <Button
            size="xs"
            color="red"
            onClick={() => void handleHangUp()}
          >
            Hang up
          </Button>
        </LanguageExchangeAffix>
      ) : null}
    </>
  );
}

function resolveActiveServerCall(
  serverActiveCall: DirectLanguageExchangeCallState | null,
  incomingCall: DirectLanguageExchangeCallState | null,
  activeCall: ActiveDirectCall | null,
): DirectLanguageExchangeCallState | null {
  if (serverActiveCall?.id === activeCall?.callId) {
    return serverActiveCall;
  }
  if (incomingCall?.id === activeCall?.callId) {
    return incomingCall;
  }
  return null;
}

function readLeaderLease(): LeaderLease | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(
      DIRECT_LANGUAGE_EXCHANGE_LEADER_STORAGE_KEY,
    );
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as LeaderLease;
    if (
      typeof parsed.leaseId !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeLeaderLease(leaseId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const nextLease: LeaderLease = {
    leaseId,
    expiresAt: Date.now() + DIRECT_LANGUAGE_EXCHANGE_LEADER_TTL_MS,
  };
  window.localStorage.setItem(
    DIRECT_LANGUAGE_EXCHANGE_LEADER_STORAGE_KEY,
    JSON.stringify(nextLease),
  );
}

function clearLeaderLease(leaseId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const currentLease = readLeaderLease();
  if (currentLease?.leaseId !== leaseId) {
    return;
  }

  window.localStorage.removeItem(
    DIRECT_LANGUAGE_EXCHANGE_LEADER_STORAGE_KEY,
  );
}

export function LanguageExchangeDirectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status: sessionStatus } = useSession();
  const [isVisible, setIsVisible] = React.useState(true);
  const [isLeader, setIsLeader] = React.useState(false);
  const [isEnabled, setIsEnabled] = React.useState(false);
  const [incomingCall, setIncomingCall] =
    React.useState<DirectLanguageExchangeCallState | null>(null);
  const [serverActiveCall, setServerActiveCall] =
    React.useState<DirectLanguageExchangeCallState | null>(null);
  const [incomingBusyId, setIncomingBusyId] = React.useState<
    number | null
  >(null);
  const [activeCall, setActiveCall] =
    React.useState<ActiveDirectCall | null>(null);
  const [isSharingScreen, setIsSharingScreen] = React.useState(false);
  const peerRef = React.useRef<RTCPeerConnection | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const screenShareStreamRef = React.useRef<MediaStream | null>(null);
  const placeholderVideoStreamRef = React.useRef<MediaStream | null>(null);
  const screenShareSenderRef = React.useRef<RTCRtpSender | null>(null);
  const appliedOfferSdpRef = React.useRef<string | null>(null);
  const isSubmittingAnswerRef = React.useRef(false);
  const leaseIdRef = React.useRef(crypto.randomUUID().replace(/-/g, ""));
  const sounds = useLanguageExchangeSounds();

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
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

  const ensurePlaceholderVideoStream = React.useCallback(() => {
    if (placeholderVideoStreamRef.current) {
      return placeholderVideoStreamRef.current;
    }

    const placeholderVideoStream = createPlaceholderVideoStream();
    if (!placeholderVideoStream) {
      return null;
    }

    placeholderVideoStreamRef.current = placeholderVideoStream;
    return placeholderVideoStream;
  }, []);

  const cleanupCallResources = React.useCallback(() => {
    sounds.stopLoopingSound();
    peerRef.current?.close();
    peerRef.current = null;
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    stopMediaStream(screenShareStreamRef.current);
    screenShareStreamRef.current = null;
    stopMediaStream(placeholderVideoStreamRef.current);
    placeholderVideoStreamRef.current = null;
    screenShareSenderRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    appliedOfferSdpRef.current = null;
    isSubmittingAnswerRef.current = false;
    setIsSharingScreen(false);
  }, [sounds]);

  const releasePresence = React.useCallback(() => {
    if (sessionStatus !== "authenticated") {
      return;
    }

    void fetch("/api/language-exchange/direct/presence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leaseId: leaseIdRef.current,
        isVisible: false,
        release: true,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [sessionStatus]);

  React.useEffect(() => {
    return () => {
      clearLeaderLease(leaseIdRef.current);
      releasePresence();
      cleanupCallResources();
    };
  }, [cleanupCallResources, releasePresence]);

  React.useEffect(() => {
    const syncLeadership = () => {
      if (sessionStatus !== "authenticated" || !isVisible) {
        clearLeaderLease(leaseIdRef.current);
        setIsLeader(false);
        return;
      }

      const currentLease = readLeaderLease();
      const now = Date.now();
      if (
        !currentLease ||
        currentLease.expiresAt <= now ||
        currentLease.leaseId === leaseIdRef.current
      ) {
        writeLeaderLease(leaseIdRef.current);
      }

      const nextLease = readLeaderLease();
      setIsLeader(nextLease?.leaseId === leaseIdRef.current);
    };

    syncLeadership();
    const intervalId = window.setInterval(syncLeadership, 2_000);
    const handleStorage = () => syncLeadership();
    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", handleStorage);
    };
  }, [isVisible, sessionStatus]);

  React.useEffect(() => {
    if (sessionStatus !== "authenticated" || !isLeader || !isVisible) {
      releasePresence();
      const timeoutId = window.setTimeout(() => {
        setIsEnabled(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;

    const sendHeartbeat = async (release = false) => {
      try {
        const response = await fetch(
          "/api/language-exchange/direct/presence",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              leaseId: leaseIdRef.current,
              isVisible,
              release,
            }),
            keepalive: release,
          },
        );
        const data = await readJsonOrThrow<PresenceResponse>(response);
        if (!cancelled) {
          setIsEnabled(data.enabled);
        }
      } catch {
        if (!cancelled) {
          setIsEnabled(false);
        }
      }
    };

    void sendHeartbeat();
    const intervalId = window.setInterval(
      () => void sendHeartbeat(),
      DIRECT_LANGUAGE_EXCHANGE_PRESENCE_HEARTBEAT_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      void sendHeartbeat(true);
    };
  }, [isLeader, isVisible, releasePresence, sessionStatus]);

  const refreshLearnerState = React.useCallback(async () => {
    const params = new URLSearchParams();
    if (activeCall?.callId) {
      params.set("activeCallId", String(activeCall.callId));
    }

    const response = await fetch(
      `/api/language-exchange/direct/learner-state${
        params.toString() ? `?${params.toString()}` : ""
      }`,
      {
        cache: "no-store",
      },
    );

    return readJsonOrThrow<LearnerStateResponse>(response);
  }, [activeCall]);

  React.useEffect(() => {
    if (
      sessionStatus !== "authenticated" ||
      !isVisible ||
      !isLeader ||
      (!isEnabled && !activeCall)
    ) {
      const timeoutId = window.setTimeout(() => {
        setIncomingCall(null);
        if (!activeCall) {
          setServerActiveCall(null);
        }
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;

    const pollState = async () => {
      try {
        const data = await refreshLearnerState();
        if (cancelled) {
          return;
        }

        setIsEnabled(data.enabled);
        setIncomingCall(data.incomingCall);
        setServerActiveCall(data.activeCall);

        if (
          activeCall &&
          incomingBusyId !== activeCall.callId &&
          !data.activeCall
        ) {
          cleanupCallResources();
          setActiveCall(null);
          void sounds.playHangupTone();
          notifications.show({
            title: "Language exchange",
            message: "Call ended.",
            color: "gray",
          });
        }
      } catch (error: unknown) {
        if (!cancelled && activeCall) {
          cleanupCallResources();
          setActiveCall(null);
          notifications.show({
            title: "Language exchange",
            message: errorMessage(error, "Could not refresh call status."),
            color: "red",
          });
        }
      }
    };

    void pollState();
    const intervalId = window.setInterval(
      () => void pollState(),
      activeCall
        ? DIRECT_LANGUAGE_EXCHANGE_CONNECT_POLL_INTERVAL_MS
        : DIRECT_LANGUAGE_EXCHANGE_INCOMING_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    activeCall,
    cleanupCallResources,
    incomingBusyId,
    isEnabled,
    isLeader,
    isVisible,
    refreshLearnerState,
    sessionStatus,
    sounds,
  ]);

  const activeServerCall = resolveActiveServerCall(
    serverActiveCall,
    incomingCall,
    activeCall,
  );

  React.useEffect(() => {
    const peer = peerRef.current;
    const offer = activeServerCall?.offerSdp;
    if (!activeCall || !peer || !offer) {
      return;
    }

    if (appliedOfferSdpRef.current === offer.sdp) {
      return;
    }

    if (isSubmittingAnswerRef.current) {
      return;
    }

    let cancelled = false;

    const applyOffer = async () => {
      try {
        appliedOfferSdpRef.current = offer.sdp;
        await peer.setRemoteDescription(offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await waitForIceGatheringComplete(peer);

        if (
          peerRef.current !== peer ||
          peer.signalingState === "closed" ||
          !peer.localDescription?.sdp
        ) {
          return;
        }

        isSubmittingAnswerRef.current = true;
        await fetch(
          `/api/language-exchange/direct/call/${activeCall.callId}/answer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              answer: {
                type: "answer",
                sdp: peer.localDescription.sdp,
              },
            }),
          },
        ).then(readJsonOrThrow);

        if (!cancelled) {
          setActiveCall((current) => {
            if (!current || current.callId !== activeCall.callId) {
              return current;
            }

            return {
              ...current,
              statusText: "Connecting...",
            };
          });
        }
      } catch (error: unknown) {
        notifications.show({
          title: "Answer failed",
          message: errorMessage(error, "Could not connect this call."),
          color: "red",
        });
        cleanupCallResources();
        setActiveCall(null);
      } finally {
        isSubmittingAnswerRef.current = false;
        setIncomingBusyId(null);
      }
    };

    void applyOffer();

    return () => {
      cancelled = true;
    };
  }, [activeCall, activeServerCall, cleanupCallResources]);

  const handleAnswer = async (call: DirectLanguageExchangeCallState) => {
    setIncomingBusyId(call.id);
    sounds.stopLoopingSound();

    let localStream: MediaStream | null = null;

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const stream = localStream;

      cleanupCallResources();

      const peer = new RTCPeerConnection({
        iceServers: languageExchangeIceServers,
      });
      peerRef.current = peer;
      localStreamRef.current = stream;

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      const placeholderVideoStream = ensurePlaceholderVideoStream();
      const placeholderTrack =
        placeholderVideoStream?.getVideoTracks()[0] ?? null;
      if (placeholderVideoStream && placeholderTrack) {
        screenShareSenderRef.current = peer.addTrack(
          placeholderTrack,
          placeholderVideoStream,
        );
      }

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          void remoteAudioRef.current.play().catch(() => undefined);
        }
      };

      peer.onconnectionstatechange = () => {
        const connectionState = peer.connectionState;
        if (connectionState === "connected") {
          sounds.stopLoopingSound();
          void sounds.playConnectedTone();
        }

        if (
          connectionState === "failed" ||
          connectionState === "disconnected"
        ) {
          sounds.stopLoopingSound();
        }

        setActiveCall((current) => {
          if (!current || current.callId !== call.id) {
            return current;
          }

          if (connectionState === "connected") {
            return { ...current, statusText: "Connected" };
          }

          if (connectionState === "failed") {
            return { ...current, statusText: "Connection failed" };
          }

          if (connectionState === "disconnected") {
            return { ...current, statusText: "Connection lost" };
          }

          return current;
        });
      };

      setActiveCall({
        callId: call.id,
        statusText: "Connecting...",
      });
      setIncomingCall(call);
    } catch (error: unknown) {
      stopMediaStream(localStream);
      setIncomingBusyId(null);
      notifications.show({
        title: "Answer failed",
        message: errorMessage(error, "Could not answer this call."),
        color: "red",
      });
    }
  };

  const handleDecline = async (callId: number) => {
    setIncomingBusyId(callId);
    try {
      const response = await fetch(
        `/api/language-exchange/direct/call/${callId}/decline`,
        {
          method: "POST",
        },
      );
      await readJsonOrThrow<{ ok: true }>(response);
      setIncomingCall((current) =>
        current?.id === callId ? null : current,
      );
    } catch (error: unknown) {
      notifications.show({
        title: "Decline failed",
        message: errorMessage(error, "Could not decline this call."),
        color: "red",
      });
    } finally {
      setIncomingBusyId(null);
    }
  };

  const handleHangUp = async () => {
    const callId = activeCall?.callId;
    cleanupCallResources();
    setActiveCall(null);
    setServerActiveCall(null);
    void sounds.playHangupTone();

    if (!callId) {
      return;
    }

    try {
      const response = await fetch(
        `/api/language-exchange/direct/call/${callId}/end`,
        {
          method: "POST",
        },
      );
      await readJsonOrThrow<{ ok: true }>(response);
    } catch (error: unknown) {
      notifications.show({
        title: "Hang up failed",
        message: errorMessage(error, "Could not end the call cleanly."),
        color: "red",
      });
    }
  };

  const stopScreenShare = React.useCallback(async () => {
    stopMediaStream(screenShareStreamRef.current);
    screenShareStreamRef.current = null;
    setIsSharingScreen(false);

    const sender = screenShareSenderRef.current;
    if (!sender) {
      return;
    }

    const placeholderTrack =
      ensurePlaceholderVideoStream()?.getVideoTracks()[0] ?? null;
    await sender.replaceTrack(placeholderTrack).catch(() => undefined);
  }, [ensurePlaceholderVideoStream]);

  const handleToggleScreenShare = async () => {
    if (isSharingScreen) {
      await stopScreenShare();
      return;
    }

    const sender = screenShareSenderRef.current;
    const peer = peerRef.current;
    if (!sender || !peer || peer.connectionState !== "connected") {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const [track] = stream.getVideoTracks();
      if (!track) {
        stopMediaStream(stream);
        return;
      }

      track.onended = () => {
        void stopScreenShare();
      };

      await sender.replaceTrack(track);
      screenShareStreamRef.current = stream;
      setIsSharingScreen(true);
    } catch (error: unknown) {
      notifications.show({
        title: "Screen share failed",
        message: errorMessage(error, "Could not share your study screen."),
        color: "red",
      });
    }
  };

  const showIncomingPrompt =
    isLeader && isEnabled && !activeCall && incomingCall !== null;

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
    <LanguageExchangeDirectView
      activeCall={activeCall}
      handleAnswer={handleAnswer}
      handleDecline={handleDecline}
      handleHangUp={handleHangUp}
      handleToggleScreenShare={handleToggleScreenShare}
      incomingBusyId={incomingBusyId}
      incomingCall={incomingCall}
      isSharingScreen={isSharingScreen}
      remoteAudioRef={remoteAudioRef}
      showIncomingPrompt={showIncomingPrompt}
    >
      {children}
    </LanguageExchangeDirectView>
  );
}
