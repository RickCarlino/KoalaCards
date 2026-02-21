import { getServersideUser } from "@/koala/get-serverside-user";
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

interface NavItem {
  path: string;
  name: string;
  icon: typeof IconStar;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }
  return {
    props: {},
  };
};

const navItems: NavItem[] = [
  {
    path: "/review",
    name: "Study Cards",
    icon: IconStar,
  },
  {
    path: "/writing/practice",
    name: "Writing Practice",
    icon: IconPencil,
  },
  {
    path: "/create",
    name: "Create Cards",
    icon: IconPlus,
  },
  {
    path: "/cards",
    name: "View Cards",
    icon: IconCards,
  },
  {
    path: "/writing",
    name: "Writing History",
    icon: IconFileText,
  },
  {
    path: "/recent",
    name: "Recent Activity",
    icon: IconFileText,
  },
  {
    path: "/user",
    name: "Settings",
    icon: IconSettings,
  },
  {
    path: "https://github.com/RickCarlino/KoalaCards",
    name: "GitHub",
    icon: IconBrandGithub,
  },
  {
    path: "https://discord.gg/jj7wXhQWJe",
    name: "Discord",
    icon: IconBrandDiscord,
  },
];

type NavCardProps = {
  item: NavItem;
};

function NavCard({ item }: NavCardProps) {
  const theme = useMantineTheme();
  const Icon = item.icon;
  const href = item.path;
  const isExternal = href.startsWith("http");
  const rootStyles = {
    cursor: "pointer",
    display: "block",
    textDecoration: "none",
    color: "inherit",
    "&:focus-visible": {
      outline: `2px solid ${theme.colors.pink[5]}`,
      outlineOffset: 2,
    },
  };

  const styles = { root: rootStyles };

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

const Index: React.FC = () => {
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
        {navItems.map((item) => (
          <NavCard key={item.name} item={item} />
        ))}
      </Stack>
    </Container>
  );
};

export default Index;
