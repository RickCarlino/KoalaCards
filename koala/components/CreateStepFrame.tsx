import { Flex, Paper, Title, useMantineTheme } from "@mantine/core";
import React from "react";
import { paperStyle, titleStyle } from "../styles";

type CreateStepFrameProps = {
  children: React.ReactNode;
  title: string;
};

export function CreateStepFrame({
  children,
  title,
}: CreateStepFrameProps) {
  const theme = useMantineTheme();

  return (
    <Paper withBorder p="xl" radius="lg" style={paperStyle(theme)}>
      <Flex direction="column" gap="md">
        <Title order={3} mb="xs" style={titleStyle(theme)}>
          {title}
        </Title>
        {children}
      </Flex>
    </Paper>
  );
}
