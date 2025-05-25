import {
  Container,
  Title,
  Text,
  Accordion,
  Box,
  Divider,
  Anchor,
  Paper,
  useMantineTheme,
} from "@mantine/core";
import Link from "next/link";
import { alphabetical } from "radash";

// Data structure for frequency lists
interface FrequencyListItem {
  title: string;
  description: string;
  url: string;
  source: string;
}

interface LanguageData {
  name: string;
  lists: FrequencyListItem[];
}

// Frequency list data
const frequencyListsData: LanguageData[] = [
  {
    name: "Spanish",
    lists: [
      {
        title: "Subtitles-Based Frequency List (Movies/TV)",
        description:
          "A list generated from a corpus of Spanish movie and television subtitles (~27.4 million words). This frequency list ranks the most common Spanish words appearing in subtitles. Subtitles corpora tend to reflect everyday conversational language.",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Spanish/Subtitles10K",
        source: "OpenSubtitles-based corpus (27.4M words, compiled 2008)",
      },
      {
        title: "Mixed-Web Spanish Frequency List",
        description:
          "A comprehensive list of Spanish word frequencies based on a Leipzig Corpora collection of Spanish texts (combining 1 million sentences from Wikipedia 2021 and news articles up to 2022).",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Spanish/Mixed_730K",
        source: "Leipzig Corpora (Wikipedia + News, 2021–2022)",
      },
    ],
  },
  {
    name: "French",
    lists: [
      {
        title: "OpenSubtitles Frequency List (French)",
        description:
          "A frequency list of the top French words derived from the OpenSubtitles corpus. This list covers the 20,000 most frequent French words found in movie and TV subtitles.",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/French/OpenSubtitles_Top_20K",
        source: "OpenSubtitles corpus (20K words)",
      },
    ],
  },
  {
    name: "German",
    lists: [
      {
        title: "Mixed Web Corpus Frequency List (German)",
        description:
          "A very extensive list of German word frequencies (covering ~2.4 million unique word forms) compiled from a variety of web sources (2014–2021).",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/German/Mixed_web_3M",
        source: "Leipzig Corpora (2011–2021 web data)",
      },
    ],
  },
  {
    name: "Italian",
    lists: [
      {
        title: "OpenSubtitles Frequency List (Italian, 50k Words)",
        description:
          "A list of the 50,000 most frequent Italian words based on the OpenSubtitles corpus. It encompasses a huge collection of film and TV subtitles in Italian, thereby highlighting very common spoken/dialogue vocabulary.",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Italian",
        source: "OpenSubtitles corpus (Italian)",
      },
      {
        title: "Italian Subtitles Core List (Top 1,000)",
        description:
          "For a quick view, Wiktionary also provides the top 1,000 Italian words from subtitles, derived from a 5.6 million-word subtitle corpus (movies/TV, compiled in 2008).",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Italian1000",
        source: "Italian subtitles corpus (5.6M words, 2008)",
      },
    ],
  },
  {
    name: "Russian",
    lists: [
      {
        title: "Web Corpus Frequency List (Russian)",
        description:
          "A comprehensive list of Russian word frequencies compiled from various web sources (2014–2021). It includes about 2.4 million distinct word forms, ranked by frequency, covering contemporary internet usage in Russian.",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Russian",
        source: "Leipzig Web Corpus (Russian, 2014–21)",
      },
    ],
  },
  {
    name: "Arabic",
    lists: [
      {
        title: "Modern Standard Arabic 1,000 Word List (TalkInArabic)",
        description:
          "TalkInArabic.com provides a frequency list of the first 1,000 most frequently used words in Modern Standard Arabic (MSA), presented in a table with meanings.",
        url: "https://talkinarabic.com/arabic-words/",
        source: "TalkInArabic.com",
      },
    ],
  },
  {
    name: "Portuguese",
    lists: [
      {
        title: "European & Brazilian Portuguese Frequency Lists",
        description:
          "Lists of the top 5,000 words in European and Brazilian Portuguese drawn from the OpenSubtitles corpus. They reflect common vocabulary as used in media subtitles.",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Portuguese",
        source: "OpenSubtitles corpus (Portuguese)",
      },
    ],
  },
  {
    name: "Korean",
    lists: [
      {
        title:
          "National Institute of Korean Language (NIKL) Frequency List",
        description:
          "A list of the most common Korean words based on a large corpus compiled by NIKL. Wiktionary hosts a 5,800-word frequency list that was generated from an official NIKL file.",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Korean_5800",
        source: "NIKL corpus (5,800 words)",
      },
      {
        title: "Basic Korean Vocabulary List",
        description:
          'An official "Basic Korean Vocabulary" list (한국어 학습용 어휘목록) of 5,897 entries, which is aimed at learners but derived from frequency and usability criteria.',
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Korean",
        source: "Korean vocabulary list (5,897 words)",
      },
    ],
  },
];

const FrequencyListsPage = () => {
  const theme = useMantineTheme();

  // Accordion styles to match branding
  const accordionStyles = {
    item: {
      borderRadius: theme.radius.md,
      marginBottom: theme.spacing.md,
      border: `1px solid ${theme.colors.pink[2]}`,
      "&[data-active]": {
        backgroundColor: theme.colors.pink[0],
      },
    },
    control: {
      "&:hover": {
        backgroundColor: theme.colors.pink[0],
      },
    },
    chevron: {
      color: theme.colors.pink[6],
    },
  };

  return (
    <Container size="lg" mt="xl" pb="xl">
      <Box mb="xl" ta="center">
        <Title order={1} mb="sm">
          Language Frequency Lists
        </Title>
        <Text size="lg" c="dimmed" maw={600} mx="auto">
          A collection of word frequency lists for various languages to
          help you build your vocabulary
        </Text>
        <Divider my="lg" />
      </Box>

      <Accordion variant="filled" radius="md" styles={accordionStyles}>
        {alphabetical(frequencyListsData, (x) => x.name).map(
          (language) => (
            <Accordion.Item
              value={language.name.toLowerCase()}
              key={language.name.toLowerCase()}
            >
              <Accordion.Control>
                <Title order={3}>{language.name}</Title>
              </Accordion.Control>
              <Accordion.Panel>
                {language.lists.map((list, index) => (
                  <Paper
                    p="md"
                    withBorder
                    mb="md"
                    key={index}
                    style={{
                      borderLeft: `4px solid ${theme.colors.pink[6]}`,
                    }}
                  >
                    <Title order={4} mb="xs">
                      {list.title}
                    </Title>
                    <Text mb="xs">{list.description}</Text>
                    <Anchor href={list.url} target="_blank">
                      View on{" "}
                      {list.url.includes("wiktionary")
                        ? "Wiktionary"
                        : list.url.includes("talkinarabic")
                          ? "TalkInArabic"
                          : "Website"}
                    </Anchor>
                    <Text fw={500} mt="md" size="sm" c="dimmed">
                      Source: {list.source}
                    </Text>
                  </Paper>
                ))}
              </Accordion.Panel>
            </Accordion.Item>
          ),
        )}
      </Accordion>

      <Box
        mt="xl"
        p="md"
        style={{
          backgroundColor: theme.colors.pink[0],
          borderRadius: theme.radius.md,
        }}
      >
        <Text ta="center" size="sm">
          These frequency lists are derived from large language corpora and
          are valuable for language learners interested in the most
          commonly used words in each target language.
        </Text>
      </Box>

      <Box mt="md" ta="center">
        <Text
          component={Link}
          href="/create"
          size="sm"
          c="pink"
          style={{ textDecoration: "none" }}
        >
          ← Back to card creation
        </Text>
      </Box>
    </Container>
  );
};

export default FrequencyListsPage;
