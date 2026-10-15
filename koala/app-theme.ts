import { createTheme, MantineTheme, rem } from "@mantine/core";
import { buildKoalaTheme } from "./theme";

const inputDefaults = {
  defaultProps: { variant: "default", radius: "sm" },
  styles: (theme: MantineTheme) => ({
    root: { minWidth: 0 },
    input: {
      minHeight: rem(44),
      fontSize: rem(16),
      backgroundColor: theme.white,
    },
    label: { marginBottom: rem(6), fontWeight: 500 },
    description: { color: theme.colors.pastel[6] },
  }),
};

const panelDefaults = {
  defaultProps: { radius: "md", shadow: "none", withBorder: true },
  styles: (theme: MantineTheme) => ({
    root: {
      minWidth: 0,
      borderColor: theme.colors.pink[1],
      backgroundColor: theme.white,
    },
  }),
};

export function buildPageTheme(fontFamily: string, pathname: string) {
  const base = buildKoalaTheme(fontFamily);
  if (pathname === "/reader" || pathname.startsWith("/reader/")) {
    return base;
  }

  return createTheme({
    ...base,
    primaryShade: 8,
    defaultRadius: "sm",
    components: {
      ...base.components,
      Button: {
        defaultProps: { radius: "sm", variant: "light" },
        styles: { root: { minHeight: rem(44), fontWeight: 600 } },
      },
      ActionIcon: {
        defaultProps: { radius: "sm", variant: "subtle", color: "pink.8" },
        styles: {
          root: { minWidth: rem(44), minHeight: rem(44), flexShrink: 0 },
        },
      },
      Card: panelDefaults,
      Paper: panelDefaults,
      TextInput: inputDefaults,
      Textarea: inputDefaults,
      NumberInput: inputDefaults,
      Select: inputDefaults,
      Anchor: {
        defaultProps: { underline: "hover", c: "pink.8" },
      },
      Title: {
        styles: (theme: MantineTheme) => ({
          root: { color: theme.colors.pink[8], overflowWrap: "anywhere" },
        }),
      },
      Badge: {
        defaultProps: { radius: "sm", variant: "light", color: "pink" },
        styles: { root: { textTransform: "none", fontWeight: 500 } },
      },
      Table: {
        defaultProps: {
          highlightOnHover: true,
          withRowBorders: true,
          horizontalSpacing: "sm",
          verticalSpacing: "sm",
        },
        styles: (theme: MantineTheme) => ({
          th: { color: theme.colors.pastel[6], fontWeight: 600 },
          td: { overflowWrap: "anywhere" },
        }),
      },
      AppShell: {
        styles: (theme: MantineTheme) => ({
          header: {
            backgroundColor: theme.colors.pink[0],
            borderBottom: `1px solid ${theme.colors.pink[1]}`,
          },
          main: { backgroundColor: theme.colors.pink[0] },
          footer: {
            borderTop: `1px solid ${theme.colors.pink[1]}`,
            backgroundColor: theme.white,
          },
        }),
      },
    },
  });
}
