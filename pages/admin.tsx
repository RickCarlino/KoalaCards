import React from "react";
import {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import { getSession } from "next-auth/react";
import { prismaClient } from "@/koala/prisma-client";
import {
  formatIsoDateTimeShort,
  formatYesNo,
} from "@/koala/utils/formatters";
import { Container, Table, Title } from "@mantine/core";
import { useRouter } from "next/router";
import { Prisma } from "@prisma/client";

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
  const session = await getSession({ req: context.req });
  const email = session?.user?.email?.toLowerCase() ?? null;

  const superUsers = (process.env.AUTHORIZED_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.includes("@"));

  if (!email || !superUsers.includes(email)) {
    return {
      redirect: {
        destination: "/user",
        permanent: false,
      },
    };
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
      email: u.email ?? "(no email??)",
      lastSeen: u.lastSeen?.toISOString() ?? null,
      createdAt: u.createdAt?.toISOString() ?? null,
      daysSinceLastSeen: daysSince(u.lastSeen),
      cardCount: u._count.Card,
      studiedCount: studiedByUser.get(u.id) || 0,
      isAdmin: !!u.email && superUsers.includes(u.email.toLowerCase()),
    };
  });

  return {
    props: {
      userData,
    },
  };
}

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

export default function AdminPage({ userData }: Props) {
  const router = useRouter();
  return (
    <Container size="md" mt="xl">
      <Title order={1} mb="sm">
        User Report
      </Title>
      <Table striped highlightOnHover>
        <thead>
          <tr>
            <th>Email</th>
            <th>Days Since</th>
            <th># Cards</th>
            <th>Studied</th>
            <th>Admin?</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          {userData.map((u) => (
            <tr
              key={u.id}
              style={{ cursor: "pointer" }}
              onClick={() => router.push(`/link/${u.id}`)}
            >
              <td>{u.email}</td>
              <td>{u.daysSinceLastSeen}</td>
              <td>{u.cardCount}</td>
              <td>{u.studiedCount}</td>
              <td>{formatYesNo(u.isAdmin)}</td>
              <td>{formatIsoDateTimeShort(u.createdAt, "No")}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
}
