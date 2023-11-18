import { prismaClient } from "@/server/prisma-client";
import { Container } from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";
import Authed from "../components/authed";
import { UserSettings } from "@prisma/client";
import React, { useState } from "react";

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
  return { props: { userSettings: JSON.parse(JSON.stringify(userSettings)) } };
}

type Props = {
  userSettings: UserSettings;
};

export default function UserSettingsPage(props: Props) {
  const { userSettings } = props;
  const [settings, setSettings] = useState(userSettings);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: value });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(settings);
  };

  return Authed(
    <Container size="s">
      <h1>User Settings</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="listeningPercentage">Listening Percentage</label>
          <input
            type="number"
            id="listeningPercentage"
            name="listeningPercentage"
            value={settings.listeningPercentage}
            onChange={handleChange}
            min="0"
            max="1"
            step="0.01"
          />
        </div>
        <div>
          <label htmlFor="playbackSpeed">Playback Speed</label>
          <input
            type="number"
            id="playbackSpeed"
            name="playbackSpeed"
            value={settings.playbackSpeed}
            onChange={handleChange}
            min="0.5"
            max="2"
            step="0.1"
          />
        </div>
        <div>
          <label htmlFor="cardsPerDayMax">Cards Per Day Max</label>
          <input
            type="number"
            id="cardsPerDayMax"
            name="cardsPerDayMax"
            value={settings.cardsPerDayMax}
            onChange={handleChange}
            min="1"
          />
        </div>
        <div>
          <label htmlFor="playbackPercentage">Playback Percentage</label>
          <input
            type="number"
            id="playbackPercentage"
            name="playbackPercentage"
            value={settings.playbackPercentage}
            onChange={handleChange}
            min="0"
            max="1"
            step="0.01"
          />
        </div>
        <button type="submit">Save Settings</button>
      </form>
    </Container>,
  );
}
