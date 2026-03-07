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

const frequencyListsData: LanguageData[] = [
  {
    name: "Spanish",
    lists: [
      {
        title: "Subtitles-Based Frequency List (Movies/TV)",
        description:
          "Most common Spanish words from movie and TV subtitles. Useful for everyday conversational vocabulary.",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Spanish/Subtitles10K",
        source: "OpenSubtitles-based corpus (27.4M words, compiled 2008)",
      },
      {
        title: "Mixed-Web Spanish Frequency List",
        description:
          "Large Spanish frequency list from mixed web sources, including Wikipedia and news.",
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
          "Top French words from subtitle data.",
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
          "Large German frequency list from mixed web corpora.",
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
          "Top 50,000 Italian words from subtitle data, with broad spoken coverage.",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Italian",
        source: "OpenSubtitles corpus (Italian)",
      },
      {
        title: "Italian Subtitles Core List (Top 1,000)",
        description:
          "Quick-start list of the top 1,000 Italian subtitle words.",
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
          "Large Russian frequency list built from mixed web corpora.",
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
          "Top 1,000 Modern Standard Arabic words with meanings.",
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
          "Top 5,000 words for European and Brazilian Portuguese from subtitle data.",
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
          "Common Korean words from a National Institute of Korean Language corpus.",
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Korean_5800",
        source: "NIKL corpus (5,800 words)",
      },
      {
        title: "Basic Korean Vocabulary List",
        description:
          'Official learner-focused Korean vocabulary list (한국어 학습용 어휘목록, 5,897 entries).',
        url: "https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Korean",
        source: "Korean vocabulary list (5,897 words)",
      },
    ],
  },
];

const FrequencyListsPage = () => {
  const theme = useMantineTheme();

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
          Reference links for high-frequency vocabulary lists.
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
          Use these lists to pick high-utility words for new cards.
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
