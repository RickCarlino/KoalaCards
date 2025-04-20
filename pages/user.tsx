import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { prismaClient } from "@/koala/prisma-client";
import { trpc } from "@/koala/trpc-config";
import { getLessonMeta } from "@/koala/trpc-routes/get-next-quizzes";
import {
  Button,
  Card,
  Container,
  Group,
  NumberInput,
  Paper,
  Radio,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { AreaChart } from "@mantine/charts"; // Import AreaChart
import { notifications } from "@mantine/notifications";
import { UnwrapPromise } from "@prisma/client/runtime/library";
import { GetServerSidePropsContext } from "next";
import { getSession, signOut } from "next-auth/react";
import React, { useState } from "react";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getSession({ req: context.req });
  if (!session?.user?.email) {
    // Handle case where session or email is missing, perhaps redirect
    return { redirect: { destination: "/", permanent: false } };
  }
  const userSettings = await getUserSettingsFromEmail(session.user.email);
  if (!userSettings) {
    // Handle case where user settings are not found
    return { redirect: { destination: "/", permanent: false } };
  }
  const userId = userSettings.userId;

  async function getUserCardStatistics(userId: string) {
    const today = new Date(); // Use Date object for easier manipulation
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
          lt: tomorrow.getTime(), // Use getTime() for comparison
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
            gte: yesterday.getTime(), // Use getTime() for Prisma timestamp comparison
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
            gte: oneWeekAgo.getTime(), // Use getTime()
          },
        },
        distinct: ["cardId"],
      })
    ).length;
    const uniqueCardsLast24Hours = await prismaClient.quiz.count({
      where: {
        ...BASE_QUERY,
        lastReview: {
          gte: yesterday.getTime(), // Use getTime()
        },
      },
    });
    const uniqueCardsLastWeek = await prismaClient.quiz.count({
      where: {
        ...BASE_QUERY,
        lastReview: {
          gte: oneWeekAgo.getTime(), // Use getTime()
        },
      },
    });

    // --- Fetch data for the chart ---
    const recentLearnedQuizzes = await prismaClient.quiz.findMany({
      where: {
        Card: { userId },
        firstReview: {
          gt: 0, // Ensure it's actually reviewed
          gte: threeMonthsAgo.getTime(), // Within the last 3 months
        },
      },
      select: {
        cardId: true,
        firstReview: true,
      },
      orderBy: {
        firstReview: "asc", // Get the earliest review first
      },
    });

    // Process in JS to find the first time each card was learned
    const firstLearnedDates: Record<string, Date> = {};
    for (const quiz of recentLearnedQuizzes) {
      // Ensure firstReview is not null and the card hasn't been recorded yet
      if (quiz.firstReview && !firstLearnedDates[quiz.cardId]) {
        firstLearnedDates[quiz.cardId] = new Date(quiz.firstReview);
      }
    }

    // --- Calculate Cumulative Count ---
    const cumulativeChartData: ChartDataPoint[] = [];
    let cumulativeCount = 0;
    // Sort the first learned dates chronologically
    const sortedLearnedDates = Object.values(firstLearnedDates).sort(
      (a, b) => a.getTime() - b.getTime(),
    );
    let learnedDateIndex = 0;
    const endDate = new Date();
    let currentDate = new Date(threeMonthsAgo); // Start from 3 months ago

    // Iterate through each day from 3 months ago until today
    while (currentDate <= endDate) {
      const dateString = formatDate(currentDate);
      const currentDayEnd = new Date(currentDate);
      currentDayEnd.setHours(23, 59, 59, 999); // Set to end of the day for comparison

      // Add count of cards whose first learned date is on or before the current day
      while (
        learnedDateIndex < sortedLearnedDates.length &&
        sortedLearnedDates[learnedDateIndex] <= currentDayEnd
      ) {
        cumulativeCount++;
        learnedDateIndex++;
      }

      // Add the cumulative count for the current date
      cumulativeChartData.push({ date: dateString, count: cumulativeCount });

      // Move to the next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    // --- End Cumulative Count Calculation ---

    // Assign the cumulative data to the chartData variable
    const chartData = cumulativeChartData;
    // --- End chart data fetching ---

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

    return { statistics, chartData }; // Return both stats and chartData
  }

  const { statistics, chartData } = await getUserCardStatistics(userId);

  return {
    props: {
      userSettings: JSON.parse(JSON.stringify(userSettings)),
      stats: statistics,
      chartData: chartData, // Pass chartData as prop
    },
  };
}

// Update Props type to include chartData
type ChartDataPoint = { date: string; count: number };
type Props = UnwrapPromise<ReturnType<typeof getServerSideProps>>["props"] & {
  chartData: ChartDataPoint[];
};

export default function UserSettingsPage(props: Props) {
  const { userSettings, stats, chartData } = props; // Destructure chartData
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
                label="Card per day weekly target"
                description="Your weekly target is 7 times this value. Daily new cards will shrink or grow to meet this weekly target. Most users should pick a value between 7 and 21."
                id="cardsPerDayMax"
                name="cardsPerDayMax"
                value={settings.cardsPerDayMax}
                onChange={(value) => handleChange(value, "cardsPerDayMax")}
                min={1}
                required
              />

              <Radio.Group
                label="Playback your voice after recording?"
                description="Listening to your own voice is a good way to improve pronunciation"
                id="playbackPercentage"
                name="playbackPercentage"
                value={String(settings.playbackPercentage)}
                onChange={(value) => handleChange(value, "playbackPercentage")}
                required
              >
                <Radio value="1" label="Always" />
                <Radio value="0.125" label="Sometimes" />
                <Radio value="0" label="Never" />
              </Radio.Group>

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
                  // Ensure stats[key] exists before rendering
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

        {/* Add the Chart Section */}
        <Stack gap="md">
          <Title order={2}>
            Total Cards Learned (Cumulative, Last 3 Months)
          </Title>
          <Card withBorder shadow="xs" p="md" radius="md">
            <AreaChart
              h={300} // Set height for the chart
              data={chartData}
              dataKey="date" // Key for the x-axis (date)
              series={[
                { name: "count", color: "blue", label: "Total Learned" },
              ]} // Data series to plot
              curveType="natural" // Smoothen the line
              yAxisLabel="Total Cards Learned"
              xAxisLabel="Date"
              tooltipProps={{
                content: ({ label, payload }) => (
                  <Paper px="md" py="sm" withBorder shadow="md" radius="md">
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
              // Optional: Add grid lines, reference lines etc. if needed
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
