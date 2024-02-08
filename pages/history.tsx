import { prismaClient } from "@/server/prisma-client";
import { exactMatch } from "@/utils/clean-string";
import { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";
import React from "react";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getSession({ req: context.req });
  const userID =
    "" +
      (
        await prismaClient.user.findUnique({
          where: { email: session?.user?.email || "" },
        })
      )?.id || "";
  const transcripts = (
    await prismaClient.transcript.findMany({
      take: 300,
      where: { card: { userId: userID } },
      orderBy: {
        recordedAt: "desc",
      },
      include: {
        card: true,
      },
    })
  )
    .filter((t) => {
      return !exactMatch(t.value, t.card.term);
    })
    .map((t) => {
      return {
        id: t.id,
        grade: t.grade.toPrecision(1),
        value: t.value,
        term: t.card.term,
      };
    });
  // Pass the transcripts to the page via props
  return { props: { transcripts } };
}

type Transcript = {
  id: number;
  grade: string;
  value: string;
  term: string;
};

type Props = {
  transcripts: Transcript[];
};

const TranscriptsPage = ({ transcripts }: Props) => {
  return (
    <div>
      <h1>Transcripts</h1>
      <p>
        <strong>NOTE:</strong> Only cards that are not an exact match are
        displayed here.
      </p>
      <hr />
      <table>
        <thead>
          <tr>
            <th>Grade</th>
            <th>Phrase</th>
            <th>What You Said</th>
          </tr>
        </thead>
        <tbody>
          {transcripts.map((transcript) => (
            <tr key={transcript.id}>
              <td>{transcript.grade}</td>
              <td>{transcript.term}</td>
              <td>{transcript.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TranscriptsPage;
