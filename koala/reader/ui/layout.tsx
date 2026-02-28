import { Box, Container, Group, Stack, Text, Title } from "@mantine/core";
import React from "react";
import {
  readerBodyFont,
  readerDecorStyle,
  readerDisplayFont,
  readerFrameStyle,
  readerPanelStyle,
} from "./theme";

type ReaderPageFrameProps = {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
};

export function ReaderPageFrame({
  children,
  size = "lg",
}: ReaderPageFrameProps) {
  return (
    <Container size={size} mt="xl" pb="xl">
      <Stack gap="lg" style={readerFrameStyle}>
        <Box style={readerDecorStyle} />
        {children}
      </Stack>
    </Container>
  );
}

type ReaderPageHeaderProps = {
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
};

export function ReaderPageHeader({
  title,
  subtitle,
  rightSlot,
}: ReaderPageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
      <Stack gap={4}>
        <Title
          order={2}
          style={{
            fontFamily: readerDisplayFont,
            color: "#4b2f3f",
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </Title>
        <Text
          size="sm"
          style={{
            color: "#7c5a69",
            fontFamily: readerBodyFont,
            maxWidth: 620,
          }}
        >
          {subtitle}
        </Text>
      </Stack>
      {rightSlot}
    </Group>
  );
}

type ReaderPanelProps = {
  children: React.ReactNode;
};

export function ReaderPanel({ children }: ReaderPanelProps) {
  return <Stack style={readerPanelStyle}>{children}</Stack>;
}
