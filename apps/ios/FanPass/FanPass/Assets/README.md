# FanPass iOS Assets

This folder contains V4 resources used by unmigrated screens plus derived V5 resources for the staged migration.

The V4 resources came from:

`FanPass_VI_Redesign_V4/assets/`

Rules:

- Preserve V4 resources while any active screen still references them.
- Derive V5 brand resources only from the selected sources under `FanPass_VI_Redesign_V5/assets/`; do not redraw or approximate them in SwiftUI.
- Do not add decorative strokes across text, QR, buttons, charts, prices, or ticket cards.
- QR placeholders must keep a clear white quiet zone.
- NFC graphics must remain small and contained.

## V5 Brand Resources

- `fanpass-mark-v5.png` is the Paper-backed, tightly cropped header rendition of the selected Round 06 no-letter pass-notch geometry. Canonical vectors remain under `FanPass_VI_Redesign_V5/assets/`.
- `Assets.xcassets/AppIcon.appiconset/` contains opaque RGB renditions generated from `FanPass_VI_Redesign_V5/assets/fanpass-app-icon-v5-inter-pass-notch-minimal.svg` at every declared iPhone, iPad, and marketing size.
- The canonical app-icon SVG uses a full square Paper background. iOS owns final corner masking; do not add a second rounded outer mask.

## Social Login Assets

- `auth-google-logo.png` comes from Google's pre-approved Sign in with Google iOS assets. The transparent PNG is cropped from the official multicolor G path so it can sit at the same visual weight as the X and Discord marks inside FanPass' circular icon button.
- `auth-x-logo.png` comes from the official X brand toolkit logo package.
- `auth-discord-symbol.png` comes from Discord's official branding page symbol asset.

Use these only for sign-in affordances, preserve aspect ratio, and do not recolor or distort the marks.

## Generated Event Covers

The `event-cover-*.png` files are generated fictional event artwork for local iOS review data. They intentionally avoid real artist, venue, sponsor, or provider marks and should not be used as release evidence.
