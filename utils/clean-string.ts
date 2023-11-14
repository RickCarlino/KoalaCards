export const cleanString = (str: string) => {
  // This regex matches any whitespace characters or punctuation
  return str.replace(/[\s\.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
};
