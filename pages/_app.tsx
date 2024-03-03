import "@mantine/core/styles.css";
import { AppProps } from "next/app";
import Head from "next/head";
import { MantineProvider } from "@mantine/core";
import { trpc } from "@/koala/trpc-config";
import { SessionProvider } from "next-auth/react";
import Navbar from "./_nav";
import { Notifications } from "@mantine/notifications";
import { UserSettingsProvider } from "@/koala/settings-provider";

function App(props: AppProps) {
  const { Component, pageProps } = props;

  if (props.router.pathname === "/auth/email") {
    return <Component {...pageProps} />;
  }
  return (
    <>
      <Head>
        <title>KoalaSRS</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
      </Head>
      <SessionProvider session={pageProps.session}>
        <MantineProvider defaultColorScheme="auto">
          <UserSettingsProvider>
            <Notifications />
            <Navbar />
            <div style={{ display: "flex", flexDirection: "row" }}>
              <Component {...pageProps} />
            </div>
          </UserSettingsProvider>
        </MantineProvider>
      </SessionProvider>
    </>
  );
}

export default trpc.withTRPC(App);
