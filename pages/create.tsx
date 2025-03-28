import { useRouter } from "next/router";
import {
  Container,
  Title,
  Text,
  Card,
  SimpleGrid,
  Button,
  Group,
  ThemeIcon,
  useMantineTheme,
  rem,
  Box,
  Divider,
} from "@mantine/core";
import { IconBulb, IconList, IconTable, IconUsers } from "@tabler/icons-react";

/*
There are three ways to create flashcards in Koala Cards:

1. "Create by vibe" (/create-vibe) This is best for casual users who are just trying the app out. You tell the AI what you want to learn and it creates cards based on what you ask.
2. "Create from word list" (/create-wordlist) You have a list of words you want to learn (such as unknown words spotted while reading). The words will intelligiently be transformed into example sentences with definitions. This is the best choice for serious learners memorizing word frequency lists or setting daily reading goals.
3. "Create from CSV" (/create-csv) Use this method if you have a list of CSV data that you want to import. This is best for users importing their data from other spaced repeittion systems. systsmes like Anki.
*/

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
}

const FeatureCard = ({
  icon,
  title,
  description,
  buttonText,
  onClick,
}: FeatureCardProps) => {
  const theme = useMantineTheme();

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: theme.white,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-5px)",
          boxShadow: theme.shadows.md,
        },
      }}
    >
      <Group mb="md">
        <ThemeIcon size={50} radius="md" variant="light" color="pink">
          {icon}
        </ThemeIcon>
        <Title order={3}>{title}</Title>
      </Group>

      <Text size="sm" mb="xl" style={{ flexGrow: 1 }}>
        {description}
      </Text>

      {title === "From Word Lists" && (
        <Text size="xs" mb="md" c="dimmed" style={{ textAlign: "center" }}>
          <Text
            component="a"
            href="/frequency-lists"
            style={{ textDecoration: "underline", cursor: "pointer" }}
          >
            Don&apos;t have a frequency list? Try one of these
          </Text>
        </Text>
      )}

      <Button fullWidth color="pink" onClick={onClick}>
        {buttonText}
      </Button>
    </Card>
  );
};

const CreatePage = () => {
  const router = useRouter();
  const theme = useMantineTheme();

  const features = [
    {
      icon: <IconUsers size={rem(30)} />,
      title: "Community Decks",
      description:
        "Explore decks created by the community and share your own collections with others.",
      buttonText: "View Decks",
      onClick: () => router.push("/shared-decks"),
    },
    {
      icon: <IconBulb size={rem(30)} />,
      title: "From Vibes",
      description:
        "Perfect for casual users just trying the app. Tell the AI what you want to learn, and it creates cards based on your request. Great for exploring new topics!",
      buttonText: "Get Started",
      onClick: () => router.push("/create-vibe"),
    },
    {
      icon: <IconList size={rem(30)} />,
      title: "From Word Lists",
      description:
        "Ideal for serious learners with specific words to learn. Your words will be transformed into example sentences with definitions. Perfect for frequency lists or reading goals.",
      buttonText: "Create from Words",
      onClick: () => router.push("/create-wordlist"),
    },
    {
      icon: <IconTable size={rem(30)} />,
      title: "From CSV",
      description:
        "For users with existing data from other spaced repetition systems like Anki. Import your CSV data directly and continue your learning journey.",
      buttonText: "Import CSV",
      onClick: () => router.push("/create-csv"),
    },
  ];

  return (
    <Container
      size="lg"
      mt={{ base: "md", sm: "xl" }}
      style={{ position: "relative" }}
    >
      <Box mb="xl" style={{ textAlign: "center" }}>
        <Title order={1} mb="sm">
          Create New Cards
        </Title>
        <Text size="lg" c="dimmed" maw={600} mx="auto">
          Choose the method that works best for your learning style
        </Text>
        <Divider my="lg" />
      </Box>

      <SimpleGrid
        cols={{ base: 1, sm: 2, md: 3 }}
        spacing={{ base: "md", sm: "lg" }}
        verticalSpacing={{ base: "md", sm: "lg" }}
      >
        {features.map((feature, index) => (
          <FeatureCard
            key={index}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            buttonText={feature.buttonText}
            onClick={feature.onClick}
          />
        ))}
      </SimpleGrid>

      <Box
        mt="xl"
        p="md"
        style={{
          backgroundColor: theme.colors.pink[0],
          borderRadius: theme.radius.md,
        }}
      >
        <Text style={{ textAlign: "center" }} fw={500}>
          Not sure which to choose? Start with "Create by Vibe" for the easiest
          experience!
        </Text>
      </Box>
    </Container>
  );
};

export default CreatePage;
