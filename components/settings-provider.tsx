import { trpc } from "@/utils/trpc";
import { notifications } from "@mantine/notifications";
import { UserSettings, User } from "@prisma/client";
import React, { createContext, useState, useEffect, useContext } from "react";

type LocalUserSettings = UserSettings & { user: User };

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
    const ok = (userSettings: LocalUserSettings) => {
      setUserSettings(userSettings);
    };
    getUserSettings.mutateAsync({}).then(ok, err);
  }, []);

  return (
    <UserSettingsContext.Provider value={userSettings || EMPTY}>
      {userSettings.id ? children : null}
    </UserSettingsContext.Provider>
  );
};

// Custom hook to use the context
export const useUserSettings = () => useContext(UserSettingsContext);
