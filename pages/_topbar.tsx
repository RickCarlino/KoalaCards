import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AppShell,
  Box,
  Group,
  Text,
  ThemeIcon,
  useMantineTheme,
} from "@mantine/core";
import { IconArrowBack } from "@tabler/icons-react";
import { useRouter } from "next/router";

interface TopBarProps {
  children: React.ReactNode;
}

const exactRouteTitles: Record<string, string> = {
  "/": "Home",
  "/review": "Review",
  "/create": "Create",
  "/cards": "Cards",
  "/reader": "Reading",
  "/writing": "Writing",
  "/recent": "Recent",
  "/user": "Settings",
  "/train": "Train",
  "/admin": "Admin",
};

const prefixRouteTitles: Array<[string, string]> = [
  ["/review/", "Study Session"],
  ["/cards/", "Cards"],
  ["/reader/", "Reading"],
  ["/writing/", "Writing"],
  ["/user/", "Settings"],
  ["/link/", "Admin"],
];

function resolveSectionTitle(pathname: string): string {
  const exact = exactRouteTitles[pathname];
  if (exact) {
    return exact;
  }

  const prefixMatch = prefixRouteTitles.find(([prefix]) =>
    pathname.startsWith(prefix),
  );

  if (prefixMatch) {
    return prefixMatch[1];
  }

  return "Koala Cards";
}

const TopBar = ({ children }: TopBarProps) => {
  const theme = useMantineTheme();
  const router = useRouter();
  const sectionTitle = resolveSectionTitle(router.pathname);

  const isHome = router.pathname === "/";
  const isReaderDocumentRoute =
    router.pathname === "/reader/[publicId]" ||
    router.pathname === "/reader/books/[publicId]";

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
  const homeButton = (
    <ThemeIcon
      variant="light"
      color="pink"
      radius="md"
      size="md"
      aria-label="Go home"
    >
      <IconArrowBack size={18} />
    </ThemeIcon>
  );

  if (isReaderDocumentRoute) {
    return (
      <AppShell padding={0}>
        <AppShell.Main
          style={{
            minHeight: "100vh",
          }}
        >
          {children}
        </AppShell.Main>
      </AppShell>
    );
  }

  if (isHome) {
    return (
      <AppShell
        header={{ height: { base: 60, md: 70, lg: 80 } }}
        padding={0}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="center">
            <Link href="/" style={{ textDecoration: "none" }}>
              {logo}
            </Link>
          </Group>
        </AppShell.Header>

        <AppShell.Main
          style={{
            minHeight: "100vh",
          }}
        >
          {children}
        </AppShell.Main>
      </AppShell>
    );
  }

  return (
    <AppShell
      header={{ height: { base: 60, md: 70, lg: 80 } }}
      padding={0}
    >
      <AppShell.Header>
        <Group
          h="100%"
          px="md"
          justify="space-between"
          wrap="nowrap"
          gap="sm"
        >
          <Link href="/" style={{ textDecoration: "none" }}>
            {homeButton}
          </Link>
          <Text
            fw={700}
            c={theme.colors.pink[8]}
            truncate
            style={{
              minWidth: 0,
              flex: "1 1 auto",
              textAlign: "center",
            }}
          >
            {sectionTitle}
          </Text>
          <Box w={28} h={28} />
        </Group>
      </AppShell.Header>

      <AppShell.Main
        style={{
          minHeight: "100vh",
        }}
      >
        {children}
      </AppShell.Main>
    </AppShell>
  );
};

export default TopBar;
