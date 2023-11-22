import { Button, Card, Container, NumberInput, Title } from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";
import Authed from "../components/authed";
import React, { useState } from "react";
import { trpc } from "@/utils/trpc";
import { notifications } from "@mantine/notifications";
import { getUserSettingsFromEmail } from "@/server/auth-helpers";
import { prismaClient } from "@/server/prisma-client";
import { UnwrapPromise } from "@prisma/client/runtime/library";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  async function getUserCardStatistics(userId: string) {
    // Calculate the timestamp for 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Calculate the timestamp for 1 week ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Query the database to retrieve the required statistics
    const uniqueCardsLast24Hours = await prismaClient.card.count({
      where: {
        userId,
        lastReview: {
          gte: twentyFourHoursAgo,
        },
      },
    });

    const uniqueCardsLastWeek = await prismaClient.card.count({
      where: {
        userId,
        lastReview: {
          gte: oneWeekAgo,
        },
      },
    });

    const newCardsLast24Hours = await prismaClient.card.count({
      where: {
        userId,
        firstReview: {
          gte: twentyFourHoursAgo,
        },
      },
    });

    const newCardsLastWeek = await prismaClient.card.count({
      where: {
        userId,
        firstReview: {
          gte: oneWeekAgo,
        },
      },
    });

    const currentTimeInSeconds = Math.floor(Date.now() / 1000);

    const cardsDueNext24Hours = await prismaClient.card.count({
      where: {
        userId,
        nextReviewAt: {
          lte: currentTimeInSeconds + 86400, // 86400 seconds in 24 hours
        },
      },
    });

    // Create an object to store the statistics
    const statistics = {
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
    console.log(settings);
  };

  return Authed(
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
          <p>Users on this server: {props.stats.globalUsers}</p>
          <p>
            Unique Cards Studied in Last 24 Hours:{" "}
            {props.stats.uniqueCardsLast24Hours}
          </p>
          <p>
            New Cards Studied in Last 24 Hours:{" "}
            {props.stats.newCardsLast24Hours}
          </p>
          <p>
            Unique Cards Studied in Last Week: {props.stats.uniqueCardsLastWeek}
          </p>
          <p>New Cards Studied in Last Week: {props.stats.newCardsLastWeek}</p>
          <p>Cards Due in Next 24 Hours: {props.stats.cardsDueNext24Hours}</p>
        </Card>
      </div>
    </Container>,
  );
}
