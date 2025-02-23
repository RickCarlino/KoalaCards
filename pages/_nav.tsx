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
    { path: "https://discord.gg/jj7wXhQWJe", name: "Discord", rainbow: true },
  ];

  return (
    <div style={navBarStyle}>
      <Link href={"/"} role="img" aria-label="koala" style={linkStyle}>
        🐨
      </Link>
      {links.map((link, index) => {
        if (link.rainbow) {
          const rainbowStyle = {
            ...linkStyle,
            animation: "rainbow 1s linear 1",
          };

          // Adding the keyframes to the style object
          // Lets update this to make it shake
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
              <style>{keyframes}</style>{" "}
              {/* Insert the keyframes into the document */}
              <Link key={index} href={link.path} style={rainbowStyle}>
                {link.name}
              </Link>
            </>
          );
        }
        return (
          <Link key={index} href={link.path} style={linkStyle}>
            {link.name}
          </Link>
        );
      })}
    </div>
  );
};

export default NavBar;
