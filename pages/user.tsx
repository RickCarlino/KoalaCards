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
import { UnwrapPromise } from "@prisma/client/runtime/library";
import { GetServerSidePropsContext } from "next";
import { getSession, signOut } from "next-auth/react";
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

export default function UserSettingsPage(props: Props) {
  const { userSettings, stats, cardChartData, writingChartData } = props;
  const [settings, setSettings] = useState(userSettings);
  const editUserSettings = trpc.editUserSettings.useMutation();

  const handleChange = (value: number | string, name: string) => {
    setSettings({ ...settings, [name]: parseFloat(String(value)) });
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

  const statLabels: [keyof typeof stats, string][] = [
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

  return (
    <Container size="lg" mt="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Group>
            <Avatar
              src={settings.user?.image || undefined}
              radius="xl"
              size={56}
            >
              {settings.user?.name?.[0] ||
                settings.user?.email?.[0] ||
                "U"}
            </Avatar>
            <Stack gap={2}>
              <Title order={2}>Account & Settings</Title>
              <Group gap="xs">
                {settings.user?.name && (
                  <Badge variant="light">{settings.user.name}</Badge>
                )}
                {settings.user?.email && (
                  <Badge color="gray" variant="outline">
                    {settings.user.email}
                  </Badge>
                )}
                {settings.user?.createdAt && (
                  <Badge color="pink" variant="light">
                    Joined {formatDate(new Date(settings.user.createdAt))}
                  </Badge>
                )}
              </Group>
            </Stack>
          </Group>
          <Button
            variant="outline"
            onClick={(event) => {
              event.preventDefault();
              signOut();
              location.assign("/");
            }}
          >
            Log Out
          </Button>
        </Group>

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper withBorder p="md" radius="md">
              <Title order={4} mb="sm">
                Preferences
              </Title>
              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  <Stack gap={6}>
                    <Text size="sm" fw={600}>
                      Audio playback speed
                    </Text>
                    <Slider
                      min={0.5}
                      max={2}
                      step={0.05}
                      value={settings.playbackSpeed}
                      onChange={(val) =>
                        handleChange(val, "playbackSpeed")
                      }
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
                    id="cardsPerDayMax"
                    name="cardsPerDayMax"
                    value={settings.cardsPerDayMax}
                    onChange={(value) =>
                      handleChange(value, "cardsPerDayMax")
                    }
                    min={1}
                    max={50}
                    required
                  />

                  <NumberInput
                    label="Daily writing goal (characters)"
                    description="Set your daily writing practice target."
                    id="dailyWritingGoal"
                    name="dailyWritingGoal"
                    value={settings.dailyWritingGoal || 300}
                    onChange={(value) =>
                      handleChange(value, "dailyWritingGoal")
                    }
                    min={0}
                    step={50}
                    required
                  />

                  <SegmentedControl
                    fullWidth
                    value={String(settings.playbackPercentage)}
                    onChange={(value) =>
                      handleChange(value, "playbackPercentage")
                    }
                    data={[
                      { label: "Always (100%)", value: "1" },
                      { label: "Usually (66%)", value: "0.66" },
                      { label: "Sometimes (33%)", value: "0.33" },
                      { label: "Never (0%)", value: "0" },
                    ]}
                  />
                  <Text size="xs" c="dimmed">
                    Controls how often your recording is replayed right
                    after you speak, to reinforce pronunciation.
                  </Text>

                  <Switch
                    checked={settings.writingFirst || false}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        writingFirst: event.currentTarget.checked,
                      })
                    }
                    label="Require daily writing before card review"
                    description="Prioritize writing practice by requiring it before card review"
                    size="md"
                    color="blue"
                  />

                  <Group justify="flex-end" mt="sm">
                    <Button
                      type="submit"
                      loading={editUserSettings.isLoading}
                    >
                      Save Settings
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="md">
              <Card withBorder shadow="xs" p="md" radius="md">
                <Title order={5} mb="xs">
                  Quick Stats
                </Title>
                <Stack gap={6}>
                  {statLabels.map(
                    ([key, label]) =>
                      stats[key] !== undefined && (
                        <Group key={key} gap="xs" justify="space-between">
                          <Text c="dimmed" size="sm">
                            {label}
                          </Text>
                          <Text fw={600}>{stats[key]}</Text>
                        </Group>
                      ),
                  )}
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>

        <Divider label="Progress" labelPosition="center" my="sm" />

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Title order={4} mb="xs">
              Total Cards Learned (90 Days)
            </Title>
            <Card withBorder shadow="xs" p="md" radius="md">
              <AreaChart
                h={300}
                data={cardChartData}
                dataKey="date"
                series={[
                  { name: "count", color: "blue", label: "Total Learned" },
                ]}
                curveType="natural"
                yAxisLabel="Cards Learned"
                xAxisLabel="Date"
                tooltipProps={{
                  content: ({ label, payload }) => (
                    <Paper
                      px="md"
                      py="sm"
                      withBorder
                      shadow="md"
                      radius="md"
                    >
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
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Title order={4} mb="xs">
              Total Writing Progress (90 Days)
            </Title>
            <Card withBorder shadow="xs" p="md" radius="md">
              <AreaChart
                h={300}
                data={writingChartData}
                dataKey="date"
                series={[{ name: "count", color: "blue", label: "Total" }]}
                curveType="natural"
                yAxisLabel="Characters Written"
                xAxisLabel="Date"
                tooltipProps={{
                  content: ({ label, payload }) => (
                    <Paper
                      px="md"
                      py="sm"
                      withBorder
                      shadow="md"
                      radius="md"
                    >
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
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
