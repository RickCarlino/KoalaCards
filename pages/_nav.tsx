import Link from "next/link";

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

  const links = [
    { path: "/review", name: "Review" },
    { path: "/create", name: "Add" },
    { path: "/cards", name: "Cards" },
    { path: "/user", name: "Settings" },
    { path: "https://github.com/RickCarlino/KoalaCards", name: "Help" },
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
    </div>
  );
};

export default NavBar;
