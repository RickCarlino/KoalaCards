import { Box } from "@mantine/core";
import React from "react";

const workspaceStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "calc(100svh - 58px)",
  padding:
    "clamp(10px, 1.5vw, 18px) clamp(10px, 2vw, 24px) clamp(16px, 2.6vw, 30px)",
  overflowX: "hidden",
};

function readerWorkspaceColumns(options: {
  navigation: React.ReactNode;
  tools: React.ReactNode;
}): string {
  const columns: string[] = [];
  if (options.navigation) {
    columns.push("minmax(190px, 250px)");
  }
  columns.push("minmax(0, 1fr)");
  if (options.tools) {
    columns.push("minmax(260px, 340px)");
  }
  return columns.join(" ");
}

function ReaderWorkspaceGrid({
  navigation,
  surface,
  tools,
}: {
  navigation: React.ReactNode;
  surface: React.ReactNode;
  tools: React.ReactNode;
}) {
  const columns = readerWorkspaceColumns({
    navigation,
    tools,
  });
  const className = tools
    ? "reader-workspace-grid reader-workspace-grid--with-tools"
    : "reader-workspace-grid";

  return (
    <Box className={className} style={{ gridTemplateColumns: columns }}>
      {navigation ? (
        <Box className="reader-workspace-navigation">{navigation}</Box>
      ) : null}
      <Box className="reader-workspace-surface">{surface}</Box>
      {tools ? (
        <Box className="reader-workspace-tools">{tools}</Box>
      ) : null}
    </Box>
  );
}

export function ReaderWorkspace({
  navigation,
  surface,
  tools,
}: {
  navigation?: React.ReactNode;
  surface: React.ReactNode;
  tools?: React.ReactNode;
}) {
  return (
    <Box style={workspaceStyle}>
      <style jsx global>{`
        .reader-workspace-grid {
          display: grid;
          align-items: start;
          gap: clamp(10px, 1.4vw, 18px);
          min-width: 0;
        }
        .reader-workspace-navigation,
        .reader-workspace-tools {
          position: sticky;
          top: 0;
          max-height: calc(100svh - 20px);
          min-width: 0;
          overflow: hidden;
        }
        .reader-workspace-surface {
          min-width: 0;
        }
        @media (max-width: 840px) {
          .reader-workspace-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .reader-workspace-grid--with-tools {
            padding-bottom: calc(min(44svh, 360px) + 12px);
          }
          .reader-workspace-navigation {
            position: static;
            max-height: none;
          }
          .reader-workspace-tools {
            position: fixed;
            top: auto;
            right: 10px;
            bottom: 10px;
            left: 10px;
            z-index: 200;
            height: min(44svh, 360px);
            max-height: none;
            overflow: hidden;
            border-radius: 12px;
            box-shadow: 0 18px 48px rgba(47, 38, 48, 0.2);
          }
          .reader-workspace-navigation {
            order: 1;
          }
          .reader-workspace-surface {
            order: 2;
          }
        }
      `}</style>
      <ReaderWorkspaceGrid
        navigation={navigation}
        surface={surface}
        tools={tools}
      />
    </Box>
  );
}
