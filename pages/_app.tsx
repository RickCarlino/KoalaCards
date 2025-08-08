import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { UserSettingsProvider } from "@/koala/settings-provider";
import { trpc } from "@/koala/trpc-config";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { Notifications } from "@mantine/notifications";
import { SessionProvider } from "next-auth/react";
import { AppProps } from "next/app";
import Head from "next/head";
import dynamic from "next/dynamic";
import { Montserrat } from "next/font/google";
import { buildKoalaTheme } from "@/koala/theme";

// TODO: use ENVs - why does this not work in NorthFlank?
const NEXT_PUBLIC_POSTHOG_KEY =
  "phc_1P2p1T7Neq6KQ2brenIAWZFaSRnpzXpz4SQsDuVuuYS";

// Initialize the Montserrat font
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Dynamically import the TopBar component to avoid hydration issues
const TopBarWithNoSSR = dynamic(() => import("./_topbar"), { ssr: false });

function App(props: AppProps) {
  const init = () => {
    posthog.init(NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      capture_pageview: "history_change",
      capture_exceptions: true,
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.debug();
        }
      },
      debug: process.env.NODE_ENV === "development",
    });
  };
  useEffect(init, []);

  // For the email authentication page, we don't want to show any UI components
  if (props.router.pathname === "/auth/email") {
    return (
      <PostHogProvider client={posthog}>
        <props.Component {...props.pageProps} />
      </PostHogProvider>
    );
  }

  // Prebuild a single theme to keep things DRY across routes
  const theme = buildKoalaTheme(montserrat.style.fontFamily);

  // For review pages, we want to exclude the navigation bar but keep other UI components
  if (
    props.router.pathname.startsWith("/review/") ||
    props.router.pathname.startsWith("/review-next/")
  ) {
    return (
      <PostHogProvider client={posthog}>
        <>
          <Head>
            <title>Koala Cards</title>
            <meta
              name="viewport"
              content="minimum-scale=1, initial-scale=1, width=device-width"
            />
          </Head>
          <SessionProvider session={props.pageProps.session}>
            <MantineProvider defaultColorScheme="light" theme={theme}>
              <UserSettingsProvider>
                <Notifications />
                <props.Component {...props.pageProps} />
              </UserSettingsProvider>
            </MantineProvider>
          </SessionProvider>
        </>
      </PostHogProvider>
    );
  }

  return (
    <PostHogProvider client={posthog}>
      <>
        <Head>
          <title>Koala Cards</title>
          <meta
            name="viewport"
            content="minimum-scale=1, initial-scale=1, width=device-width"
          />
        </Head>
        <SessionProvider session={props.pageProps.session}>
          <MantineProvider defaultColorScheme="light" theme={theme}>
            <UserSettingsProvider>
              <Notifications />
              <TopBarWithNoSSR>
                <props.Component {...props.pageProps} />
              </TopBarWithNoSSR>
            </UserSettingsProvider>
          </MantineProvider>
        </SessionProvider>
      </>
    </PostHogProvider>
  );
}

export default trpc.withTRPC(App);
