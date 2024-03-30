import { Button, Card, Container, NumberInput, Title } from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";
import React, { useState } from "react";
import { trpc } from "@/koala/trpc-config";
import { notifications } from "@mantine/notifications";
import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { prismaClient } from "@/koala/prisma-client";
import { UnwrapPromise } from "@prisma/client/runtime/library";
import { getLessonMeta } from "@/koala/routers/get-next-quizzes";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

export async function getServerSideProps(context: GetServerSidePropsContext) {
  async function getUserCardStatistics(userId: string) {
    // Calculate the timestamp for 24 hours ago
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
    // Query the database to retrieve the required statistics
    const cardsDueNext24Hours = await prismaClient.quiz.count({
      where: {
        ...BASE_QUERY,
        nextReview: {
          lt: tomorrow,
        },
        lastReview: {
          lt: today,
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
    // Create an object to store the statistics
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
  // Grab the tRPC editUserSettings mutation:
  const editUserSettings = trpc.editUserSettings.useMutation();
  const handleChange = (value: number | string, name: string) => {
    setSettings({ ...settings, [name]: parseFloat("" + value) });
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
    ["totalCards", "total cards studied"],
    ["newCards", "new cards in deck"],
    ["quizzesDue", "Cards due now"],
    ["cardsDueNext24Hours", "Cards due next 24 hours"],
    ["newCardsLast24Hours", "New cards studied last 24 hours"],
    ["newCardsLastWeek", "New cards studied this week"],
    ["uniqueCardsLast24Hours", "Cards studied last 24 hours"],
    ["uniqueCardsLastWeek", "Cards studied this week"],
    ["globalUsers", "users on this server"],
  ];

  return (
    <Container size="s">
      <Title order={1}>User Settings</Title>
      <form onSubmit={handleSubmit}>
        {/* <NumberInput
          label="Audio playback speed percentage (50%-200%)"
          id="playbackSpeed"
          name="playbackSpeed"
          value={settings.playbackSpeed}
          onChange={(value) => handleChange(value, "playbackSpeed")}
          min={0.5}
          max={2}
          step={0.05}
          required
        /> */}
        <NumberInput
          label="Maximum new cards introduced in a 24 hour period"
          id="cardsPerDayMax"
          name="cardsPerDayMax"
          value={settings.cardsPerDayMax}
          onChange={(value) => handleChange(value, "cardsPerDayMax")}
          min={1}
          required
        />
        <NumberInput
          label="Percentage of user recorded audio played back after a speaking test."
          id="playbackPercentage"
          name="playbackPercentage"
          value={settings.playbackPercentage}
          onChange={(value) => handleChange(value, "playbackPercentage")}
          min={0}
          max={1}
          step={0.05}
          required
        />
        <Button type="submit" mt="md">
          Save Settings
        </Button>
      </form>
      <div>
        <h1>Statistics</h1>
        <Card shadow="xs" padding="md" radius="sm">
          {labels.map(([key, label]) => {
            return (
              <div key={key}>
                <b>{label}</b>: {stats[key]}
              </div>
            );
          })}
        </Card>
      </div>
    </Container>
  );
}
