import type { NextApiRequest, NextApiResponse } from "next";
import { requireJsonGetMethod, setNoStore } from "@/koala/api/next-api";
import { getStudyReportOwner } from "@/koala/study-report-link-server";
import { getStudyReport } from "@/koala/study-report";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  setNoStore(res);
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!requireJsonGetMethod(req, res)) {
    return;
  }

  const userId = await getStudyReportOwner(req.query.token);
  if (!userId) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  res.status(200).json(await getStudyReport(userId));
}
