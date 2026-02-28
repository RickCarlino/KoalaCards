import { lookup } from "dns/promises";
import { isIP } from "net";

const MAX_TEXT_LENGTH = 120000;
const MAX_HTML_LENGTH = 240000;
const DESCRIPTION_LENGTH = 500;

type MetaTag = {
  attr: "name" | "property";
  key: string;
};

export type ArticleSnapshot = {
  normalizedUrl: string;
  title: string;
  description: string;
  text: string;
  htmlContent: string;
};

const normalizeWhitespace = (input: string): string => {
  return input.replace(/\s+/g, " ").trim();
};

const normalizeLineBreaks = (input: string): string => {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const isLocalHostname = (hostname: string): boolean => {
  const lowered = hostname.toLowerCase();
  if (lowered === "localhost") {
    return true;
  }
  return lowered.endsWith(".localhost");
};

const parseIpv4Octets = (
  ip: string,
): [number, number, number, number] | null => {
  const octets = ip.split(".").map((part) => Number(part));
  if (octets.length !== 4) {
    return null;
  }
  if (octets.some((part) => !Number.isInteger(part))) {
    return null;
  }
  if (octets.some((part) => part < 0 || part > 255)) {
    return null;
  }
  const [first, second, third, fourth] = octets;
  return [first, second, third, fourth];
};

const isPrivateIpv4Prefix = (first: number, second: number): boolean => {
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
};

const isPrivateIpv4Address = (ip: string): boolean => {
  const octets = parseIpv4Octets(ip);
  if (!octets) {
    return true;
  }
  const [first, second] = octets;
  return isPrivateIpv4Prefix(first, second);
};

const isPrivateIpv6Address = (ip: string): boolean => {
  const lowered = ip.toLowerCase().split("%")[0];
  if (lowered === "::1" || lowered === "::") {
    return true;
  }

  if (lowered.startsWith("fc") || lowered.startsWith("fd")) {
    return true;
  }

  if (/^fe[89ab]/.test(lowered)) {
    return true;
  }

  if (lowered.startsWith("::ffff:")) {
    const mappedIpv4 = lowered.slice("::ffff:".length);
    return isPrivateIpv4Address(mappedIpv4);
  }

  return false;
};

const isPrivateOrLocalIp = (address: string): boolean => {
  const version = isIP(address);
  if (version === 4) {
    return isPrivateIpv4Address(address);
  }
  if (version === 6) {
    return isPrivateIpv6Address(address);
  }
  return true;
};

const assertPublicTargetHost = async (hostname: string): Promise<void> => {
  if (isLocalHostname(hostname)) {
    throw new Error("Local URLs are not supported.");
  }

  const hostIpVersion = isIP(hostname);
  if (hostIpVersion !== 0 && isPrivateOrLocalIp(hostname)) {
    throw new Error("Private network URLs are not supported.");
  }

  if (hostIpVersion !== 0) {
    return;
  }

  let resolvedAddresses: string[];
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    resolvedAddresses = records.map((record) => record.address);
  } catch {
    throw new Error("Could not resolve the article hostname.");
  }

  if (resolvedAddresses.length === 0) {
    throw new Error("Could not resolve the article hostname.");
  }

  if (resolvedAddresses.some(isPrivateOrLocalIp)) {
    throw new Error("Private network URLs are not supported.");
  }
};

const decodeHtmlEntities = (input: string): string => {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/");
};

const stripTags = (input: string): string => {
  return input.replace(/<[^>]+>/g, " ");
};

const removeNoiseNodes = (html: string): string => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<canvas[\s\S]*?<\/canvas>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ");
};

const extractFirstMatch = (html: string, pattern: RegExp): string => {
  const match = pattern.exec(html);
  if (!match?.[1]) {
    return "";
  }
  return decodeHtmlEntities(match[1]).trim();
};

const metaContent = (html: string, tag: MetaTag): string => {
  const escapedKey = tag.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]*${tag.attr}=["']${escapedKey}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  return extractFirstMatch(html, pattern);
};

const extractTitle = (html: string): string => {
  const candidates = [
    metaContent(html, { attr: "property", key: "og:title" }),
    metaContent(html, { attr: "name", key: "twitter:title" }),
    extractFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return normalizeWhitespace(candidate);
    }
  }

  return "Untitled article";
};

const extractDescription = (html: string): string => {
  const candidates = [
    metaContent(html, { attr: "property", key: "og:description" }),
    metaContent(html, { attr: "name", key: "description" }),
    metaContent(html, { attr: "name", key: "twitter:description" }),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return normalizeWhitespace(candidate).slice(0, DESCRIPTION_LENGTH);
    }
  }

  return "";
};

const extractBodyHtml = (html: string): string => {
  const matchedBody = extractFirstMatch(
    html,
    /<body[^>]*>([\s\S]*?)<\/body>/i,
  );

  if (matchedBody) {
    return matchedBody;
  }

  return html;
};

const textFromHtml = (html: string): string => {
  const withoutNoise = removeNoiseNodes(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n");

  const decoded = decodeHtmlEntities(stripTags(withoutNoise));
  return normalizeLineBreaks(decoded).slice(0, MAX_TEXT_LENGTH);
};

const compactHtml = (html: string): string => {
  return removeNoiseNodes(html)
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, MAX_HTML_LENGTH);
};

export const normalizeSourceUrl = (rawUrl: string): string => {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  parsed.hash = "";
  return parsed.toString();
};

export const fetchArticleSnapshot = async (
  rawUrl: string,
): Promise<ArticleSnapshot> => {
  const normalizedUrl = normalizeSourceUrl(rawUrl);
  const parsedUrl = new URL(normalizedUrl);
  await assertPublicTargetHost(parsedUrl.hostname);

  const response = await fetch(normalizedUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": "KoalaCards/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Article fetch failed with status ${response.status}.`,
    );
  }

  const html = await response.text();
  if (!html.trim()) {
    throw new Error("Fetched article was empty.");
  }

  const bodyHtml = extractBodyHtml(html);
  const text = textFromHtml(bodyHtml);
  if (!text) {
    throw new Error("Could not extract readable text from the URL.");
  }

  return {
    normalizedUrl,
    title: extractTitle(html),
    description: extractDescription(html),
    text,
    htmlContent: compactHtml(bodyHtml),
  };
};

const escapeHtml = (input: string): string => {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const plainTextToHtmlParagraphs = (input: string): string => {
  const normalized = normalizeLineBreaks(input);
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
};
