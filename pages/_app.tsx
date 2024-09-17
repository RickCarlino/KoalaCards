import { UserSettingsProvider } from "@/koala/settings-provider";
import { trpc } from "@/koala/trpc-config";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import { SessionProvider } from "next-auth/react";
import { AppProps } from "next/app";
import Head from "next/head";
import Navbar from "./_nav";

function App(props: AppProps) {
  if (props.router.pathname === "/auth/email") {
    return <props.Component {...props.pageProps} />;
  }
  return (
    <>
      <Head>
        <title>Koala Cards</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
      </Head>
      <SessionProvider session={props.pageProps.session}>
        <MantineProvider defaultColorScheme="auto">
          <UserSettingsProvider>
            <Notifications />
            <Navbar />
            <div style={{ display: "flex", flexDirection: "row" }}>
              <props.Component {...props.pageProps} />
            </div>
          </UserSettingsProvider>
        </MantineProvider>
      </SessionProvider>
    </>
  );
}

export default trpc.withTRPC(App);
