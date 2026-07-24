# Fan Access V1 Design QA

## Evidence

- Selected reference: `fan-access-v1-selected.png` (853 x 1844).
- Simulator implementation: `fan-access-v1-implementation.png` (1206 x 2622).
- Side-by-side comparison: `fan-access-v1-design-qa-comparison.jpg`.
- Runtime: `FanPass-iPhone-17`, iOS 26.5, active V4 app shell.
- Comparison preparation: the reference was proportionally normalized and padded to the simulator viewport; neither product screenshot was stretched.

## Visual Review

- The implemented screen preserves the selected concept's dark V4 shell, cyan/violet accent system, compact hero, three campaign facts, task hierarchy, progress treatment, and persistent primary action.
- Typography, radii, borders, spacing, poster crop, and task density were checked against the combined comparison image. The final simulator pass tightened hero height, headline scale, section spacing, task rows, and fractional-second close-date parsing.
- The reference shows an authenticated example with 5/40 points and a completed follow task. The implementation evidence intentionally shows the honest signed-out state at 0/40 rather than fabricating account progress. System status and navigation chrome also add height that is absent from the concept image.
- The screen uses the existing V4 design system and `FPEventPoster`; it does not introduce a parallel component language.

## Interaction Review

- Explore exposes Fan Access only when the API reports an active campaign inside its open window.
- Opening Aurora Nights routes to the real campaign screen and loads the backend-owned reward, supply, threshold, allocation method, deadline, and tasks.
- A protected task opens the existing sign-in gate for a guest.
- `How selection works` opens the fairness, wallet, and risk-policy explanation.
- `View eligible tickets` routes to Tickets.
- No mock completion or client-owned score mutation remains in the active flow.

Final result: passed for this simulator visual/interaction QA only. It is not current-RC Staging, provider, TestFlight, or physical-device evidence.
