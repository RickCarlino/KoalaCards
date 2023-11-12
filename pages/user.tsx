import { prismaClient } from "@/server/prisma-client";
import { Container } from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";
import Authed from "../components/authed";
import { UserSettings } from "@prisma/client";

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

type SettingsDisplayProps<T extends keyof UserSettings> = {
  setting: T;
  description: string;
  value: UserSettings[T];
};

function SettingsDisplay<T extends keyof UserSettings>(
  props: SettingsDisplayProps<T>,
) {
  return (
    <li>
      <label>
        {props.description}
        <input type="text" value={"" + props.value} />
      </label>
    </li>
  );
}

type Props = {
  userSettings: UserSettings;
};

export default function User(props: Props) {
  return Authed(
    <Container size="s">
      <h1>THIS DOESN'T WORK YET</h1>
      <ul>
        <SettingsDisplay
          setting={"playbackPercentage"}
          description={
            "What percentage of recordings will be played back to you for review?"
          }
          value={props.userSettings.playbackPercentage}
        />
      </ul>
    </Container>,
  );
}
