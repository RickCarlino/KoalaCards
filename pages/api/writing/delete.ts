import { prismaClient } from "@/koala/prisma-client";
import { NextApiRequest, NextApiResponse } from "next";
import { authOptions } from "../auth/[...nextauth]";
import { getServerSession } from "next-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res
      .status(401)
      .json({ message: "Unauthorized - No valid session" });
  }

  const dbUser = await prismaClient.user.findUnique({
    where: { email: session.user.email },
  });

  if (!dbUser) {
    return res
      .status(401)
      .json({ message: "Unauthorized - User not found" });
  }

  const submissionId = parseInt(req.body.id);
  if (isNaN(submissionId)) {
    return res.status(400).json({ message: "Invalid submission ID" });
  }

  const submission = await prismaClient.writingSubmission.findFirst({
    where: {
      id: submissionId,
      userId: dbUser.id,
    },
  });

  if (!submission) {
    return res
      .status(404)
      .json({ message: "Submission not found or not owned by you" });
  }

  await prismaClient.writingSubmission.delete({
    where: {
      id: submissionId,
    },
  });

  const page = req.headers.referer?.includes("page=")
    ? req.headers.referer.split("page=")[1].split("&")[0]
    : "1";

  res.redirect(`/writing?page=${page}`);
}
