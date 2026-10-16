import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { Rating } from "ts-fsrs";
import {
  FeedbackVoteControls,
  GradeExplanationContent,
} from "../koala/review/grade-explanation.tsx";
import {
  ReviewRatingButtons,
  ReviewResult,
} from "../koala/review/review-result.tsx";
import { buildKoalaTheme } from "../koala/theme.ts";

function render(element: Parameters<typeof renderToStaticMarkup>[0]) {
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      { theme: buildKoalaTheme("sans-serif") },
      element,
    ),
  );
}

const feedback = createElement(FeedbackVoteControls, {
  selected: null,
  onVote: () => assert.fail("Server rendering must not submit feedback"),
});

test("helpfulness controls stay hidden before an explanation, including loading and errors", () => {
  for (const state of [
    {},
    { isPending: true },
    { error: "Could not load the explanation. Please try again." },
  ]) {
    const html = render(
      createElement(GradeExplanationContent, {
        ...state,
        onExplain: () => assert.fail("Explanations must be opt-in"),
        children: feedback,
      }),
    );
    assert.doesNotMatch(html, /Was this helpful|Explanation was helpful/);
    assert.match(html, /Explain|Retry explanation/);
  }
});

test("a visible explanation includes its helpfulness controls", () => {
  const html = render(
    createElement(GradeExplanationContent, {
      explanation: "두세 가지 expresses two or three things.",
      onExplain: () => assert.fail("A saved explanation needs no request"),
      children: feedback,
    }),
  );
  assert.match(html, /두세 가지 expresses two or three things/);
  assert.match(html, /Was this helpful/);
  assert.match(html, /aria-label="Explanation was helpful"/);
  assert.match(html, /aria-label="Explanation was not helpful"/);
});

test("failed feedback remains retryable and only saved votes lock the controls", () => {
  const retry = render(
    createElement(FeedbackVoteControls, {
      selected: null,
      hasError: true,
      onVote: () => undefined,
    }),
  );
  assert.match(retry, /role="alert"/);
  assert.doesNotMatch(retry, /<button[^>]* disabled/);
  for (const state of [
    { selected: 1 as const },
    { selected: null, isPending: true },
  ]) {
    const html = render(
      createElement(FeedbackVoteControls, {
        ...state,
        onVote: () => undefined,
      }),
    );
    assert.equal(html.match(/<button[^>]* disabled/g)?.length, 2);
  }
});

test("review results show the expected answer after correct and incorrect responses", () => {
  for (const isCorrect of [true, false]) {
    const html = render(
      createElement(ReviewResult, {
        isCorrect,
        feedback: isCorrect ? "Correct" : "Slightly incorrect",
        definition: "Simple but sophisticated",
        transcription: "단편하지만 세련됐어요",
        answer: "단순하지만 세련됐어요",
        children: createElement("button", null, "Continue"),
      }),
    );
    assert.match(html, /Simple but sophisticated/);
    assert.match(html, /단편하지만 세련됐어요/);
    assert.match(html, /단순하지만 세련됐어요/);
    assert.ok(
      html.indexOf("Your answer") < html.indexOf("Expected answer"),
    );
    assert.match(html, /role="status"/);
  }
});

test("rating controls keep all four choices, review intervals, and keyboard shortcuts", () => {
  const options: Parameters<typeof ReviewRatingButtons>[0]["options"] = [
    [Rating.Again, "21 days"],
    [Rating.Hard, "17 months"],
    [Rating.Good, "26 months"],
    [Rating.Easy, "47 months"],
  ];
  const hotkeys = {
    [Rating.Again]: "a",
    [Rating.Hard]: "s",
    [Rating.Good]: "d",
    [Rating.Easy]: "f",
  };
  for (const isLoading of [false, true]) {
    const html = render(
      createElement(ReviewRatingButtons, {
        options,
        hotkeys,
        isLoading,
        onSelect: () => assert.fail("Ratings require user input"),
      }),
    );
    for (const [grade, interval] of options) {
      assert.ok(html.includes(interval));
      assert.ok(html.includes(`aria-keyshortcuts="${hotkeys[grade]}"`));
    }
    assert.equal(
      html.match(/<button[^>]* disabled/g)?.length ?? 0,
      isLoading ? 4 : 0,
    );
  }
});
