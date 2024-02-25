export const errorReport = (message: string): never => {
  console.error(`ERROR: ${message}`);
  const e = new Error(message);
  console.log(e.stack);
  throw e;
};
