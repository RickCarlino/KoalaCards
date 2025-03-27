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
    padding: `${rem(10)} ${rem(14)}`,
    borderRadius: theme.radius.md,
    color: theme.colors.gray[7],
    textDecoration: "none",
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    transition: "all 0.2s ease",
    border: "1px solid transparent",
  };

  const activeStyles = {
    ...baseStyles,
    backgroundColor: theme.colors.pink[1],
    color: theme.colors.pink[7],
    borderColor: theme.colors.pink[2],
  };

  if (rainbow) {
    const rainbowStyles = {
      ...baseStyles,
      animation: "rainbow 1s linear 1",
    };

    const keyframes = `
      @keyframes rainbow {
        0% { color: #FF85A2; rotate: 0deg; }
        14% { color: #FFA8B6; rotate: 10deg; }
        28% { color: #FFCAD4; rotate: -10deg; }
        42% { color: #FFE5D9; rotate: 10deg; }
        57% { color: #D8E2DC; rotate: -10deg; }
        71% { color: #BBE1FA; rotate: 10deg; }
        85% { color: #A0C4FF; rotate: -10deg; }
        100% { color: #FF85A2; rotate: 0deg; }
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
  const theme = useMantineTheme();

  const links: NavLink[] = [
    { path: "/review", name: "Review" },
    { path: "/create", name: "Add" },
    { path: "/cards", name: "Cards" },
    { path: "/writing", name: "Writing Helper" },
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
              <Text
                size="xl"
                fw={700}
                role="img"
                aria-label="koala"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    background: `linear-gradient(45deg, ${theme.colors.pink[5]}, ${theme.colors.pink[7]})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    textShadow: "0px 1px 2px rgba(0,0,0,0.1)",
                  }}
                >
                  Koala Cards
                </span>
              </Text>
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
