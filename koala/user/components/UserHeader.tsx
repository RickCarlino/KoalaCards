import { formatDateKey } from "@/koala/user/date";
import { SerializedUserSettings } from "@/koala/user/types";
import { Avatar, Badge, Button, Group, Stack, Title } from "@mantine/core";
import { signOut } from "next-auth/react";
import Link from "next/link";
import React from "react";

function firstChar(value: string | null | undefined) {
  return value?.trim()[0];
}

export function UserHeader(props: {
  user: SerializedUserSettings["user"];
}) {
  const initials =
    firstChar(props.user.name) ?? firstChar(props.user.email) ?? "U";
  const joinedLabel = props.user.createdAt
    ? `Joined ${formatDateKey(new Date(props.user.createdAt))}`
    : undefined;

  const handleLogout = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void signOut().finally(() => location.assign("/"));
  };

  return (
    <Group justify="space-between" align="center">
      <Group>
        <Avatar src={props.user.image ?? undefined} radius="xl" size={56}>
          {initials}
        </Avatar>
        <Stack gap={2}>
          <Title order={2}>Account & Settings</Title>
          <Group gap="xs">
            {props.user.name ? (
              <Badge variant="light">{props.user.name}</Badge>
            ) : null}
            {props.user.email ? (
              <Badge color="gray" variant="outline">
                {props.user.email}
              </Badge>
            ) : null}
            {joinedLabel ? (
              <Badge color="pink" variant="light">
                {joinedLabel}
              </Badge>
            ) : null}
          </Group>
        </Stack>
      </Group>
      <Group>
        <Button component={Link} href="/user/export" variant="light">
          Import / Export Decks
        </Button>
        <Button variant="outline" onClick={handleLogout}>
          Log Out
        </Button>
      </Group>
    </Group>
  );
}
