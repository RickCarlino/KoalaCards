import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { Card, Container, rem, Stack, Text } from "@mantine/core";
import {
  IconBrandDiscord,
  IconBrandGithub,
  IconCards,
  IconPencil,
  IconPlus,
  IconSettings,
  IconStar,
} from "@tabler/icons-react";
import Link from "next/link";
import { GetServerSideProps } from "next/types";
import * as React from "react";

interface IndexProps {
  // Does the user have ANY cards?
  hasCards: boolean;
  // Has the user EVER studied?
  didStudy: boolean;
  // Has the user EVER done a writing exercise?
  didWrite: boolean;
}

interface NavItem {
  path: (props: IndexProps) => string;
  name: string;
  // Don't show the item if it returns true
  show: (props: IndexProps) => boolean; // See my instructions.
  // Blink the border
  blink: (props: IndexProps) => boolean;
  icon: typeof IconStar;
}

// Get serverside props:
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

  const reviewCount = await prismaClient.quiz.count({
    where: {
      Card: { userId: dbUser.id },
      repetitions: { gt: 0 },
    },
  });

  const writingCount = await prismaClient.quiz.count({});

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
    path: (p) => (p.hasCards ? "/create" : "/create-vibe"),
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
    name: "View Writing",
    show: (props) => props.didWrite,
    blink: () => false,
    icon: IconPencil,
  },
  {
    path: () => "/user",
    name: "Settings",
    show: (props) => props.hasCards,
    blink: () => false,
    icon: IconSettings,
  },
  {
    path: () => "https://github.com/RickCarlino/KoalaCards",
    name: "GitHub",
    show: (props) => props.hasCards,
    blink: () => false,
    icon: IconBrandGithub,
  },
  {
    path: () => "https://discord.gg/jj7wXhQWJe",
    name: "Discord",
    show: (props) => props.hasCards,
    blink: () => false,
    icon: IconBrandDiscord,
  },
];

const Index: React.FC<IndexProps> = (props) => {
  const visibleItems = navItems.filter((item) => item.show(props));

  return (
    <Container size="sm" py="xl">
      <Text size="xl" fw={700} ta="center" mb="xl">
        Welcome to Koala Cards
      </Text>

      <Stack gap="md">
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const path = item.path(props);
          const isExternal = path.startsWith("http");
          const shouldBlink = item.blink(props);

          const cardContent = (
            <Card
              key={index}
              shadow="sm"
              p="lg"
              radius="md"
              withBorder
              style={{
                cursor: "pointer",
                transition: "all 0.2s ease",
                animation: shouldBlink ? "blink 1s infinite" : undefined,
              }}
              styles={{
                root: {
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                  },
                },
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: rem(12),
                }}
              >
                <Icon size={rem(24)} stroke={1.5} />
                <Text size="lg" fw={500}>
                  {item.name}
                </Text>
              </div>
            </Card>
          );

          if (isExternal) {
            return (
              <a
                key={index}
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none" }}
              >
                {cardContent}
              </a>
            );
          }

          return (
            <Link
              key={index}
              href={path}
              style={{ textDecoration: "none" }}
            >
              {cardContent}
            </Link>
          );
        })}
      </Stack>

      <style jsx>{`
        @keyframes blink {
          0% {
            border-color: inherit;
          }
          50% {
            border-color: #f06595;
          }
          100% {
            border-color: inherit;
          }
        }
      `}</style>
    </Container>
  );
};

export default Index;
