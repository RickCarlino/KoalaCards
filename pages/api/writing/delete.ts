import { prismaClient } from "@/koala/prisma-client";
import { NextApiRequest, NextApiResponse } from "next";
import { unstable_getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Get server-side session using the auth options from [...nextauth].ts
    const session = await unstable_getServerSession(req, res, authOptions);

    console.log("Session data:", JSON.stringify(session));

    if (!session?.user?.email) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No valid session" });
    }

    // Get the user from the database
    const dbUser = await prismaClient.user.findUnique({
      where: { email: session.user.email },
    });

    console.log("User found:", dbUser?.id);

    if (!dbUser) {
      return res.status(401).json({ message: "Unauthorized - User not found" });
    }

    // Get submission ID from request body
    const submissionId = parseInt(req.body.id);
    if (isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submission ID" });
    }

    // Check if the submission exists and belongs to the user
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

    // Delete the submission
    await prismaClient.writingSubmission.delete({
      where: {
        id: submissionId,
      },
    });

    // Redirect back to the writing history page with the same page number
    const page = req.headers.referer?.includes("page=")
      ? req.headers.referer.split("page=")[1].split("&")[0]
      : "1";

    res.redirect(`/writing?page=${page}`);
  } catch (error) {
    console.error("Error deleting writing submission:", error);
    res.status(500).json({ message: "Error deleting submission" });
  }
}
