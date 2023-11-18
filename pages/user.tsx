import { prismaClient } from "@/server/prisma-client";
import { Button, Container, NumberInput, Title } from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";
import Authed from "../components/authed";
import { UserSettings } from "@prisma/client";
import React, { useState } from "react";
import { trpc } from "@/utils/trpc";
import { notifications } from "@mantine/notifications";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getSession({ req: context.req });
  const userId =
    "" +
    (
      await prismaClient.user.findUnique({
        where: { email: session?.user?.email || "" },
      })
    )?.id;
  if (!userId) {
    throw new Error("User not found");
  }

  const userSettings = await prismaClient.userSettings.upsert({
    where: { userId: userId },
    update: {},
    create: { userId },
  });
  // Pass the transcripts to the page via props
  // TODO: Why does this not work with dates?
  return { props: { userSettings: JSON.parse(JSON.stringify(userSettings)) } };
}

type Props = {
  userSettings: UserSettings;
};

export default function UserSettingsPage(props: Props) {
  const { userSettings } = props;
  const [settings, setSettings] = useState(userSettings);
  // Grab the tRPC editUserSettings mutation:
  const editUserSettings = trpc.editUserSettings.useMutation();
  const handleChange = (value: number | string, name: string) => {
    setSettings({ ...settings, [name]: value });
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
          label="Maximum new cards introduced in a 21 hour period"
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
    </Container>,
  );
}
