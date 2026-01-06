export function containsEmoji(input: string): boolean {
  const emojiRegex = /\p{Extended_Pictographic}/u;
  return emojiRegex.test(input);
}

export function stripEmojis(input: string): string {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  return input.replace(emojiRegex, "");
}
