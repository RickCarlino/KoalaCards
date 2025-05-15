import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AppShell,
  Burger,
  Group,
  Text,
  UnstyledButton,
  rem,
  useMantineTheme,
  Box,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useRouter } from "next/router";

interface NavLinkProps {
  path: string;
  name: string;
  active?: boolean;
  onMobileClick?: () => void;
}

const NavLink = ({
  path,
  name,
  active = false,
  onMobileClick,
}: NavLinkProps) => {
  const theme = useMantineTheme();

  const baseStyles = {
    display: "block",
    width: "100%",
    padding: `${rem(10)} ${rem(14)}`,
    borderRadius: theme.radius.md,
    color: theme.colors.gray[7],
    textDecoration: "none",
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    transition: "all 0.2s ease",
  };

  const activeStyles = {
    ...baseStyles,
    backgroundColor: theme.colors.pink[1],
    color: theme.colors.pink[7],
    borderColor: theme.colors.pink[2],
  };

  return (
    <UnstyledButton
      component={Link}
      href={path}
      style={active ? activeStyles : baseStyles}
      onClick={onMobileClick}
    >
      <Text>{name}</Text>
    </UnstyledButton>
  );
};

interface NavLink {
  path: string;
  name: string;
}

interface NavBarProps {
  children: React.ReactNode;
}

const NavBar = ({ children }: NavBarProps) => {
  const [opened, { toggle }] = useDisclosure(false);
  const router = useRouter();
  const theme = useMantineTheme();

  const links: NavLink[] = [
    { path: "/review", name: "⭐️ Study Cards" },
    { path: "/create", name: "Create Cards" },
    { path: "/cards", name: "View Cards" },
    { path: "/writing", name: "View Writing" },
    { path: "/user", name: "Settings" },
    { path: "https://github.com/RickCarlino/KoalaCards", name: "GitHub" },
    { path: "https://discord.gg/jj7wXhQWJe", name: "Discord" },
  ];

  return (
    <AppShell
      header={{ height: { base: 60, md: 70, lg: 80 } }}
      navbar={{
        width: { base: 200, md: 250, lg: 300 },
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
      styles={{
        header: {
          backgroundColor: theme.colors.pink[0],
          borderBottom: `1px solid ${theme.colors.pink[2]}`,
        },
        navbar: {
          backgroundColor: theme.white,
          borderRight: `1px solid ${theme.colors.pink[2]}`,
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger
            opened={opened}
            onClick={toggle}
            hiddenFrom="sm"
            size="sm"
            color={theme.colors.pink[6]}
          />
          <Group>
            <Link href="/" style={{ textDecoration: "none" }}>
              <Image
                src="/nav.png"
                alt="Koala Cards Logo"
                width={150}
                height={50}
                style={{
                  display: "block",
                  objectFit: "contain", // Maintain aspect ratio within bounds
                  maxHeight: "100%",
                }}
              />
            </Link>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          <Box>
            {links.map((link, index) => (
              <Box key={index} mb={12}>
                <NavLink
                  path={link.path}
                  name={link.name}
                  active={router.pathname === link.path}
                  onMobileClick={() => {
                    if (window.innerWidth < 768) {
                      toggle();
                    }
                  }}
                />
              </Box>
            ))}
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

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

export default NavBar;
