import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { SectionCard } from "@/koala/components/SectionCard";
import { prismaClient } from "@/koala/prisma-client";
import {
  REVIEW_TAKE_MAX,
  REVIEW_TAKE_MIN,
} from "@/koala/settings/review-take";
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
import { UnwrapPromise } from "@prisma/client/runtime/library";
import { GetServerSidePropsContext } from "next";
import { getSession, signOut } from "next-auth/react";
import Link from "next/link";
import React, { useState } from "react";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
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
      flagged: { not: true },
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

    const cumulativeChartData: ChartDataPoint[] = [];
    let cumulativeCount = 0;

    const sortedLearnedDates = Object.values(firstLearnedDates).sort(
      (a, b) => a.getTime() - b.getTime(),
    );
    let learnedDateIndex = 0;
    const endDate = new Date();
    let currentDate = new Date(threeMonthsAgo);

    while (currentDate <= endDate) {
      const dateString = formatDate(currentDate);
      const currentDayEnd = new Date(currentDate);
      currentDayEnd.setHours(23, 59, 59, 999);

      while (
        learnedDateIndex < sortedLearnedDates.length &&
        sortedLearnedDates[learnedDateIndex] <= currentDayEnd
      ) {
        cumulativeCount++;
        learnedDateIndex++;
      }

      cumulativeChartData.push({
        date: dateString,
        count: cumulativeCount,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

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

    currentDate = new Date(threeMonthsAgo);
    while (currentDate <= endDate) {
      const dateString = formatDate(currentDate);
      cumulativeWritingCount += dailyWritingData[dateString] || 0;

      cumulativeWritingData.push({
        date: dateString,
        count: cumulativeWritingCount,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const cardChartData = cumulativeChartData;
    const writingChartData = cumulativeWritingData;

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

    return { statistics, cardChartData, writingChartData };
  }

  const { statistics, cardChartData, writingChartData } =
    await getUserCardStatistics(userId);

  return {
    props: {
      userSettings: JSON.parse(JSON.stringify(userSettings)),
      stats: statistics,
      cardChartData: cardChartData,
      writingChartData: writingChartData,
    },
  };
}

type ChartDataPoint = { date: string; count: number };
type Props = UnwrapPromise<
  ReturnType<typeof getServerSideProps>
>["props"] & {
  cardChartData: ChartDataPoint[];
  writingChartData: ChartDataPoint[];
};

type SettingsFormValues = {
  playbackSpeed: number;
  cardsPerDayMax: number;
  reviewTakeCount: number;
  dailyWritingGoal: number;
  playbackPercentage: number;
  writingFirst: boolean;
};

type SettingsNumberKey =
  | "playbackSpeed"
  | "cardsPerDayMax"
  | "reviewTakeCount"
  | "dailyWritingGoal"
  | "playbackPercentage";

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
    <Grid align="flex-start" gutter={{ base: "sm", sm: "lg" }}>
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

type SettingsFormProps = {
  values: SettingsFormValues;
  onNumberChange: (
    value: number | string,
    name: SettingsNumberKey,
  ) => void;
  onWritingFirstChange: (checked: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
};

function SettingsForm({
  values,
  onNumberChange,
  onWritingFirstChange,
  onSubmit,
  isSaving,
}: SettingsFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <Stack gap="xl">
        <SettingsGroup
          title="Study pace"
          description="Daily targets and session size."
        >
          <SettingsRow
            label="New cards per day target"
            description="Weekly target is 7x this value; daily new adjusts to meet it."
            labelFor="cardsPerDayMax"
          >
            <NumberInput
              id="cardsPerDayMax"
              name="cardsPerDayMax"
              value={values.cardsPerDayMax}
              onChange={(value) => onNumberChange(value, "cardsPerDayMax")}
              min={1}
              max={50}
              required
              size="sm"
            />
          </SettingsRow>

          <SettingsRow
            label="Cards per review session"
            description="Cards pulled when you start a deck review."
            labelFor="reviewTakeCount"
          >
            <NumberInput
              id="reviewTakeCount"
              name="reviewTakeCount"
              value={values.reviewTakeCount}
              onChange={(value) =>
                onNumberChange(value, "reviewTakeCount")
              }
              min={REVIEW_TAKE_MIN}
              max={REVIEW_TAKE_MAX}
              step={1}
              required
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
              value={values.dailyWritingGoal}
              onChange={(value) =>
                onNumberChange(value, "dailyWritingGoal")
              }
              min={0}
              step={50}
              required
              size="sm"
            />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup
          title="Audio feedback"
          description="Playback speed and auto-replay."
        >
          <SettingsRow
            label="Audio playback speed"
            description="Adjust how fast spoken audio plays."
          >
            <Stack gap="xs">
              <Group justify="flex-end">
                <Text size="sm" fw={600}>
                  {values.playbackSpeed.toFixed(2)}x
                </Text>
              </Group>
              <Slider
                id="playbackSpeed"
                min={0.5}
                max={2}
                step={0.05}
                value={values.playbackSpeed}
                onChange={(val) => onNumberChange(val, "playbackSpeed")}
                label={(value) => `${value.toFixed(2)}x`}
              />
            </Stack>
          </SettingsRow>

          <SettingsRow
            label="Replay your recording"
            description="How often your recording replays after you answer."
          >
            <SegmentedControl
              fullWidth
              value={String(values.playbackPercentage)}
              onChange={(value) =>
                onNumberChange(value, "playbackPercentage")
              }
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

        <SettingsGroup
          title="Writing flow"
          description="Prioritize writing before review when you need focus."
        >
          <SettingsRow
            label="Require daily writing before card review"
            description="Encourages consistent writing practice."
            labelFor="writingFirst"
          >
            <Switch
              id="writingFirst"
              checked={values.writingFirst}
              onChange={(event) =>
                onWritingFirstChange(event.currentTarget.checked)
              }
              size="md"
            />
          </SettingsRow>
        </SettingsGroup>

        <Group justify="flex-end">
          <Button type="submit" loading={isSaving} size="sm">
            Save settings
          </Button>
        </Group>
      </Stack>
    </form>
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

function AccountPanel({ user, onSignOut }: AccountPanelProps) {
  const initial = user?.name?.[0] || user?.email?.[0] || "U";
  const displayName = user?.name || user?.email || "Your account";
  const secondaryEmail = user?.name ? user?.email : null;
  const joinedAt = user?.createdAt
    ? formatDate(new Date(user.createdAt))
    : null;

  return (
    <Paper withBorder p="xl" radius="lg">
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="lg"
      >
        <Group gap="lg" wrap="nowrap">
          <Avatar src={user?.image || undefined} radius="xl" size={72}>
            {initial}
          </Avatar>
          <Stack gap={6}>
            <Text size="xs" c="dimmed" fw={600}>
              Account
            </Text>
            <Text size="lg" fw={600}>
              {displayName}
            </Text>
            {secondaryEmail && (
              <Text size="sm" c="dimmed">
                {secondaryEmail}
              </Text>
            )}
            {joinedAt && (
              <Badge color="pink" variant="light" radius="xl" size="sm">
                Joined {joinedAt}
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
  ["globalUsers", "Active Koala users"],
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
      title="Quick Stats"
      description="Snapshot across all decks."
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
};

function ProgressSection({
  cardChartData,
  writingChartData,
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
      </SimpleGrid>
    </Stack>
  );
}

export default function UserSettingsPage(props: Props) {
  const { userSettings, stats, cardChartData, writingChartData } = props;
  const [settings, setSettings] = useState(userSettings);
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
    setSettings({ ...settings, [name]: parsed });
  };

  const handleWritingFirstChange = (checked: boolean) => {
    setSettings({ ...settings, writingFirst: checked });
  };

  const handleSignOut = () => {
    signOut();
    location.assign("/");
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
          notifications.show({
            title: "Error",
            message: `Error: ${JSON.stringify(error).slice(0, 100)}`,
            color: "red",
          });
        },
      );
  };

  const formValues: SettingsFormValues = {
    playbackSpeed: settings.playbackSpeed,
    cardsPerDayMax: settings.cardsPerDayMax,
    reviewTakeCount: settings.reviewTakeCount,
    dailyWritingGoal: settings.dailyWritingGoal ?? 300,
    playbackPercentage: settings.playbackPercentage,
    writingFirst: Boolean(settings.writingFirst),
  };

  return (
    <Container size="lg" mt="xl" pb="xl">
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>Settings</Title>
          <Text size="sm" c="dimmed">
            Adjust your study pace, audio feedback, and writing flow.
          </Text>
        </Stack>

        <AccountPanel user={settings.user} onSignOut={handleSignOut} />

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <SectionCard
              title="Preferences"
              titleOrder={3}
              description="Daily pace, review size, and audio feedback."
            >
              <SettingsForm
                values={formValues}
                onNumberChange={handleNumberChange}
                onWritingFirstChange={handleWritingFirstChange}
                onSubmit={handleSubmit}
                isSaving={editUserSettings.isLoading}
              />
            </SectionCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <QuickStatsCard stats={stats} />
          </Grid.Col>
        </Grid>

        <ProgressSection
          cardChartData={cardChartData}
          writingChartData={writingChartData}
        />
      </Stack>
    </Container>
  );
}
