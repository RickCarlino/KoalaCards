import { SectionCard } from "@/koala/components/SectionCard";
import {
  DIRECT_LANGUAGE_EXCHANGE_CONNECT_POLL_INTERVAL_MS,
  DIRECT_LANGUAGE_EXCHANGE_STATUS_POLL_INTERVAL_MS,
  DirectLanguageExchangeAvailabilityStatus,
} from "@/koala/language-exchange-direct";
import {
  DirectLanguageExchangeCallState,
  errorMessage,
  readJsonOrThrow,
} from "@/koala/language-exchange-direct-client";
import {
  languageExchangeIceServers,
  stopMediaStream,
  waitForIceGatheringComplete,
} from "@/koala/language-exchange-client";
import { useLanguageExchangeSounds } from "@/koala/language-exchange-sounds";
import {
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconLanguage,
  IconPhoneCall,
  IconPhoneOff,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import * as React from "react";
import { findLanguageExchangeLinkBySlug } from "@/koala/language-exchange-direct-server";
import {
  resolveGuestCallCompletion,
  resolveGuestCallProgressStatus,
} from "@/koala/language-exchange/guest-call-status";

type DirectGuestCall = DirectLanguageExchangeCallState & {
  guestToken: string;
};

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const slug =
    typeof context.params?.slug === "string" ? context.params.slug : null;
  if (!slug) {
    return { notFound: true };
  }

  const link = await findLanguageExchangeLinkBySlug(slug);
  if (!link) {
    return { notFound: true };
  }

  return {
    props: {
      slug,
    },
  };
}

export default function DirectLanguageExchangePage({
  slug,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [availabilityStatus, setAvailabilityStatus] =
    React.useState<DirectLanguageExchangeAvailabilityStatus>("offline");
  const [loadingStatus, setLoadingStatus] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [guestCall, setGuestCall] = React.useState<DirectGuestCall | null>(
    null,
  );
  const [callStatusText, setCallStatusText] =
    React.useState<string>("준비됨");
  const peerRef = React.useRef<RTCPeerConnection | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const remoteVideoContainerRef = React.useRef<HTMLDivElement | null>(
    null,
  );
  const appliedAnswerSdpRef = React.useRef<string | null>(null);
  const latestGuestCallRef = React.useRef<DirectGuestCall | null>(null);
  const [remoteVideoStream, setRemoteVideoStream] =
    React.useState<MediaStream | null>(null);
  const sounds = useLanguageExchangeSounds();

  React.useEffect(() => {
    latestGuestCallRef.current = guestCall;
  }, [guestCall]);

  const cleanupCallResources = React.useCallback(() => {
    sounds.stopLoopingSound();
    peerRef.current?.close();
    peerRef.current = null;
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    appliedAnswerSdpRef.current = null;
    setRemoteVideoStream(null);
  }, [sounds]);

  React.useEffect(() => {
    if (!remoteVideoRef.current) {
      return;
    }

    if (!remoteVideoStream) {
      remoteVideoRef.current.srcObject = null;
      return;
    }

    if (remoteVideoRef.current.srcObject !== remoteVideoStream) {
      remoteVideoRef.current.srcObject = remoteVideoStream;
    }
    void remoteVideoRef.current.play().catch(() => undefined);
  }, [remoteVideoStream]);

  const handleExpandVideo = async () => {
    const container = remoteVideoContainerRef.current;
    if (!container || !remoteVideoStream) {
      return;
    }

    if (document.fullscreenElement === container) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await container.requestFullscreen?.().catch(() => undefined);
  };

  React.useEffect(() => {
    return () => {
      const call = latestGuestCallRef.current;
      if (call) {
        void fetch(`/api/language-exchange/direct/call/${call.id}/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            guestToken: call.guestToken,
          }),
          keepalive: true,
        }).catch(() => undefined);
      }

      cleanupCallResources();
    };
  }, [cleanupCallResources]);

  React.useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await fetch(
          `/api/language-exchange/direct/link/${slug}/status`,
          {
            cache: "no-store",
          },
        );
        const data = await readJsonOrThrow<{
          status: DirectLanguageExchangeAvailabilityStatus;
        }>(response);
        if (!cancelled) {
          setAvailabilityStatus(data.status);
        }
      } catch {
        if (!cancelled) {
          setAvailabilityStatus("offline");
        }
      } finally {
        if (!cancelled) {
          setLoadingStatus(false);
        }
      }
    };

    void loadStatus();
    const intervalId = window.setInterval(
      () => void loadStatus(),
      DIRECT_LANGUAGE_EXCHANGE_STATUS_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [slug]);

  React.useEffect(() => {
    if (!guestCall) {
      return;
    }

    let cancelled = false;

    const pollState = async () => {
      try {
        const params = new URLSearchParams({
          guestToken: guestCall.guestToken,
        });
        const response = await fetch(
          `/api/language-exchange/direct/call/${guestCall.id}/guest-state?${params.toString()}`,
          {
            cache: "no-store",
          },
        );
        const data = await readJsonOrThrow<{
          call: DirectLanguageExchangeCallState;
        }>(response);
        if (!cancelled) {
          setGuestCall({
            ...data.call,
            guestToken: guestCall.guestToken,
          });
        }
      } catch (error: unknown) {
        if (!cancelled) {
          notifications.show({
            title: "통화 상태를 불러오지 못했습니다",
            message: errorMessage(
              error,
              "통화 상태를 새로고침하지 못했습니다.",
            ),
            color: "red",
          });
        }
      }
    };

    void pollState();
    const intervalId = window.setInterval(
      () => void pollState(),
      DIRECT_LANGUAGE_EXCHANGE_CONNECT_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [guestCall?.guestToken, guestCall?.id]);

  React.useEffect(() => {
    if (!guestCall) {
      return;
    }

    const progressStatus = resolveGuestCallProgressStatus({
      status: guestCall.status,
      connectionState: peerRef.current?.connectionState ?? null,
      hasPeer: Boolean(peerRef.current),
    });
    if (progressStatus) {
      setCallStatusText(progressStatus);
      return;
    }

    const completion = resolveGuestCallCompletion(guestCall.status);
    if (!completion) {
      return;
    }

    if (completion.playHangupTone) {
      void sounds.playHangupTone();
    }
    if (completion.notification) {
      notifications.show(completion.notification);
    }

    cleanupCallResources();
    setGuestCall(null);
    setCallStatusText("준비됨");
  }, [cleanupCallResources, guestCall, sounds]);

  React.useEffect(() => {
    const answer = guestCall?.answerSdp;
    const peer = peerRef.current;

    if (!guestCall || !answer || !peer) {
      return;
    }

    if (appliedAnswerSdpRef.current === answer.sdp) {
      return;
    }

    let cancelled = false;

    const applyAnswer = async () => {
      try {
        appliedAnswerSdpRef.current = answer.sdp;
        await peer.setRemoteDescription(answer);
        if (!cancelled) {
          setCallStatusText("연결 중...");
        }
      } catch (error: unknown) {
        notifications.show({
          title: "통화 연결에 실패했습니다",
          message: errorMessage(error, "통화 연결을 완료하지 못했습니다."),
          color: "red",
        });
        cleanupCallResources();
        setGuestCall(null);
        setCallStatusText("준비됨");
      }
    };

    void applyAnswer();

    return () => {
      cancelled = true;
    };
  }, [cleanupCallResources, guestCall]);

  const handleConnect = async () => {
    setConnecting(true);

    let localStream: MediaStream | null = null;
    let peer: RTCPeerConnection | null = null;

    try {
      cleanupCallResources();
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const stream = localStream;

      const nextPeer = new RTCPeerConnection({
        iceServers: languageExchangeIceServers,
      });
      nextPeer.addTransceiver("video", {
        direction: "recvonly",
      });
      peer = nextPeer;
      peerRef.current = nextPeer;
      localStreamRef.current = stream;

      stream.getTracks().forEach((track) => {
        nextPeer.addTrack(track, stream);
      });

      nextPeer.ontrack = (event) => {
        const [stream] = event.streams;
        if (event.track.kind === "video") {
          const nextVideoStream = stream ?? new MediaStream([event.track]);
          setRemoteVideoStream(nextVideoStream);
          event.track.onended = () => {
            setRemoteVideoStream(null);
          };
          return;
        }

        if (stream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          void remoteAudioRef.current.play().catch(() => undefined);
        }
      };

      nextPeer.onconnectionstatechange = () => {
        if (nextPeer.connectionState === "connected") {
          sounds.stopLoopingSound();
          void sounds.playConnectedTone();
          setCallStatusText("연결됨");
          return;
        }

        if (nextPeer.connectionState === "failed") {
          sounds.stopLoopingSound();
          setCallStatusText("연결 실패");
          return;
        }

        if (nextPeer.connectionState === "disconnected") {
          sounds.stopLoopingSound();
          setCallStatusText("연결 끊김");
        }
      };

      const offer = await nextPeer.createOffer({
        offerToReceiveAudio: true,
      });
      await nextPeer.setLocalDescription(offer);
      await waitForIceGatheringComplete(nextPeer);
      if (!nextPeer.localDescription?.sdp) {
        throw new Error("Offer generation failed.");
      }

      const response = await fetch(
        `/api/language-exchange/direct/link/${slug}/call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            offer: {
              type: "offer",
              sdp: nextPeer.localDescription.sdp,
            },
          }),
        },
      );
      const data = await readJsonOrThrow<{
        callId: number;
        guestToken: string;
        status: DirectGuestCall["status"];
        createdAt: string;
        expiresAt: string;
      }>(response);

      void sounds.startRingbackTone();

      setGuestCall({
        id: data.callId,
        guestToken: data.guestToken,
        status: data.status,
        createdAt: data.createdAt,
        acceptedAt: null,
        endedAt: null,
        expiresAt: data.expiresAt,
        offerSdp: null,
        answerSdp: null,
      });
      setCallStatusText("연결 중...");
    } catch (error: unknown) {
      sounds.stopLoopingSound();
      peer?.close();
      stopMediaStream(localStream);
      notifications.show({
        title: "연결을 시작하지 못했습니다",
        message: errorMessage(error, "언어 교환을 시작하지 못했습니다."),
        color: "red",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleEnd = async () => {
    const currentCall = guestCall;
    cleanupCallResources();
    setGuestCall(null);
    setCallStatusText("준비됨");
    void sounds.playHangupTone();

    if (!currentCall) {
      return;
    }

    try {
      const response = await fetch(
        `/api/language-exchange/direct/call/${currentCall.id}/end`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            guestToken: currentCall.guestToken,
          }),
        },
      );
      await readJsonOrThrow<{ ok: true }>(response);
    } catch (error: unknown) {
      notifications.show({
        title: "통화를 종료하지 못했습니다",
        message: errorMessage(
          error,
          "통화를 정상적으로 종료하지 못했습니다.",
        ),
        color: "red",
      });
    }
  };

  const availabilityText = loadingStatus
    ? "학습자 상태를 확인하는 중..."
    : availabilityStatus === "available"
      ? "지금 바로 연결할 수 있습니다"
      : availabilityStatus === "busy"
        ? "지금은 다른 통화 중입니다"
        : "지금은 연결할 수 없습니다";

  const canStartCall = !guestCall && availabilityStatus === "available";

  return (
    <Container size={remoteVideoStream ? "lg" : "sm"} py="xl">
      <audio ref={remoteAudioRef} autoPlay playsInline hidden />
      <Stack gap="xl">
        <Stack gap="sm" align="center">
          <ThemeIcon color="pink" size={56} radius="xl">
            <IconLanguage size={28} />
          </ThemeIcon>
          <Title order={2} ta="center">
            한국어 언어 교환
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            준비된 학습자와 바로 대화해 보세요.
          </Text>
        </Stack>

        <SectionCard
          title="현재 상태"
          description="학습자가 온라인이면 바로 연결됩니다."
          action={
            guestCall ? (
              <Badge color="pink">{callStatusText}</Badge>
            ) : undefined
          }
        >
          <Stack gap="md">
            <Text fw={600}>{availabilityText}</Text>
            {guestCall ? (
              <Group>
                <Button
                  color="red"
                  leftSection={<IconPhoneOff size={16} />}
                  onClick={handleEnd}
                >
                  통화 종료
                </Button>
              </Group>
            ) : (
              <Group>
                <Button
                  color="pink"
                  leftSection={<IconPhoneCall size={16} />}
                  onClick={handleConnect}
                  loading={connecting}
                  disabled={!canStartCall}
                >
                  연결하기
                </Button>
              </Group>
            )}
            <Text size="sm" c="dimmed">
              {guestCall
                ? "연결되는 동안 이 페이지를 열어 두세요."
                : "연결할 때 마이크 권한을 요청합니다."}
            </Text>
          </Stack>
        </SectionCard>

        {remoteVideoStream ? (
          <SectionCard
            title="학습 화면"
            description="학습자가 공유한 화면입니다."
            action={
              <Button
                size="xs"
                variant="light"
                onClick={() => void handleExpandVideo()}
              >
                크게 보기
              </Button>
            }
          >
            <div ref={remoteVideoContainerRef}>
              <Paper radius="md" withBorder style={{ overflow: "hidden" }}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    aspectRatio: "16 / 9",
                    background: "#111",
                    display: "block",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    width: "100%",
                  }}
                />
              </Paper>
            </div>
          </SectionCard>
        ) : null}
      </Stack>
    </Container>
  );
}
