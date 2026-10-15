import {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import { prismaClient } from "@/koala/prisma-client";
import { Anchor, Container, Paper, Table } from "@mantine/core";
import Link from "next/link";
import { PageHeader } from "@/koala/components/PageHeader";
import { Prisma } from "@/koala/generated/prisma/client";
import {
  fmtShortDate,
  requireAdminRequest,
  yesNo,
} from "@/koala/admin-helpers";

const ONE_DAY = 24 * 60 * 60 * 1000;

function daysSince(date: Date | null): number {
  if (!date) {
    return 0;
  }
  return Math.floor((Date.now() - date.getTime()) / ONE_DAY);
}

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const adminRequest = await requireAdminRequest(context);
  if ("redirect" in adminRequest) {
    return adminRequest;
  }

  type UserWithCount = Prisma.UserGetPayload<{
    include: {
      _count: {
        select: {
          Card: true;
        };
      };
    };
  }>;

  const users: UserWithCount[] = await prismaClient.user.findMany({
    orderBy: {
      lastSeen: "desc",
    },
    include: {
      _count: {
        select: { Card: true },
      },
    },
  });

  const studiedByUserRows = await prismaClient.card.groupBy({
    by: ["userId"],
    where: { repetitions: { gt: 0 } },
    _count: { _all: true },
  });

  const studiedByUser = new Map<string, number>(
    studiedByUserRows.map((r) => [r.userId, r._count._all] as const),
  );

  const userData = users.map((u) => {
    return {
      id: u.id,
      email: u.email ?? "(no email)",
      lastSeen: u.lastSeen?.toISOString() ?? null,
      createdAt: u.createdAt?.toISOString() ?? null,
      daysSinceLastSeen: daysSince(u.lastSeen),
      cardCount: u._count.Card,
      studiedCount: studiedByUser.get(u.id) || 0,
      isAdmin:
        !!u.email &&
        adminRequest.superUsers.includes(u.email.toLowerCase()),
    };
  });

  return {
    props: {
      userData,
    },
  };
}

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

function fmtDate(iso: string | null): string {
  return fmtShortDate(iso, "No");
}

export default function AdminPage({ userData }: Props) {
  return (
    <Container size="lg" py="xl">
      <PageHeader title="User report" />
      <Paper p="md">
        <Table.ScrollContainer minWidth={720} type="native">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Email</Table.Th>
                <Table.Th>Days Since</Table.Th>
                <Table.Th># Cards</Table.Th>
                <Table.Th>Studied</Table.Th>
                <Table.Th>Admin?</Table.Th>
                <Table.Th>Created At</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {userData.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td>
                    <Anchor
                      component={Link}
                      href={`/link/${u.id}`}
                      size="sm"
                    >
                      {u.email}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{u.daysSinceLastSeen}</Table.Td>
                  <Table.Td>{u.cardCount}</Table.Td>
                  <Table.Td>{u.studiedCount}</Table.Td>
                  <Table.Td>{yesNo(u.isAdmin)}</Table.Td>
                  <Table.Td>{fmtDate(u.createdAt)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Container>
  );
}
