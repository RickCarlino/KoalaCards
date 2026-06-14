export type EpubNavigationItem = {
  label: string;
  href: string;
  children: EpubNavigationItem[];
};

export type EpubSpineItem = {
  id: string;
  href: string;
  mediaType: string;
  title?: string;
};

export type EpubManifest = {
  fingerprint: string;
  title: string;
  author: string;
  description: string;
  language: string;
  opfIdentifier: string;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  coverPath: string;
  navigationJson: EpubNavigationItem[];
  spineJson: EpubSpineItem[];
};

export type EpubReadingPreferences = {
  fontSize: number;
  lineHeight: number;
  columnWidth: number;
};

export type EpubBookLocator = {
  href: string;
  title?: string;
  chapterTitle?: string;
  sectionIndex?: number;
  progression?: number;
  totalProgression?: number;
};
