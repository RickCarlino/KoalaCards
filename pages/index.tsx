import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import {
  Anchor,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconClock,
  IconFileText,
  IconPencil,
  IconSettings,
  IconSparkles,
  IconStar,
} from "@tabler/icons-react";
import Link from "next/link";
import { GetServerSideProps } from "next/types";
import * as React from "react";

type HomePageProps = {
  hasAnyCards: boolean;
};

type HomeAction = {
  href: string;
  label: string;
  icon: typeof IconStar;
};

type UtilityLink = {
  href: string;
  label: string;
  external?: boolean;
};

const quickActions: HomeAction[] = [
  {
    href: "/reader",
    label: "Reading",
    icon: IconFileText,
  },
  {
    href: "/writing/practice",
    label: "Writing",
    icon: IconPencil,
  },
  {
    href: "/user",
    label: "Settings",
    icon: IconSettings,
  },
  {
    href: "/recent",
    label: "Recent Activity",
    icon: IconClock,
  },
];

const utilityLinks: UtilityLink[] = [
  {
    href: "https://github.com/RickCarlino/KoalaCards",
    label: "GitHub",
    external: true,
  },
  {
    href: "https://discord.gg/jj7wXhQWJe",
    label: "Discord",
    external: true,
  },
];

export const getServerSideProps: GetServerSideProps<
  HomePageProps
> = async (context) => {
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const cardCount = await prismaClient.card.count({
    where: { userId: dbUser.id },
  });

  return {
    props: {
      hasAnyCards: cardCount > 0,
    },
  };
};

type UtilityLinksProps = {
  links: UtilityLink[];
};

function UtilityLinks({ links }: UtilityLinksProps) {
  return (
    <Group gap="xs" wrap="wrap">
      {links.map((link) => {
        if (link.external) {
          return (
            <Anchor
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
            >
              {link.label}
            </Anchor>
          );
        }

        return (
          <Anchor
            key={link.label}
            component={Link}
            href={link.href}
            size="sm"
          >
            {link.label}
          </Anchor>
        );
      })}
    </Group>
  );
}

type QuickActionButtonsProps = {
  actions: HomeAction[];
};

function QuickActionButtons({ actions }: QuickActionButtonsProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.label}
            component={Link}
            href={action.href}
            variant="light"
            h={52}
            justify="flex-start"
            leftSection={<Icon size={16} />}
            fullWidth
          >
            {action.label}
          </Button>
        );
      })}
    </SimpleGrid>
  );
}

type PrimaryActionPanelProps = {
  hasAnyCards: boolean;
};

function PrimaryActionPanel({ hasAnyCards }: PrimaryActionPanelProps) {
  if (hasAnyCards) {
    return (
      <Paper withBorder p={{ base: "md", sm: "lg" }} radius="md">
        <Stack gap="sm">
          <Group gap="xs" wrap="nowrap">
            <IconStar size={18} />
            <Text fw={600}>Continue studying</Text>
          </Group>
          <Text size="sm" c="gray.7">
            Pick up where you left off.
          </Text>
          <Group>
            <Button
              component={Link}
              href="/review"
              color="pink"
              variant="filled"
            >
              Study cards
            </Button>
            <Button component={Link} href="/create" variant="default">
              Add cards
            </Button>
            <Button
              component={Link}
              href="/cards"
              variant="subtle"
              c="pastel.6"
            >
              View cards
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder p={{ base: "md", sm: "lg" }} radius="md">
      <Stack gap="sm">
        <Group gap="xs" wrap="nowrap">
          <IconFileText size={18} />
          <Text fw={600}>Start with reading</Text>
        </Group>
        <Text size="sm" c="gray.7">
          Save Korean text first, then turn highlights into cards.
        </Text>
        <Group>
          <Button
            component={Link}
            href="/reader"
            color="pink"
            variant="filled"
          >
            Open Reading
          </Button>
          <Button
            component={Link}
            href="/create"
            variant="subtle"
            color="pink"
            leftSection={<IconSparkles size={14} />}
          >
            Create cards
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

const Index: React.FC<HomePageProps> = ({ hasAnyCards }) => {
  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={1} size="h2">
            Koala Cards
          </Title>
          <Text size="sm" c="gray.7">
            A focused study tool for cards, writing, and reading.
          </Text>
        </Stack>

        <PrimaryActionPanel hasAnyCards={hasAnyCards} />

        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Explore
          </Text>
          <QuickActionButtons actions={quickActions} />
        </Stack>

        <Divider />

        <Stack gap={4}>
          <UtilityLinks links={utilityLinks} />
        </Stack>
      </Stack>
    </Container>
  );
};

export default Index;
