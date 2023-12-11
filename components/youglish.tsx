export function Youglish(children: string) {
  // Split string on any/all whitespace:
  const words = children.split(/\s+/);
  return words.map((word, i) => {
    // If it's not hangeul, retrun the chunk as-is:
    if (!word.match(/[가-힣]/)) return <span>{word + " "}</span>;
    return (
      <a
        key={word + i}
        href={`https://youglish.com/pronounce/${word}/korean`}
        target="_blank"
        rel="noreferrer"
      >
        {word + " "}
      </a>
    );
  });
}
