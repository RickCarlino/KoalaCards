import React from "react";
import Link from "next/link";
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
  rainbow?: boolean;
  active?: boolean;
  onMobileClick?: () => void;
}

const NavLink = ({
  path,
  name,
  rainbow = false,
  active = false,
  onMobileClick,
}: NavLinkProps) => {
  const theme = useMantineTheme();

  const baseStyles = {
    display: "block",
    width: "100%",
    padding: `${rem(8)} ${rem(12)}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.dark[0],
    textDecoration: "none",
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
  };

  const activeStyles = {
    ...baseStyles,
    backgroundColor: theme.colors.dark[6],
  };

  if (rainbow) {
    const rainbowStyles = {
      ...baseStyles,
      animation: "rainbow 1s linear 1",
    };

    const keyframes = `
      @keyframes rainbow {
        0% { color: red; rotate: 0deg; }
        14% { color: orange; rotate: 10deg; }
        28% { color: yellow; rotate: -10deg; }
        42% { color: green; rotate: 10deg; }
        57% { color: blue; rotate: -10deg; }
        71% { color: indigo; rotate: 10deg; }
        85% { color: violet; rotate: -10deg; }
        100% { color: red; rotate: 0deg; }
      }
    `;

    return (
      <>
        <style>{keyframes}</style>
        <UnstyledButton
          component={Link}
          href={path}
          style={rainbowStyles}
          onClick={onMobileClick}
        >
          <Text>{name}</Text>
        </UnstyledButton>
      </>
    );
  }

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
  rainbow?: boolean;
}

interface NavBarProps {
  children: React.ReactNode;
}

const NavBar = ({ children }: NavBarProps) => {
  const [opened, { toggle }] = useDisclosure(false);
  const router = useRouter();

  const links: NavLink[] = [
    { path: "/review", name: "Review" },
    { path: "/create", name: "Add" },
    { path: "/cards", name: "Cards" },
    { path: "/user", name: "Settings" },
    { path: "https://github.com/RickCarlino/KoalaCards", name: "Help" },
    { path: "https://discord.gg/jj7wXhQWJe", name: "Discord", rainbow: true },
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
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Group>
            <Link href="/" style={{ textDecoration: "none" }}>
              <Text size="xl" fw={700} role="img" aria-label="koala">
                🐨 Koala Cards
              </Text>
            </Link>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          <Box>
            {links.map((link, index) => (
              <Box key={index} mb={8}>
                <NavLink
                  path={link.path}
                  name={link.name}
                  rainbow={link.rainbow}
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

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
};

export default NavBar;
