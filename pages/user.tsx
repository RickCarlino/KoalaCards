import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { prismaClient } from "@/koala/prisma-client";
import { trpc } from "@/koala/trpc-config";
import { getLessonMeta } from "@/koala/trpc-routes/get-next-quizzes";
import { AreaChart } from "@mantine/charts";
import {
  Button,
  Card,
  Container,
  Group,
  NumberInput,
  Paper,
  Radio,
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
      Card: {
        userId: userId,
        flagged: { not: true },
      },
    };

    const cardsDueNext24Hours = await prismaClient.quiz.count({
      where: {
        ...BASE_QUERY,
        nextReview: {
          lt: tomorrow.getTime(),
        },
        firstReview: {
          gt: 0,
        },
      },
    });
    const newCardsLast24Hours = (
      await prismaClient.quiz.findMany({
        select: { id: true },
        where: {
          Card: { userId },
          firstReview: {
            gte: yesterday.getTime(),
          },
        },
        distinct: ["cardId"],
      })
    ).length;
    const newCardsLastWeek = (
      await prismaClient.quiz.findMany({
        select: { id: true },
        where: {
          Card: { userId },
          firstReview: {
            gte: oneWeekAgo.getTime(),
          },
        },
        distinct: ["cardId"],
      })
    ).length;
    const uniqueCardsLast24Hours = await prismaClient.quiz.count({
      where: {
        ...BASE_QUERY,
        lastReview: {
          gte: yesterday.getTime(),
        },
      },
    });
    const uniqueCardsLastWeek = await prismaClient.quiz.count({
      where: {
        ...BASE_QUERY,
        lastReview: {
          gte: oneWeekAgo.getTime(),
        },
      },
    });

    const recentLearnedQuizzes = await prismaClient.quiz.findMany({
      where: {
        Card: { userId },
        firstReview: {
          gt: 0,
          gte: threeMonthsAgo.getTime(),
        },
      },
      select: {
        cardId: true,
        firstReview: true,
      },
      orderBy: {
        firstReview: "asc",
      },
    });

    const firstLearnedDates: Record<string, Date> = {};
    for (const quiz of recentLearnedQuizzes) {
      if (quiz.firstReview && !firstLearnedDates[quiz.cardId]) {
        firstLearnedDates[quiz.cardId] = new Date(quiz.firstReview);
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

    let initDate = new Date(threeMonthsAgo);
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
    <Container size="sm" mt="xl">
      <Stack gap="xl">
        <Title order={1}>User Settings</Title>
        <Paper withBorder p="md" radius="md">
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <NumberInput
                label="Audio playback speed percentage"
                description="Adjust how quickly audio is played back (50% - 200%)"
                id="playbackSpeed"
                name="playbackSpeed"
                value={settings.playbackSpeed}
                onChange={(value) => handleChange(value, "playbackSpeed")}
                min={0.5}
                max={2}
                step={0.02}
                required
              />

              <NumberInput
                label="New cards per day target"
                description="Most users should pick a value between 7 and 21. Your weekly target is 7 times this value. Daily new cards will shrink or grow to meet this weekly target based on upcoming cards due."
                id="cardsPerDayMax"
                name="cardsPerDayMax"
                value={settings.cardsPerDayMax}
                onChange={(value) => handleChange(value, "cardsPerDayMax")}
                min={1}
                max={30}
                required
              />

              <NumberInput
                label="Daily writing goal (characters)"
                description="Set your daily writing practice target in characters."
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

              <Radio.Group
                label="Playback your voice after recording?"
                description="Listening to your own voice is a good way to improve pronunciation"
                id="playbackPercentage"
                name="playbackPercentage"
                value={String(settings.playbackPercentage)}
                onChange={(value) =>
                  handleChange(value, "playbackPercentage")
                }
                required
              >
                <Radio value="1" label="Always" />
                <Radio value="0.125" label="Sometimes" />
                <Radio value="0" label="Never" />
              </Radio.Group>

              <Switch
                checked={settings.writingFirst || false}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    writingFirst: event.currentTarget.checked,
                  })
                }
                label="Do not allow review of cards if daily writing goal is not met"
                description="Prioritize writing practice by requiring it before card review"
                size="md"
                color="blue"
              />

              <Group justify="flex-end" mt="md">
                <Button type="submit">Save Settings</Button>
              </Group>
            </Stack>
          </form>
        </Paper>

        <Stack gap="md">
          <Title order={2}>Statistics</Title>
          <Text size="sm">
            Here are some insights into your learning progress and the user
            base.
          </Text>
          <Card withBorder shadow="xs" p="md" radius="md">
            <Stack gap="xs">
              {statLabels.map(
                ([key, label]) =>
                  stats[key] !== undefined && (
                    <Group key={key} gap="xs">
                      <Text fw={500}>{label}:</Text>
                      <Text>{stats[key]}</Text>
                    </Group>
                  ),
              )}
            </Stack>
          </Card>
        </Stack>

        {/* Cards Chart Section */}
        <Stack gap="md">
          <Title order={2}>
            Total Cards Learned (Cumulative, Last 3 Months)
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
              yAxisLabel="Total Cards Learned"
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
                      {label} {/* Display date */}
                    </Text>
                    {payload?.map((item: any) => (
                      <Text key={item.name} c={item.color} fz="sm">
                        {item.name}: {item.value} {/* Display count */}
                      </Text>
                    ))}
                  </Paper>
                ),
              }}
              gridProps={{ strokeDasharray: "3 3" }}
            />
          </Card>
        </Stack>

        {/* Writing Progress Chart Section */}
        <Stack gap="md">
          <Title order={2}>
            Total Writing Progress (Cumulative, Last 3 Months)
          </Title>
          <Card withBorder shadow="xs" p="md" radius="md">
            <AreaChart
              h={300}
              data={writingChartData}
              dataKey="date"
              series={[
                { name: "count", color: "blue", label: "Total Learned" },
              ]}
              curveType="natural"
              yAxisLabel="Total Cards Learned"
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
                      {label} {/* Display date */}
                    </Text>
                    {payload?.map((item: any) => (
                      <Text key={item.name} c={item.color} fz="sm">
                        {item.name}: {item.value} {/* Display count */}
                      </Text>
                    ))}
                  </Paper>
                ),
              }}
              gridProps={{ strokeDasharray: "3 3" }}
            />
          </Card>
        </Stack>

        <Stack gap="md">
          <Card withBorder shadow="xs" p="md" radius="md">
            <Button
              onClick={(event) => {
                event.preventDefault();
                signOut();
                location.assign("/");
              }}
            >
              Log Out
            </Button>
          </Card>
        </Stack>
      </Stack>
    </Container>
  );
}
