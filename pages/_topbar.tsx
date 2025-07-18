import React from "react";
import Link from "next/link";
import Image from "next/image";
import { AppShell, Group, useMantineTheme } from "@mantine/core";
import { IconArrowBack } from "@tabler/icons-react";

interface TopBarProps {
  children: React.ReactNode;
}

const TopBar = ({ children }: TopBarProps) => {
  const theme = useMantineTheme();
  const logo = (
    <Image
      src="/nav.png"
      alt="Koala Cards Logo"
      width={150}
      height={50}
      style={{
        display: "block",
        objectFit: "contain",
        maxHeight: "100%",
      }}
    />
  );
  const backButton = (
    <IconArrowBack size={24} color={theme.colors.pink[7]} />
  );
  const topThing = window.location.pathname === "/" ? logo : backButton;
  return (
    <AppShell
      header={{ height: { base: 60, md: 70, lg: 80 } }}
      padding="md"
      styles={{
        header: {
          backgroundColor: theme.colors.pink[0],
          borderBottom: `1px solid ${theme.colors.pink[2]}`,
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="center">
          <Link href="/" style={{ textDecoration: "none" }}>
            {topThing}
          </Link>
        </Group>
      </AppShell.Header>

      <AppShell.Main
        style={{
          backgroundColor: theme.colors.pink[0],
        }}
      >
        {children}
      </AppShell.Main>
    </AppShell>
  );
};

export default TopBar;
