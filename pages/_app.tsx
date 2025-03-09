import { UserSettingsProvider } from "@/koala/settings-provider";
import { trpc } from "@/koala/trpc-config";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import { SessionProvider } from "next-auth/react";
import { AppProps } from "next/app";
import Head from "next/head";
import dynamic from "next/dynamic";

// Dynamically import the Navbar component to avoid hydration issues
const NavbarWithNoSSR = dynamic(() => import("./_nav"), { ssr: false });

function App(props: AppProps) {
  // For the email authentication page, we don't want to show any UI components
  if (props.router.pathname === "/auth/email") {
    return <props.Component {...props.pageProps} />;
  }

  // For review pages, we want to exclude the navigation bar but keep other UI components
  if (props.router.pathname.startsWith("/review/")) {
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
              <props.Component {...props.pageProps} />
            </UserSettingsProvider>
          </MantineProvider>
        </SessionProvider>
      </>
    );
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
            <NavbarWithNoSSR>
              <props.Component {...props.pageProps} />
            </NavbarWithNoSSR>
          </UserSettingsProvider>
        </MantineProvider>
      </SessionProvider>
    </>
  );
}

export default trpc.withTRPC(App);
