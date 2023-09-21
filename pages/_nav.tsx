import {
  Group,
  Navbar,
  Title,
  createStyles,
  getStylesRef,
} from "@mantine/core";
import { MantineLogo } from "@mantine/ds";
import {
  IconBook,
  IconLogout,
  IconPencil,
  IconUser,
  IconDatabaseImport,
} from "@tabler/icons-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { MouseEventHandler } from "react";

const signouthandler: MouseEventHandler<HTMLAnchorElement> = (event) => {
  event.preventDefault();
  signOut();
};

const data = [
  { link: "/study", label: "Study", icon: IconBook },
  { link: "/cards", label: "Edit Cards", icon: IconPencil },
  { link: "/import", label: "Import Cards", icon: IconDatabaseImport },
  { link: "/user", label: "User", icon: IconUser },
];

export default function NavbarSimple() {
  const mainLinks = data.map((item) => {
    return (
      <Link href={item.link} key={item.label} aria-label={item.label}>
        <item.icon stroke={1.5} />
      </Link>
    );
  });

  return (
    <nav>
      {mainLinks}
      <Link onClick={signouthandler} aria-label={"Log out"} href={""}>
        <IconLogout stroke={1.5} />
      </Link>
    </nav>
  );
}
