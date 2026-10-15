import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THEME, mergeMantineTheme } from "@mantine/core";
import { buildPageTheme } from "../koala/app-theme.ts";
import { buildKoalaTheme } from "../koala/theme.ts";

function resolveStyles(theme: ReturnType<typeof buildKoalaTheme>) {
  const resolved = mergeMantineTheme(DEFAULT_THEME, theme);
  return {
    ...theme,
    components: Object.fromEntries(
      Object.entries(theme.components ?? {}).map(([name, component]) => [
        name,
        {
          ...component,
          styles:
            typeof component?.styles === "function"
              ? component.styles(resolved, {}, {})
              : component?.styles,
        },
      ]),
    ),
  };
}

test("app styling leaves every reader route on its original theme", () => {
  for (const path of [
    "/reader",
    "/reader/[publicId]",
    "/reader/books/[publicId]",
  ]) {
    assert.deepEqual(
      resolveStyles(buildPageTheme("Koala test font", path)),
      resolveStyles(buildKoalaTheme("Koala test font")),
    );
  }
});

test("non-reader pages share the existing pink palette and font", () => {
  const original = buildKoalaTheme("Koala test font");
  for (const path of [
    "/",
    "/review",
    "/review/[deckId]",
    "/cards",
    "/create",
    "/writing/practice",
    "/user",
    "/auth/email",
  ]) {
    const theme = buildPageTheme("Koala test font", path);
    assert.equal(theme.primaryColor, "pink");
    assert.deepEqual(theme.colors, original.colors);
    assert.equal(theme.fontFamily, original.fontFamily);
    assert.equal(theme.primaryShade, 8);
  }
});
