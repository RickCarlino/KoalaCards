export const errorReport = (message: string): never => {
  console.error(`ERROR: ${message}`);
  throw new Error(message);
};
