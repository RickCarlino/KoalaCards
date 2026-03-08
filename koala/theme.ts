import {
  MantineThemeOverride,
  MantineTheme,
  MantineColorsTuple,
  createTheme,
  rem,
} from "@mantine/core";

const colors: Record<string, MantineColorsTuple> = {
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
  ] as MantineColorsTuple,
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
  ] as MantineColorsTuple,
};

export function buildKoalaTheme(fontFamily: string) {
  const theme: MantineThemeOverride = {
    colors,
    primaryColor: "pink",
    primaryShade: 5,
    defaultRadius: "md",
    fontFamily,
    fontFamilyMonospace: "Monaco, Courier, monospace",
    fontSizes: {
      xs: rem(12),
      sm: rem(14),
      md: rem(16),
      lg: rem(18),
      xl: rem(20),
    },
    headings: {
      fontFamily,
      sizes: {
        h1: { fontSize: rem(34), lineHeight: "1.2", fontWeight: "700" },
        h2: { fontSize: rem(28), lineHeight: "1.25", fontWeight: "700" },
        h3: { fontSize: rem(22), lineHeight: "1.3", fontWeight: "600" },
        h4: { fontSize: rem(18), lineHeight: "1.35", fontWeight: "600" },
      },
    },
    radius: {
      xs: rem(4),
      sm: rem(8),
      md: rem(12),
      lg: rem(16),
      xl: rem(20),
    },
    shadows: {
      xs: "0 1px 2px rgba(0,0,0,0.03)",
      sm: "0 1px 3px rgba(0,0,0,0.05)",
      md: "0 4px 10px rgba(0,0,0,0.06)",
      lg: "0 8px 20px rgba(0,0,0,0.08)",
      xl: "0 14px 28px rgba(0,0,0,0.1)",
    },
    components: {
      Button: {
        defaultProps: {
          radius: "md",
          variant: "light",
        },
        styles: (theme: MantineTheme) => ({
          root: {
            transition:
              "box-shadow 150ms ease, background-color 150ms ease, border-color 150ms ease",
            "&:hover": {
              boxShadow: theme.shadows.sm,
            },
          },
        }),
      },
      ActionIcon: {
        defaultProps: {
          radius: "md",
          variant: "light",
          color: "pink",
        },
        styles: (theme: MantineTheme) => ({
          root: {
            transition:
              "box-shadow 150ms ease, background-color 150ms ease, border-color 150ms ease",
            "&:hover": {
              boxShadow: theme.shadows.sm,
            },
          },
        }),
      },
      Card: {
        defaultProps: {
          radius: "md",
          shadow: "sm",
          withBorder: true,
        },
        styles: (theme: MantineTheme) => ({
          root: {
            borderColor: theme.colors.pink[2],
            backgroundColor: theme.white,
            transition: "box-shadow 160ms ease, border-color 160ms ease",
          },
        }),
      },
      Paper: {
        defaultProps: {
          radius: "md",
          shadow: "sm",
          withBorder: true,
        },
        styles: (theme: MantineTheme) => ({
          root: {
            borderColor: theme.colors.pink[2],
            backgroundColor: theme.white,
            transition: "box-shadow 160ms ease, border-color 160ms ease",
          },
        }),
      },
      TextInput: {
        defaultProps: {
          variant: "filled",
        },
        styles: (theme: MantineTheme) => ({
          input: {
            backgroundColor: theme.white,
            borderColor: theme.colors.pink[1],
            transition:
              "box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease",
            "&:focus": {
              borderColor: theme.colors.pink[5],
              boxShadow: `0 0 0 3px ${theme.colors.pink[0]}`,
              backgroundColor: theme.white,
            },
          },
        }),
      },
      Select: {
        defaultProps: {
          variant: "filled",
        },
        styles: (theme: MantineTheme) => ({
          input: {
            backgroundColor: theme.white,
            borderColor: theme.colors.pink[1],
            transition:
              "box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease",
            "&:focus": {
              borderColor: theme.colors.pink[5],
              boxShadow: `0 0 0 3px ${theme.colors.pink[0]}`,
              backgroundColor: theme.white,
            },
          },
        }),
      },
      Anchor: {
        defaultProps: {
          underline: "hover",
        },
        styles: (theme: MantineTheme) => ({
          root: {
            color: theme.colors.pink[6],
            textDecoration: "none",
            transition:
              "color 120ms ease, text-decoration-color 120ms ease",
            "&:hover": {
              textDecoration: "underline",
            },
          },
        }),
      },
      Badge: {
        defaultProps: {
          radius: "sm",
          variant: "light",
          color: "pink",
        },
      },
      Table: {
        defaultProps: {
          highlightOnHover: true,
          withRowBorders: false,
        },
        styles: (theme: MantineTheme) => ({
          table: {
            borderCollapse: "separate",
            borderSpacing: 0,
          },
          th: { borderBottom: `1px solid ${theme.colors.pink[2]}` },
          td: { borderBottom: `1px solid ${theme.colors.pink[1]}` },
          tr: {
            transition: "background-color 120ms ease",
            "&:hover": { backgroundColor: theme.colors.pink[0] },
          },
        }),
      },
      AppShell: {
        styles: (theme: MantineTheme) => ({
          header: {
            backgroundColor: theme.colors.pink[0],
            borderBottom: `1px solid ${theme.colors.pink[2]}`,
            boxShadow: theme.shadows.xs,
          },
          main: {
            backgroundColor: theme.colors.pink[0],
          },
          footer: {
            borderTop: `1px solid ${theme.colors.pink[2]}`,
            backgroundColor: theme.white,
          },
        }),
      },
    },
  };

  return createTheme(theme);
}
