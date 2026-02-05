import { trpc } from "@/koala/trpc-config";
import { Container, Grid, Center, Button } from "@mantine/core";
import { fullHeightStyle } from "./styles";
import { notifications } from "@mantine/notifications";
import { signIn } from "next-auth/react";
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
} from "react";
import { REVIEW_TAKE_DEFAULT } from "@/koala/settings/review-take";
import {
  REQUESTED_RETENTION_DEFAULT,
  resolveRequestedRetention,
} from "@/koala/settings/requested-retention";

type AppUserSettings = {
  id: number;
  userId: string;
  playbackSpeed: number;
  cardsPerDayMax: number;
  maxLapses: number;
  reviewTakeCount: number;
  requestedRetention: number;
  playbackPercentage: number;
  responseTimeoutSeconds: number;
  createdAt: Date;
  updatedAt: Date;
  dailyWritingGoal: number;
  writingFirst: boolean;
};

type AppUserSettingsInput = Omit<
  AppUserSettings,
  "reviewTakeCount" | "requestedRetention" | "maxLapses"
> & {
  reviewTakeCount?: number;
  requestedRetention?: number;
  maxLapses?: number;
};

interface UserSettingsProviderProps {
  children: React.ReactNode;
}

const pickAppUserSettings = (
  input: AppUserSettingsInput,
): AppUserSettings => ({
  id: input.id,
  userId: input.userId,
  playbackSpeed: input.playbackSpeed,
  cardsPerDayMax: input.cardsPerDayMax,
  maxLapses: input.maxLapses ?? 0,
  reviewTakeCount: input.reviewTakeCount ?? REVIEW_TAKE_DEFAULT,
  requestedRetention: resolveRequestedRetention(input.requestedRetention),
  playbackPercentage: input.playbackPercentage,
  responseTimeoutSeconds: input.responseTimeoutSeconds ?? 0,
  createdAt: input.createdAt,
  updatedAt: input.updatedAt,
  dailyWritingGoal: input.dailyWritingGoal,
  writingFirst: input.writingFirst,
});

const EMPTY: AppUserSettings = {
  id: 0,
  userId: "0",
  playbackSpeed: 1,
  cardsPerDayMax: 42,
  maxLapses: 0,
  reviewTakeCount: REVIEW_TAKE_DEFAULT,
  requestedRetention: REQUESTED_RETENTION_DEFAULT,
  playbackPercentage: 0.5,
  responseTimeoutSeconds: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  dailyWritingGoal: 300,
  writingFirst: false,
};

const UserSettingsContext = createContext<AppUserSettings>(EMPTY);

export const useUserSettings = (): AppUserSettings => {
  return useContext(UserSettingsContext);
};

export const UserSettingsProvider = ({
  children,
}: UserSettingsProviderProps) => {
  const [userSettings, setUserSettings] = useState<AppUserSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const getUserSettings = trpc.getUserSettings.useMutation();

  useEffect(() => {
    const err = (error: unknown) => {
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
          setUserSettings(pickAppUserSettings(userSettings));
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
