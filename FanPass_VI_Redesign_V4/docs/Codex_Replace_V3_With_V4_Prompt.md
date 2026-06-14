# Codex Prompt: Replace FanPass V3 Visual Assets With V4 Clean Version

Use the FanPass V4 brand assets as the only source of truth.

Important changes from V3:
- Remove all decorative background lines from app icon, brand sheets, ticket cards, and UI mockups.
- NFC/proof waves should only appear inside dedicated UI components such as NFC scan status, Proof & History, or scanner animation.
- Do not place decorative curves behind text.
- Do not allow text to overflow outside ticket cards or phone mockups.
- Do not redesign the FanPass logo.

Files to use:
- assets/fanpass-mark-v4.svg
- assets/fanpass-app-icon-v4.svg
- assets/fanpass-horizontal-lockup-v4.svg
- docs/fanpass-brand-tokens-v4.json

Implementation requirements:
1. Replace all V3 logo/app icon references with V4 assets.
2. Update SwiftUI design tokens according to `fanpass-brand-tokens-v4.json`.
3. Remove any large diagonal decorative strokes from reusable UI components.
4. For ticket cards, keep Proof & History text inside a contained card/panel.
5. For price charts, keep chart lines inside their chart area only; they must not cross labels or values.
6. For NFC graphics, use small contained arcs or animation views, not large page-level line decorations.
7. Preserve the premium dark iOS visual direction.

UI copy guidance:
- Use “Verified Ticket”, “NFC Ready”, “Proof & History”, “Secure Resale”, and “Transparent Prices”.
- Avoid crypto-heavy wording in primary screens.

Before finishing, run a visual consistency pass and confirm:
- No stray line crosses the logo.
- No stray line crosses text.
- No text exceeds card boundaries.
- The app icon remains readable at small sizes.
