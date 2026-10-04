import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { SectionCard } from "@/koala/components/SectionCard";
import { getLanguageExchangePublicPath } from "@/koala/language-exchange-direct";
import { ensureLanguageExchangeLink } from "@/koala/language-exchange-direct-server";
import { prismaClient } from "@/koala/prisma-client";
import { combineReaderHighlightDates } from "@/koala/reader/activity";
import {
  REVIEW_TAKE_MAX,
  REVIEW_TAKE_MIN,
} from "@/koala/settings/review-take";
import {
  REQUESTED_RETENTION_MAX,
  REQUESTED_RETENTION_MIN,
  clampRequestedRetention,
  resolveRequestedRetention,
} from "@/koala/settings/requested-retention";
import { trpc } from "@/koala/trpc-config";
import { getLessonMeta } from "@/koala/trpc-routes/get-next-quizzes";
import { AreaChart } from "@mantine/charts";
import {
  Avatar,
  Badge,
  Button,
  Container,
  Grid,
  Group,
  InputLabel,
  NumberInput,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { GetServerSidePropsContext } from "next";
import { getSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

type ChartDataPoint = { date: string; count: number };

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function baseUrlFromRequest(
  request: GetServerSidePropsContext["req"],
): string {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  const forwardedHost = request.headers["x-forwarded-host"];
  const forwardedProto = request.headers["x-forwarded-proto"];
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || request.headers.host || "localhost:3000";
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || (host.includes("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

function buildCumulativeChartDataFromSortedDates(options: {
  startDate: Date;
  endDate: Date;
  sortedDates: Date[];
}): ChartDataPoint[] {
  const { startDate, endDate, sortedDates } = options;
  const chartData: ChartDataPoint[] = [];
  let cumulativeCount = 0;
  let dateIndex = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateString = formatDate(currentDate);
    const currentDayEnd = new Date(currentDate);
    currentDayEnd.setHours(23, 59, 59, 999);

    while (
      dateIndex < sortedDates.length &&
      sortedDates[dateIndex] <= currentDayEnd
    ) {
      cumulativeCount += 1;
      dateIndex += 1;
    }

    chartData.push({
      date: dateString,
      count: cumulativeCount,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return chartData;
}

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const session = await getSession({ req: context.req });
  if (!session?.user?.email) {
    return { redirect: { destination: "/", permanent: false } };
  }
  const userSettings = await getUserSettingsFromEmail(session.user.email);
  if (!userSettings) {
    return { redirect: { destination: "/", permanent: false } };
  }
  const userId = userSettings.userId;

  async function getUserCardStatistics(userId: string) {
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - ONE_WEEK);
    const yesterday = new Date(today.getTime() - ONE_DAY);
    const tomorrow = new Date(today.getTime() + ONE_DAY);
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    const BASE_QUERY = {
      userId: userId,
      paused: { not: true },
    } as const;

    const cardsDueNext24Hours = await prismaClient.card.count({
      where: {
        ...BASE_QUERY,
        nextReview: { lt: tomorrow.getTime() },
        firstReview: { gt: 0 },
      },
    });
    const newCardsLast24Hours = (
      await prismaClient.card.findMany({
        select: { id: true },
        where: {
          userId,
          firstReview: { gte: yesterday.getTime() },
        },
        distinct: ["id"],
      })
    ).length;
    const newCardsLastWeek = (
      await prismaClient.card.findMany({
        select: { id: true },
        where: {
          userId,
          firstReview: { gte: oneWeekAgo.getTime() },
        },
        distinct: ["id"],
      })
    ).length;
    const uniqueCardsLast24Hours = await prismaClient.card.count({
      where: {
        ...BASE_QUERY,
        lastReview: { gte: yesterday.getTime() },
      },
    });
    const uniqueCardsLastWeek = await prismaClient.card.count({
      where: {
        ...BASE_QUERY,
        lastReview: { gte: oneWeekAgo.getTime() },
      },
    });

    const recentLearnedQuizzes = await prismaClient.card.findMany({
      where: {
        userId,
        firstReview: { gte: threeMonthsAgo.getTime() },
      },
      select: {
        id: true,
        firstReview: true,
      },
      orderBy: {
        firstReview: "asc",
      },
    });

    const firstLearnedDates: Record<string, Date> = {};
    for (const card of recentLearnedQuizzes) {
      if (card.firstReview && !firstLearnedDates[card.id]) {
        firstLearnedDates[card.id] = new Date(card.firstReview);
      }
    }

    const sortedLearnedDates = Object.values(firstLearnedDates).sort(
      (a, b) => a.getTime() - b.getTime(),
    );
    const endDate = new Date();
    const cardChartData = buildCumulativeChartDataFromSortedDates({
      startDate: threeMonthsAgo,
      endDate,
      sortedDates: sortedLearnedDates,
    });

    const writingSubmissions =
      await prismaClient.writingSubmission.findMany({
        where: {
          userId: userId,
          createdAt: {
            gte: threeMonthsAgo,
          },
        },
        select: {
          createdAt: true,
          correctionCharacterCount: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

    const dailyWritingData: Record<string, number> = {};

    const initDate = new Date(threeMonthsAgo);
    while (initDate <= endDate) {
      dailyWritingData[formatDate(initDate)] = 0;
      initDate.setDate(initDate.getDate() + 1);
    }

    for (const submission of writingSubmissions) {
      const submissionDate = formatDate(submission.createdAt);
      dailyWritingData[submissionDate] =
        (dailyWritingData[submissionDate] || 0) +
        submission.correctionCharacterCount;
    }

    const cumulativeWritingData: ChartDataPoint[] = [];
    let cumulativeWritingCount = 0;

    const currentDate = new Date(threeMonthsAgo);
    while (currentDate <= endDate) {
      const dateString = formatDate(currentDate);
      cumulativeWritingCount += dailyWritingData[dateString] || 0;

      cumulativeWritingData.push({
        date: dateString,
        count: cumulativeWritingCount,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const writingChartData = cumulativeWritingData;
    const [articleHighlights, bookHighlights] = await Promise.all([
      prismaClient.readerArticleHighlight.findMany({
        where: {
          userId,
          createdAt: {
            gte: threeMonthsAgo,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      prismaClient.readerBookAnnotation.findMany({
        where: {
          userId,
          createdAt: {
            gte: threeMonthsAgo,
          },
        },
        select: {
          createdAt: true,
        },
      }),
    ]);
    const sortedReaderHighlightDates = combineReaderHighlightDates({
      articles: articleHighlights.map((highlight) => highlight.createdAt),
      books: bookHighlights.map((highlight) => highlight.createdAt),
    });
    const readerChartData = buildCumulativeChartDataFromSortedDates({
      startDate: threeMonthsAgo,
      endDate,
      sortedDates: sortedReaderHighlightDates,
    });

    const weeklyTarget = userSettings.cardsPerDayMax * 7;
    const statistics = {
      ...(await getLessonMeta(userId)),
      uniqueCardsLast24Hours,
      uniqueCardsLastWeek,
      newCardsLast24Hours,
      newCardsLastWeek: `${newCardsLastWeek} / ${weeklyTarget}`,
      cardsDueNext24Hours,
      globalUsers: await prismaClient.user.count(),
    };

    return {
      statistics,
      cardChartData,
      writingChartData,
      readerChartData,
    };
  }

  const { statistics, cardChartData, writingChartData, readerChartData } =
    await getUserCardStatistics(userId);
  const languageExchangeLink = await ensureLanguageExchangeLink(userId);
  const languageExchangeUrl = new URL(
    getLanguageExchangePublicPath(languageExchangeLink.slug),
    baseUrlFromRequest(context.req),
  ).toString();

  return {
    props: {
      userSettings: JSON.parse(JSON.stringify(userSettings)),
      stats: statistics,
      cardChartData: cardChartData,
      writingChartData: writingChartData,
      readerChartData: readerChartData,
      languageExchangeUrl,
    },
  };
}
type Props = Awaited<ReturnType<typeof getServerSideProps>>["props"] & {
  cardChartData: ChartDataPoint[];
  writingChartData: ChartDataPoint[];
  readerChartData: ChartDataPoint[];
  languageExchangeUrl: string;
};

type SettingsFormValues = {
  playbackSpeed: number;
  cardsPerDayMax: number;
  maxLapses: number;
  reviewTakeCount: number;
  requestedRetention: number;
  dailyWritingGoal: number;
  playbackPercentage: number;
  responseTimeoutSeconds: number;
  writingFirst: boolean;
  dueCardsEmailNotifications: boolean;
  languageExchangeAvailable: boolean;
};

type SettingsNumberKey =
  | "playbackSpeed"
  | "cardsPerDayMax"
  | "maxLapses"
  | "reviewTakeCount"
  | "requestedRetention"
  | "dailyWritingGoal"
  | "playbackPercentage"
  | "responseTimeoutSeconds";

type SettingsGroupProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

function SettingsGroup({
  title,
  description,
  children,
}: SettingsGroupProps) {
  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          {title}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      <Stack gap="md">{children}</Stack>
    </Stack>
  );
}

type SettingsRowProps = {
  label: string;
  description?: string;
  labelFor?: string;
  children: React.ReactNode;
};

function SettingsRow({
  label,
  description,
  labelFor,
  children,
}: SettingsRowProps) {
  return (
    <Grid align="flex-start" gap={{ base: "sm", sm: "lg" }}>
      <Grid.Col span={{ base: 12, sm: 5 }}>
        <Stack gap={4}>
          <InputLabel
            size="sm"
            fw={600}
            labelElement={labelFor ? "label" : "div"}
            htmlFor={labelFor}
          >
            {label}
          </InputLabel>
          {description && (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          )}
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 7 }}>{children}</Grid.Col>
    </Grid>
  );
}

type SettingsNumberChangeHandler = (
  value: number | string,
  name: SettingsNumberKey,
) => void;

type SettingsFormProps = {
  values: SettingsFormValues;
  onNumberChange: SettingsNumberChangeHandler;
  onWritingFirstChange: (checked: boolean) => void;
  onDueCardsEmailNotificationsChange: (checked: boolean) => void;
  onLanguageExchangeAvailableChange: (checked: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
};

type SliderSettingsGroupProps = {
  playbackSpeed: number;
  requestedRetention: number;
  onNumberChange: SettingsNumberChangeHandler;
};

function SliderSettingsGroup({
  playbackSpeed,
  requestedRetention,
  onNumberChange,
}: SliderSettingsGroupProps) {
  return (
    <SettingsGroup
      title="Review Targets"
      description="Adjust retention and playback settings."
    >
      <SettingsRow
        label="Target retention"
        description="Higher values review cards more often."
        labelFor="requestedRetention"
      >
        <Stack gap="xs">
          <Group justify="flex-end">
            <Text size="sm" fw={600}>
              {Math.round(requestedRetention * 100)}%
            </Text>
          </Group>
          <Slider
            id="requestedRetention"
            min={REQUESTED_RETENTION_MIN}
            max={REQUESTED_RETENTION_MAX}
            step={0.01}
            value={requestedRetention}
            onChange={(value) =>
              onNumberChange(value, "requestedRetention")
            }
            label={(value) => `${Math.round(value * 100)}%`}
          />
        </Stack>
      </SettingsRow>

      <SettingsRow
        label="Audio playback speed"
        description="Adjust how fast spoken audio plays."
        labelFor="playbackSpeed"
      >
        <Stack gap="xs">
          <Group justify="flex-end">
            <Text size="sm" fw={600}>
              {playbackSpeed.toFixed(2)}x
            </Text>
          </Group>
          <Slider
            id="playbackSpeed"
            min={0.5}
            max={2}
            step={0.05}
            value={playbackSpeed}
            onChange={(value) => onNumberChange(value, "playbackSpeed")}
            label={(value) => `${value.toFixed(2)}x`}
          />
        </Stack>
      </SettingsRow>
    </SettingsGroup>
  );
}

type NumberSettingsGroupProps = {
  cardsPerDayMax: number;
  maxLapses: number;
  reviewTakeCount: number;
  dailyWritingGoal: number;
  responseTimeoutSeconds: number;
  onNumberChange: SettingsNumberChangeHandler;
};

function NumberSettingsGroup({
  cardsPerDayMax,
  maxLapses,
  reviewTakeCount,
  dailyWritingGoal,
  responseTimeoutSeconds,
  onNumberChange,
}: NumberSettingsGroupProps) {
  return (
    <SettingsGroup
      title="Study Limits"
      description="Set your daily and session limits."
    >
      <SettingsRow
        label="New cards per day"
        description="Used to pace how many new cards you learn each week."
        labelFor="cardsPerDayMax"
      >
        <NumberInput
          id="cardsPerDayMax"
          name="cardsPerDayMax"
          value={cardsPerDayMax}
          onChange={(value) => onNumberChange(value, "cardsPerDayMax")}
          min={1}
          max={50}
          required
          size="sm"
        />
      </SettingsRow>

      <SettingsRow
        label="Cards per review session"
        description="How many cards to load when you start a session."
        labelFor="reviewTakeCount"
      >
        <NumberInput
          id="reviewTakeCount"
          name="reviewTakeCount"
          value={reviewTakeCount}
          onChange={(value) => onNumberChange(value, "reviewTakeCount")}
          min={REVIEW_TAKE_MIN}
          max={REVIEW_TAKE_MAX}
          step={1}
          required
          size="sm"
        />
      </SettingsRow>

      <SettingsRow
        label="Auto-pause after lapses"
        description="Set to 0 to disable."
        labelFor="maxLapses"
      >
        <NumberInput
          id="maxLapses"
          name="maxLapses"
          value={maxLapses}
          onChange={(value) => onNumberChange(value, "maxLapses")}
          min={0}
          step={1}
          size="sm"
        />
      </SettingsRow>

      <SettingsRow
        label="Daily writing goal (characters)"
        description="Your daily writing practice target."
        labelFor="dailyWritingGoal"
      >
        <NumberInput
          id="dailyWritingGoal"
          name="dailyWritingGoal"
          value={dailyWritingGoal}
          onChange={(value) => onNumberChange(value, "dailyWritingGoal")}
          min={0}
          step={50}
          required
          size="sm"
        />
      </SettingsRow>

      <SettingsRow
        label="Response timeout (seconds)"
        description="How long to wait before timing out. Set to 0 to disable."
        labelFor="responseTimeoutSeconds"
      >
        <NumberInput
          id="responseTimeoutSeconds"
          name="responseTimeoutSeconds"
          value={responseTimeoutSeconds}
          onChange={(value) =>
            onNumberChange(value, "responseTimeoutSeconds")
          }
          min={0}
          step={1}
          size="sm"
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

type ChoiceSettingsGroupProps = {
  playbackPercentage: number;
  onNumberChange: SettingsNumberChangeHandler;
};

function ChoiceSettingsGroup({
  playbackPercentage,
  onNumberChange,
}: ChoiceSettingsGroupProps) {
  return (
    <SettingsGroup
      title="Audio Replay"
      description="Choose how often your recording plays back."
    >
      <SettingsRow
        label="Replay your recording"
        description="Playback rate after each response."
      >
        <SegmentedControl
          fullWidth
          value={String(playbackPercentage)}
          onChange={(value) => onNumberChange(value, "playbackPercentage")}
          data={[
            { label: "100%", value: "1" },
            { label: "66%", value: "0.66" },
            { label: "33%", value: "0.33" },
            { label: "0%", value: "0" },
          ]}
          size="sm"
          aria-label="Replay your recording"
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

type ToggleSettingsGroupProps = {
  writingFirst: boolean;
  onWritingFirstChange: (checked: boolean) => void;
  dueCardsEmailNotifications: boolean;
  onDueCardsEmailNotificationsChange: (checked: boolean) => void;
  languageExchangeAvailable: boolean;
  onLanguageExchangeAvailableChange: (checked: boolean) => void;
};

function ToggleSettingsGroup({
  writingFirst,
  onWritingFirstChange,
  dueCardsEmailNotifications,
  onDueCardsEmailNotificationsChange,
  languageExchangeAvailable,
  onLanguageExchangeAvailableChange,
}: ToggleSettingsGroupProps) {
  return (
    <SettingsGroup
      title="Study Rules"
      description="Turn optional behaviors on or off."
    >
      <SettingsRow
        label="Require daily writing before card review"
        description="Finish your writing goal before review sessions unlock."
        labelFor="writingFirst"
      >
        <Switch
          id="writingFirst"
          checked={writingFirst}
          onChange={(event) =>
            onWritingFirstChange(event.currentTarget.checked)
          }
          size="md"
        />
      </SettingsRow>
      <SettingsRow
        label="Email me when more than 20 cards are due"
        description="Reminders reset after you log in again."
        labelFor="dueCardsEmailNotifications"
      >
        <Switch
          id="dueCardsEmailNotifications"
          checked={dueCardsEmailNotifications}
          onChange={(event) =>
            onDueCardsEmailNotificationsChange(event.currentTarget.checked)
          }
          size="md"
        />
      </SettingsRow>
      <SettingsRow
        label="Answer language exchange calls"
        description="Show incoming calls from your shared link while you study."
        labelFor="languageExchangeAvailable"
      >
        <Switch
          id="languageExchangeAvailable"
          checked={languageExchangeAvailable}
          onChange={(event) =>
            onLanguageExchangeAvailableChange(event.currentTarget.checked)
          }
          size="md"
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

function SettingsForm({
  values,
  onNumberChange,
  onWritingFirstChange,
  onDueCardsEmailNotificationsChange,
  onLanguageExchangeAvailableChange,
  onSubmit,
  isSaving,
}: SettingsFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <Stack gap="xl">
        <SliderSettingsGroup
          playbackSpeed={values.playbackSpeed}
          requestedRetention={values.requestedRetention}
          onNumberChange={onNumberChange}
        />
        <NumberSettingsGroup
          cardsPerDayMax={values.cardsPerDayMax}
          maxLapses={values.maxLapses}
          reviewTakeCount={values.reviewTakeCount}
          dailyWritingGoal={values.dailyWritingGoal}
          responseTimeoutSeconds={values.responseTimeoutSeconds}
          onNumberChange={onNumberChange}
        />
        <ChoiceSettingsGroup
          playbackPercentage={values.playbackPercentage}
          onNumberChange={onNumberChange}
        />
        <ToggleSettingsGroup
          writingFirst={values.writingFirst}
          onWritingFirstChange={onWritingFirstChange}
          dueCardsEmailNotifications={values.dueCardsEmailNotifications}
          onDueCardsEmailNotificationsChange={
            onDueCardsEmailNotificationsChange
          }
          languageExchangeAvailable={values.languageExchangeAvailable}
          onLanguageExchangeAvailableChange={
            onLanguageExchangeAvailableChange
          }
        />

        <Group justify="flex-end">
          <Button type="submit" loading={isSaving} size="sm">
            Save settings
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function LanguageExchangeLinkCard({
  languageExchangeUrl,
}: {
  languageExchangeUrl: string;
}) {
  const [currentLanguageExchangeUrl, setCurrentLanguageExchangeUrl] =
    React.useState(languageExchangeUrl);
  const [isRegenerating, setIsRegenerating] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentLanguageExchangeUrl);
      notifications.show({
        title: "Link copied",
        message: "Share it with the person you want to talk to.",
        color: "teal",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Copy failed",
        message:
          error instanceof Error
            ? error.message
            : "Could not copy the link.",
        color: "red",
      });
    }
  };

  const handleRegenerate = async () => {
    const confirmed = window.confirm(
      "Regenerate your link? The old link will stop working right away.",
    );
    if (!confirmed) {
      return;
    }

    setIsRegenerating(true);

    try {
      const response = await fetch(
        "/api/language-exchange/direct/link/regenerate",
        {
          method: "POST",
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        slug?: string;
      } | null;
      if (!response.ok || !data?.slug) {
        throw new Error(data?.error ?? "Could not regenerate the link.");
      }

      const nextUrl = new URL(
        getLanguageExchangePublicPath(data.slug),
        window.location.origin,
      ).toString();
      setCurrentLanguageExchangeUrl(nextUrl);
      notifications.show({
        title: "New link ready",
        message: "The old link no longer works.",
        color: "teal",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Could not regenerate link",
        message:
          error instanceof Error
            ? error.message
            : "Could not regenerate the link.",
        color: "red",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <SectionCard
      title="Language Exchange Link"
      titleOrder={3}
      description="Share this link. It only works while language exchange is on and Koala stays open in a visible tab."
    >
      <Stack gap="md">
        <Paper withBorder p="sm" radius="md">
          <Text
            size="sm"
            ff="monospace"
            style={{ wordBreak: "break-all" }}
          >
            {currentLanguageExchangeUrl}
          </Text>
        </Paper>
        <Group>
          <Button
            size="sm"
            variant="light"
            onClick={() => void handleCopy()}
          >
            Copy link
          </Button>
          <Button
            size="sm"
            variant="outline"
            color="red"
            onClick={() => void handleRegenerate()}
            loading={isRegenerating}
          >
            Regenerate link
          </Button>
          <Button
            size="sm"
            variant="subtle"
            component="a"
            href={currentLanguageExchangeUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open link
          </Button>
        </Group>
      </Stack>
    </SectionCard>
  );
}

type UserProfile = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  createdAt?: string | Date | null;
};

type AccountPanelProps = {
  user: UserProfile | null | undefined;
  onSignOut: () => void;
};

type AccountDisplay = {
  displayName: string;
  image: string | undefined;
  initial: string;
  joinedAt: string | null;
  secondaryEmail: string | null;
};

function resolveAccountDisplay(
  user: UserProfile | null | undefined,
): AccountDisplay {
  if (!user) {
    return {
      displayName: "Your account",
      image: undefined,
      initial: "U",
      joinedAt: null,
      secondaryEmail: null,
    };
  }

  const name = user.name || null;
  const email = user.email || null;

  return {
    displayName: name || email || "Your account",
    image: user.image || undefined,
    initial: resolveAccountInitial(name, email),
    joinedAt: resolveJoinedAt(user.createdAt),
    secondaryEmail: name ? email : null,
  };
}

function resolveAccountInitial(
  name: string | null,
  email: string | null,
): string {
  return name?.[0] || email?.[0] || "U";
}

function resolveJoinedAt(
  createdAt: UserProfile["createdAt"],
): string | null {
  return createdAt ? formatDate(new Date(createdAt)) : null;
}

function AccountPanel({ user, onSignOut }: AccountPanelProps) {
  const display = resolveAccountDisplay(user);

  return (
    <Paper withBorder p="xl" radius="lg">
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="lg"
      >
        <Group gap="lg" wrap="nowrap">
          <Avatar src={display.image} radius="xl" size={72}>
            {display.initial}
          </Avatar>
          <Stack gap={6}>
            <Text size="xs" c="dimmed" fw={600}>
              Account
            </Text>
            <Text size="lg" fw={600}>
              {display.displayName}
            </Text>
            {display.secondaryEmail && (
              <Text size="sm" c="dimmed">
                {display.secondaryEmail}
              </Text>
            )}
            {display.joinedAt && (
              <Badge color="pink" variant="light" radius="xl" size="sm">
                Joined {display.joinedAt}
              </Badge>
            )}
          </Stack>
        </Group>
        <Stack gap="xs" align="flex-end">
          <Button
            component={Link}
            href="/user/export"
            variant="light"
            size="sm"
          >
            Import / Export Decks
          </Button>
          <Button variant="outline" onClick={onSignOut} size="sm">
            Log Out
          </Button>
        </Stack>
      </Group>
    </Paper>
  );
}

type StatRowProps = {
  label: string;
  value: number | string;
};

function StatRow({ label, value }: StatRowProps) {
  return (
    <Group gap="xs" justify="space-between" align="baseline">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text fw={600} size="sm">
        {value}
      </Text>
    </Group>
  );
}

const QUICK_STATS_LABELS: Array<[string, string]> = [
  ["totalCards", "Total cards"],
  ["newCards", "New cards in deck"],
  ["quizzesDue", "Cards due now"],
  ["cardsDueNext24Hours", "Cards due next 24 hours"],
  ["newCardsLast24Hours", "New cards studied last 24 hours"],
  ["newCardsLastWeek", "New cards studied this week"],
  ["uniqueCardsLast24Hours", "Cards studied last 24 hours"],
  ["uniqueCardsLastWeek", "Cards studied this week"],
  ["globalUsers", "Total Koala users"],
];

type QuickStatsCardProps = {
  stats: Record<string, number | string | undefined>;
};

function QuickStatsCard({ stats }: QuickStatsCardProps) {
  const rows = QUICK_STATS_LABELS.flatMap(([key, label]) => {
    const value = stats[key];
    return value === undefined ? [] : [{ key, label, value }];
  });

  return (
    <SectionCard
      title="Study Snapshot"
      description="Current stats across your decks."
    >
      <Stack gap="sm">
        {rows.map((row) => (
          <StatRow key={row.key} label={row.label} value={row.value} />
        ))}
      </Stack>
    </SectionCard>
  );
}

type ProgressChartProps = {
  title: string;
  data: ChartDataPoint[];
  series: { name: string; color: string; label: string };
  yAxisLabel: string;
};

function ProgressChart({
  title,
  data,
  series,
  yAxisLabel,
}: ProgressChartProps) {
  return (
    <Paper withBorder shadow="xs" p="md" radius="lg">
      <Stack gap="sm">
        <Title order={5}>{title}</Title>
        <AreaChart
          h={300}
          data={data}
          dataKey="date"
          series={[series]}
          curveType="natural"
          yAxisLabel={yAxisLabel}
          xAxisLabel="Date"
          tooltipProps={{
            content: ({ label, payload }) => (
              <Paper px="md" py="sm" withBorder shadow="md" radius="md">
                <Text fw={500} mb={5}>
                  {label}
                </Text>
                {payload?.map((item) => (
                  <Text key={item.name} c={item.color} fz="sm">
                    {item.name}: {item.value}
                  </Text>
                ))}
              </Paper>
            ),
          }}
          gridProps={{ strokeDasharray: "3 3" }}
        />
      </Stack>
    </Paper>
  );
}

type ProgressSectionProps = {
  cardChartData: ChartDataPoint[];
  writingChartData: ChartDataPoint[];
  readerChartData: ChartDataPoint[];
};

function ProgressSection({
  cardChartData,
  writingChartData,
  readerChartData,
}: ProgressSectionProps) {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="baseline">
        <Title order={3}>Progress</Title>
        <Text size="sm" c="dimmed">
          Last 90 days
        </Text>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <ProgressChart
          title="Total Cards Learned"
          data={cardChartData}
          series={{ name: "count", color: "pink", label: "Total Learned" }}
          yAxisLabel="Cards Learned"
        />
        <ProgressChart
          title="Writing Progress"
          data={writingChartData}
          series={{ name: "count", color: "pink", label: "Total" }}
          yAxisLabel="Characters Written"
        />
        <ProgressChart
          title="Reader Highlights"
          data={readerChartData}
          series={{
            name: "count",
            color: "pink",
            label: "Total Highlights",
          }}
          yAxisLabel="Highlights"
        />
      </SimpleGrid>
    </Stack>
  );
}

export default function UserSettingsPage(props: Props) {
  const {
    userSettings,
    stats,
    cardChartData,
    writingChartData,
    readerChartData,
    languageExchangeUrl,
  } = props;
  const router = useRouter();
  const [settings, setSettings] = useState(() => ({
    ...userSettings,
    maxLapses: userSettings.maxLapses ?? 0,
    requestedRetention: resolveRequestedRetention(
      userSettings.requestedRetention,
    ),
    dueCardsEmailNotifications: Boolean(
      userSettings.dueCardsEmailNotifications,
    ),
    languageExchangeAvailable: Boolean(
      userSettings.languageExchangeAvailable,
    ),
  }));
  const editUserSettings = trpc.editUserSettings.useMutation();

  const handleNumberChange = (
    value: number | string,
    name: SettingsNumberKey,
  ) => {
    const parsed =
      typeof value === "number" ? value : Number.parseFloat(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    const nextValue =
      name === "requestedRetention"
        ? clampRequestedRetention(parsed)
        : parsed;
    setSettings({ ...settings, [name]: nextValue });
  };

  const handleWritingFirstChange = (checked: boolean) => {
    setSettings({ ...settings, writingFirst: checked });
  };

  const handleDueCardsEmailNotificationsChange = (checked: boolean) => {
    setSettings({
      ...settings,
      dueCardsEmailNotifications: checked,
    });
  };

  const handleLanguageExchangeAvailableChange = (checked: boolean) => {
    setSettings({
      ...settings,
      languageExchangeAvailable: checked,
    });
  };

  const handleSignOut = () => {
    void signOut({ redirect: false }).then(() => router.push("/"));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    editUserSettings
      .mutateAsync({
        ...settings,
        updatedAt: new Date(settings.updatedAt),
      })
      .then(
        () => {
          location.reload();
        },
        (error: unknown) => {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : "Unable to save settings.";
          notifications.show({
            title: "Save failed",
            message,
            color: "red",
          });
        },
      );
  };

  const formValues: SettingsFormValues = {
    playbackSpeed: settings.playbackSpeed,
    cardsPerDayMax: settings.cardsPerDayMax,
    maxLapses: settings.maxLapses ?? 0,
    reviewTakeCount: settings.reviewTakeCount,
    requestedRetention: resolveRequestedRetention(
      settings.requestedRetention,
    ),
    dailyWritingGoal: settings.dailyWritingGoal ?? 300,
    playbackPercentage: settings.playbackPercentage,
    responseTimeoutSeconds: settings.responseTimeoutSeconds ?? 0,
    writingFirst: Boolean(settings.writingFirst),
    dueCardsEmailNotifications: Boolean(
      settings.dueCardsEmailNotifications,
    ),
    languageExchangeAvailable: Boolean(settings.languageExchangeAvailable),
  };

  return (
    <Container size="lg" mt="xl" pb="xl">
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>Settings</Title>
          <Text size="sm" c="dimmed">
            Update your review pace, writing rules, and audio behavior.
          </Text>
        </Stack>

        <AccountPanel user={settings.user} onSignOut={handleSignOut} />

        <Grid gap="xl">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="xl">
              <SectionCard
                title="Preferences"
                titleOrder={3}
                description="Review pacing, writing rules, and playback options."
              >
                <SettingsForm
                  values={formValues}
                  onNumberChange={handleNumberChange}
                  onWritingFirstChange={handleWritingFirstChange}
                  onDueCardsEmailNotificationsChange={
                    handleDueCardsEmailNotificationsChange
                  }
                  onLanguageExchangeAvailableChange={
                    handleLanguageExchangeAvailableChange
                  }
                  onSubmit={handleSubmit}
                  isSaving={editUserSettings.isPending}
                />
              </SectionCard>
              <LanguageExchangeLinkCard
                key={languageExchangeUrl}
                languageExchangeUrl={languageExchangeUrl}
              />
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <QuickStatsCard stats={stats} />
          </Grid.Col>
        </Grid>

        <ProgressSection
          cardChartData={cardChartData}
          writingChartData={writingChartData}
          readerChartData={readerChartData}
        />
      </Stack>
    </Container>
  );
}
