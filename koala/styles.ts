import { CSSProperties } from "react";
import { MantineTheme } from "@mantine/core";

export const fullHeightStyle: CSSProperties = {
  height: "100%",
};

export const paperStyle = (theme: MantineTheme): CSSProperties => ({
  background: "rgba(255, 255, 255, 0.8)",
  border: `1px solid ${theme.colors.pink[2]}`,
  boxShadow: "0 4px 8px rgba(0,0,0,0.04)",
});

export const buttonShadow: CSSProperties = {
  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
};

export const titleStyle = (theme: MantineTheme): CSSProperties => ({
  color: theme.colors.pink[6],
  fontWeight: 600,
});
