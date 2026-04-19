import {
  Box,
  Container,
  Grid,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import React from "react";
import {
  readerBodyFont,
  readerDecorStyle,
  readerDisplayFont,
  readerFrameStyle,
  readerHeadingColor,
  readerPageContainerStyle,
  readerPageSectionGap,
  readerPanelGap,
  readerPanelStyle,
  readerPanelSubtitleStyle,
  readerPanelTitleStyle,
} from "./theme";

type ReaderPageFrameProps = {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
};

export function ReaderPageFrame({
  children,
  size = "lg",
}: ReaderPageFrameProps) {
  return (
    <Container size={size} style={readerPageContainerStyle}>
      <Stack gap={readerPageSectionGap} style={readerFrameStyle}>
        <Box style={readerDecorStyle} />
        {children}
      </Stack>
    </Container>
  );
}

type ReaderPageHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
};

export function ReaderPageHeader({
  title,
  subtitle,
  rightSlot,
}: ReaderPageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
      <Stack gap={4} style={{ flex: "1 1 440px", minWidth: 0 }}>
        <Title
          order={2}
          style={{
            fontFamily: readerDisplayFont,
            color: readerHeadingColor,
            letterSpacing: "0.01em",
            lineHeight: 1.15,
            fontSize: "clamp(1.35rem, 2.7vw, 2rem)",
          }}
        >
          {title}
        </Title>
        {subtitle && (
          <Text
            size="sm"
            style={{
              ...readerPanelSubtitleStyle,
              fontFamily: readerBodyFont,
              maxWidth: 620,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </Text>
        )}
      </Stack>
      {rightSlot}
    </Group>
  );
}

type ReaderPanelProps = {
  children: React.ReactNode;
  gap?: number | string;
  style?: React.CSSProperties;
};

export function ReaderPanel({
  children,
  gap = readerPanelGap,
  style,
}: ReaderPanelProps) {
  const mergedStyle = style
    ? { ...readerPanelStyle, ...style }
    : readerPanelStyle;

  return (
    <Stack gap={gap} style={mergedStyle}>
      {children}
    </Stack>
  );
}

type ReaderPanelHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
};

export function ReaderPanelHeader({
  title,
  subtitle,
  rightSlot,
}: ReaderPanelHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
      <Stack gap={3} style={{ flex: "1 1 240px", minWidth: 0 }}>
        <Text size="sm" style={readerPanelTitleStyle}>
          {title}
        </Text>
        {subtitle && (
          <Text size="xs" style={readerPanelSubtitleStyle}>
            {subtitle}
          </Text>
        )}
      </Stack>
      {rightSlot}
    </Group>
  );
}

type ReaderSplitWorkspaceProps = {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  stickySecondary?: boolean;
  secondaryTopOffset?: string;
};

export function ReaderSplitWorkspace({
  primary,
  secondary,
  stickySecondary = false,
  secondaryTopOffset,
}: ReaderSplitWorkspaceProps) {
  if (!secondary) {
    return <Box>{primary}</Box>;
  }

  const secondaryColumnStyle: React.CSSProperties = {
    minWidth: 0,
  };
  const secondaryContentStyle: React.CSSProperties = {
    minWidth: 0,
  };

  if (stickySecondary) {
    secondaryColumnStyle.position = "sticky";
    secondaryColumnStyle.top = secondaryTopOffset ?? "86px";
    secondaryColumnStyle.alignSelf = "start";
  }

  return (
    <Grid gutter="clamp(10px, 1.5vw, 18px)" align="flex-start">
      <Grid.Col span={{ base: 12, md: 7, lg: 8 }}>
        <Box style={{ minWidth: 0 }}>{primary}</Box>
      </Grid.Col>
      <Grid.Col
        span={{ base: 12, md: 5, lg: 4 }}
        style={secondaryColumnStyle}
      >
        <Stack
          gap="clamp(10px, 1.2vw, 14px)"
          style={secondaryContentStyle}
        >
          {secondary}
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
