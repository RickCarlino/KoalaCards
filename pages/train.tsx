import React from "react";
import { useRouter } from "next/router";
import {
  Container,
  Paper,
  Table,
  Text,
  Title,
  Space,
  Pagination,
} from "@mantine/core";
import { TrainingData } from "@prisma/client";
import { GetServerSideProps } from "next/types";
import { getServersideUser } from "@/koala/get-serverside-user";

interface TrainProps {
  data: TrainingData[];
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

  return (
    <Container size="lg" mt="md">
      <Title order={2}>Training Data</Title>
      <Space h="md" />
      <Paper shadow="md" radius="md" withBorder p="md">
        {data.length === 0 ? NULL_TABLE : table(data)}
      </Paper>
      <Space h="md" />
      <Pagination value={page} onChange={onPageChange} total={totalPages} />
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
  const rowsPerPage = 20;

  // Count total records (adjust filter for your 30-days condition, etc.)
  const totalCount = await prismaClient.trainingData.count({
    where: {
      yesNo: "no",
      createdAt: {
        gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      },
    },
  });

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  // Calculate skip/take for pagination
  const skip = (page - 1) * rowsPerPage;

  // Query paginated results (last 30 days, max 500 if you wish, or remove that limit)
  const data = await prismaClient.trainingData.findMany({
    where: {
      yesNo: "no",
      createdAt: {
        gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
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

function table(data: TrainingData[]): React.ReactNode {
  return (
    <Table striped highlightOnHover withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>ID</Table.Th>
          <Table.Th>Definition</Table.Th>
          <Table.Th>Acceptable</Table.Th>
          <Table.Th>Provided</Table.Th>
          <Table.Th>Corrected</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data.map((trainingData) => {
          const { id, definition, term, userInput, explanation, yesNo } =
            trainingData;
          return (
            <Table.Tr
              key={id}
              style={{
                color: yesNo === "no" ? "orange" : "",
              }}
            >
              <Table.Td>{id}</Table.Td>
              <Table.Td>{definition}</Table.Td>
              <Table.Td>{term}</Table.Td>
              <Table.Td>{userInput}</Table.Td>
              <Table.Td>{explanation}</Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
