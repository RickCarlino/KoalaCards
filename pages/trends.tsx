import { getTopUnreviewedQuizTermTrends } from "@/koala/trends/get-top-unreviewed-quiz-term-trends";
import { getServersideUser } from "@/koala/get-serverside-user";
import { Container, Table, Text, Title } from "@mantine/core";
import { GetServerSideProps } from "next";

type TrendsRow = {
  term: string;
  definition: string;
  count: number;
};

type Props = {
  rows: TrendsRow[];
};

export const getServerSideProps: GetServerSideProps<Props> = async (
  context,
) => {
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const rows = await getTopUnreviewedQuizTermTrends({
    userId: dbUser.id,
    limit: 10,
  });

  return {
    props: {
      rows,
    },
  };
};

export default function TrendsPage({ rows }: Props) {
  const hasRows = rows.length > 0;

  return (
    <Container size="md" py="xl">
      <Title order={2}>Unreviewed quiz trends</Title>
      <Text c="dimmed" mt="xs">
        Top 10 acceptable terms by count (reviewedAt is null).
      </Text>

      {!hasRows ? (
        <Text mt="md">No unreviewed quiz results found.</Text>
      ) : (
        <Table
          striped
          highlightOnHover
          withTableBorder
          withColumnBorders
          mt="md"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Term</Table.Th>
              <Table.Th>Definition</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Count</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map(({ term, definition, count }) => (
              <Table.Tr key={term}>
                <Table.Td>{term}</Table.Td>
                <Table.Td>{definition}</Table.Td>
                <Table.Td style={{ textAlign: "right" }}>{count}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Container>
  );
}
