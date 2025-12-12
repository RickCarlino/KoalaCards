export const errorReport = (message: string): never => {
  throw new Error(message);
};
