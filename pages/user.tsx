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
import { notifications } from "@mantine/notifications";
import { UnwrapPromise } from "@prisma/client/runtime/library";
import { GetServerSidePropsContext } from "next";
import { getSession, signOut } from "next-auth/react";
import React, { useState } from "react";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

export async function getServerSideProps(context: GetServerSidePropsContext) {
  async function getUserCardStatistics(userId: string) {
    const today = Date.now();
    const oneWeekAgo = today - ONE_WEEK;
    const yesterday = today - ONE_DAY;
    const tomorrow = today + ONE_DAY;

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
          lt: tomorrow,
        },
        firstReview: {
          gt: 0,
        },
      },
    });
    const newCardsLast24Hours = await prismaClient.quiz.count({
      where: {
        ...BASE_QUERY,
        firstReview: {
          gte: yesterday,
        },
      },
    });
    const newCardsLastWeek = await prismaClient.quiz.count({
      where: {
        ...BASE_QUERY,
        firstReview: {
          gte: oneWeekAgo,
        },
      },
    });
    const uniqueCardsLast24Hours = await prismaClient.quiz.count({
      where: {
        ...BASE_QUERY,
        lastReview: {
          gte: yesterday,
        },
      },
    });
    const uniqueCardsLastWeek = await prismaClient.quiz.count({
      where: {
        ...BASE_QUERY,
        lastReview: {
          gte: oneWeekAgo,
        },
      },
    });

    const statistics = {
      ...(await getLessonMeta(userId)),
      uniqueCardsLast24Hours,
      uniqueCardsLastWeek,
      newCardsLast24Hours,
      newCardsLastWeek,
      cardsDueNext24Hours,
      globalUsers: await prismaClient.user.count(),
    };

    return statistics;
  }

  const session = await getSession({ req: context.req });
  const userSettings = await getUserSettingsFromEmail(session?.user?.email);
  return {
    props: {
      userSettings: JSON.parse(JSON.stringify(userSettings)),
      stats: await getUserCardStatistics(userSettings.userId),
    },
  };
}

type Props = UnwrapPromise<ReturnType<typeof getServerSideProps>>["props"];

export default function UserSettingsPage(props: Props) {
  const { userSettings } = props;
  const [settings, setSettings] = useState(userSettings);
  const editUserSettings = trpc.editUserSettings.useMutation();
  const lr = trpc.levelReviews.useMutation();

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

  const stats = props.stats;
  const labels: [keyof typeof stats, string][] = [
    ["totalCards", "Total cards studied"],
    ["newCards", "New cards in deck"],
    ["quizzesDue", "Cards due now"],
    ["cardsDueNext24Hours", "Cards due next 24 hours"],
    ["newCardsLast24Hours", "New cards studied last 24 hours"],
    ["newCardsLastWeek", "New cards studied this week"],
    ["uniqueCardsLast24Hours", "Cards studied last 24 hours"],
    ["uniqueCardsLastWeek", "Cards studied this week"],
    ["globalUsers", "Users on this server"],
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
                label="Max new quizzes per day"
                description="Maximum number of new quizzes (usually 2 per card) in a 24-hour period"
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
              {labels.map(([key, label]) => (
                <Group key={key} gap="xs">
                  <Text fw={500}>{label}:</Text>
                  <Text>{stats[key]}</Text>
                </Group>
              ))}
            </Stack>
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
          <Title order={2}>Level Reviews</Title>
          <Text size="sm">
            If you have too many cards due, you can level your review schedule.
            This will evenly distribute older cards over the next 7 days.
            <br />
            <strong>This operation is irreversible.</strong>
          </Text>
          <Card withBorder shadow="xs" p="md" radius="md">
            <Button
              variant="outline"
              color="red"
              onClick={() =>
                lr.mutateAsync({}).then(
                  ({ count }) => {
                    notifications.show({
                      title: "Success",
                      message: `Leveled ${count} cards.`,
                      color: "green",
                    });
                  },
                  () => {
                    notifications.show({
                      title: "Error",
                      message: "Error leveling cards.",
                      color: "red",
                    });
                  },
                )
              }
            >
              Level Reviews
            </Button>
          </Card>
        </Stack>
      </Stack>
    </Container>
  );
}
