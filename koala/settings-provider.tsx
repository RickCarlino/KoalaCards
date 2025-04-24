import { trpc } from "@/koala/trpc-config";
import { Container, Grid, Center, Button } from "@mantine/core";
import { fullHeightStyle } from "./styles";
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
  playbackSpeed: 1,
  cardsPerDayMax: 42,
  playbackPercentage: 0.5,
  createdAt: new Date(),
  updatedAt: new Date(),
  dailyWritingGoal: 300,
  writingFirst: false,
};

const UserSettingsContext = createContext<UserSettings>(EMPTY);

export const UserSettingsProvider = ({
  children,
}: UserSettingsProviderProps) => {
  const [userSettings, setUserSettings] = useState<UserSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
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
    getUserSettings
      .mutateAsync({})
      .then((userSettings) => {
        if (userSettings) {
          setUserSettings(userSettings);
        }
      }, err)
      .finally(() => setLoading(false));
  }, []);

  const clickLogin = () => signIn();
  const login = (
    <Container size="s">
      <Grid grow justify="center" align="center">
        <Center style={fullHeightStyle}>
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
  const a = <div>Loading...</div>;
  const b = userSettings.id ? children : login;
  return (
    <UserSettingsContext.Provider value={userSettings || EMPTY}>
      {loading ? a : b}
    </UserSettingsContext.Provider>
  );
};

// Custom hook to use the context
export const useUserSettings = () => useContext(UserSettingsContext);
