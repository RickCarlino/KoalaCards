export function keyboardInput(question: string): Promise<string> {
  const stdin = process.stdin;
  const stdout = process.stdout;

  stdin.resume();
  stdout.write(question + ": ");

  return new Promise((res) => {
    stdin.once("data", function (data) {
      res(data.toString("utf-8").trim());
    });
  });
}
