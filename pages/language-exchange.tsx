import { SectionCard } from "@/koala/components/SectionCard";
import {
  debugLanguageExchange,
  LANGUAGE_EXCHANGE_CONNECT_POLL_INTERVAL_MS,
  LANGUAGE_EXCHANGE_POLL_INTERVAL_MS,
  SessionDescriptionPayload,
} from "@/koala/language-exchange";
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
import * as React from "react";

type GuestRequestState = {
  requestId: number;
  guestToken: string;
  status: "WAITING" | "MATCHED" | "ENDED" | "CANCELLED" | "EXPIRED";
  expiresAt: string;
  matched: boolean;
  learnerAnswerSdp: SessionDescriptionPayload | null;
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const json = (await response.json()) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(json.error || "Request failed.");
  }

  return json as T;
}

export default function LanguageExchangePage() {
  const [availableLearners, setAvailableLearners] = React.useState<
    number | null
  >(null);
  const [loadingCount, setLoadingCount] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [guestRequest, setGuestRequest] =
    React.useState<GuestRequestState | null>(null);
  const [callStatusText, setCallStatusText] =
    React.useState<string>("준비됨");
  const peerRef = React.useRef<RTCPeerConnection | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const appliedAnswerSdpRef = React.useRef<string | null>(null);
  const preparedOfferSdpRef = React.useRef<string | null>(null);
  const offerUploadedForRequestIdRef = React.useRef<number | null>(null);
  const latestGuestRequestRef = React.useRef<GuestRequestState | null>(
    null,
  );
  const sounds = useLanguageExchangeSounds();

  React.useEffect(() => {
    latestGuestRequestRef.current = guestRequest;
  }, [guestRequest]);

  const cleanupCallResources = React.useCallback(() => {
    sounds.stopLoopingSound();
    peerRef.current?.close();
    peerRef.current = null;
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    appliedAnswerSdpRef.current = null;
    preparedOfferSdpRef.current = null;
    offerUploadedForRequestIdRef.current = null;
  }, [sounds]);

  React.useEffect(() => {
    return () => {
      const request = latestGuestRequestRef.current;
      if (request) {
        void fetch("/api/language-exchange/guest-end", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: request.requestId,
            guestToken: request.guestToken,
          }),
          keepalive: true,
        }).catch(() => undefined);
      }

      cleanupCallResources();
    };
  }, [cleanupCallResources]);

  React.useEffect(() => {
    let cancelled = false;

    const loadCount = async () => {
      try {
        const response = await fetch("/api/language-exchange/available", {
          cache: "no-store",
        });
        const data = await readJsonOrThrow<{
          availableLearners: number;
        }>(response);
        if (!cancelled) {
          debugLanguageExchange("guest.available.loaded", {
            availableLearners: data.availableLearners,
          });
          setAvailableLearners(data.availableLearners);
        }
      } catch {
        if (!cancelled) {
          debugLanguageExchange("guest.available.failed");
          setAvailableLearners(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingCount(false);
        }
      }
    };

    void loadCount();
    const intervalId = window.setInterval(
      () => void loadCount(),
      LANGUAGE_EXCHANGE_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  React.useEffect(() => {
    if (!guestRequest) {
      return;
    }

    let cancelled = false;

    const pollStatus = async () => {
      try {
        const params = new URLSearchParams({
          requestId: String(guestRequest.requestId),
          guestToken: guestRequest.guestToken,
        });
        const response = await fetch(
          `/api/language-exchange/guest-status?${params.toString()}`,
          {
            cache: "no-store",
          },
        );
        const data = await readJsonOrThrow<{
          request: GuestRequestState;
        }>(response);

        if (!cancelled) {
          debugLanguageExchange("guest.status.polled", {
            requestId: data.request.requestId,
            status: data.request.status,
            matched: data.request.matched,
            hasLearnerAnswer: Boolean(data.request.learnerAnswerSdp),
          });
          setGuestRequest(data.request);
        }
      } catch (error: unknown) {
        debugLanguageExchange("guest.status.poll-failed", {
          message: errorMessage(
            error,
            "Could not refresh language exchange status.",
          ),
        });
        if (!cancelled) {
          notifications.show({
            title: "통화 상태를 불러오지 못했습니다",
            message: errorMessage(
              error,
              "언어 교환 통화 상태를 새로고침하지 못했습니다.",
            ),
            color: "red",
          });
        }
      }
    };

    void pollStatus();
    const intervalId = window.setInterval(
      () => void pollStatus(),
      LANGUAGE_EXCHANGE_CONNECT_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [guestRequest?.guestToken, guestRequest?.requestId]);

  React.useEffect(() => {
    if (!guestRequest) {
      return;
    }

    debugLanguageExchange("guest.status.changed", {
      requestId: guestRequest.requestId,
      status: guestRequest.status,
      matched: guestRequest.matched,
      hasLearnerAnswer: Boolean(guestRequest.learnerAnswerSdp),
    });

    if (guestRequest.status === "WAITING") {
      if (!peerRef.current) {
        setCallStatusText("학습자를 찾는 중...");
      }
      return;
    }

    if (guestRequest.status === "MATCHED") {
      if (peerRef.current?.connectionState !== "connected") {
        setCallStatusText("연결 중...");
      }
      return;
    }

    if (guestRequest.status === "EXPIRED") {
      void sounds.playHangupTone();
      notifications.show({
        title: "아직 연결되지 않았습니다",
        message: "응답한 학습자가 없습니다. 다시 시도해 주세요.",
        color: "gray",
      });
      cleanupCallResources();
      setGuestRequest(null);
      setCallStatusText("준비됨");
      return;
    }

    if (guestRequest.status === "ENDED") {
      void sounds.playHangupTone();
      notifications.show({
        title: "통화가 종료되었습니다",
        message: "학습자가 통화를 종료했습니다.",
        color: "gray",
      });
      cleanupCallResources();
      setGuestRequest(null);
      setCallStatusText("준비됨");
      return;
    }

    if (guestRequest.status === "CANCELLED") {
      void sounds.playHangupTone();
      cleanupCallResources();
      setGuestRequest(null);
      setCallStatusText("준비됨");
    }
  }, [cleanupCallResources, guestRequest, sounds]);

  React.useEffect(() => {
    if (!guestRequest || guestRequest.status !== "MATCHED") {
      return;
    }

    if (offerUploadedForRequestIdRef.current === guestRequest.requestId) {
      return;
    }

    const preparedOfferSdp = preparedOfferSdpRef.current;
    if (!preparedOfferSdp) {
      return;
    }

    let cancelled = false;

    const uploadOffer = async () => {
      try {
        offerUploadedForRequestIdRef.current = guestRequest.requestId;
        debugLanguageExchange("guest.offer.upload-start", {
          requestId: guestRequest.requestId,
          offerLength: preparedOfferSdp.length,
        });
        const response = await fetch(
          "/api/language-exchange/guest-offer",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requestId: guestRequest.requestId,
              guestToken: guestRequest.guestToken,
              offer: {
                type: "offer",
                sdp: preparedOfferSdp,
              },
            }),
          },
        );
        await readJsonOrThrow<{ ok: true }>(response);
        debugLanguageExchange("guest.offer.uploaded", {
          requestId: guestRequest.requestId,
        });
        if (!cancelled) {
          setCallStatusText("연결 중...");
        }
      } catch (error: unknown) {
        debugLanguageExchange("guest.offer.upload-failed", {
          requestId: guestRequest.requestId,
          message: errorMessage(
            error,
            "Could not send language exchange offer.",
          ),
        });
        notifications.show({
          title: "통화 연결에 실패했습니다",
          message: errorMessage(
            error,
            "언어 교환 통화 요청을 보내지 못했습니다.",
          ),
          color: "red",
        });
        cleanupCallResources();
        setGuestRequest(null);
        setCallStatusText("준비됨");
      }
    };

    void uploadOffer();

    return () => {
      cancelled = true;
    };
  }, [cleanupCallResources, guestRequest]);

  React.useEffect(() => {
    const answer = guestRequest?.learnerAnswerSdp;
    const peer = peerRef.current;

    if (!guestRequest || !answer || !peer) {
      return;
    }

    if (appliedAnswerSdpRef.current === answer.sdp) {
      return;
    }

    let cancelled = false;

    const applyAnswer = async () => {
      try {
        appliedAnswerSdpRef.current = answer.sdp;
        debugLanguageExchange("guest.answer.apply-start", {
          requestId: guestRequest.requestId,
          answerLength: answer.sdp.length,
        });
        await peer.setRemoteDescription(answer);
        debugLanguageExchange("guest.answer.applied", {
          requestId: guestRequest.requestId,
        });
        if (!cancelled) {
          setCallStatusText("연결 중...");
        }
      } catch (error: unknown) {
        debugLanguageExchange("guest.answer.apply-failed", {
          requestId: guestRequest.requestId,
          message: errorMessage(error, "Could not apply learner answer."),
        });
        notifications.show({
          title: "통화 연결에 실패했습니다",
          message: errorMessage(error, "통화 연결을 완료하지 못했습니다."),
          color: "red",
        });
        cleanupCallResources();
        setGuestRequest(null);
        setCallStatusText("준비됨");
      }
    };

    void applyAnswer();

    return () => {
      cancelled = true;
    };
  }, [cleanupCallResources, guestRequest]);

  const handleConnect = async () => {
    setConnecting(true);
    debugLanguageExchange("guest.connect.start");

    let localStream: MediaStream | null = null;
    let peer: RTCPeerConnection | null = null;

    try {
      cleanupCallResources();
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      debugLanguageExchange("guest.connect.mic-granted");
      const stream = localStream;

      const nextPeer = new RTCPeerConnection({
        iceServers: languageExchangeIceServers,
      });
      debugLanguageExchange("guest.connect.peer-created");
      peer = nextPeer;
      peerRef.current = nextPeer;
      localStreamRef.current = stream;

      stream.getTracks().forEach((track) => {
        nextPeer.addTrack(track, stream);
      });

      nextPeer.ontrack = (event) => {
        const [stream] = event.streams;
        debugLanguageExchange("guest.remote-track", {
          streamId: stream?.id ?? null,
        });
        if (stream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          void remoteAudioRef.current.play().catch(() => undefined);
        }
      };

      nextPeer.onconnectionstatechange = () => {
        debugLanguageExchange("guest.connection-state", {
          state: nextPeer.connectionState,
        });
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
      preparedOfferSdpRef.current = nextPeer.localDescription.sdp;
      debugLanguageExchange("guest.offer.prepared", {
        offerLength: nextPeer.localDescription.sdp.length,
      });

      const response = await fetch("/api/language-exchange/start", {
        method: "POST",
      });
      const data = await readJsonOrThrow<{
        requestId: number;
        guestToken: string;
        status: GuestRequestState["status"];
        expiresAt: string;
      }>(response);
      debugLanguageExchange("guest.request.created", {
        requestId: data.requestId,
        status: data.status,
      });
      void sounds.startRingbackTone();

      localStreamRef.current = stream;
      setGuestRequest({
        requestId: data.requestId,
        guestToken: data.guestToken,
        status: data.status,
        expiresAt: data.expiresAt,
        matched: false,
        learnerAnswerSdp: null,
      });
      setCallStatusText("학습자를 찾는 중...");
    } catch (error: unknown) {
      debugLanguageExchange("guest.connect.failed", {
        message: errorMessage(error, "Could not start language exchange."),
      });
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
    const currentRequest = guestRequest;
    debugLanguageExchange("guest.end", {
      requestId: currentRequest?.requestId ?? null,
    });
    cleanupCallResources();
    setGuestRequest(null);
    setCallStatusText("준비됨");
    void sounds.playHangupTone();

    if (!currentRequest) {
      return;
    }

    try {
      const response = await fetch("/api/language-exchange/guest-end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: currentRequest.requestId,
          guestToken: currentRequest.guestToken,
        }),
      });
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

  const availableCount = availableLearners ?? 0;
  const availableText = loadingCount
    ? "가능한 학습자를 확인하는 중..."
    : `${availableCount}명의 한국어 학습자가 언어 교환 가능합니다`;

  return (
    <Container size="sm" py="xl">
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
            한국어를 배우는 영어 원어민 학습자와 대화해 보세요.
          </Text>
        </Stack>

        <SectionCard
          title="현재 가능 인원"
          description="학습자가 준비되면 바로 연결할 수 있습니다."
          action={
            guestRequest ? (
              <Badge color="pink">{callStatusText}</Badge>
            ) : undefined
          }
        >
          <Stack gap="md">
            <Text fw={600}>{availableText}</Text>
            {guestRequest ? (
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
                >
                  연결하기
                </Button>
              </Group>
            )}
            <Text size="sm" c="dimmed">
              {guestRequest
                ? "연결되는 동안 이 페이지를 열어 두세요."
                : "연결할 때 마이크 권한을 요청합니다."}
            </Text>
          </Stack>
        </SectionCard>
      </Stack>
    </Container>
  );
}
