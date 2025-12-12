import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { prismaClient } from "@/koala/prisma-client";
import { trpc } from "@/koala/trpc-config";
import { getLessonMeta } from "@/koala/trpc-routes/get-next-quizzes";
import { AreaChart } from "@mantine/charts";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Grid,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { GetServerSideProps } from "next";
import { getSession, signOut } from "next-auth/react";
import Link from "next/link";
import React, { useState } from "react";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

type ChartDataPoint = { date: string; count: number };
type QuickStat = { label: string; value: number | string };
type SerializedUserSettings = {
  id: number;
  playbackSpeed: number;
  cardsPerDayMax: number;
  playbackPercentage: number;
  dailyWritingGoal: number | null;
  writingFirst: boolean | null;
  performCorrectiveReviews: boolean | null;
  updatedAt: string;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
    createdAt: string | null;
  };
};

type Props = {
  userSettings: SerializedUserSettings;
  quickStats: QuickStat[];
  cardChartData: ChartDataPoint[];
  writingChartData: ChartDataPoint[];
};

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, deltaDays: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addMonths(date: Date, deltaMonths: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + deltaMonths);
  return next;
}

function dateKeysInclusive(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let day = startOfDay(start);
  const endDay = startOfDay(end);

  while (day <= endDay) {
    keys.push(formatDateKey(day));
    day = addDays(day, 1);
  }

  return keys;
}

function cumulativeSeriesFromDailyTotals(
  dateKeys: readonly string[],
  dailyTotals: Readonly<Record<string, number>>,
): ChartDataPoint[] {
  let runningTotal = 0;
  return dateKeys.map((date) => {
    runningTotal += dailyTotals[date] ?? 0;
    return { date, count: runningTotal };
  });
}

function cumulativeSeriesFromEvents<T>(params: {
  dateKeys: readonly string[];
  events: readonly T[];
  getDate: (event: T) => Date;
  getAmount: (event: T) => number;
}): ChartDataPoint[] {
  const dailyTotals: Record<string, number> = {};
  for (const key of params.dateKeys) {
    dailyTotals[key] = 0;
  }

  for (const event of params.events) {
    const key = formatDateKey(params.getDate(event));
    if (Object.prototype.hasOwnProperty.call(dailyTotals, key)) {
      dailyTotals[key] += params.getAmount(event);
    }
  }

  return cumulativeSeriesFromDailyTotals(params.dateKeys, dailyTotals);
}

function serializeUserSettings(
  settings: Awaited<ReturnType<typeof getUserSettingsFromEmail>>,
): SerializedUserSettings {
  return {
    id: settings.id,
    playbackSpeed: settings.playbackSpeed,
    cardsPerDayMax: settings.cardsPerDayMax,
    playbackPercentage: settings.playbackPercentage,
    dailyWritingGoal: settings.dailyWritingGoal ?? null,
    writingFirst: settings.writingFirst ?? null,
    performCorrectiveReviews: settings.performCorrectiveReviews ?? null,
    updatedAt: settings.updatedAt.toISOString(),
    user: {
      name: settings.user?.name ?? null,
      email: settings.user?.email ?? null,
      image: settings.user?.image ?? null,
      createdAt: settings.user?.createdAt?.toISOString() ?? null,
    },
  };
}

async function countNewCardsSince(userId: string, sinceMs: number) {
  const rows = await prismaClient.card.findMany({
    select: { id: true },
    where: { userId, firstReview: { gte: sinceMs } },
    distinct: ["id"],
  });
  return rows.length;
}

async function getUserProgressData(params: {
  userId: string;
  cardsPerDayMax: number;
}): Promise<{
  quickStats: QuickStat[];
  cardChartData: ChartDataPoint[];
  writingChartData: ChartDataPoint[];
}> {
  const now = new Date();
  const yesterdayMs = now.getTime() - ONE_DAY;
  const oneWeekAgoMs = now.getTime() - ONE_WEEK;
  const tomorrowMs = now.getTime() + ONE_DAY;

  const chartStart = startOfDay(addMonths(now, -3));
  const chartEnd = now;
  const dateKeys = dateKeysInclusive(chartStart, chartEnd);

  const baseCardWhere = { userId: params.userId, flagged: { not: true } };

  const [
    lessonMeta,
    cardsDueNext24Hours,
    uniqueCardsLast24Hours,
    uniqueCardsLastWeek,
    newCardsLast24Hours,
    newCardsLastWeek,
    globalUsers,
    learnedCards,
    writingSubmissions,
  ] = await Promise.all([
    getLessonMeta(params.userId),
    prismaClient.card.count({
      where: {
        ...baseCardWhere,
        nextReview: { lt: tomorrowMs },
        firstReview: { gt: 0 },
      },
    }),
    prismaClient.card.count({
      where: { ...baseCardWhere, lastReview: { gte: yesterdayMs } },
    }),
    prismaClient.card.count({
      where: { ...baseCardWhere, lastReview: { gte: oneWeekAgoMs } },
    }),
    countNewCardsSince(params.userId, yesterdayMs),
    countNewCardsSince(params.userId, oneWeekAgoMs),
    prismaClient.user.count(),
    prismaClient.card.findMany({
      where: {
        userId: params.userId,
        firstReview: { gte: chartStart.getTime() },
      },
      select: { firstReview: true },
    }),
    prismaClient.writingSubmission.findMany({
      where: { userId: params.userId, createdAt: { gte: chartStart } },
      select: { createdAt: true, correctionCharacterCount: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const weeklyTarget = params.cardsPerDayMax * 7;
  const learnedWithFirstReview = learnedCards.filter(
    (card): card is { firstReview: number } =>
      typeof card.firstReview === "number",
  );
  const cardChartData = cumulativeSeriesFromEvents({
    dateKeys,
    events: learnedWithFirstReview,
    getDate: (card) => new Date(card.firstReview),
    getAmount: () => 1,
  });
  const writingChartData = cumulativeSeriesFromEvents({
    dateKeys,
    events: writingSubmissions,
    getDate: (submission) => submission.createdAt,
    getAmount: (submission) => submission.correctionCharacterCount,
  });

  const quickStats: QuickStat[] = [
    { label: "Total cards", value: lessonMeta.totalCards },
    { label: "New cards in deck", value: lessonMeta.newCards },
    { label: "Cards due now", value: lessonMeta.quizzesDue },
    { label: "Cards due next 24 hours", value: cardsDueNext24Hours },
    {
      label: "New cards studied last 24 hours",
      value: newCardsLast24Hours,
    },
    {
      label: "New cards studied this week",
      value: `${newCardsLastWeek} / ${weeklyTarget}`,
    },
    {
      label: "Cards studied last 24 hours",
      value: uniqueCardsLast24Hours,
    },
    { label: "Cards studied this week", value: uniqueCardsLastWeek },
    { label: "Active Koala users", value: globalUsers },
  ];

  return { quickStats, cardChartData, writingChartData };
}

export const getServerSideProps: GetServerSideProps<Props> = async (
  context,
) => {
  const session = await getSession({ req: context.req });
  const email = session?.user?.email;
  if (!email) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const userSettings = await getUserSettingsFromEmail(email);
  const { quickStats, cardChartData, writingChartData } =
    await getUserProgressData({
      userId: userSettings.userId,
      cardsPerDayMax: userSettings.cardsPerDayMax,
    });

  return {
    props: {
      userSettings: serializeUserSettings(userSettings),
      quickStats,
      cardChartData,
      writingChartData,
    },
  };
};

function firstChar(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }
  return value.trim()[0];
}

function parseFiniteNumber(value: number | string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function ChartTooltip(props: {
  label: string | number | undefined;
  items: { name: string; value: number | string; color: string }[];
}) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <Paper px="md" py="sm" withBorder shadow="md" radius="md">
      <Text fw={500} mb={5}>
        {props.label}
      </Text>
      {props.items.map((item) => (
        <Text key={item.name} c={item.color} fz="sm">
          {item.name}: {item.value}
        </Text>
      ))}
    </Paper>
  );
}

function toChartTooltipItems(payload: unknown) {
  if (!Array.isArray(payload)) {
    return [];
  }

  const items: { name: string; value: number | string; color: string }[] =
    [];

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  for (const candidate of payload) {
    if (!isRecord(candidate)) {
      continue;
    }

    const name = candidate.name;
    const value = candidate.value;
    const color = candidate.color;

    if (
      typeof name === "string" &&
      (typeof value === "number" || typeof value === "string") &&
      typeof color === "string"
    ) {
      items.push({ name, value, color });
    }
  }

  return items;
}

function ProgressChartCard(props: {
  title: string;
  data: ChartDataPoint[];
  seriesLabel: string;
  yAxisLabel: string;
}) {
  return (
    <Grid.Col span={{ base: 12, md: 6 }}>
      <Title order={4} mb="xs">
        {props.title}
      </Title>
      <Card withBorder shadow="xs" p="md" radius="md">
        <AreaChart
          h={300}
          data={props.data}
          dataKey="date"
          series={[
            { name: "count", color: "blue", label: props.seriesLabel },
          ]}
          curveType="natural"
          yAxisLabel={props.yAxisLabel}
          xAxisLabel="Date"
          tooltipProps={{
            content: ({ label, payload }) => (
              <ChartTooltip
                label={label}
                items={toChartTooltipItems(payload)}
              />
            ),
          }}
          gridProps={{ strokeDasharray: "3 3" }}
        />
      </Card>
    </Grid.Col>
  );
}

function QuickStatsCard(props: { stats: QuickStat[] }) {
  return (
    <Card withBorder shadow="xs" p="md" radius="md">
      <Title order={5} mb="xs">
        Quick Stats
      </Title>
      <Stack gap={6}>
        {props.stats.map((stat) => (
          <Group
            key={stat.label}
            gap="xs"
            justify="space-between"
            wrap="nowrap"
          >
            <Text c="dimmed" size="sm">
              {stat.label}
            </Text>
            <Text fw={600}>{stat.value}</Text>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

function PreferencesForm(props: {
  settings: SerializedUserSettings;
  onChange: (next: SerializedUserSettings) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const applyNumber = (
    field:
      | "playbackSpeed"
      | "cardsPerDayMax"
      | "dailyWritingGoal"
      | "playbackPercentage",
    value: number | string,
  ) => {
    const parsed = parseFiniteNumber(value);
    if (parsed === null) {
      return;
    }

    if (field === "playbackSpeed") {
      props.onChange({ ...props.settings, playbackSpeed: parsed });
      return;
    }
    if (field === "cardsPerDayMax") {
      props.onChange({ ...props.settings, cardsPerDayMax: parsed });
      return;
    }
    if (field === "dailyWritingGoal") {
      props.onChange({ ...props.settings, dailyWritingGoal: parsed });
      return;
    }
    props.onChange({ ...props.settings, playbackPercentage: parsed });
  };

  const applyBool = (
    field: "writingFirst" | "performCorrectiveReviews",
    checked: boolean,
  ) => {
    if (field === "writingFirst") {
      props.onChange({ ...props.settings, writingFirst: checked });
      return;
    }
    props.onChange({
      ...props.settings,
      performCorrectiveReviews: checked,
    });
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Title order={4} mb="sm">
        Preferences
      </Title>

      <Stack gap="md">
        <Stack gap={6}>
          <Text size="sm" fw={600}>
            Audio playback speed
          </Text>
          <Slider
            min={0.5}
            max={2}
            step={0.05}
            value={props.settings.playbackSpeed}
            onChange={(val) => applyNumber("playbackSpeed", val)}
            marks={[
              { value: 0.5, label: "0.5x" },
              { value: 1, label: "1x" },
              { value: 1.5, label: "1.5x" },
              { value: 2, label: "2x" },
            ]}
          />
        </Stack>

        <NumberInput
          label="New cards per day target"
          description="Weekly target is 7× this value; daily new adjusts to meet it."
          value={props.settings.cardsPerDayMax}
          onChange={(value) => applyNumber("cardsPerDayMax", value)}
          min={1}
          max={50}
          required
        />

        <NumberInput
          label="Daily writing goal (characters)"
          description="Set your daily writing practice target."
          value={props.settings.dailyWritingGoal ?? 300}
          onChange={(value) => applyNumber("dailyWritingGoal", value)}
          min={1}
          step={50}
          required
        />

        <SegmentedControl
          fullWidth
          value={String(props.settings.playbackPercentage)}
          onChange={(value) => applyNumber("playbackPercentage", value)}
          data={[
            { label: "Always (100%)", value: "1" },
            { label: "Usually (66%)", value: "0.66" },
            { label: "Sometimes (33%)", value: "0.33" },
            { label: "Never (0%)", value: "0" },
          ]}
        />
        <Text size="xs" c="dimmed">
          Controls how often your recording is replayed right after you
          speak, to reinforce pronunciation.
        </Text>

        <Switch
          checked={props.settings.writingFirst ?? false}
          onChange={(event) =>
            applyBool("writingFirst", event.currentTarget.checked)
          }
          label="Require daily writing before card review"
          description="Prioritize writing practice by requiring it before card review"
          size="md"
          color="blue"
        />

        <Switch
          checked={props.settings.performCorrectiveReviews ?? true}
          onChange={(event) =>
            applyBool(
              "performCorrectiveReviews",
              event.currentTarget.checked,
            )
          }
          label="Perform corrective reviews"
          description="After a review session, optionally run a short corrective speaking drill"
          size="md"
          color="blue"
        />

        <Group justify="flex-end" mt="sm">
          <Button
            type="button"
            loading={props.isSaving}
            onClick={props.onSave}
          >
            Save Settings
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function UserHeader(props: { user: SerializedUserSettings["user"] }) {
  const initials =
    firstChar(props.user.name) ?? firstChar(props.user.email) ?? "U";
  const joinedLabel = props.user.createdAt
    ? `Joined ${formatDateKey(new Date(props.user.createdAt))}`
    : undefined;

  const handleLogout = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void signOut().finally(() => location.assign("/"));
  };

  return (
    <Group justify="space-between" align="center">
      <Group>
        <Avatar src={props.user.image ?? undefined} radius="xl" size={56}>
          {initials}
        </Avatar>
        <Stack gap={2}>
          <Title order={2}>Account & Settings</Title>
          <Group gap="xs">
            {props.user.name ? (
              <Badge variant="light">{props.user.name}</Badge>
            ) : null}
            {props.user.email ? (
              <Badge color="gray" variant="outline">
                {props.user.email}
              </Badge>
            ) : null}
            {joinedLabel ? (
              <Badge color="pink" variant="light">
                {joinedLabel}
              </Badge>
            ) : null}
          </Group>
        </Stack>
      </Group>
      <Group>
        <Button component={Link} href="/user/export" variant="light">
          Import / Export Decks
        </Button>
        <Button variant="outline" onClick={handleLogout}>
          Log Out
        </Button>
      </Group>
    </Group>
  );
}

export default function UserSettingsPage(props: Props) {
  const editUserSettings = trpc.editUserSettings.useMutation();
  const [settings, setSettings] = useState(props.userSettings);

  const saveSettings = async () => {
    try {
      await editUserSettings.mutateAsync({
        id: settings.id,
        playbackSpeed: settings.playbackSpeed,
        cardsPerDayMax: settings.cardsPerDayMax,
        playbackPercentage: settings.playbackPercentage,
        dailyWritingGoal: settings.dailyWritingGoal ?? undefined,
        writingFirst: settings.writingFirst ?? undefined,
        performCorrectiveReviews:
          settings.performCorrectiveReviews ?? undefined,
        updatedAt: new Date(settings.updatedAt),
      });
      location.reload();
    } catch (error: unknown) {
      notifications.show({
        title: "Error",
        message: `Error: ${JSON.stringify(error).slice(0, 100)}`,
        color: "red",
      });
    }
  };

  return (
    <Container size="lg" mt="xl">
      <Stack gap="lg">
        <UserHeader user={settings.user} />

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <PreferencesForm
              settings={settings}
              onChange={setSettings}
              onSave={saveSettings}
              isSaving={editUserSettings.isLoading}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="md">
              <QuickStatsCard stats={props.quickStats} />
            </Stack>
          </Grid.Col>
        </Grid>

        <Divider label="Progress" labelPosition="center" my="sm" />

        <Grid gutter="lg">
          <ProgressChartCard
            title="Total Cards Learned (90 Days)"
            data={props.cardChartData}
            seriesLabel="Total Learned"
            yAxisLabel="Cards Learned"
          />
          <ProgressChartCard
            title="Total Writing Progress (90 Days)"
            data={props.writingChartData}
            seriesLabel="Total"
            yAxisLabel="Characters Written"
          />
        </Grid>
      </Stack>
    </Container>
  );
}
