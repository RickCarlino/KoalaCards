import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

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

  return {
    redirect: { destination: `/writing?page=${page}`, permanent: false },
  };
};

export default function DeletePage() {
  return null;
}
