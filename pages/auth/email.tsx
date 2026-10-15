import { useRouter } from "next/router";
import {
  Anchor,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Image from "next/image";

export default function EmailSignin() {
  const { query } = useRouter();
  return (
    <Box
      component="main"
      mih="100svh"
      bg="pink.0"
      py={{ base: "xl", sm: 80 }}
    >
      <Container size={440}>
        <Stack gap="xl" align="center">
          <Image
            src="/nav.png"
            alt="Koala Cards"
            width={150}
            height={50}
          />
          <Paper p={{ base: "md", sm: "xl" }} w="100%">
            <form action="/api/auth/callback/email" method="get">
              <Stack gap="lg">
                <Title order={1} size="h2">
                  Sign in
                </Title>
                <input
                  type="hidden"
                  name="token"
                  defaultValue={query.token}
                />
                <input
                  type="hidden"
                  name="callbackUrl"
                  defaultValue={query.callbackUrl}
                />
                <input
                  type="hidden"
                  name="email"
                  defaultValue={query.email}
                />
                <Button type="submit" variant="filled" fullWidth>
                  Continue to Koala Cards
                </Button>
              </Stack>
            </form>
          </Paper>
          <Text size="sm" c="pastel.6" ta="center">
            Having trouble?{" "}
            <Anchor
              href="https://github.com/RickCarlino/KoalaCards/issues/new?title=login%20issues"
              size="sm"
            >
              Report a sign-in issue
            </Anchor>
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
