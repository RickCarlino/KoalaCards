import { Image } from "@mantine/core";

interface CardImageProps {
  imageURL?: string;
  term: string;
}

export const CardImage: React.FC<CardImageProps> = ({
  imageURL,
  term,
}) => {
  if (!imageURL) return null;

  return (
    <Image
      src={imageURL}
      alt={`Image: ${term}`}
      maw="100%"
      mah={240}
      fit="contain"
    />
  );
};
