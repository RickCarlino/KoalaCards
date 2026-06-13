import type {
  EpubManifest,
  EpubNavigationItem,
  EpubReadingPreferences,
  EpubSpineItem,
} from "./types";

type ZipEntry = {
  filename: string;
  directory?: boolean;
  getData: (writer: unknown) => Promise<unknown>;
};

type ZipModule = typeof import("@zip.js/zip.js");

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string[];
};

type ParsedPackage = {
  packagePath: string;
  packageDir: string;
  title: string;
  author: string;
  description: string;
  language: string;
  opfIdentifier: string;
  coverPath: string;
  manifestItems: Map<string, ManifestItem>;
  spineJson: EpubSpineItem[];
  navigationJson: EpubNavigationItem[];
};

type RenderedSection = {
  html: string;
  text: string;
  objectUrls: string[];
};

const EPUB_CONTAINER_PATH = "META-INF/container.xml";

function normalizeArchivePath(value: string): string {
  return value.replace(/^\/+/, "").replace(/\\/g, "/");
}

function directoryName(value: string): string {
  const normalized = normalizeArchivePath(value);
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex < 0) {
    return "";
  }

  return normalized.slice(0, slashIndex);
}

function stripHrefFragment(value: string): string {
  return value.split("#")[0].split("?")[0];
}

function normalizePathSegments(value: string): string {
  const parts = normalizeArchivePath(value).split("/");
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      normalized.pop();
      continue;
    }

    normalized.push(part);
  }

  return normalized.join("/");
}

function resolveRelativePath(baseDir: string, href: string): string {
  const stripped = stripHrefFragment(href);
  if (!stripped) {
    return normalizeArchivePath(baseDir);
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(stripped)) {
    return stripped;
  }

  if (stripped.startsWith("/")) {
    return normalizePathSegments(stripped);
  }

  return normalizePathSegments(
    baseDir ? `${baseDir}/${stripped}` : stripped,
  );
}

function textFromElement(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function elementsByLocalName(
  parent: ParentNode,
  localName: string,
): Element[] {
  const candidates = Array.from(parent.querySelectorAll(localName));
  if (candidates.length > 0) {
    return candidates;
  }

  if (parent instanceof Document || parent instanceof Element) {
    return Array.from(
      parent.getElementsByTagNameNS("*", localName),
    ) as Element[];
  }

  return [];
}

function firstElementByLocalName(
  parent: ParentNode,
  localName: string,
): Element | null {
  return elementsByLocalName(parent, localName)[0] ?? null;
}

function attributeTokens(element: Element, name: string): string[] {
  const value = element.getAttribute(name) ?? "";
  return value.split(/\s+/).filter((token) => token.length > 0);
}

function hasAttributeToken(
  element: Element,
  localName: string,
  token: string,
): boolean {
  for (const attribute of Array.from(element.attributes)) {
    if (
      attribute.localName === localName &&
      attribute.value.split(/\s+/).includes(token)
    ) {
      return true;
    }
  }

  return false;
}

function parseXml(text: string, label: string): Document {
  const document = new DOMParser().parseFromString(
    text,
    "application/xml",
  );
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Could not parse ${label}.`);
  }

  return document;
}

function firstMetadataText(document: Document, localName: string): string {
  return textFromElement(firstElementByLocalName(document, localName));
}

function normalizeFingerprintPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, " ")
    .trim();
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function buildFingerprint(options: {
  file: File;
  title: string;
  author: string;
  opfIdentifier: string;
}): string {
  const identity =
    normalizeFingerprintPart(options.opfIdentifier) ||
    normalizeFingerprintPart(
      `${options.title} ${options.author}`.trim(),
    ) ||
    normalizeFingerprintPart(options.file.name);
  const compactIdentity = identity.slice(0, 340);

  return [
    "epub",
    compactIdentity,
    shortHash(identity),
    String(options.file.size),
    String(options.file.lastModified),
  ]
    .join("|")
    .slice(0, 512);
}

function flattenNavigation(
  items: EpubNavigationItem[],
): EpubNavigationItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenNavigation(item.children),
  ]);
}

function hrefWithoutFragment(value: string): string {
  return stripHrefFragment(normalizeArchivePath(value));
}

function buildSpineTitleMap(
  navigationJson: EpubNavigationItem[],
): Map<string, string> {
  const titleByHref = new Map<string, string>();

  for (const item of flattenNavigation(navigationJson)) {
    const key = hrefWithoutFragment(item.href);
    if (!titleByHref.has(key)) {
      titleByHref.set(key, item.label);
    }
  }

  return titleByHref;
}

function generatedNavigationFromSpine(
  spineJson: EpubSpineItem[],
): EpubNavigationItem[] {
  return spineJson.map((spineItem, index) => ({
    label: spineItem.title || `Section ${index + 1}`,
    href: spineItem.href,
    children: [],
  }));
}

function ensureNavigation(
  navigationJson: EpubNavigationItem[],
  spineJson: EpubSpineItem[],
): EpubNavigationItem[] {
  if (navigationJson.length > 0) {
    return navigationJson;
  }

  return generatedNavigationFromSpine(spineJson);
}

function parseDirectListItems(list: Element): Element[] {
  return Array.from(list.children).filter(
    (child) => child.localName.toLowerCase() === "li",
  );
}

function firstDirectChildByLocalName(
  element: Element,
  localName: string,
): Element | null {
  return (
    Array.from(element.children).find(
      (child) => child.localName.toLowerCase() === localName,
    ) ?? null
  );
}

function parseNavList(
  list: Element,
  navDir: string,
): EpubNavigationItem[] {
  return parseDirectListItems(list)
    .map((listItem) => {
      const anchor =
        firstDirectChildByLocalName(listItem, "a") ??
        firstDirectChildByLocalName(listItem, "span") ??
        listItem.querySelector("a, span");
      const nestedList =
        firstDirectChildByLocalName(listItem, "ol") ??
        listItem.querySelector("ol");
      const label = textFromElement(anchor);
      const href =
        anchor?.getAttribute("href") ?? anchor?.getAttribute("src") ?? "";
      const resolvedHref = href ? resolveRelativePath(navDir, href) : "";

      return {
        label,
        href: resolvedHref,
        children: nestedList ? parseNavList(nestedList, navDir) : [],
      };
    })
    .filter((item) => item.label.length > 0 && item.href.length > 0);
}

function parseEpub3Navigation(
  document: Document,
  navPath: string,
): EpubNavigationItem[] {
  const navDir = directoryName(navPath);
  const navElements = elementsByLocalName(document, "nav");
  const tocNav =
    navElements.find((nav) => hasAttributeToken(nav, "type", "toc")) ??
    navElements[0] ??
    null;
  const tocList = tocNav
    ? (firstDirectChildByLocalName(tocNav, "ol") ??
      tocNav.querySelector("ol"))
    : null;

  if (!tocList) {
    return [];
  }

  return parseNavList(tocList, navDir);
}

function parseNcxNavigation(
  document: Document,
  ncxPath: string,
): EpubNavigationItem[] {
  const ncxDir = directoryName(ncxPath);

  function parseNavPoint(point: Element): EpubNavigationItem | null {
    const label = textFromElement(
      firstElementByLocalName(point, "navLabel"),
    );
    const content = firstElementByLocalName(point, "content");
    const src = content?.getAttribute("src") ?? "";
    if (!label || !src) {
      return null;
    }

    const children = Array.from(point.children)
      .filter((child) => child.localName.toLowerCase() === "navpoint")
      .map(parseNavPoint)
      .filter((item): item is EpubNavigationItem => item !== null);

    return {
      label,
      href: resolveRelativePath(ncxDir, src),
      children,
    };
  }

  const navMap = firstElementByLocalName(document, "navMap");
  if (!navMap) {
    return [];
  }

  return Array.from(navMap.children)
    .filter((child) => child.localName.toLowerCase() === "navpoint")
    .map(parseNavPoint)
    .filter((item): item is EpubNavigationItem => item !== null);
}

function mediaTypeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".css")) {
    return "text/css";
  }

  return "application/octet-stream";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(reader.error ?? new Error("Could not read cover image."));
    };
    reader.onload = () => {
      resolve(String(reader.result ?? ""));
    };
    reader.readAsDataURL(blob);
  });
}

function cssForPreferences(preferences: EpubReadingPreferences): string {
  const flowCss =
    preferences.flow === "paginated"
      ? `
        html, body { height: 100%; overflow: hidden; }
        body {
          max-width: none;
          width: max-content;
          column-width: ${preferences.columnWidth}px;
          column-gap: 42px;
        }
      `
      : `
        html, body { min-height: 100%; }
        body { max-width: ${preferences.columnWidth}px; }
      `;

  return `
    :root {
      color-scheme: light;
      background: #fffdfd;
    }
    * { box-sizing: border-box; }
    html {
      background: #fffdfd;
      color: #2f2630;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: ${preferences.fontSize}px;
      letter-spacing: 0;
    }
    body {
      margin: 0 auto;
      padding: 32px clamp(18px, 5vw, 56px) 44px;
      background: #fffdfd;
      color: #2f2630;
      line-height: ${preferences.lineHeight};
      overflow-wrap: anywhere;
    }
    ${flowCss}
    img, svg, video {
      max-width: 100%;
      height: auto;
    }
    a { color: inherit; text-decoration-thickness: 0.08em; }
    mark[data-reader-highlight="saved"] {
      background: #ffeb99;
      color: inherit;
      border-radius: 3px;
      padding: 0 1px;
    }
    ::selection {
      background: rgba(184, 75, 115, 0.24);
    }
  `;
}

function escapeStyleClosingTags(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

function removeUnsafeContent(document: Document): void {
  const unsafeElements = document.querySelectorAll(
    "script, object, embed, iframe",
  );
  for (const element of Array.from(unsafeElements)) {
    element.remove();
  }

  for (const element of Array.from(document.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      const value = attribute.value.trim().toLowerCase();
      if (
        attribute.name.toLowerCase().startsWith("on") ||
        value.startsWith("javascript:")
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function isLocalResourceHref(value: string): boolean {
  if (!value || value.startsWith("#")) {
    return false;
  }

  if (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return false;
  }

  return true;
}

function sectionDocumentHtml(options: {
  document: Document;
  styles: string[];
  preferences: EpubReadingPreferences;
}): string {
  const body = options.document.body ?? options.document.documentElement;
  const styleText = [
    cssForPreferences(options.preferences),
    ...options.styles,
  ]
    .map(escapeStyleClosingTags)
    .join("\n");

  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<style>${styleText}</style>`,
    "</head>",
    "<body>",
    body.innerHTML,
    "</body>",
    "</html>",
  ].join("");
}

export class EpubSession {
  private parsedPackage: ParsedPackage | null = null;

  private constructor(
    private readonly zip: ZipModule,
    private readonly zipReader: InstanceType<ZipModule["ZipReader"]>,
    private readonly entriesByPath: Map<string, ZipEntry>,
    private readonly file: File,
  ) {}

  static async open(file: File): Promise<EpubSession> {
    const zip = await import("@zip.js/zip.js");
    const zipReader = new zip.ZipReader(new zip.BlobReader(file));
    const entries = (await zipReader.getEntries()) as ZipEntry[];
    const entriesByPath = new Map<string, ZipEntry>();

    for (const entry of entries) {
      if (!entry.directory) {
        entriesByPath.set(normalizeArchivePath(entry.filename), entry);
      }
    }

    return new EpubSession(zip, zipReader, entriesByPath, file);
  }

  async close(): Promise<void> {
    await this.zipReader.close();
  }

  async readManifest(): Promise<{
    manifest: EpubManifest;
    coverDataUrl: string | null;
  }> {
    const parsedPackage = await this.readParsedPackage();
    const manifest: EpubManifest = {
      fingerprint: buildFingerprint({
        file: this.file,
        title: parsedPackage.title,
        author: parsedPackage.author,
        opfIdentifier: parsedPackage.opfIdentifier,
      }),
      title: parsedPackage.title || this.file.name.replace(/\.epub$/i, ""),
      author: parsedPackage.author,
      description: parsedPackage.description,
      language: parsedPackage.language,
      opfIdentifier: parsedPackage.opfIdentifier,
      fileName: this.file.name,
      fileSize: this.file.size,
      fileLastModified: this.file.lastModified,
      coverPath: parsedPackage.coverPath,
      navigationJson: parsedPackage.navigationJson,
      spineJson: parsedPackage.spineJson,
    };

    return {
      manifest,
      coverDataUrl: parsedPackage.coverPath
        ? await this.readCoverDataUrl(parsedPackage.coverPath)
        : null,
    };
  }

  async renderSection(
    sectionHref: string,
    preferences: EpubReadingPreferences,
  ): Promise<RenderedSection> {
    const sectionPath = normalizeArchivePath(
      stripHrefFragment(sectionHref),
    );
    const sectionDir = directoryName(sectionPath);
    const text = await this.readText(sectionPath);
    const document = new DOMParser().parseFromString(text, "text/html");
    removeUnsafeContent(document);

    const objectUrls: string[] = [];
    const styles = await this.inlineStyles(document, sectionDir);
    await this.rewriteEmbeddedResources(document, sectionDir, objectUrls);
    const body = document.body ?? document.documentElement;

    return {
      html: sectionDocumentHtml({ document, styles, preferences }),
      text: body.textContent?.replace(/\u00a0/g, " ") ?? "",
      objectUrls,
    };
  }

  private async readParsedPackage(): Promise<ParsedPackage> {
    if (this.parsedPackage) {
      return this.parsedPackage;
    }

    const container = parseXml(
      await this.readText(EPUB_CONTAINER_PATH),
      "EPUB container",
    );
    const rootfile = firstElementByLocalName(container, "rootfile");
    const packagePath = rootfile?.getAttribute("full-path");
    if (!packagePath) {
      throw new Error("This EPUB does not declare a package file.");
    }

    const packageDocument = parseXml(
      await this.readText(packagePath),
      "EPUB package",
    );
    const packageDir = directoryName(packagePath);
    const manifestItems = this.parseManifestItems(
      packageDocument,
      packageDir,
    );
    const spineJson = this.parseSpineItems(packageDocument, manifestItems);
    const navigationJson = ensureNavigation(
      await this.readNavigation(packageDocument, manifestItems),
      spineJson,
    );
    const titleByHref = buildSpineTitleMap(navigationJson);
    const titledSpine = spineJson.map((spineItem) => ({
      ...spineItem,
      title:
        spineItem.title ??
        titleByHref.get(hrefWithoutFragment(spineItem.href)) ??
        undefined,
    }));

    this.parsedPackage = {
      packagePath,
      packageDir,
      title: firstMetadataText(packageDocument, "title"),
      author: firstMetadataText(packageDocument, "creator"),
      description: firstMetadataText(packageDocument, "description"),
      language: firstMetadataText(packageDocument, "language"),
      opfIdentifier: firstMetadataText(packageDocument, "identifier"),
      coverPath: this.findCoverPath(packageDocument, manifestItems),
      manifestItems,
      spineJson: titledSpine,
      navigationJson,
    };

    return this.parsedPackage;
  }

  private parseManifestItems(
    document: Document,
    packageDir: string,
  ): Map<string, ManifestItem> {
    const manifestItems = new Map<string, ManifestItem>();

    for (const item of elementsByLocalName(document, "item")) {
      const id = item.getAttribute("id") ?? "";
      const href = item.getAttribute("href") ?? "";
      if (!id || !href) {
        continue;
      }

      manifestItems.set(id, {
        id,
        href: resolveRelativePath(packageDir, href),
        mediaType: item.getAttribute("media-type") ?? "",
        properties: attributeTokens(item, "properties"),
      });
    }

    return manifestItems;
  }

  private parseSpineItems(
    document: Document,
    manifestItems: Map<string, ManifestItem>,
  ): EpubSpineItem[] {
    return elementsByLocalName(document, "itemref")
      .map((itemref) => {
        const idref = itemref.getAttribute("idref") ?? "";
        const item = manifestItems.get(idref);
        if (!item) {
          return null;
        }

        return {
          id: idref,
          href: item.href,
          mediaType: item.mediaType,
        };
      })
      .filter((item): item is EpubSpineItem => item !== null);
  }

  private async readNavigation(
    document: Document,
    manifestItems: Map<string, ManifestItem>,
  ): Promise<EpubNavigationItem[]> {
    const navItem = Array.from(manifestItems.values()).find((item) =>
      item.properties.includes("nav"),
    );
    if (navItem) {
      const navDocument = parseXml(
        await this.readText(navItem.href),
        "EPUB navigation",
      );
      const epub3Navigation = parseEpub3Navigation(
        navDocument,
        navItem.href,
      );
      if (epub3Navigation.length > 0) {
        return epub3Navigation;
      }
    }

    const spine = firstElementByLocalName(document, "spine");
    const tocId = spine?.getAttribute("toc") ?? "";
    const ncxItem =
      manifestItems.get(tocId) ??
      Array.from(manifestItems.values()).find(
        (item) => item.mediaType === "application/x-dtbncx+xml",
      );

    if (!ncxItem) {
      return [];
    }

    const ncxDocument = parseXml(
      await this.readText(ncxItem.href),
      "EPUB NCX",
    );
    return parseNcxNavigation(ncxDocument, ncxItem.href);
  }

  private findCoverPath(
    document: Document,
    manifestItems: Map<string, ManifestItem>,
  ): string {
    const coverImage = Array.from(manifestItems.values()).find((item) =>
      item.properties.includes("cover-image"),
    );
    if (coverImage) {
      return coverImage.href;
    }

    const coverMeta = Array.from(document.querySelectorAll("meta")).find(
      (meta) => meta.getAttribute("name") === "cover",
    );
    const coverId = coverMeta?.getAttribute("content") ?? "";
    return manifestItems.get(coverId)?.href ?? "";
  }

  private async inlineStyles(
    document: Document,
    sectionDir: string,
  ): Promise<string[]> {
    const links = Array.from(
      document.querySelectorAll('link[rel~="stylesheet"][href]'),
    );
    const styles: string[] = [];

    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      if (!isLocalResourceHref(href)) {
        continue;
      }

      try {
        styles.push(
          await this.readText(resolveRelativePath(sectionDir, href)),
        );
        link.remove();
      } catch {
        link.remove();
      }
    }

    return styles;
  }

  private async rewriteEmbeddedResources(
    document: Document,
    sectionDir: string,
    objectUrls: string[],
  ): Promise<void> {
    const resourceElements = Array.from(
      document.querySelectorAll("[src], image[href], image[xlink\\:href]"),
    );

    for (const element of resourceElements) {
      const attributeName =
        element.getAttribute("src") !== null
          ? "src"
          : element.getAttribute("href") !== null
            ? "href"
            : "xlink:href";
      const href = element.getAttribute(attributeName) ?? "";
      if (!isLocalResourceHref(href)) {
        continue;
      }

      try {
        const resourcePath = resolveRelativePath(sectionDir, href);
        const blob = await this.readBlob(resourcePath);
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.push(objectUrl);
        element.setAttribute(attributeName, objectUrl);
      } catch {
        element.removeAttribute(attributeName);
      }
    }
  }

  private async readCoverDataUrl(path: string): Promise<string | null> {
    try {
      return await blobToDataUrl(await this.readBlob(path));
    } catch {
      return null;
    }
  }

  private findEntry(path: string): ZipEntry {
    const normalized = normalizeArchivePath(path);
    const entry = this.entriesByPath.get(normalized);
    if (!entry) {
      throw new Error(`EPUB entry not found: ${normalized}`);
    }

    return entry;
  }

  private async readText(path: string): Promise<string> {
    const entry = this.findEntry(path);
    return String(await entry.getData(new this.zip.TextWriter()));
  }

  private async readBlob(path: string): Promise<Blob> {
    const entry = this.findEntry(path);
    const mimeType = mediaTypeFromPath(path);
    return (await entry.getData(
      new this.zip.BlobWriter(mimeType),
    )) as Blob;
  }
}

export async function openEpubSession(file: File): Promise<EpubSession> {
  return EpubSession.open(file);
}

export async function readEpubManifest(file: File): Promise<{
  manifest: EpubManifest;
  coverDataUrl: string | null;
}> {
  const session = await EpubSession.open(file);
  try {
    return await session.readManifest();
  } finally {
    await session.close();
  }
}
