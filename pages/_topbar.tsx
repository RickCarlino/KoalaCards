import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AppShell,
  ActionIcon,
  Box,
  Group,
  Menu,
  Text,
  ThemeIcon,
  useMantineTheme,
} from "@mantine/core";
import { IconArrowBack, IconMenu2 } from "@tabler/icons-react";
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

function NavigationMenu({ pathname }: { pathname: string }) {
  return (
    <Menu position="bottom-end" width={220}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="pink.8"
          aria-label="Open navigation"
        >
          <IconMenu2 size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {Object.entries(exactRouteTitles)
          .filter(([href]) => href !== "/train" && href !== "/admin")
          .map(([href, label]) => (
            <Menu.Item
              key={href}
              component={Link}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              c={pathname === href ? "pink.8" : undefined}
              mih={44}
            >
              {label}
            </Menu.Item>
          ))}
      </Menu.Dropdown>
    </Menu>
  );
}

const TopBar = ({ children }: TopBarProps) => {
  const theme = useMantineTheme();
  const router = useRouter();
  const sectionTitle = resolveSectionTitle(router.pathname);

  const isHome = router.pathname === "/";
  const isReaderRoute =
    router.pathname === "/reader" ||
    router.pathname.startsWith("/reader/");
  const headerHeight = isReaderRoute ? { base: 60, md: 70, lg: 80 } : 64;
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
      <AppShell header={{ height: headerHeight }} padding={0}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Box w={44} />
            <Link href="/" style={{ textDecoration: "none" }}>
              {logo}
            </Link>
            <NavigationMenu pathname={router.pathname} />
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
    <AppShell header={{ height: headerHeight }} padding={0}>
      <AppShell.Header>
        <Group
          h="100%"
          px="md"
          justify="space-between"
          wrap="nowrap"
          gap="sm"
        >
          {isReaderRoute ? (
            <Link href="/" style={{ textDecoration: "none" }}>
              {homeButton}
            </Link>
          ) : (
            <ActionIcon
              component={Link}
              href="/"
              variant="subtle"
              color="pink.8"
              aria-label="Go home"
            >
              <IconArrowBack size={20} />
            </ActionIcon>
          )}
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
          {isReaderRoute ? (
            <Box w={28} h={28} />
          ) : (
            <NavigationMenu pathname={router.pathname} />
          )}
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
