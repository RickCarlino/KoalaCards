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

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const TopBarWithNoSSR = dynamic(() => import("./_topbar"), { ssr: false });

function App(props: AppProps) {
  if (props.router.pathname === "/auth/email") {
    return <props.Component {...props.pageProps} />;
  }

  const theme = buildKoalaTheme(montserrat.style.fontFamily);

  if (
    props.router.pathname.startsWith("/review/") ||
    props.router.pathname.startsWith("/review-next/")
  ) {
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
          <MantineProvider defaultColorScheme="light" theme={theme}>
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
  );
}

export default trpc.withTRPC(App);
