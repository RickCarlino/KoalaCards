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
  IconCards,
  IconFileText,
  IconPencil,
  IconPlus,
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
    label: "Reader",
    icon: IconFileText,
  },
  {
    href: "/create",
    label: "Add Cards",
    icon: IconPlus,
  },
  {
    href: "/cards",
    label: "View Cards",
    icon: IconCards,
  },
  {
    href: "/writing/practice",
    label: "Writing Practice",
    icon: IconPencil,
  },
];

const utilityLinks: UtilityLink[] = [
  { href: "/user", label: "Settings" },
  { href: "/writing", label: "Writing History" },
  { href: "/recent", label: "Recent Activity" },
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
            color="pink"
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
      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Group gap="xs" wrap="nowrap">
            <IconStar size={18} />
            <Text fw={700}>Continue Studying</Text>
          </Group>
          <Text size="sm" c="gray.7">
            Jump back into review and keep your deck moving forward.
          </Text>
          <Group>
            <Button component={Link} href="/review" color="pink">
              Study Cards
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="sm">
        <Group gap="xs" wrap="nowrap">
          <IconFileText size={18} />
          <Text fw={700}>Start With Reader</Text>
        </Group>
        <Text size="sm" c="gray.7">
          Save Korean text first, then turn highlights into cards.
        </Text>
        <Group>
          <Button component={Link} href="/reader" color="pink">
            Open Reader
          </Button>
          <Button
            component={Link}
            href="/create"
            variant="subtle"
            color="pink"
            leftSection={<IconSparkles size={14} />}
          >
            Or create cards directly
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

const Index: React.FC<HomePageProps> = ({ hasAnyCards }) => {
  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Stack gap="xs">
          <Title order={1}>Koala Cards</Title>
          <Text size="sm" c="gray.7">
            A focused study tool for cards, writing, and reading.
          </Text>
        </Stack>

        <PrimaryActionPanel hasAnyCards={hasAnyCards} />

        <Stack gap="xs">
          <Text size="sm" fw={700}>
            Quick Actions
          </Text>
          <QuickActionButtons actions={quickActions} />
        </Stack>

        <Divider />

        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            More
          </Text>
          <UtilityLinks links={utilityLinks} />
        </Stack>
      </Stack>
    </Container>
  );
};

export default Index;
