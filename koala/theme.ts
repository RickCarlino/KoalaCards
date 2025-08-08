import {
  MantineThemeOverride,
  MantineTheme,
  MantineColorsTuple,
  createTheme,
  rem,
} from "@mantine/core";

// Centralized Mantine theme for Koala Cards
// Keep branding (pink palette) but add modern polish (radius, shadows, focus)

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
      xs: "0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02)",
      sm: "0 2px 6px rgba(0,0,0,0.06)",
      md: "0 8px 20px rgba(0,0,0,0.08)",
      lg: "0 12px 32px rgba(0,0,0,0.10)",
      xl: "0 20px 48px rgba(0,0,0,0.12)",
    },
    components: {
      Button: {
        defaultProps: {
          radius: "md",
          variant: "light",
        },
        styles: (theme: MantineTheme) => ({
          root: {
            boxShadow: theme.shadows.sm,
            transition:
              "transform 150ms ease, box-shadow 150ms ease, background-color 150ms ease",
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: theme.shadows.md,
            },
            "&:active": {
              transform: "translateY(0)",
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
              "transform 120ms ease, box-shadow 150ms ease, background-color 150ms ease",
            boxShadow: theme.shadows.xs,
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: theme.shadows.sm,
            },
            "&:active": {
              transform: "translateY(0)",
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
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "saturate(180%) blur(6px)",
            transition: "transform 150ms ease, box-shadow 200ms ease",
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: theme.shadows.md,
            },
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
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "saturate(180%) blur(6px)",
            transition: "transform 150ms ease, box-shadow 200ms ease",
          },
        }),
      },
      TextInput: {
        defaultProps: {
          variant: "filled",
        },
        styles: (theme: MantineTheme) => ({
          input: {
            backgroundColor: "rgba(255, 240, 246, 0.35)",
            borderColor: theme.colors.pink[1],
            transition:
              "box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease",
            "&:focus": {
              borderColor: theme.colors.pink[5],
              boxShadow: `0 0 0 3px ${theme.colors.pink[0]}`,
              backgroundColor: "rgba(255, 240, 246, 0.5)",
            },
            "&:focus-within": { borderColor: theme.colors.pink[4] },
          },
        }),
      },
      Select: {
        defaultProps: {
          variant: "filled",
        },
        styles: (theme: MantineTheme) => ({
          input: {
            backgroundColor: "rgba(255, 240, 246, 0.35)",
            borderColor: theme.colors.pink[1],
            transition:
              "box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease",
            "&:focus": {
              borderColor: theme.colors.pink[5],
              boxShadow: `0 0 0 3px ${theme.colors.pink[0]}`,
              backgroundColor: "rgba(255, 240, 246, 0.5)",
            },
            "&:focus-within": { borderColor: theme.colors.pink[4] },
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
            backgroundColor: "rgba(255, 240, 246, 0.9)", // pink[0] with alpha
            backdropFilter: "saturate(180%) blur(8px)",
            borderBottom: `1px solid ${theme.colors.pink[2]}`,
            boxShadow: theme.shadows.xs,
          },
          main: {
            background:
              "linear-gradient(180deg, rgba(255,240,246,0.35) 0%, rgba(255,255,255,1) 30%)",
          },
          footer: {
            borderTop: `1px solid ${theme.colors.pink[2]}`,
            backgroundColor: "rgba(255,255,255,0.9)",
            backdropFilter: "saturate(180%) blur(6px)",
          },
        }),
      },
    },
  };

  return createTheme(theme);
}
