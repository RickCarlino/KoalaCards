import React from "react";
import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { getSession } from "next-auth/react";
import { prismaClient } from "@/koala/prisma-client";
import { Container, Table, Title } from "@mantine/core";
import { Prisma } from "@prisma/client";

const ONE_DAY = 24 * 60 * 60 * 1000;

function daysSince(date: Date | null): number {
  if (!date) return 0;
  return Math.floor((Date.now() - date.getTime()) / ONE_DAY);
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
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

  const userData = users.map((u) => {
    return {
      id: u.id,
      email: u.email ?? "(no email??)",
      lastSeen: u.lastSeen?.toISOString() ?? null,
      daysSinceLastSeen: daysSince(u.lastSeen),
      cardCount: u._count.Card,
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
            <th>Admin?</th>
          </tr>
        </thead>
        <tbody>
          {userData.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.daysSinceLastSeen}</td>
              <td>{u.cardCount}</td>
              <td>{u.isAdmin ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
}
