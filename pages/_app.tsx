import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { UserSettingsProvider } from "@/koala/settings-provider";
import { trpc } from "@/koala/trpc-config";
import { MantineProvider, createTheme, rem } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { Notifications } from "@mantine/notifications";
import { SessionProvider } from "next-auth/react";
import { AppProps } from "next/app";
import Head from "next/head";
import dynamic from "next/dynamic";
import { Montserrat } from "next/font/google";

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
            <MantineProvider
              defaultColorScheme="light"
              theme={createTheme({
                colors: {
                  pink: [
                    "#FFF0F6",
                    "#FFDEEB",
                    "#FCC2D7",
                    "#FAA2C1",
                    "#F783AC",
                    "#F06595",
                    "#E64980",
                    "#D6336C",
                    "#C2255C",
                    "#A61E4D",
                  ],
                  pastel: [
                    "#F8F9FA",
                    "#E9ECEF",
                    "#DEE2E6",
                    "#CED4DA",
                    "#ADB5BD",
                    "#868E96",
                    "#495057",
                    "#343A40",
                    "#212529",
                    "#121416",
                  ],
                },
                primaryColor: "pink",
                primaryShade: 5,
                fontFamily: montserrat.style.fontFamily,
                fontFamilyMonospace: "Monaco, Courier, monospace",
                headings: { fontFamily: montserrat.style.fontFamily },
                radius: {
                  xs: rem(4),
                  sm: rem(8),
                  md: rem(12),
                  lg: rem(16),
                  xl: rem(20),
                },
                components: {
                  Button: {
                    defaultProps: {
                      radius: "md",
                    },
                    styles: {
                      root: {
                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                      },
                    },
                  },
                  Card: {
                    defaultProps: {
                      radius: "md",
                      shadow: "sm",
                    },
                  },
                  Paper: {
                    defaultProps: {
                      radius: "md",
                      shadow: "sm",
                    },
                  },
                },
              })}
            >
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
          <MantineProvider
            defaultColorScheme="light"
            theme={createTheme({
              colors: {
                pink: [
                  "#FFF0F6",
                  "#FFDEEB",
                  "#FCC2D7",
                  "#FAA2C1",
                  "#F783AC",
                  "#F06595",
                  "#E64980",
                  "#D6336C",
                  "#C2255C",
                  "#A61E4D",
                ],
                pastel: [
                  "#F8F9FA",
                  "#E9ECEF",
                  "#DEE2E6",
                  "#CED4DA",
                  "#ADB5BD",
                  "#868E96",
                  "#495057",
                  "#343A40",
                  "#212529",
                  "#121416",
                ],
              },
              primaryColor: "pink",
              primaryShade: 5,
              fontFamily: montserrat.style.fontFamily,
              fontFamilyMonospace: "Monaco, Courier, monospace",
              headings: { fontFamily: montserrat.style.fontFamily },
              radius: {
                xs: rem(4),
                sm: rem(8),
                md: rem(12),
                lg: rem(16),
                xl: rem(20),
              },
              components: {
                Button: {
                  defaultProps: {
                    radius: "md",
                  },
                  styles: {
                    root: {
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                    },
                  },
                },
                Card: {
                  defaultProps: {
                    radius: "md",
                    shadow: "sm",
                  },
                },
                Paper: {
                  defaultProps: {
                    radius: "md",
                    shadow: "sm",
                  },
                },
              },
            })}
          >
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
