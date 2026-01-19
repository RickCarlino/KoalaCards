import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import {
  Card,
  Container,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMantineTheme,
} from "@mantine/core";
import {
  IconBrandDiscord,
  IconBrandGithub,
  IconCards,
  IconFileText,
  IconPencil,
  IconPlus,
  IconSettings,
  IconStar,
} from "@tabler/icons-react";
import Link from "next/link";
import { GetServerSideProps } from "next/types";
import * as React from "react";

interface IndexProps {
  hasCards: boolean;
  didStudy: boolean;
  didWrite: boolean;
}

interface NavItem {
  path: (props: IndexProps) => string;
  name: string;
  show: (props: IndexProps) => boolean;
  blink: (props: IndexProps) => boolean;
  icon: typeof IconStar;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }
  const cardCount = await prismaClient.card.count({
    where: { userId: dbUser.id },
  });

  const reviewCount = await prismaClient.card.count({
    where: { userId: dbUser.id, repetitions: { gt: 0 } },
  });

  const writingCount = await prismaClient.writingSubmission.count({
    where: { userId: dbUser.id },
  });

  return {
    props: {
      hasCards: cardCount > 0,
      didStudy: reviewCount > 0,
      didWrite: writingCount > 0,
    },
  };
};

const navItems: NavItem[] = [
  {
    path: () => "/review",
    name: "Study Cards",
    show: (props) => props.hasCards,
    blink: (props) => props.hasCards && !props.didStudy,
    icon: IconStar,
  },
  {
    path: () => "/writing/practice",
    name: "Writing Practice",
    show: () => true,
    blink: () => false,
    icon: IconPencil,
  },
  {
    path: () => "/create",
    name: "Create Cards",
    show: (_props) => true,
    blink: (props) => !props.hasCards,
    icon: IconPlus,
  },
  {
    path: () => "/cards",
    name: "View Cards",
    show: (props) => props.hasCards && props.didStudy,
    blink: () => false,
    icon: IconCards,
  },
  {
    path: () => "/writing",
    name: "Writing History",
    show: (props) => props.didWrite,
    blink: () => false,
    icon: IconFileText,
  },
  {
    path: () => "/user",
    name: "Settings",
    show: (props) => props.hasCards && props.didStudy,
    blink: () => false,
    icon: IconSettings,
  },
  {
    path: () => "https://github.com/RickCarlino/KoalaCards",
    name: "GitHub",
    show: (props) => props.hasCards && props.didStudy,
    blink: () => false,
    icon: IconBrandGithub,
  },
  {
    path: () => "https://discord.gg/jj7wXhQWJe",
    name: "Discord",
    show: (props) => props.hasCards && props.didStudy,
    blink: () => false,
    icon: IconBrandDiscord,
  },
];

type NavCardProps = {
  item: NavItem;
  href: string;
  attention: boolean;
  isExternal: boolean;
};

function NavCard({ item, href, attention, isExternal }: NavCardProps) {
  const theme = useMantineTheme();
  const Icon = item.icon;
  const styles = {
    root: {
      cursor: "pointer",
      display: "block",
      textDecoration: "none",
      color: "inherit",
      "&:focus-visible": {
        outline: `2px solid ${theme.colors.pink[5]}`,
        outlineOffset: 2,
      },
      ...(attention
        ? {
            borderColor: theme.colors.pink[4],
            boxShadow: theme.shadows.sm,
          }
        : {}),
    },
  };

  if (isExternal) {
    return (
      <Card
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        styles={styles}
        p="sm"
      >
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color="pink" radius="md" size="md">
            <Icon size={18} stroke={1.5} />
          </ThemeIcon>
          <Text size="sm" fw={600} c="pink.7">
            {item.name}
          </Text>
        </Group>
      </Card>
    );
  }

  return (
    <Card component={Link} href={href} styles={styles} p="sm">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" color="pink" radius="md" size="md">
          <Icon size={18} stroke={1.5} />
        </ThemeIcon>
        <Text size="sm" fw={600} c="pink.7">
          {item.name}
        </Text>
      </Group>
    </Card>
  );
}

const Index: React.FC<IndexProps> = (props) => {
  const visibleItems = navItems.filter((item) => item.show(props));

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="xs" mb="xl">
        <Title order={1} c="pink.7" ta="center">
          Welcome to Koala Cards
        </Title>
        <Text size="md" c="gray.7" ta="center">
          Your language learning marsupial companion.
        </Text>
      </Stack>

      <Stack gap="sm">
        {visibleItems.map((item) => {
          const href = item.path(props);
          const isExternal = href.startsWith("http");
          const attention = item.blink(props);

          return (
            <NavCard
              key={item.name}
              item={item}
              href={href}
              isExternal={isExternal}
              attention={attention}
            />
          );
        })}
      </Stack>
    </Container>
  );
};

export default Index;
