import { Container } from "@mantine/core";
import Authed from "../components/authed";

export default function User() {
  return Authed(
    <Container size="s">
      <h1>User Settings</h1>
      <p>
        Eventually, I want this page to allow things like changing email
        address, changing password, and deleting account. It also needs stats on
        how much you have studied.
      </p>
    </Container>,
  );
}
