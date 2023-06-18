import * as React from "react";
import { Button, Center, Container } from "@mantine/core";
import { signIn, useSession } from "next-auth/react";

type Element = React.JSX.Element;

const SignInButton: React.FC = () => {
  return (
    <Container>
      <Center style={{ height: "100%" }}>
        <Button onClick={() => signIn()} size="xl" uppercase>🔑 Click Here To Log In</Button>
      </Center>
    </Container>
  );
};

export default function Authed<T extends Element>(el: T): T {
  const { status } = useSession();
  switch (status) {
    case "loading":
      return (<div>Logging in...</div>) as T;
    case "unauthenticated":
      return (<SignInButton />) as T;
    case "authenticated":
      return el;
  }
}
