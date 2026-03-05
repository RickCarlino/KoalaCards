import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AppShell,
  Box,
  Group,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { IconArrowBack } from "@tabler/icons-react";
import { useRouter } from "next/router";

interface TopBarProps {
  children: React.ReactNode;
}

const TopBar = ({ children }: TopBarProps) => {
  const theme = useMantineTheme();
  const router = useRouter();
  const [pageTitle, setPageTitle] = React.useState("Reader");

  const isHome = router.pathname === "/";
  const isReaderArticleRoute = router.pathname === "/reader/[publicId]";

  React.useEffect(() => {
    if (!isReaderArticleRoute) {
      return;
    }

    const updateTitle = () => {
      const rawTitle = document.title.trim();
      const cleanedTitle = rawTitle
        .replace(/\s*(?:·|-|\|)\s*Koala Cards\s*$/i, "")
        .trim();

      if (cleanedTitle.length > 0) {
        setPageTitle(cleanedTitle);
        return;
      }

      setPageTitle("Reader");
    };

    updateTitle();
    const titleElement = document.querySelector("title");
    if (!titleElement) {
      return;
    }

    const observer = new MutationObserver(() => {
      updateTitle();
    });
    observer.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [isReaderArticleRoute, router.asPath]);

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

  if (isReaderArticleRoute) {
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
            <Link href="/reader" style={{ textDecoration: "none" }}>
              {backButton}
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
              {pageTitle}
            </Text>
            <Box w={24} h={24} />
          </Group>
        </AppShell.Header>

        <AppShell.Main
          style={{
            background: `linear-gradient(180deg, ${theme.colors.pink[0]} 0%, #FFFFFF 38%)`,
            minHeight: "100vh",
          }}
        >
          {children}
        </AppShell.Main>
      </AppShell>
    );
  }

  const topThing = isHome ? logo : backButton;
  return (
    <AppShell
      header={{ height: { base: 60, md: 70, lg: 80 } }}
      padding={0}
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
          background: `linear-gradient(180deg, ${theme.colors.pink[0]} 0%, #FFFFFF 38%)`,
          minHeight: "100vh",
        }}
      >
        {children}
      </AppShell.Main>
    </AppShell>
  );
};

export default TopBar;
