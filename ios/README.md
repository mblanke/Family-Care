# Home Board — native iOS app (iPhone + iPad)

Native SwiftUI client for family-hub, full feature parity with the web app.
Talks to the same FastAPI backend over Tailscale (`https://atlas.tail8d54ec.ts.net`),
using the same session-cookie login. No backend changes required.

## Layout

- `project.yml` — [XcodeGen](https://github.com/yonaskolb/XcodeGen) spec; regenerate the
  project with `xcodegen generate` after adding/removing files
- `FamilyHub/Api` — `APIClient` (cookie session, 401 → keychain re-login, no-trailing-slash
  and HTML-fallthrough guards), Codable models, keychain wrapper
- `FamilyHub/App` — app entry, session state, role-based shell (parent: 6 tabs, Today-first;
  admin/family: full nav; iPad uses a sidebar)
- `FamilyHub/Screens` — one view per screen, mirroring the web behavior
- `FamilyHub/Lib` — design tokens (`Theme.swift`) and verbatim datetime formatting
  (`Format.swift` — API datetimes are naive strings, never re-zoned)
- `FamilyHubTests` / `FamilyHubUITests` — decoding/format units + a live to-do flow UI test
- `docs/api-contract.md` — the audited REST contract this app consumes

## Build & test (works on Intel Macs, Xcode 16.4)

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodegen generate          # only after file add/remove
xcodebuild -project FamilyHub.xcodeproj -scheme FamilyHub \
  -destination 'platform=iOS Simulator,name=iPhone 16' build
xcodebuild ... test        # unit + UI tests (UI test hits the live server)
```

Debug-only simulator hooks (not compiled into Release): env vars `FH_AUTO_USER` /
`FH_AUTO_PASS` sign in automatically, `FH_AUTO_TAB` jumps to a screen
(`xcrun simctl launch` passes them with the `SIMCTL_CHILD_` prefix).

## TestFlight

Bundle ID `com.blanke.homeboard`, display name "Home Board", deployment target iOS 17.
Archive in Xcode → upload → add family as **internal testers** (no App Review; the server
is Tailscale-only so reviewers could never reach it). Each device needs the Tailscale app
on the tailnet plus TestFlight.
