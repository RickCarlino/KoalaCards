import { trpc } from "@/utils/trpc";
import { Container, Grid, Center, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { UserSettings } from "@prisma/client";
import { signIn } from "next-auth/react";
import React, { createContext, useState, useEffect, useContext } from "react";

interface UserSettingsProviderProps {
  children: React.ReactNode;
}
const EMPTY: UserSettings = {
  id: 0,
  userId: "0",
  listeningPercentage: 0.5,
  playbackSpeed: 1,
  cardsPerDayMax: 21,
  playbackPercentage: 0.5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const UserSettingsContext = createContext<UserSettings>(EMPTY);

export const UserSettingsProvider = ({
  children,
}: UserSettingsProviderProps) => {
  const [userSettings, setUserSettings] = useState<UserSettings>(EMPTY);
  const getUserSettings = trpc.getUserSettings.useMutation();

  useEffect(() => {
    const err = (error: unknown) => {
      console.error("Failed to fetch user settings:", error);
      notifications.show({
        title: "Failed to fetch user settings",
        message: JSON.stringify(error),
        color: "red",
      });
    };
    getUserSettings.mutateAsync({}).then((userSettings) => {
      if (userSettings) {
        setUserSettings(userSettings);
      }
    }, err);
  }, []);

  const clickLogin = () => {
    alert([
      "NOTE TO NEW USERS: ",
      "Demo accounts use GPT-3.5 because GPT-4 is too expensive to give away for free.",
      "If you want to use GPT-4, please self-host or donate on Patreon.",
      "GPT-3.5 is still very good, but it sometimes requires user intervention to correct mistakes.",
    ]);
    signIn();
  };
  const login = (
    <Container size="s">
      <Grid grow justify="center" align="center">
        <Center style={{ height: "100%" }}>
          <Grid.Col>
            <h1>Not Logged In</h1>
            <Button onClick={clickLogin} size="xl">
              🔑 Click Here To Log In
            </Button>
          </Grid.Col>
        </Center>
      </Grid>
    </Container>
  );
  return (
    <UserSettingsContext.Provider value={userSettings || EMPTY}>
      {userSettings.id ? children : login}
    </UserSettingsContext.Provider>
  );
};

// Custom hook to use the context
export const useUserSettings = () => useContext(UserSettingsContext);
