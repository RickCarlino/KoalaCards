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
    name: "View Writing",
    show: (props) => props.didWrite && props.didStudy,
    blink: () => false,
    icon: IconPencil,
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

const Index: React.FC<IndexProps> = (props) => {
  const visibleItems = navItems.filter((item) => item.show(props));

  return (
    <Container size="sm" py="xl">
      <div style={{ textAlign: "center", marginBottom: rem(40) }}>
        <Text size={rem(32)} fw={700} c="pink.6" mb="xs">
          Welcome to Koala Cards
        </Text>
        <Text size="md" c="gray.6">
          Your language learning marsupial companion.
        </Text>
      </div>

      <Stack gap="xs">
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const path = item.path(props);
          const isExternal = path.startsWith("http");
          const shouldBlink = item.blink(props);

          const cardContent = (
            <Card
              key={index}
              style={{
                cursor: "pointer",
                transition: "all 0.3s ease",
                animation: shouldBlink
                  ? "blink 2s ease-in-out infinite"
                  : undefined,
                backgroundColor: "#FFF0F6",
                border: "1px solid #FFDEEB",
                padding: "12px 16px",
                borderRadius: "8px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(246, 101, 149, 0.1)";
                e.currentTarget.style.backgroundColor = "#FFDEEB";
                e.currentTarget.style.borderColor = "#FCC2D7";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.backgroundColor = "#FFF0F6";
                e.currentTarget.style.borderColor = "#FFDEEB";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#FFDEEB",
                    borderRadius: "6px",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} stroke={1.5} color="#E64980" />
                </div>
                <Text
                  size="sm"
                  fw={500}
                  c="pink.7"
                  style={{ lineHeight: 1.2 }}
                >
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
            border-color: #ffdeeb;
            box-shadow: 0 4px 12px rgba(246, 101, 149, 0);
          }
          50% {
            border-color: #f06595;
            box-shadow: 0 4px 20px rgba(246, 101, 149, 0.3);
          }
          100% {
            border-color: #ffdeeb;
            box-shadow: 0 4px 12px rgba(246, 101, 149, 0);
          }
        }
      `}</style>
    </Container>
  );
};

export default Index;
