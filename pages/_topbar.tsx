import React from "react";
import Link from "next/link";
import Image from "next/image";
import { AppShell, Group, useMantineTheme } from "@mantine/core";

interface TopBarProps {
  children: React.ReactNode;
}

const TopBar = ({ children }: TopBarProps) => {
  const theme = useMantineTheme();

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
          </Link>
        </Group>
      </AppShell.Header>

      <AppShell.Main
        style={{
          backgroundColor: theme.colors.pink[0],
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 222, 235, 0.3) 100%)",
        }}
      >
        {children}
      </AppShell.Main>
    </AppShell>
  );
};

export default TopBar;
