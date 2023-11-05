import Link from "next/link";
import { signOut } from "next-auth/react";

const NavBar = () => {
  const navBarStyle = {
    width: "100%",
    height: "64px",
    display: "flex",
    alignItems: "center",
    backgroundColor: "#333",
    color: "white",
    padding: "0 16px",
  };

  const linkStyle = {
    margin: "0 16px",
    color: "lightgray",
    textDecoration: "none",
    fontWeight: "bold",
  };

  const logoutButtonStyle = {
    ...linkStyle,
    margin: undefined,
    marginLeft: "auto",
    cursor: "pointer",
  };

  const links = [
    { path: "/study", name: "Study" },
    { path: "/create", name: "Create" },
    { path: "/cards", name: "Edit" },
    { path: "/user", name: "Settings" },
  ];

  return (
    <div style={navBarStyle}>
      <Link href={"/"} role="img" aria-label="koala" style={linkStyle}>
        🐨
      </Link>
      {links.map((link, index) => (
        <Link key={index} href={link.path} style={linkStyle}>
          {link.name}
        </Link>
      ))}
      <div
        style={logoutButtonStyle}
        onClick={(event) => {
          event.preventDefault();
          signOut();
          location.assign("/");
        }}
      >
        Log Out
      </div>
    </div>
  );
};

export default NavBar;
