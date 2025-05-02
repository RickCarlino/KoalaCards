import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { Container } from "@mantine/core";
import { GetServerSideProps } from "next/types";
import * as React from "react";

// Get serverside props:
export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }
  const cardCount = await prismaClient.card.count({
    where: { userId: dbUser.id },
  });

  if (cardCount === 0) {
    return { redirect: { destination: "/create", permanent: false } };
  }

  return { redirect: { destination: "/review", permanent: false } };
};

const Index: React.FC = () => {
  return (
    <Container size="xs">
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        <span style={{ fontSize: "24px", fontWeight: "bold" }}>
          Welcome
        </span>
      </header>
      <p>Click "Study" on the left panel to begin a lesson.</p>
    </Container>
  );
};

export default Index;
