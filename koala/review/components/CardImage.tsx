import { Image } from "@mantine/core";

interface CardImageProps {
  imageURL?: string;
  definition: string;
}

export const CardImage: React.FC<CardImageProps> = ({
  imageURL,
  definition,
}) => {
  if (!imageURL) return null;

  return (
    <Image
      src={imageURL}
      alt={`Image: ${definition}`}
      maw="100%"
      mah={240}
      fit="contain"
    />
  );
};
