# Design Normalization TODO

## Scope
- [ ] Target feature: Home dashboard (`pages/index.tsx`) as the normalization focus.
- [ ] Confirm the feature includes all visible states (empty vs. active nav list, external links).

## Discover the Design System (internal only)
- [ ] Read `AGENTS.md` to apply the brand direction and design principles.
- [ ] Review design tokens and component defaults in `koala/theme.ts` (colors, type scale, radii, shadows, component variants).
- [ ] Review shared style helpers in `koala/styles.ts` and identify reuse opportunities.
- [ ] Scan similar app surfaces (`pages/review.tsx`, `pages/create.tsx`, `pages/writing.tsx`) to mirror established layout patterns.

## Analyze Current Feature (Home dashboard)
- [ ] Inventory hard-coded colors and inline styles in `pages/index.tsx`.
- [ ] List deviations from theme tokens (e.g., hex colors, manual hover styles, custom animations).
- [ ] Identify interaction patterns that diverge from Mantine component defaults.
- [ ] Note accessibility gaps specific to this feature (contrast, motion, focus).

## Normalization Plan (write before editing code)
- [ ] Map each inline style in `pages/index.tsx` to a Mantine token or component prop.
- [ ] Replace manual hover handlers with theme-consistent variants or class styles.
- [ ] Align text color and sizes with theme tokens for readable contrast.
- [ ] Decide whether the blink animation should follow a global motion pattern or be removed.
- [ ] Confirm responsive layout behavior aligns with other pages (spacing, stacking, padding).

## Execute: Typography
- [ ] Replace hard-coded font sizes/weights with Mantine `Text`/`Title` props and theme sizes.
- [ ] Ensure the feature uses the Montserrat font via theme (no custom font overrides).

## Execute: Color & Theme
- [ ] Replace hex colors with theme tokens (`pink`, `pastel`, `gray`) or Mantine semantic props.
- [ ] Remove any one-off background colors that bypass theme defaults.
- [ ] Ensure hover, focus, and active states use theme-driven colors.

## Execute: Spacing & Layout
- [ ] Replace literal padding/margins with Mantine spacing tokens or component props.
- [ ] Ensure layout spacing mirrors established container patterns (e.g., `Container`, `Stack` usage).
- [ ] Avoid repetitive card grids; ensure the list feels intentional and calm.

## Execute: Components
- [ ] Use Mantine `Card`, `Group`, and `Stack` props instead of inline `div` wrappers.
- [ ] Ensure icon containers follow existing ActionIcon patterns where applicable.
- [ ] Keep prop surfaces tight; pass only what is used.

## Execute: Motion & Interaction
- [ ] Replace `transition: all` with specific properties (`transform`, `box-shadow`, `background-color`).
- [ ] Ensure any animation respects reduced motion preferences.
- [ ] Match hover lift and shadow behavior to theme defaults.

## Execute: Responsive Behavior
- [ ] Verify the nav list reads well on mobile (tap targets, spacing, wrapping).
- [ ] Ensure no horizontal overflow on small screens.

## Execute: Accessibility
- [ ] Validate text contrast for default and hover states.
- [ ] Ensure interactive items have visible focus states and are keyboard reachable.
- [ ] Confirm external links have clear affordance and accessible labels if needed.

## Progressive Disclosure
- [ ] Ensure the hierarchy emphasizes the next best action without visual noise.
- [ ] Avoid redundant copy or duplicative headings.

## Guardrails (verify after changes)
- [ ] Confirm no new one-off components were introduced when Mantine equivalents exist.
- [ ] Confirm no new hard-coded values that should use tokens.
- [ ] Confirm no new UI patterns that diverge from existing flows.
- [ ] Confirm accessibility was not compromised for visual polish.

## Cleanup & Verification
- [ ] Remove obsolete inline styles or unused helper code after normalization.
- [ ] Run `./tidy.sh` and ensure it passes.
- [ ] Quick manual check of the home dashboard in desktop and mobile widths.
