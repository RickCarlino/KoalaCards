const cleanString = (str: string) => {
  // This regex matches any whitespace characters or punctuation
  return str.replace(/[\s\.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
};

export const exactMatch = (str: string, query: string) => {
  return cleanString(str) === cleanString(query);;
};
