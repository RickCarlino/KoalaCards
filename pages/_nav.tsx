import { Code, Group, Navbar, createStyles, getStylesRef } from "@mantine/core";
import {
  IconBook,
  IconLogout,
  IconPencil,
  IconUser,
  IconDatabaseImport
} from "@tabler/icons-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { MouseEventHandler } from "react";
import PJSON from "../package.json";

const signouthandler: MouseEventHandler<HTMLAnchorElement> = (event) => {
  event.preventDefault();
  signOut();
};

const useStyles = createStyles((theme) => ({
  header: {
    paddingBottom: theme.spacing.md,
    marginBottom: `calc(${theme.spacing.md} * 1.5)`,
  },

  link: {
    ...theme.fn.focusStyles(),
    display: "flex",
    alignItems: "center",
    textDecoration: "none",
    fontSize: theme.fontSizes.sm,
    color:
      theme.colorScheme === "dark"
        ? theme.colors.dark[1]
        : theme.colors.gray[7],
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.radius.sm,
    fontWeight: 500,

    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[0],
      color: theme.colorScheme === "dark" ? theme.white : theme.black,

      [`& .${getStylesRef("icon")}`]: {
        color: theme.colorScheme === "dark" ? theme.white : theme.black,
      },
    },
  },

  linkIcon: {
    ref: getStylesRef("icon"),
    color:
      theme.colorScheme === "dark"
        ? theme.colors.dark[2]
        : theme.colors.gray[6],
    marginRight: theme.spacing.sm,
  },

  linkActive: {
    "&, &:hover": {
      backgroundColor: theme.fn.variant({
        variant: "light",
        color: theme.primaryColor,
      }).background,
      color: theme.fn.variant({ variant: "light", color: theme.primaryColor })
        .color,
      [`& .${getStylesRef("icon")}`]: {
        color: theme.fn.variant({ variant: "light", color: theme.primaryColor })
          .color,
      },
    },
  },
}));

const data = [
  { link: "/study", label: "Study", icon: IconBook },
  { link: "/cards", label: "Edit Cards", icon: IconPencil },
  { link: "/import", label: "Import Cards", icon: IconDatabaseImport },
  { link: "/user", label: "User", icon: IconUser },
];

export default function NavbarSimple() {
  const { classes, cx } = useStyles();
  const router = useRouter();
  const links = data.map((item) => {
    const isActive = router.pathname === item.link;
    return (
      <Link
        className={cx(classes.link, {
          [classes.linkActive]: isActive,
        })}
        href={item.link}
        key={item.label}
      >
        <item.icon className={classes.linkIcon} stroke={1.5} />
        <span>{item.label}</span>
      </Link>
    );
  });

  return (
    <Navbar width={{ sm: 300 }} p="md">
      <Navbar.Section grow>
        <Group className={classes.header} position="apart">
          <span style={{ fontSize: "24px", marginRight: "10px" }}>
            <span role="img" aria-label="Koala">
              🐨
            </span>
          </span>
          <span style={{ fontSize: "24px", fontWeight: "bold" }}>KoalaSRS</span>
          <Code sx={{ fontWeight: 700 }}>v{PJSON.version}</Code>
        </Group>
        {links}
        <a href="#" className={classes.link} onClick={signouthandler}>
          <IconLogout className={classes.linkIcon} stroke={1.5} />
          <span>Logout</span>
        </a>
      </Navbar.Section>
    </Navbar>
  );
}
