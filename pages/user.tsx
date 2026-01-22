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
  Divider,
  Grid,
  Group,
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

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <Text size="sm" fw={600}>
          {title}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      {children}
    </Stack>
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
      <Stack gap="lg">
        <SettingsSection
          title="Study pace"
          description="Daily targets and review size."
        >
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <NumberInput
              label="New cards per day target"
              description="Weekly target is 7× this value; daily new adjusts to meet it."
              id="cardsPerDayMax"
              name="cardsPerDayMax"
              value={values.cardsPerDayMax}
              onChange={(value) => onNumberChange(value, "cardsPerDayMax")}
              min={1}
              max={50}
              required
            />

            <NumberInput
              label="Cards per review session"
              description="Controls how many cards are pulled when you start a deck review."
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
            />

            <NumberInput
              label="Daily writing goal (characters)"
              description="Set your daily writing practice target."
              id="dailyWritingGoal"
              name="dailyWritingGoal"
              value={values.dailyWritingGoal}
              onChange={(value) =>
                onNumberChange(value, "dailyWritingGoal")
              }
              min={0}
              step={50}
              required
            />
          </SimpleGrid>
        </SettingsSection>

        <Divider variant="dashed" />

        <SettingsSection
          title="Audio feedback"
          description="Adjust playback speed and auto-replay."
        >
          <Stack gap="md">
            <Stack gap={6}>
              <Group justify="space-between" align="baseline">
                <Text size="sm" fw={600}>
                  Audio playback speed
                </Text>
                <Text size="xs" c="dimmed">
                  {values.playbackSpeed.toFixed(2)}x
                </Text>
              </Group>
              <Slider
                min={0.5}
                max={2}
                step={0.05}
                value={values.playbackSpeed}
                onChange={(val) => onNumberChange(val, "playbackSpeed")}
                marks={[
                  { value: 0.5, label: "0.5x" },
                  { value: 1, label: "1x" },
                  { value: 1.5, label: "1.5x" },
                  { value: 2, label: "2x" },
                ]}
              />
            </Stack>

            <Stack gap={6}>
              <Text size="sm" fw={600}>
                Replay your recording
              </Text>
              <SegmentedControl
                fullWidth
                value={String(values.playbackPercentage)}
                onChange={(value) =>
                  onNumberChange(value, "playbackPercentage")
                }
                data={[
                  { label: "Always (100%)", value: "1" },
                  { label: "Usually (66%)", value: "0.66" },
                  { label: "Sometimes (33%)", value: "0.33" },
                  { label: "Never (0%)", value: "0" },
                ]}
              />
              <Text size="xs" c="dimmed">
                Controls how often your recording replays after you answer.
              </Text>
            </Stack>
          </Stack>
        </SettingsSection>

        <Divider variant="dashed" />

        <SettingsSection title="Writing flow">
          <Switch
            checked={values.writingFirst}
            onChange={(event) =>
              onWritingFirstChange(event.currentTarget.checked)
            }
            label="Require daily writing before card review"
            description="Prioritize writing practice by requiring it before card review."
            size="md"
          />
        </SettingsSection>

        <Group justify="flex-end" mt="xs">
          <Button type="submit" loading={isSaving}>
            Save Settings
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
    <Paper withBorder p="lg" radius="lg">
      <Group justify="space-between" align="center" wrap="wrap" gap="lg">
        <Group gap="md" wrap="nowrap">
          <Avatar src={user?.image || undefined} radius="xl" size={64}>
            {initial}
          </Avatar>
          <Stack gap={4}>
            <Title order={2}>Account & Settings</Title>
            <Text size="sm" fw={600}>
              {displayName}
            </Text>
            {secondaryEmail && (
              <Text size="sm" c="dimmed">
                {secondaryEmail}
              </Text>
            )}
            {joinedAt && (
              <Badge color="pink" variant="light">
                Joined {joinedAt}
              </Badge>
            )}
          </Stack>
        </Group>
        <Group>
          <Button component={Link} href="/user/export" variant="light">
            Import / Export Decks
          </Button>
          <Button variant="outline" onClick={onSignOut}>
            Log Out
          </Button>
        </Group>
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
    <Group gap="xs" justify="space-between">
      <Text c="gray.7" size="sm">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
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
  return (
    <SectionCard
      title="Quick Stats"
      description="Snapshot across all decks."
    >
      <Stack gap="xs">
        {QUICK_STATS_LABELS.map(([key, label]) => {
          const value = stats[key];
          if (value === undefined) {
            return null;
          }
          return <StatRow key={key} label={label} value={value} />;
        })}
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
    <Container size="xl" mt="xl" pb="xl">
      <Stack gap="xl">
        <AccountPanel user={settings.user} onSignOut={handleSignOut} />

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <SectionCard
              title="Preferences"
              titleOrder={3}
              description="Tune your daily pace, session size, and audio feedback."
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
