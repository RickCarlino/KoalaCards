import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { VisualDiff } from "@/koala/review/visual-diff";
import {
  ActionIcon,
  Alert,
  Container,
  Divider,
  Group,
  Pagination,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { GetServerSideProps } from "next";
import Link from "next/link";
import { useState } from "react";

const ITEMS_PER_PAGE = 5;

interface WritingHistory {
  submissions: {
    id: number;
    prompt: string;
    submission: string;
    correction: string;
    createdAt: string;
    deck: {
      id: number;
      name: string;
      langCode: string;
    };
  }[];
  totalPages: number;
  currentPage: number;
  statusMessage?: {
    type: "success" | "error";
    message: string;
  };
}

export const getServerSideProps: GetServerSideProps<WritingHistory> = async (
  ctx,
) => {
  // Authenticate user
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  // Get page from query params
  const page = Number(ctx.query.page) || 1;
  const skip = (page - 1) * ITEMS_PER_PAGE;

  // Get total count for pagination
  const totalCount = await prismaClient.writingSubmission.count({
    where: { userId: dbUser.id },
  });

  // Fetch user's writing submissions with pagination
  const submissions = await prismaClient.writingSubmission.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    take: ITEMS_PER_PAGE,
    skip,
    select: {
      id: true,
      prompt: true,
      submission: true,
      correction: true,
      createdAt: true,
      deck: {
        select: {
          id: true,
          name: true,
          langCode: true,
        },
      },
    },
  });

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return {
    props: {
      submissions: JSON.parse(JSON.stringify(submissions)),
      totalPages,
      currentPage: page,
    },
  };
};

export default function WritingHistoryPage({
  submissions,
  totalPages,
  currentPage,
}: WritingHistory) {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const toggleItem = (id: number) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  return (
    <Container size="md" py="md">
      <Title order={2} mb="lg">
        My Writing History
      </Title>

      {submissions.length === 0 ? (
        <Alert title="No submissions found" color="blue">
          You haven't submitted any writing practice yet.{" "}
          <Link href="/create">Add a deck</Link> and{" "}
          <Link href="/review">do some writing exercises!</Link>
        </Alert>
      ) : (
        <Stack gap="xl">
          {submissions.map((submission) => (
            <Paper key={submission.id} p="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={5}>
                    <Text fw={700} size="lg">
                      {new Date(submission.createdAt).toLocaleDateString()}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {submission.deck.name} ({submission.deck.langCode})
                    </Text>
                  </Stack>
                  <Tooltip label="Delete submission">
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => {
                        if (
                          confirm(
                            "Are you sure you want to delete this submission?",
                          )
                        ) {
                          // Use window.location for a full page reload approach
                          window.location.href = `/writing/delete?id=${submission.id}&page=${currentPage}`;
                        }
                      }}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>

                <Stack gap="xs">
                  <Text fw={600} size="sm">
                    Prompt:
                  </Text>
                  <Text size="sm" mb="xs">
                    {submission.prompt}
                  </Text>
                </Stack>

                <UnstyledButton
                  onClick={() => toggleItem(submission.id)}
                  styles={(theme) => ({
                    root: {
                      display: "block",
                      width: "100%",
                      textAlign: "center",
                      padding: theme.spacing.xs,
                      borderRadius: theme.radius.sm,
                      color: theme.colors.blue[6],
                      "&:hover": {
                        backgroundColor: theme.colors.gray[0],
                      },
                    },
                  })}
                >
                  {expandedItem === submission.id
                    ? "Hide Details"
                    : "Show Details"}
                </UnstyledButton>

                {expandedItem === submission.id && (
                  <Stack gap="md" mt="xs">
                    <Divider />

                    <Stack gap="xs">
                      <Text fw={600} size="sm">
                        Your Submission:
                      </Text>
                      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                        {submission.submission}
                      </Text>
                    </Stack>

                    <Stack gap="xs">
                      <Text fw={600} size="sm">
                        Corrected Text:
                      </Text>
                      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                        {submission.correction}
                      </Text>
                    </Stack>

                    <Stack gap="xs">
                      <Text fw={600} size="sm">
                        Changes:
                      </Text>
                      <VisualDiff
                        actual={submission.submission}
                        expected={submission.correction}
                      />
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}

          {totalPages > 1 && (
            <Group justify="center" mt="xl">
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={(page) => {
                  window.location.href = `/writing?page=${page}`;
                }}
              />
            </Group>
          )}
        </Stack>
      )}
    </Container>
  );
}
