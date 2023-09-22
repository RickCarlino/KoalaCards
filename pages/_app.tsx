import { AppProps } from "next/app";
import Head from "next/head";
import { MantineProvider } from "@mantine/core";
import { trpc } from "@/utils/trpc";
import { SessionProvider } from "next-auth/react";
import Navbar from "./_nav";
import { Notifications } from "@mantine/notifications";

function App(props: AppProps) {
  const { Component, pageProps } = props;

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
        <MantineProvider withGlobalStyles withNormalizeCSS>
          <Notifications />
          <Navbar />
          <div style={{ display: "flex", flexDirection: "row" }}>
            <Component {...pageProps} />
          </div>
        </MantineProvider>
      </SessionProvider>
    </>
  );
}

export default trpc.withTRPC(App);
