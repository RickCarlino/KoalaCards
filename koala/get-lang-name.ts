export const getLangName = (lang: string) => {
  const names: Record<string, string> = {
    EN: "English",
    IT: "Italian",
    FR: "French",
    ES: "Spanish",
    KO: "Korean",
  };
  const key = lang.slice(0, 2).toUpperCase();
  return names[key] || lang;
};
