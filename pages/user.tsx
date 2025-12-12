import { trpc } from "@/koala/trpc-config";
import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { PreferencesForm } from "@/koala/user/components/PreferencesForm";
import { ProgressChartCard } from "@/koala/user/components/ProgressChartCard";
import { QuickStatsCard } from "@/koala/user/components/QuickStatsCard";
import { UserHeader } from "@/koala/user/components/UserHeader";
import { serializeUserSettings } from "@/koala/user/serialize-user-settings";
import { getUserProgressData } from "@/koala/user/user-progress-data";
import {
  EditableUserSettings,
  ChartDataPoint,
  QuickStat,
  SerializedUserSettings,
  toEditableUserSettings,
} from "@/koala/user/types";
import { Container, Divider, Grid, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import React, { useState } from "react";

type Props = {
  userSettings: SerializedUserSettings;
  quickStats: QuickStat[];
  cardChartData: ChartDataPoint[];
  writingChartData: ChartDataPoint[];
};

export const getServerSideProps: GetServerSideProps<Props> = async (
  context,
) => {
  const session = await getSession({ req: context.req });
  const email = session?.user?.email;
  if (!email) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const userSettings = await getUserSettingsFromEmail(email);
  const { quickStats, cardChartData, writingChartData } =
    await getUserProgressData({
      userId: userSettings.userId,
      cardsPerDayMax: userSettings.cardsPerDayMax,
    });

  return {
    props: {
      userSettings: serializeUserSettings(userSettings),
      quickStats,
      cardChartData,
      writingChartData,
    },
  };
};

export default function UserSettingsPage(props: Props) {
  const editUserSettings = trpc.editUserSettings.useMutation();
  const [settings, setSettings] = useState<EditableUserSettings>(() =>
    toEditableUserSettings(props.userSettings),
  );

  const buildMutationInput = (next: EditableUserSettings) => ({
    id: next.id,
    playbackSpeed: next.playbackSpeed,
    cardsPerDayMax: next.cardsPerDayMax,
    playbackPercentage: next.playbackPercentage,
    dailyWritingGoal: next.dailyWritingGoal,
    writingFirst: next.writingFirst,
    performCorrectiveReviews: next.performCorrectiveReviews,
    updatedAt: new Date(next.updatedAt),
  });

  const saveSettings = async () => {
    try {
      await editUserSettings.mutateAsync(buildMutationInput(settings));
      location.reload();
    } catch (error: unknown) {
      notifications.show({
        title: "Error",
        message: `Error: ${JSON.stringify(error).slice(0, 100)}`,
        color: "red",
      });
    }
  };

  return (
    <Container size="lg" mt="xl">
      <Stack gap="lg">
        <UserHeader user={settings.user} />

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <PreferencesForm
              settings={settings}
              onChange={setSettings}
              onSave={saveSettings}
              isSaving={editUserSettings.isLoading}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="md">
              <QuickStatsCard stats={props.quickStats} />
            </Stack>
          </Grid.Col>
        </Grid>

        <Divider label="Progress" labelPosition="center" my="sm" />

        <Grid gutter="lg">
          <ProgressChartCard
            title="Total Cards Learned (90 Days)"
            data={props.cardChartData}
            seriesLabel="Total Learned"
            yAxisLabel="Cards Learned"
          />
          <ProgressChartCard
            title="Total Writing Progress (90 Days)"
            data={props.writingChartData}
            seriesLabel="Total"
            yAxisLabel="Characters Written"
          />
        </Grid>
      </Stack>
    </Container>
  );
}
