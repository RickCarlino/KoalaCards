import type { NextApiRequest, NextApiResponse } from "next";
import { handleMcpRequest } from "@/koala/mcp/http";

export const config = {
  api: { bodyParser: { sizeLimit: "16kb" } },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await handleMcpRequest(req, res, req.query.token, req.body);
}
