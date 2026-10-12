import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireJsonPostMethod, setNoStore } from "@/koala/api/next-api";
import { requireJsonApiUser } from "@/koala/get-api-user";
import {
  disableStudyReportLink,
  saveStudyReportLink,
} from "@/koala/study-report-link-server";

const actionSchema = z.object({
  action: z.enum(["copy", "regenerate", "disable"]),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  setNoStore(res);
  if (!requireJsonPostMethod(req, res)) {
    return;
  }
  if (
    req.headers["content-type"]?.split(";")[0].trim() !==
    "application/json"
  ) {
    res.status(415).json({ error: "Expected JSON" });
    return;
  }
  const user = await requireJsonApiUser(req, res);
  if (!user) {
    return;
  }
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (parsed.data.action === "disable") {
    await disableStudyReportLink(user.id);
    res.status(200).json({ token: null });
    return;
  }

  const link = await saveStudyReportLink(
    user.id,
    parsed.data.action === "regenerate",
  );
  res.status(200).json(link);
}
