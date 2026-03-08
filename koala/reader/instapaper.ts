import { createHmac, randomBytes } from "crypto";

const INSTAPAPER_API_ROOT = "https://www.instapaper.com/api/1";
const OAUTH_SIGNATURE_METHOD = "HMAC-SHA1";
const OAUTH_VERSION = "1.0";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

type OAuthConsumerCredentials = {
  key: string;
  secret: string;
};

type OAuthAccessToken = {
  token: string;
  secret: string;
};

export type InstapaperCredentials = {
  username: string;
  password: string;
};

export type InstapaperSession = {
  accessToken: OAuthAccessToken;
};

export type InstapaperUnreadBookmark = {
  bookmarkId: string;
  title: string;
  url: string;
  description: string;
};

export type AddPrivateBookmarkInput = {
  url: string;
  title: string;
  htmlContent: string;
};

export type InstapaperErrorKind =
  | "config"
  | "auth"
  | "api"
  | "network"
  | "bad_response";

const knownInstapaperErrorCodes: Record<number, string> = {
  1040: "Rate limit exceeded.",
  1041: "Authentication failed.",
  1042: "OAuth signature was rejected.",
  1200: "The request parameters were invalid.",
  1201: "The URL is invalid.",
  1202: "The supplied content was invalid.",
  1220: "This domain cannot be imported by Instapaper.",
  1221: "Instapaper could not parse this page.",
};

export class InstapaperApiError extends Error {
  kind: InstapaperErrorKind;
  statusCode?: number;
  apiCode?: number;

  constructor(
    message: string,
    options: {
      kind: InstapaperErrorKind;
      statusCode?: number;
      apiCode?: number;
    },
  ) {
    super(message);
    this.name = "InstapaperApiError";
    this.kind = options.kind;
    this.statusCode = options.statusCode;
    this.apiCode = options.apiCode;
  }
}

type InstapaperRequest = {
  method: "GET" | "POST";
  path: string;
  params: Record<string, string>;
  accessToken?: OAuthAccessToken;
};

const isRecord = (value: JsonValue): value is JsonObject => {
  if (typeof value !== "object") {
    return false;
  }

  if (value === null) {
    return false;
  }

  return !Array.isArray(value);
};

const asString = (value: JsonValue | undefined): string => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
};

const requireEnvValue = (name: string): string => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new InstapaperApiError(
      "Instapaper integration is not configured for this deployment.",
      { kind: "config" },
    );
  }

  return value.trim();
};

const instapaperConsumerCredentials = (): OAuthConsumerCredentials => {
  return {
    key: requireEnvValue("INSTAPAPER_CONSUMER_KEY"),
    secret: requireEnvValue("INSTAPAPER_CONSUMER_SECRET"),
  };
};

const oauthEncode = (value: string): string => {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/'/g, "%27");
};

const oauthNonce = (): string => {
  return randomBytes(16).toString("hex");
};

const normalizeParameterPairs = (
  pairs: Array<[string, string]>,
): Array<[string, string]> => {
  const normalized = pairs.map(([key, value]) => {
    return [oauthEncode(key), oauthEncode(value)] as [string, string];
  });

  normalized.sort((left, right) => {
    if (left[0] < right[0]) {
      return -1;
    }

    if (left[0] > right[0]) {
      return 1;
    }

    if (left[1] < right[1]) {
      return -1;
    }

    if (left[1] > right[1]) {
      return 1;
    }

    return 0;
  });

  return normalized;
};

const parameterString = (pairs: Array<[string, string]>): string => {
  return normalizeParameterPairs(pairs)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
};

const oauthAuthorizationHeader = (options: {
  method: "GET" | "POST";
  absoluteUrl: string;
  requestParams: Record<string, string>;
  consumer: OAuthConsumerCredentials;
  accessToken?: OAuthAccessToken;
}): string => {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: options.consumer.key,
    oauth_nonce: oauthNonce(),
    oauth_signature_method: OAUTH_SIGNATURE_METHOD,
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: OAUTH_VERSION,
  };

  if (options.accessToken) {
    oauthParams.oauth_token = options.accessToken.token;
  }

  const signaturePairs = [
    ...Object.entries(options.requestParams),
    ...Object.entries(oauthParams),
  ];

  const signatureBaseString = [
    options.method.toUpperCase(),
    oauthEncode(options.absoluteUrl),
    oauthEncode(parameterString(signaturePairs)),
  ].join("&");

  const signingKey = [
    oauthEncode(options.consumer.secret),
    oauthEncode(options.accessToken?.secret ?? ""),
  ].join("&");

  const signature = createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64");

  const headerPairs = normalizeParameterPairs([
    ...Object.entries(oauthParams),
    ["oauth_signature", signature],
  ]).map(([key, value]) => `${key}="${value}"`);

  return `OAuth ${headerPairs.join(", ")}`;
};

const bodyApiCode = (body: string): number | undefined => {
  const trimmed = body.trim();
  if (!trimmed) {
    return undefined;
  }

  const leadingCode = /^\d{4}$/.test(trimmed)
    ? Number.parseInt(trimmed, 10)
    : undefined;
  if (leadingCode) {
    return leadingCode;
  }

  if (/^\d{4}\b/.test(trimmed)) {
    return Number.parseInt(trimmed.slice(0, 4), 10);
  }

  return undefined;
};

const instapaperErrorMessage = (
  statusCode: number,
  body: string,
): string => {
  const apiCode = bodyApiCode(body);

  if (apiCode && knownInstapaperErrorCodes[apiCode]) {
    return `Instapaper error ${apiCode}: ${knownInstapaperErrorCodes[apiCode]}`;
  }

  if (apiCode) {
    return `Instapaper error ${apiCode}.`;
  }

  if (statusCode === 401 || statusCode === 403) {
    return "Instapaper authentication failed. Check username/password and app credentials.";
  }

  if (statusCode >= 500) {
    return "Instapaper is currently unavailable. Please try again.";
  }

  if (body.trim()) {
    return `Instapaper request failed: ${body.trim()}`;
  }

  return `Instapaper request failed with status ${statusCode}.`;
};

const parseJson = (input: string): JsonValue => {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new InstapaperApiError(
      "Instapaper returned an empty response.",
      {
        kind: "bad_response",
      },
    );
  }

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    throw new InstapaperApiError("Instapaper returned invalid JSON.", {
      kind: "bad_response",
    });
  }
};

const doInstapaperRequest = async (
  request: InstapaperRequest,
): Promise<string> => {
  const consumer = instapaperConsumerCredentials();
  const absoluteUrl = `${INSTAPAPER_API_ROOT}${request.path}`;

  const authorization = oauthAuthorizationHeader({
    method: request.method,
    absoluteUrl,
    requestParams: request.params,
    consumer,
    accessToken: request.accessToken,
  });

  const encodedParams = new URLSearchParams(request.params).toString();
  let requestUrl = absoluteUrl;
  const headers: Record<string, string> = {
    Authorization: authorization,
  };

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method === "GET") {
    requestUrl = encodedParams
      ? `${absoluteUrl}?${encodedParams}`
      : absoluteUrl;
  }

  if (request.method === "POST") {
    headers["Content-Type"] =
      "application/x-www-form-urlencoded; charset=utf-8";
    init.body = encodedParams;
  }

  let response: Response;
  try {
    response = await fetch(requestUrl, init);
  } catch {
    throw new InstapaperApiError(
      "Could not reach Instapaper. Check network connectivity.",
      {
        kind: "network",
      },
    );
  }

  const responseText = await response.text();
  if (response.ok) {
    return responseText;
  }

  const apiCode = bodyApiCode(responseText);
  const message = instapaperErrorMessage(response.status, responseText);
  const kind: InstapaperErrorKind =
    response.status === 401 || response.status === 403 ? "auth" : "api";

  throw new InstapaperApiError(message, {
    kind,
    statusCode: response.status,
    apiCode,
  });
};

const parseAccessTokenResponse = (
  responseText: string,
): OAuthAccessToken => {
  const params = new URLSearchParams(responseText.trim());
  const token = params.get("oauth_token")?.trim() ?? "";
  const secret = params.get("oauth_token_secret")?.trim() ?? "";

  if (!token || !secret) {
    throw new InstapaperApiError(
      "Instapaper access token response was missing required fields.",
      {
        kind: "bad_response",
      },
    );
  }

  return { token, secret };
};

export const createInstapaperSession = async (
  credentials: InstapaperCredentials,
): Promise<InstapaperSession> => {
  const username = credentials.username.trim();
  const password = credentials.password;

  if (!username || !password) {
    throw new InstapaperApiError(
      "Instapaper username and password are required.",
      {
        kind: "auth",
      },
    );
  }

  const responseText = await doInstapaperRequest({
    method: "POST",
    path: "/oauth/access_token",
    params: {
      x_auth_mode: "client_auth",
      x_auth_password: password,
      x_auth_username: username,
    },
  });

  return {
    accessToken: parseAccessTokenResponse(responseText),
  };
};

const toUnreadBookmark = (
  value: JsonValue,
): InstapaperUnreadBookmark | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (asString(value.type) !== "bookmark") {
    return null;
  }

  const bookmarkId = asString(value.bookmark_id).trim();
  const url = asString(value.url).trim();

  if (!bookmarkId || !url) {
    return null;
  }

  const title = asString(value.title).trim() || "Untitled";
  const description = asString(value.description).trim();

  return {
    bookmarkId,
    title,
    url,
    description,
  };
};

const parseUnreadBookmarksResponse = (
  responseText: string,
): InstapaperUnreadBookmark[] => {
  const payload = parseJson(responseText);
  if (!Array.isArray(payload)) {
    throw new InstapaperApiError(
      "Instapaper unread payload was not an array.",
      {
        kind: "bad_response",
      },
    );
  }

  const bookmarks: InstapaperUnreadBookmark[] = [];
  for (const value of payload) {
    const bookmark = toUnreadBookmark(value);
    if (bookmark) {
      bookmarks.push(bookmark);
    }
  }

  return bookmarks;
};

export const listInstapaperUnreadBookmarks = async (
  session: InstapaperSession,
): Promise<InstapaperUnreadBookmark[]> => {
  const responseText = await doInstapaperRequest({
    method: "POST",
    path: "/bookmarks/list",
    params: {
      folder_id: "unread",
      limit: "500",
    },
    accessToken: session.accessToken,
  });

  return parseUnreadBookmarksResponse(responseText);
};

const parseBookmarkIdFromAddResponse = (
  responseText: string,
): string | null => {
  const payload = parseJson(responseText);
  if (!isRecord(payload)) {
    return null;
  }

  const bookmarkId = asString(payload.bookmark_id).trim();
  if (!bookmarkId) {
    return null;
  }

  return bookmarkId;
};

export const addPrivateInstapaperBookmark = async (
  session: InstapaperSession,
  input: AddPrivateBookmarkInput,
): Promise<{ bookmarkId: string | null }> => {
  const responseText = await doInstapaperRequest({
    method: "POST",
    path: "/bookmarks/add",
    params: {
      content: input.htmlContent,
      is_private_from_source: "KoalaCards",
      title: input.title,
      url: input.url,
    },
    accessToken: session.accessToken,
  });

  return {
    bookmarkId: parseBookmarkIdFromAddResponse(responseText),
  };
};

export const archiveInstapaperBookmark = async (
  session: InstapaperSession,
  bookmarkId: string,
): Promise<void> => {
  const normalizedBookmarkId = bookmarkId.trim();
  if (!normalizedBookmarkId) {
    throw new InstapaperApiError(
      "Bookmark id is required for archiving.",
      {
        kind: "api",
      },
    );
  }

  await doInstapaperRequest({
    method: "POST",
    path: "/bookmarks/archive",
    params: {
      bookmark_id: normalizedBookmarkId,
    },
    accessToken: session.accessToken,
  });
};
