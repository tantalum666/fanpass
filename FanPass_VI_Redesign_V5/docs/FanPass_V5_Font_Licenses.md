# FanPass V5 Font License Notes

Status: working license notes for V5 logo/type exploration.
Date: 2026-06-29.

## Decision

The owner rejected the custom-drawn Round 03 wordmark as too cartoon-like and asked to switch to fonts that allow commercial use.

Current logo font direction:

- Use an open-source SIL Open Font License 1.1 typeface as the base.
- Do not use macOS system fonts as final logo source.
- Do not ship the Round 03 self-drawn wordmark as the current brand direction.
- The owner selected `Inter 700` from the Round 04 commercial-font board.

## Candidate Fonts

### Manrope

Use: primary V5 wordmark candidate.

Why: closest to the accepted `Humanist Premium` direction: modern, warm, practical, clean, less cartoon-like than the self-drawn candidate.

Local files:

- `assets/fonts/manrope/Manrope-700.ttf`
- `assets/fonts/manrope/Manrope-800.ttf`
- `assets/fonts/manrope/OFL.txt`

License: SIL Open Font License 1.1.

Source:

- Google Fonts CSS: `https://fonts.googleapis.com/css2?family=Manrope:wght@700;800`
- License snapshot: `https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt`

### Inter

Use: selected V5 wordmark base.

Why: extremely legible and commercially usable. Pair it with a restrained pass-notch mark so the overall identity feels FanPass-specific rather than generic UI.

Local files:

- `assets/fonts/inter/Inter-700.ttf`
- `assets/fonts/inter/OFL.txt`

License: SIL Open Font License 1.1.

Source:

- Google Fonts CSS: `https://fonts.googleapis.com/css2?family=Inter:wght@700`
- License snapshot: `https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt`

### Geist

Use: modern restrained contrast candidate.

Why: clean and contemporary, but can drift too software/SaaS for a ticketing brand.

Local files:

- `assets/fonts/geist/Geist-700.ttf`
- `assets/fonts/geist/OFL.txt`

License: SIL Open Font License 1.1.

Source:

- Google Fonts CSS: `https://fonts.googleapis.com/css2?family=Geist:wght@700`
- License snapshot: `https://raw.githubusercontent.com/google/fonts/main/ofl/geist/OFL.txt`

## OFL Guardrails

- The fonts can be used commercially under SIL Open Font License 1.1.
- If the font is modified and redistributed, respect Reserved Font Name requirements in the OFL.
- Keep license files with any redistributed font files.
- For a final trademark/logo, still run trademark review and avoid implying the font author endorses FanPass.

## Current Recommendation

Proceed with `Inter 700` for the V5 wordmark direction, with custom tracking and a no-letter pass-notch mark for app icon and compact lockups.
