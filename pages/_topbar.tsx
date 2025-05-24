import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AppShell,
  Group,
  useMantineTheme,
  Menu,
  Button,
  rem,
} from "@mantine/core";
import {
  IconStar,
  IconPlus,
  IconCards,
  IconPencil,
  IconSettings,
  IconBrandGithub,
  IconBrandDiscord,
} from "@tabler/icons-react";

interface TopBarProps {
  children: React.ReactNode;
}

const TopBar = ({ children }: TopBarProps) => {
  const theme = useMantineTheme();

  const menuItems = [
    { path: "/review", name: "Study Cards", icon: IconStar },
    { path: "/create", name: "Create Cards", icon: IconPlus },
    { path: "/cards", name: "View Cards", icon: IconCards },
    { path: "/writing", name: "View Writing", icon: IconPencil },
    { path: "/user", name: "Settings", icon: IconSettings },
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

  return (
    <AppShell
      header={{ height: { base: 60, md: 70, lg: 80 } }}
      padding="md"
      styles={{
        header: {
          backgroundColor: theme.colors.pink[0],
          borderBottom: `1px solid ${theme.colors.pink[2]}`,
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Link href="/" style={{ textDecoration: "none" }}>
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
          </Link>

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button variant="subtle" color="pink">
                Menu
              </Button>
            </Menu.Target>

            <Menu.Dropdown>
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                const isExternal = item.path.startsWith("http");

                if (isExternal) {
                  return (
                    <Menu.Item
                      key={index}
                      leftSection={<Icon size={rem(14)} />}
                      component="a"
                      href={item.path}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.name}
                    </Menu.Item>
                  );
                }
                
                return (
                  <Menu.Item
                    key={index}
                    leftSection={<Icon size={rem(14)} />}
                    component={Link}
                    href={item.path}
                  >
                    {item.name}
                  </Menu.Item>
                );
              })}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

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

export default TopBar;
