import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  generateAIText,
  generateStructuredOutput,
  streamAIText,
  generateAIImage,
} from "../koala/ai.ts";

let providerFetch: typeof fetch = async () =>
  assert.fail("Unexpected request");
const previousKey = process.env.OPENAI_API_KEY;
const messages = [{ role: "user" as const, content: "Test" }];

test.before(() => {
  process.env.OPENAI_API_KEY = "test-key";
  test.mock.method(
    globalThis,
    "fetch",
    (...args: Parameters<typeof fetch>) => providerFetch(...args),
  );
});
test.after(() => {
  test.mock.restoreAll();
  if (previousKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = previousKey;
  }
});

function completion(content: string) {
  return {
    id: "chat_test",
    object: "chat.completion",
    created: 0,
    model: "test",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content, refusal: null },
      },
    ],
  };
}

test("SDK upgrade preserves existing text and structured generation", async () => {
  let calls = 0;
  providerFetch = async (url, init) => {
    assert.equal(
      String(url),
      "https://api.openai.com/v1/chat/completions",
    );
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "gpt-5.6-sol");
    assert.deepEqual(request.messages, messages);
    calls += 1;
    if (request.response_format) {
      assert.equal(request.response_format.type, "json_schema");
      return Response.json(completion('{"value":"structured"}'));
    }
    return Response.json(completion("Plain text"));
  };
  assert.equal(
    await generateAIText({ model: "good", messages }),
    "Plain text",
  );
  assert.deepEqual(
    await generateStructuredOutput({
      model: "good",
      messages,
      schema: z.object({ value: z.string() }),
    }),
    { value: "structured" },
  );
  assert.equal(calls, 2);
});

test("SDK upgrade preserves streaming text", async () => {
  providerFetch = async (url, init) => {
    assert.equal(
      String(url),
      "https://api.openai.com/v1/chat/completions",
    );
    const request = JSON.parse(String(init?.body));
    assert.equal(request.stream, true);
    assert.equal(request.model, "gpt-5.6-terra");
    const events = ["Hello", " world"]
      .map(
        (content) =>
          `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
      )
      .join("");
    return new Response(`${events}data: [DONE]\n\n`, {
      headers: { "content-type": "text/event-stream" },
    });
  };
  const chunks: string[] = [];
  for await (const chunk of streamAIText({
    model: "interactive",
    messages,
  })) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, ["Hello", " world"]);
});

test("SDK upgrade preserves image generation", async () => {
  providerFetch = async (url, init) => {
    assert.equal(
      String(url),
      "https://api.openai.com/v1/images/generations",
    );
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "gpt-image-2");
    assert.equal(request.prompt, "Test image");
    return Response.json({ data: [{ b64_json: "test-image" }] });
  };
  assert.equal(
    await generateAIImage("Test image", "imageDefault"),
    "test-image",
  );
});
