import { getLangName } from "@/koala/get-lang-name";
import { getServersideUser } from "@/koala/get-serverside-user";
import { VisualDiff } from "@/koala/review/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  List,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
  rem,
  useMantineTheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowRight,
  IconBulb,
  IconCheck,
  IconPencil,
  IconSparkles,
  IconWand,
  IconX,
} from "@tabler/icons-react";
import { GetServerSideProps } from "next";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";

import { prismaClient } from "@/koala/prisma-client";
import type { EssayResponse } from "@/koala/trpc-routes/grade-writing";
import Link from "next/link";
import { CSSProperties, useMemo } from "react"; // useMemo is used below

const centeredFlexStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const loadingBoxStyle: CSSProperties = {
  ...centeredFlexStyle,
  flexDirection: "column",
  paddingTop: rem(20), // Example padding, adjust as needed
  paddingBottom: rem(20), // Example padding, adjust as needed
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }
  const decksWith7OrMoreCards = await prismaClient.card.groupBy({
    by: ["deckId"],
    _count: { deckId: true },
    having: { deckId: { _count: { gt: 6 } } },
  });

  const deckIds = decksWith7OrMoreCards.map((d) => d.deckId);

  const uniqueLangCodes = await prismaClient.card.findMany({
    where: { deckId: { in: deckIds as number[] } },
    distinct: ["langCode"],
    select: { langCode: true },
  });

  return {
    props: {
      langCodes: uniqueLangCodes.map((c) => c.langCode).sort(),
    },
  };
};

interface WritingAssistantProps {
  langCodes: LangCode[];
}

const WritingAssistant = ({ langCodes }: WritingAssistantProps) => {
  // --- Hooks moved to top level ---
  const [essay, setEssay] = useState("");
  const [feedback, setFeedback] = useState<EssayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [promptsLoading, setPromptsLoading] = useState<LangCode | null>(null);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  // Initialize selectedLangCode carefully, checking langCodes later if needed
  const [selectedLangCode, setSelectedLangCode] = useState<LangCode | null>(
    langCodes && langCodes.length > 0 ? langCodes[0] : null,
  );
  const [selectedWords, setSelectedWords] = useState<Record<string, boolean>>(
    {},
  );
  const [definitions, setDefinitions] = useState<
    { word: string; lemma?: string; definition: string }[]
  >([]);
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [definitionsError, setDefinitionsError] = useState<string | null>(null);
  const theme = useMantineTheme();

  // --- Moved useMemo hooks ---
  const sentences = feedback?.sentences ?? []; // Moved from below
  const originalText = useMemo(
    () => sentences.map((s) => s.input).join(" "),
    [sentences],
  );
  const correctedText = useMemo(
    () => sentences.map((s) => (s.ok ? s.input : s.correction)).join(" "),
    [sentences],
  );
  const allExplanations = useMemo(
    () => sentences.filter((s) => !s.ok).flatMap((s) => s.explanations),
    [sentences],
  );
  // --- End moved hooks ---

  if (!langCodes || langCodes.length === 0) {
    return (
      <Container size="md" py="xl">
        <Paper withBorder shadow="lg" p="xl" radius="md">
          <Group mb="md" align="center">
            <ThemeIcon size="lg" variant="light" radius="xl">
              <IconPencil size={20} />
            </ThemeIcon>
            <Title order={4}>No Suitable Decks Found</Title>
          </Group>
          <Alert title="7 cards minimum" color="red">
            Please{" "}
            <Link href="/create">create a deck with more than 7 cards</Link>{" "}
            first.
          </Alert>
        </Paper>
      </Container>
    );
  }
  // Hooks were moved to the top
  const primaryColor = theme.primaryColor || "blue";

  const gradeWritingMutation = trpc.gradeWriting.useMutation({
    onError: (error) => {
      notifications.show({
        title: "Error Analyzing",
        message:
          error.message || "Failed to analyze your writing. Please try again.",
        color: "red",
      });
      setLoading(false);
    },
  });

  const generatePromptsMutation = trpc.generateWritingPrompts.useMutation({
    onSuccess: (data, variables) => {
      setPrompts(data);
      setPromptsError(null);
      setSelectedLangCode(variables.langCode);
      setDefinitions([]);
      setDefinitionsError(null);
      // Copy generated prompts into the essay textarea
      setEssay(data.join("\n\n"));
      notifications.show({
        title: "Prompts Generated",
        message: "New writing prompts are ready!",
        color: "green",
      });
    },
    onError: (error) => {
      setPromptsError(error.message || "Failed to generate prompts.");
      notifications.show({
        title: "Error Generating Prompts",
        message: error.message || "Please try again.",
        color: "red",
      });
    },
    onSettled: () => {
      setPromptsLoading(null);
    },
  });

  const defineWordsMutation = trpc.defineUnknownWords.useMutation({
    onSuccess: (data) => {
      setDefinitions(data.definitions);
      setDefinitionsError(null);
      notifications.show({
        title: "Definitions Ready",
        message: `Definitions generated for ${data.definitions.length} word(s).`,
        color: "blue",
      });
    },
    onError: (error) => {
      setDefinitionsError(error.message || "Failed to get definitions.");
      setDefinitions([]);
      notifications.show({
        title: "Error Getting Definitions",
        message: error.message || "Please try again.",
        color: "red",
      });
    },
    onSettled: () => {
      setDefinitionsLoading(false);
    },
  });

  const handleWordClick = (word: string) => {
    const cleanWord = word
      .replace(/[.,!?;:]$/, "")
      .trim()
      .toLowerCase();
    if (!cleanWord) return;

    setSelectedWords((prev) => {
      const newSelected = { ...prev };
      if (newSelected[cleanWord]) {
        delete newSelected[cleanWord];
      } else {
        newSelected[cleanWord] = true; // Store true to indicate selection
      }
      return newSelected;
    });
    setDefinitions([]);
    setDefinitionsError(null);
  };

  const handleAnalyze = async () => {
    if (!essay.trim()) return;
    if (!selectedLangCode) {
      notifications.show({
        title: "Language Not Selected",
        message: "Please generate prompts for a language first.",
        color: "orange",
      });
      return;
    }

    setLoading(true);
    // Reset feedback/definitions, but keep selected words
    setFeedback(null);
    setDefinitions([]);
    setDefinitionsError(null);
    try {
      const result = await gradeWritingMutation.mutateAsync({
        text: essay,
        langCode: selectedLangCode,
      });
      setFeedback(result);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePrompts = (code: LangCode) => {
    setPromptsLoading(code);
    setPromptsError(null);
    setPrompts([]);
    setFeedback(null);
    setSelectedWords({}); // Clear selected words for new prompts
    setDefinitions([]);
    setDefinitionsError(null);
    generatePromptsMutation.mutate({ langCode: code });
  };

  const handleExplainWords = () => {
    if (!selectedLangCode) {
      notifications.show({
        title: "Language Not Set",
        message: "Cannot explain words without a language context.",
        color: "orange",
      });
      return;
    }
    const wordsToDefine = Object.keys(selectedWords);
    if (wordsToDefine.length === 0) {
      notifications.show({
        title: "No Words Selected",
        message: "Please click on words in the text sections first.",
        color: "blue",
      });
      return;
    }

    // Kitchen sink context approach
    const contextParts = [];
    if (prompts.length > 0) {
      contextParts.push("Prompts:\n" + prompts.join("\n\n"));
    }
    if (essay.trim()) {
      contextParts.push("Essay:\n" + essay);
    }
    if (hasSentences) {
      // Use the existing hasSentences variable
      const corrected = sentences
        .map((s) => (s.ok ? s.input : s.correction))
        .join(" ");
      contextParts.push("Corrected Essay:\n" + corrected);
    }

    const contextText = contextParts.join("\n\n---\n\n");

    if (!contextText) {
      notifications.show({
        title: "Context Missing",
        message:
          "Need either prompts or essay text to provide context for definitions.",
        color: "orange",
      });
      return;
    }

    setDefinitionsLoading(true);
    setDefinitionsError(null);
    setDefinitions([]);
    defineWordsMutation.mutate({
      langCode: selectedLangCode,
      contextText,
      wordsToDefine,
    });
  };

  const shouldDisplayLemma = (def: { word: string; lemma?: string }) =>
    !!def.lemma && def.lemma.toLowerCase() !== def.word.toLowerCase();

  const handleCreateCards = () => {
    if (!definitions || definitions.length === 0 || !selectedLangCode) return;

    const wordsForCards = definitions.map((def) =>
      shouldDisplayLemma(def) ? def.lemma! : def.word,
    );

    const uniqueWords = Array.from(new Set(wordsForCards));

    if (uniqueWords.length === 0) return;

    const wordsParam = encodeURIComponent(uniqueWords.join(","));
    const url = `/create-wordlist?lang=${selectedLangCode}&words=${wordsParam}`;

    window.open(url, "_blank");
  };

  const clickableWordStyle = (isSelected: boolean): CSSProperties => ({
    cursor: "pointer",
    backgroundColor: isSelected ? theme.colors.yellow[2] : "transparent",
    borderRadius: theme.radius.sm,
    padding: "0 2px",
    margin: "0 1px",
    display: "inline-block",
  });

  // No longer needs source prop
  interface ClickableWordSpanProps {
    token: string;
  }

  const ClickableWordSpan = ({ token }: ClickableWordSpanProps) => {
    const cleanToken = token.replace(/[.,!?;:]$/, "").toLowerCase();
    const isSelected = !!selectedWords[cleanToken];
    return (
      <Text
        component="span"
        onClick={() => handleWordClick(token)}
        style={clickableWordStyle(isSelected)}
      >
        {token}
      </Text>
    );
  };

  // No longer needs source parameter
  const renderClickableText = (text: string) => {
    return (
      <Text size="md" lh={1.6}>
        {text.split(/(\s+)/).map((token, index) =>
          /\s+/.test(token) || !token ? (
            <span key={index}>{token}</span>
          ) : (
            <ClickableWordSpan key={index} token={token} /> // Removed source
          ),
        )}
      </Text>
    );
  };

  // No longer needs source parameter
  const renderClickableNodes = (nodes: React.ReactNode): React.ReactNode => {
    if (typeof nodes === "string") {
      return nodes.split(/(\s+)/).map((token, index) =>
        /\s+/.test(token) || !token ? (
          <span key={index}>{token}</span>
        ) : (
          <ClickableWordSpan key={index} token={token} /> // Removed source
        ),
      );
    }

    if (Array.isArray(nodes)) {
      return nodes.map((node, index) => (
        <React.Fragment key={index}>
          {renderClickableNodes(node)}
        </React.Fragment>
      ));
    }

    if (React.isValidElement(nodes)) {
      const children = (nodes.props as any).children;
      return React.cloneElement(
        nodes,
        { ...nodes.props },
        renderClickableNodes(children), // Removed source
      );
    }

    return nodes;
  };

  // sentences, originalText, correctedText, allExplanations moved up
  const hasSentences = sentences.length > 0; // Keep this, depends on 'sentences' moved up
  const hasExplanations = allExplanations.length > 0;

  const numSelectedWords = Object.keys(selectedWords).length;
  const hasSelectedWords = numSelectedWords > 0;
  const canExplainWords = !!selectedLangCode && !definitionsLoading;
  const canCreateCards = !definitionsLoading && definitions.length > 0;
  const showDefinitions = definitions.length > 0 && !definitionsLoading;

  const definitionPanel = hasSelectedWords && (
    <Card withBorder shadow="sm" padding="lg" radius="md" mt="lg" mb="lg">
      <Group justify="center">
        <Button
          onClick={handleExplainWords}
          loading={definitionsLoading}
          disabled={!canExplainWords}
          variant="light"
          color="blue"
          leftSection={<IconBulb size={rem(16)} />}
        >
          Explain Selected Words ({numSelectedWords})
        </Button>
        <Button
          onClick={handleCreateCards}
          disabled={!canCreateCards}
          variant="light"
          color="green"
          leftSection={<IconCheck size={rem(16)} />}
        >
          Create Cards from Words ({definitions.length})
        </Button>
      </Group>
      {definitionsLoading && (
        <Box mt="md" style={centeredFlexStyle}>
          <Loader size="sm" color="blue" />
          <Text ml="sm" c="dimmed">
            Getting definitions...
          </Text>
        </Box>
      )}
      {definitionsError && (
        <Alert title="Error" color="red" mt="md" radius="md">
          {definitionsError}
        </Alert>
      )}
      {showDefinitions && (
        <Stack gap="xs" mt="md">
          {definitions.map((def, idx) => (
            <Box key={idx}>
              <Text fw={700} component="span">
                {def.word}
              </Text>
              {shouldDisplayLemma(def) && (
                <Text component="span" c="dimmed" fs="italic">
                  {" "}
                  ({def.lemma!})
                </Text>
              )}
              <Text component="span">: {def.definition}</Text>
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  );

  const renderFeedback = () => {
    return (
      <Paper withBorder shadow="lg" p="xl" radius="md" mt="xl">
        <Group justify="apart" mb="md">
          <Group>
            <ThemeIcon size="lg" radius="xl" color={primaryColor}>
              <IconSparkles size={20} />
            </ThemeIcon>
            <Title order={3}>Feedback</Title>
          </Group>
        </Group>
        <Divider mb="xl" />
        {!hasSentences ? (
          <Alert
            title="No sentences detected"
            color="blue"
            icon={<IconX size={16} />}
            radius="md"
          >
            Please write a longer essay or use complete sentences.
          </Alert>
        ) : (
          <Stack gap="lg">
            <Card withBorder shadow="sm" padding="lg" radius="md">
              <Group gap="xs" mb="md">
                <IconPencil size={20} color={theme.colors[primaryColor][6]} />
                <Text fw={500}>Original Text (Click words you don't know)</Text>
              </Group>
              {renderClickableText(originalText)}
            </Card>
            <Card withBorder shadow="sm" padding="lg" radius="md">
              <Group gap="xs" mb="md">
                <IconCheck size={20} color={theme.colors.green[6]} />
                <Text fw={500}>
                  Corrected Text (Click words you don't know)
                </Text>
              </Group>
              {renderClickableText(correctedText)}
            </Card>
            <Card withBorder shadow="sm" padding="lg" radius="md">
              <Group gap="xs" mb="md">
                <IconArrowRight size={20} color={theme.colors.violet[6]} />
                <Text fw={500}>Changes</Text>
              </Group>
              <Box mt="md">
                <VisualDiff actual={originalText} expected={correctedText} />
              </Box>
            </Card>
            {hasExplanations && (
              <Card withBorder shadow="sm" padding="lg" radius="md">
                <Group gap="xs" mb="md">
                  <IconBulb size={20} color={theme.colors.yellow[6]} />
                  <Text fw={500}>Suggestions</Text>
                </Group>
                <Stack gap="sm" mt="md">
                  {allExplanations.map((explanation, idx) => (
                    <Text key={idx} size="sm" lh={1.6}>
                      • {explanation}
                    </Text>
                  ))}
                </Stack>
              </Card>
            )}
          </Stack>
        )}
      </Paper>
    );
  };

  return (
    <Container size="md" py="xl">
      {definitionPanel}
      <Paper withBorder shadow="sm" p="lg" mb="xl" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size="lg" variant="light" radius="xl" color="teal">
              <IconWand size={20} />
            </ThemeIcon>
            <Title order={4}>Need Inspiration?</Title>
          </Group>
          <Group>
            {langCodes.map((code) => {
              const isCurrentLangLoading = promptsLoading === code;
              const isAnyLangLoading = !!promptsLoading;
              return (
                <Button
                  key={code}
                  onClick={() => handleGeneratePrompts(code)}
                  leftSection={<IconWand size={rem(16)} />}
                  loading={isCurrentLangLoading}
                  disabled={isAnyLangLoading}
                  size="sm"
                  radius="md"
                  variant="light"
                  color="teal"
                >
                  Generate {getLangName(code)} Prompts
                </Button>
              );
            })}
          </Group>
        </Group>
        {promptsLoading && (
          <Box mt="md" style={centeredFlexStyle}>
            <Loader size="sm" color="teal" />
            <Text ml="sm" c="dimmed">
              Generating prompts for {getLangName(promptsLoading)}...
            </Text>
          </Box>
        )}
        {promptsError && (
          <Alert title="Error" color="red" mt="md" radius="md">
            {promptsError}
          </Alert>
        )}
        {prompts.length > 0 && !promptsLoading && selectedLangCode && (
          <Card withBorder radius="md" mt="lg" p="md">
            <Text fw={500} mb="sm">
              Generated {getLangName(selectedLangCode)} Prompts (Click words you
              don't know):
            </Text>
            <Stack gap="xs">
              {prompts.map((prompt, index) => {
                const renderParagraph = ({
                  children,
                }: {
                  children?: React.ReactNode;
                }) => {
                  return (
                    <Text size="sm" lh={1.5}>
                      {renderClickableNodes(children)}
                    </Text>
                  );
                };
                const markdownComponents = {
                  p: renderParagraph,
                  strong: ({ children }: { children?: React.ReactNode }) => (
                    <strong>{renderClickableNodes(children)}</strong>
                  ),
                  em: ({ children }: { children?: React.ReactNode }) => (
                    <em>{renderClickableNodes(children)}</em>
                  ),
                  ol: ({ children }: { children?: React.ReactNode }) => (
                    <List type="ordered" withPadding>
                      {renderClickableNodes(children)}
                    </List>
                  ),
                  ul: ({ children }: { children?: React.ReactNode }) => (
                    <List withPadding>{renderClickableNodes(children)}</List>
                  ),
                  li: ({ children }: { children?: React.ReactNode }) => (
                    <List.Item>{renderClickableNodes(children)}</List.Item>
                  ),
                  h1: ({ children }: { children?: React.ReactNode }) => (
                    <h1>{renderClickableNodes(children)}</h1>
                  ),
                  h2: ({ children }: { children?: React.ReactNode }) => (
                    <h2>{renderClickableNodes(children)}</h2>
                  ),
                  h3: ({ children }: { children?: React.ReactNode }) => (
                    <h3>{renderClickableNodes(children)}</h3>
                  ),
                  h4: ({ children }: { children?: React.ReactNode }) => (
                    <h4>{renderClickableNodes(children)}</h4>
                  ),
                  h5: ({ children }: { children?: React.ReactNode }) => (
                    <h5>{renderClickableNodes(children)}</h5>
                  ),
                  h6: ({ children }: { children?: React.ReactNode }) => (
                    <h6>{renderClickableNodes(children)}</h6>
                  ),
                };
                return (
                  <ReactMarkdown key={index} components={markdownComponents}>
                    {prompt}
                  </ReactMarkdown>
                );
              })}
            </Stack>
          </Card>
        )}
      </Paper>
      <Paper withBorder shadow="lg" p="xl" mb="xl" radius="md" styles={{}}>
        <Group mb="md" align="center">
          <ThemeIcon size="lg" variant="light" radius="xl">
            <IconPencil size={20} />
          </ThemeIcon>
          <Title order={4}>Your Essay</Title>
        </Group>
        <Textarea
          placeholder="Write your essay here..."
          description="Write a few sentences or a short paragraph in your target language. If you don't know a word, write it in english surrounded with question marks (e.g., '?apple?를 먹었어요.')."
          autosize
          minRows={6}
          maxRows={12}
          value={essay}
          onChange={(e) => setEssay(e.currentTarget.value)}
          mb="lg"
          radius="md"
          styles={{}}
        />
        <Group justify="right">
          <Button
            onClick={handleAnalyze}
            leftSection={<IconSparkles size={rem(16)} />}
            loading={loading}
            disabled={!essay.trim()}
            size="md"
            radius="md"
            variant="gradient"
            gradient={{
              from: theme.colors[primaryColor][7],
              to: theme.colors[primaryColor][5],
              deg: 45,
            }}
          >
            Analyze
          </Button>
        </Group>
      </Paper>

      {loading && (
        <Paper withBorder shadow="md" p="xl" radius="md">
          <Box style={loadingBoxStyle}>
            <Loader
              size="lg"
              variant="dots"
              color={theme.colors[primaryColor][6]}
            />
            <Text mt="md" ta="center" c="dimmed">
              Analyzing your writing...
            </Text>
          </Box>
        </Paper>
      )}
      {!loading && feedback && renderFeedback()}
    </Container>
  );
};

export default WritingAssistant;
