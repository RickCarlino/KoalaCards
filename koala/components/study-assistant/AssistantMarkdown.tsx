import React from "react";
import { Box, Text } from "@mantine/core";
import ReactMarkdown, {
  type Components,
  type ExtraProps,
} from "react-markdown";

type MarkdownCodeProps = JSX.IntrinsicElements["code"] &
  ExtraProps & { inline?: boolean };

type AssistantMarkdownProps = {
  content: string;
  style: React.CSSProperties;
};

const blockSpacing = "0 0 8px 18px";

function MarkdownCode(
  props: MarkdownCodeProps & { style: React.CSSProperties },
) {
  const { inline, children, style } = props;
  const display = inline ? "inline" : "block";
  const padding = inline ? "0 4px" : "4px";

  return (
    <Text
      component="code"
      style={{
        ...style,
        display,
        padding,
        backgroundColor: "rgba(0, 0, 0, 0.05)",
        borderRadius: 4,
        fontFamily: "var(--mantine-font-family-monospace)",
      }}
    >
      {children}
    </Text>
  );
}

export default function AssistantMarkdown({
  content,
  style,
}: AssistantMarkdownProps) {
  const markdownComponents = React.useMemo<Components>(
    () => ({
      p: ({ children }) => (
        <Text component="p" style={{ ...style, margin: 0 }}>
          {children}
        </Text>
      ),
      ul: ({ children }) => (
        <Box
          component="ul"
          style={{ ...style, margin: blockSpacing, paddingLeft: 0 }}
        >
          {children}
        </Box>
      ),
      ol: ({ children }) => (
        <Box
          component="ol"
          style={{ ...style, margin: blockSpacing, paddingLeft: 0 }}
        >
          {children}
        </Box>
      ),
      li: ({ children }) => (
        <Box component="li" style={{ ...style, marginBottom: 4 }}>
          {children}
        </Box>
      ),
      a: ({ children, href }) => (
        <Text
          component="a"
          href={href}
          c="indigo.7"
          style={style}
          target="_blank"
          rel="noreferrer"
        >
          {children}
        </Text>
      ),
      code: (props: MarkdownCodeProps) => (
        <MarkdownCode {...props} style={style} />
      ),
      blockquote: ({ children }) => (
        <Box
          component="blockquote"
          style={{
            ...style,
            margin: "4px 0",
            padding: "4px 12px",
            borderLeft: "3px solid var(--mantine-color-gray-4)",
            backgroundColor: "var(--mantine-color-gray-0)",
          }}
        >
          {children}
        </Box>
      ),
    }),
    [style],
  );

  return (
    <Box style={style}>
      <ReactMarkdown components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </Box>
  );
}
