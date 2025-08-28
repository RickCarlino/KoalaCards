import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Authenticate user using the standard method in this project
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  // Get params
  const id = Number(context.query.id);
  const page = context.query.page || "1";

  if (isNaN(id)) {
    return {
      redirect: { destination: `/writing?page=${page}`, permanent: false },
    };
  }

  await prismaClient.writingSubmission.deleteMany({
    where: {
      id,
      userId: dbUser.id,
    },
  });

  // Redirect back to the writing page
  return {
    redirect: { destination: `/writing?page=${page}`, permanent: false },
  };
};

// This component will never be rendered since we always redirect
export default function DeletePage() {
  return null;
}
