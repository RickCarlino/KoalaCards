import React from "react";
import { useRouter } from "next/router";
import {
  Button,
  Container,
  Group,
  Paper,
  Pagination,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { QuizResult } from "@prisma/client";
import { GetServerSideProps } from "next/types";
import { getServersideUser } from "@/koala/get-serverside-user";

interface TrainProps {
  data: QuizResult[];
  totalPages: number;
  page: number;
}

const NULL_TABLE = (
  <Text fw="bold" ta="center">
    No data found.
  </Text>
);

export default function Train({ data, totalPages, page }: TrainProps) {
  const router = useRouter();

  // Handler for pagination changes:
  const onPageChange = (newPage: number) => {
    // We push a new route with the updated page param
    router.push(`/train?page=${newPage}`);
  };

  const handleDownload = () => {
    const payload = {
      page,
      totalPages,
      count: data.length,
      results: data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz-results_page-${page}_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Container size="lg" mt="md">
      <Group justify="space-between" align="center" mb="md">
        <Title order={2}>Quiz Results</Title>
        <Button
          onClick={handleDownload}
          leftSection={<IconDownload size={16} />}
        >
          Download JSON
        </Button>
      </Group>
      <Paper shadow="md" radius="md" withBorder p="md">
        {data.length === 0 ? NULL_TABLE : table(data)}
      </Paper>
      <Pagination
        value={page}
        onChange={onPageChange}
        total={totalPages}
      />
    </Container>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { prismaClient } = await import("@/koala/prisma-client");
  const { isApprovedUser } = await import("@/koala/is-approved-user");
  const dbUser = await getServersideUser(ctx);
  const userId = dbUser?.id;

  // Only approved users can access
  if (!userId || !isApprovedUser(userId)) {
    return {
      redirect: {
        destination: "/user",
        permanent: false,
      },
    };
  }

  // Parse the page param, default to 1
  const page = parseInt(ctx.query.page as string, 10) || 1;
  const rowsPerPage = 200;

  // Count total records (adjust filter for your 30-days condition, etc.)
  const totalCount = await prismaClient.quizResult.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
    },
  });

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  const skip = (page - 1) * rowsPerPage;

  const data = await prismaClient.quizResult.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: rowsPerPage,
  });

  // Return serialized data plus pagination info
  return {
    props: {
      data: JSON.parse(JSON.stringify(data)),
      totalPages,
      page,
    },
  };
};

function table(data: QuizResult[]): React.ReactNode {
  return (
    <Table striped highlightOnHover withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>ID</Table.Th>
          <Table.Th>Definition</Table.Th>
          <Table.Th>Acceptable</Table.Th>
          <Table.Th>Provided</Table.Th>
          <Table.Th>Reason</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data.map((row) => {
          const {
            id,
            definition,
            acceptableTerm,
            userInput,
            reason,
            isAcceptable,
          } = row;
          return (
            <Table.Tr
              key={id}
              style={{
                color: isAcceptable ? undefined : "orange",
              }}
            >
              <Table.Td>{id}</Table.Td>
              <Table.Td>{definition}</Table.Td>
              <Table.Td>{acceptableTerm}</Table.Td>
              <Table.Td>{userInput}</Table.Td>
              <Table.Td>{reason}</Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
