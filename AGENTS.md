## Code Quality & Complexity Rules

- Avoid Boolean soups. Replace complex predicates with well-named helpers.
- Avoid unnecessary `as` casts. If used, keep them local, justified, and safe.
- Conditional UI: extract components for distinct states (e.g., Existing vs New forms) instead of inline JSX blocks.
- Define helper types near usage or in `koala/types/` when shared.
- Eliminate duplication. Factor repeated UI or logic into pure functions or tiny components.
- No nested ternaries.
- Never use nested ternaries. If/else or small helpers are required instead.
- Keep components small: aim for <150 lines per component. Extract subcomponents early.
- Keep prop surfaces tight. Pass only what’s used.
- Keep render selection flat. Use a map/object for mode → component instead of big conditionals when possible.
- Never use `any`. Favor precise types and discriminated unions.
- No comment-driven code. Code should be self-explanatory; prefer clear names over comments.
- Prefer early returns over nested conditionals. Avoid nesting beyond 2 levels in JSX and logic.
- Prefer pure functions for parsing/transforming data. Keep side effects (I/O, mutations, notifications) at edges.

Run tidy.sh when you are done and make sure it passes.