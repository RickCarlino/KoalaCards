import { Button, Card, Container, NumberInput, Title } from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";
import React, { useState } from "react";
import { trpc } from "@/utils/trpc";
import { notifications } from "@mantine/notifications";
import { getUserSettingsFromEmail } from "@/server/auth-helpers";
import { prismaClient } from "@/server/prisma-client";
import { UnwrapPromise } from "@prisma/client/runtime/library";
import { getLessonMeta } from "@/server/routers/get-next-quizzes";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  async function getUserCardStatistics(userId: string) {
    // Calculate the timestamp for 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Calculate the timestamp for 1 week ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Query the database to retrieve the required statistics
    const cardsDueNext24Hours = -1;
    const newCardsLast24Hours = -1;
    const newCardsLastWeek = -1;
    const uniqueCardsLast24Hours = -1;
    const uniqueCardsLastWeek = -1;

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
      // TODO: Why does this not work with dates?
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
          console.log(error);
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
    ["quizzesDue", "Cards due now"],
    ["uniqueCardsLast24Hours", "Cards studied last 24 hours"],
    ["newCardsLast24Hours", "New cards studied last 24 hours"],
    ["uniqueCardsLastWeek", "Cards studied this week"],
    ["newCardsLastWeek", "New cards studied this week"],
    ["cardsDueNext24Hours", "Cards due next 24 hours"],
    ["totalCards", "total cards studied"],
    ["newCards", "new cards in deck"],
    ["globalUsers", "users on this server"],
  ];

  return (
    <Container size="s">
      <Title order={1}>User Settings</Title>
      <form onSubmit={handleSubmit}>
        <NumberInput
          label="Percentage of tests that should be listening tests"
          id="listeningPercentage"
          name="listeningPercentage"
          value={settings.listeningPercentage}
          onChange={(value) => handleChange(value, "listeningPercentage")}
          min={0}
          max={1}
          step={0.05}
          required
        />
        <NumberInput
          label="Audio playback speed percentage (50%-200%)"
          id="playbackSpeed"
          name="playbackSpeed"
          value={settings.playbackSpeed}
          onChange={(value) => handleChange(value, "playbackSpeed")}
          min={0.5}
          max={2}
          step={0.05}
          required
        />
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
