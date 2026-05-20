export type GuestCallStatus =
  | "RINGING"
  | "ACTIVE"
  | "DECLINED"
  | "EXPIRED"
  | "ENDED"
  | "CANCELLED"
  | string;

export type GuestCallCompletion = {
  notification: {
    title: string;
    message: string;
    color: "gray";
  } | null;
  playHangupTone: boolean;
};

export function resolveGuestCallProgressStatus(options: {
  status: GuestCallStatus;
  connectionState: string | null;
  hasPeer: boolean;
}): string | null {
  if (options.status === "RINGING") {
    if (!options.hasPeer) {
      return "연결 준비 중...";
    }
    if (options.connectionState !== "connected") {
      return "연결 중...";
    }
  }

  if (
    options.status === "ACTIVE" &&
    options.connectionState !== "connected"
  ) {
    return "연결 중...";
  }

  return null;
}

export function resolveGuestCallCompletion(
  status: GuestCallStatus,
): GuestCallCompletion | null {
  if (status === "DECLINED") {
    return {
      notification: {
        title: "통화가 거절되었습니다",
        message: "학습자가 지금은 통화를 받을 수 없습니다.",
        color: "gray",
      },
      playHangupTone: true,
    };
  }

  if (status === "EXPIRED") {
    return {
      notification: {
        title: "응답이 없습니다",
        message: "학습자가 통화에 응답하지 않았습니다.",
        color: "gray",
      },
      playHangupTone: true,
    };
  }

  if (status === "ENDED") {
    return {
      notification: {
        title: "통화가 종료되었습니다",
        message: "학습자가 통화를 종료했습니다.",
        color: "gray",
      },
      playHangupTone: true,
    };
  }

  if (status === "CANCELLED") {
    return {
      notification: null,
      playHangupTone: true,
    };
  }

  return null;
}
