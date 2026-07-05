import type { NextApiRequest, NextApiResponse } from "next";
import { escapeHtml } from "@/koala/html";
import { prismaClient } from "@/koala/prisma-client";
import { hashBookmarkletSecret } from "@/koala/reader/secret";
import {
  ReaderSaveError,
  queueReaderArticle,
} from "@/koala/reader/save-article";

const firstParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};

const htmlResponse = (
  title: string,
  message: string,
  color: string,
): string => {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(160deg, #fff7fb 0%, #ffe7f1 100%);
        color: #4f2b3f;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      }
      main {
        width: min(560px, calc(100vw - 32px));
        background: rgba(255, 255, 255, 0.85);
        border: 1px solid #f3bfd4;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 10px 28px rgba(198, 106, 147, 0.16);
      }
      h1 {
        margin: 0 0 8px;
        color: ${color};
        font-size: 22px;
      }
      p {
        margin: 0;
        line-height: 1.55;
      }
      a {
        color: #bb4d80;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <p style="margin-top: 12px;"><a href="/reader">Back to Reader</a></p>
    </main>
  </body>
</html>`;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).send("Method not allowed.");
    return;
  }

  const secretKey = firstParam(req.query.key).trim();
  const articleUrl = firstParam(req.query.url).trim();
  const suggestedTitle = firstParam(req.query.title).trim();

  if (!secretKey || !articleUrl) {
    res.status(400).setHeader("Content-Type", "text/html; charset=utf-8");
    res
      .status(400)
      .send(
        htmlResponse(
          "Missing Parameters",
          "Bookmarklet key and URL are required.",
          "#c2416f",
        ),
      );
    return;
  }

  const credential =
    await prismaClient.readerBookmarkletCredential.findUnique({
      where: {
        secretHash: hashBookmarkletSecret(secretKey),
      },
      select: {
        userId: true,
      },
    });

  if (!credential) {
    res.status(403).setHeader("Content-Type", "text/html; charset=utf-8");
    res
      .status(403)
      .send(
        htmlResponse(
          "Invalid Key",
          "This bookmarklet key is not valid. Generate a new key from your Reader settings.",
          "#c2416f",
        ),
      );
    return;
  }

  try {
    const queuedArticle = await queueReaderArticle({
      userId: credential.userId,
      requestUrl: articleUrl,
      saveOrigin: "BOOKMARKLET",
      suggestedTitle,
    });

    res.redirect(302, `/reader/${queuedArticle.publicId}?added=1`);
    return;
  } catch (error) {
    if (error instanceof ReaderSaveError) {
      res
        .status(error.status)
        .setHeader("Content-Type", "text/html; charset=utf-8");
      res
        .status(error.status)
        .send(
          htmlResponse("Could Not Save Article", error.message, "#c2416f"),
        );
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unexpected reader error.";

    res.status(500).setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send(htmlResponse("Reader Error", message, "#c2416f"));
  }
}
