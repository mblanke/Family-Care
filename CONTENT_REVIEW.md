# Content review and fix plan

Reviewed against the public `mblanke/Family-Care` clone at commit `2026d9d` (2026-07-16).
The earlier local worktree was at `2b23598`, so a few line numbers may have drifted.
All paths are under `frontend/src/` unless noted.

## Guiding rules (already implied by the codebase)

- Big text, big targets, text plus icon, never colour alone.
- Neutral clinical language, never advice.
- Parents are the primary readers. Prefer plain words over jargon and abbreviations.

## A. Bugs that show wrong content

| # | Where | Problem | Fix |
|---|---|---|---|
| A1 | `screens/BpLog.tsx:236` | The print link sends `days=${days \|\| 90}`. Choosing **All** (value 0) prints "Last 90 days". The backend already treats `days=0` as all. | Use `?days=${days}` and disable the link while no person is selected (`selected == null` currently yields `/api/people/null/...`). |
| A2 | `screens/Today.tsx` | The API returns `open_todos` (see `api/types.ts:TodayData`) and the README promises open to-dos on Today, but the screen never renders them. | Add a "To do" section between appointments and birthdays, listing `data.open_todos` text. |
| A3 | `screens/Today.tsx:8` | The load has no `catch`. A failed request leaves "Loading today…" on screen forever. | Add an error state: "Couldn't load today. Pull down or tap to try again." with a retry button. |
| A4 | `components/Confirmation.tsx` prepends a check mark, and BpLog/Todo also append one. | Banners read "✓ Reading saved ✓", "✓ Checked off ✓", "✓ Target saved ✓". | Drop the trailing check from the three strings in `BpLog.tsx:148,179` and `TodoScreen.tsx:57`. |
| A5 | `admin/ScanReview.tsx:105` | Error renders as `{err} — you can still type it in manually.` When `err` is a raw status text this reads "Internal Server Error — you can still type it in manually." | Lead with a fixed sentence: "Couldn't read the label. You can still type it in below." Show the server detail on a second, smaller line only when it is not a generic status text. |
| A6 | `screens/Login.tsx:10` | A network failure surfaces the browser's raw "Failed to fetch". | Map `TypeError` (fetch failed) to "Couldn't reach the server. Check the connection and try again." Keep the backend's "Invalid username or password" as is. |

## B. Consistency

| # | Problem | Fix |
|---|---|---|
| B1 | Error wording splits between "Couldn't …" (Todo, Grocery, Contacts, Birthdays, Accounts, AppointmentForm) and "Could not …" (Medications, BpLog). | Standardise on **Couldn't … Please try again.** (full stop, not a dash). |
| B2 | Errors render two ways: `ErrorBanner` on most screens, an inline red paragraph in `Medications.tsx:197` and `BpLog.tsx:193,257`. | Use `ErrorBanner` everywhere for request failures. Keep inline text only for field validation next to the field. |
| B3 | Success banners are inconsistent: Todo "Added to the list", Grocery "Added", and nothing at all for Contacts, Birthdays, Medications, Appointments, Accounts, even though the README promises a visible confirmation. | Pattern: **"<Thing> added"**, **"<Thing> saved"**, **"<Thing> removed"**. Add `Confirmation` to the five screens that lack it. |
| B4 | Title case vs sentence case: "Add Appointment", "Add Birthday", "New Appointment", "Edit Appointment", "This Week" against "Add medication", "Add contact", "Save reading", "Change history". | Sentence case everywhere: "Add appointment", "Add birthday", "New appointment", "Edit appointment", "This week". |
| B5 | Parent nav says **BP** (`parent/ParentLayout.tsx:20`) while admin nav says "Blood Pressure" and the heading says "Blood pressure". Parents are the ones who need the full words. | "Blood pressure" in both navs. |
| B6 | Ride badge is "🚗 Ride" on Schedule but "🚗 Needs a ride" on Today. | Use "🚗 Needs a ride" in both. |
| B7 | The text-size toggle reads "Aa Normal" / "Aa Larger", which shows the target state and is easy to misread. | "Larger text" / "Normal text". |
| B8 | Dates: `recorded_at.slice(0, 10)` in `Medications.tsx:79` and `taken_at.slice(0, 10)` in `BpLog.tsx:76` show `2026-06-01`. Birthdays show "June 22 1950" with no comma. | Add `formatDate(iso)` to `lib/format.ts` returning "June 1, 2026" and use it in all three places. Cover it in `lib/format.test.ts`. |
| B9 | Backend printout (`backend/app/routers/bp_export.py:34`) says "Last all days" when `days=0`. | "All readings" when `days == 0`, otherwise "Last N days". |

## C. Clarity and plain language

| # | Where | Current | Suggested |
|---|---|---|---|
| C1 | `TodoScreen.tsx:95` | "Done" header always shows, even over an empty list. No empty state for the open list. | Hide the header when nothing is done. Open list empty state: "Nothing on the list. Add something above." (Header text stays exactly "Done" for the test.) |
| C2 | `GroceryScreen.tsx` | Store "Either" as a section header, and empty sections under **All** show a header with nothing below. | Rename the group to "Either store". Hide empty groups, or show "Nothing needed" under them. Overall empty state: "The list is empty." |
| C3 | `GroceryScreen.tsx:203` | "Clear checked" | "Remove checked items" and dialog title "Remove all checked items?" (button "Remove"). |
| C4 | `components/ConfirmDialog.tsx:14` | Cancel button is always "Keep". | Make it a `cancelLabel` prop defaulting to "Cancel"; pass "Keep" only where the body names a single item. |
| C5 | `Medications.tsx:128-153` | Four `window.prompt` dialogs (change dose, reason, stop, note). Tiny system text, no font scaling, no big targets. The verbatim-dose warning is buried in the prompt. | New `components/PromptDialog.tsx` (title, helper text, one or two labelled inputs, primary Save, secondary Cancel, non-red). Move the warning into visible helper text: "Type the dose exactly as written on the label. The app records it as typed and does not check it." |
| C6 | `Medications.tsx:68` | Button "Stop" | "Stop medication" |
| C7 | `Medications.tsx:222,234` | Placeholders "For (optional)", "Reason for the record (optional)" | "What it's for (optional)", "Why it was added (optional)". Add visible labels above each input rather than placeholder only. |
| C8 | `Medications.tsx` | No empty states. | "No medications recorded for <name>." and, under Change history, "No changes recorded yet." |
| C9 | `BpLog.tsx:252-255` | "Enter the range your doctor gave — readings are then shown as within / above / below it. Not the app deciding what's normal." | "Enter the range your doctor gave. Each reading is then marked within, above or below that range. The app never decides what is normal." |
| C10 | `BpLog.tsx:159,168` | "Doctor / clinic label is required." "All four range values are required and must be numbers." | "Enter the doctor or clinic that set this target." "Enter all four numbers." |
| C11 | `BpLog.tsx:80` | Status line "systolic within target · diastolic above target" | "Top within range · Bottom above range" to match the stepper labels "Top (systolic)" and "Bottom (diastolic)". |
| C12 | `BpLog.tsx:241` | "Print / Save PDF" | "Print or save as PDF" |
| C13 | `Today.tsx:32` | "in 1 day" | "tomorrow"; keep "in N days" otherwise. |
| C14 | `Schedule.tsx:52` | "What I'm driving this week" (first person is odd for a shared family view). | "Rides someone is driving this week". Any wording must keep the phrase "driving this week" or the test needs updating. |
| C15 | `Schedule.tsx:75-84` | Toggle button turns into "Cancel" while the form also has its own Cancel, so two Cancel buttons show. | Hide the toggle while the form is open. |
| C16 | `admin/AppointmentForm.tsx:130,150` | Person chip "Both"; save button "Save" / "Update"; silent return when title, date or time is missing. | "Both parents" (or "Everyone"); "Save appointment"; inline message "Enter a title, date and start time." |
| C17 | `screens/Birthdays.tsx:79-87` | Month and day are bare number inputs with placeholders "Month" and "Day". "Add Birthday" appears as both heading and button. | Month as a `<select>` of month names, day as a number with a visible label, heading "Add a birthday", button "Add birthday". |
| C18 | `screens/Contacts.tsx:128` | Add form has no heading; silent return when name or phone is missing. | Heading "Add a contact"; message "Enter a name and phone number." |
| C19 | `admin/Accounts.tsx:87,100` | "Link to…" placeholder; list shows the raw role key ("Sam — admin", "(inactive)"). | "Which parent is this account for?"; capitalise roles via a `ROLE_LABEL` map ("Admin", "Family", "Parent"). |
| C20 | `admin/ScanReview.tsx:148,160` | "Add to regimen"; "Keep photo with these entries" (README says "this entry"). | "Add this medication" (update the ScanReview test regex); "Keep the photo with this medication". |
| C21 | `components/ErrorBanner.tsx` | Auto-dismisses after 8 seconds. Older readers can miss it. | Stay until dismissed. Add a "Dismiss" button (≥ 60 px). |
| C22 | Load failures in Todo, Grocery, Contacts, Medications only log to the console. | Show `ErrorBanner` "Couldn't load the list. Please try again." with a retry. |

## D. Accessibility text (screen-reader labels)

| # | Where | Current | Suggested |
|---|---|---|---|
| D1 | `TodoScreen.tsx:16,23`, `GroceryScreen.tsx:165` | "Check" / "Uncheck" / "Delete" with no item name, so a list reads as "Check, Check, Check". | `Mark ${text} done` / `Mark ${text} not done` / `Delete ${text}`. |
| D2 | `GroceryScreen.tsx:184,192` | "Less" / "More" | `One fewer ${name}` / `One more ${name}`. |
| D3 | `Medications.tsx:201-237`, `Contacts.tsx:129-155`, `Accounts.tsx:53-80` | Inputs rely on placeholders only. | Add `aria-label` (or visible `<label>`) matching the placeholder. |
| D4 | `components/ConfirmDialog.tsx:8` | Dialog has no accessible name. | `aria-labelledby` pointing at the title. |
| D5 | `components/BpChart.tsx:137-139` | Legend glyphs "━━", "╌╌", "····" are read aloud oddly. | Wrap glyphs in `aria-hidden` spans and prefix "Solid line", "Dashed line", "Dotted line" visually hidden. Keep the visible text "Systolic — top number" / "Diastolic — bottom number" (tests match it). |

## E. Strings the tests pin (do not change without updating the test)

| Test | Pinned text |
|---|---|
| `TodoScreen.test.tsx` | Header exactly `Done`; items `Milk`, `Eggs` |
| `GroceryScreen.test.tsx` | Exactly one button matching `/costco/i`, one `/grocery/i`, one `/^all$/i` |
| `Contacts.test.tsx` | Exactly one element matching `/Emergency/i` in parent view; link name `/call ambulance/i` |
| `Medications.test.tsx` | Text matching `/not medical advice/i`; no button `/change dose/i` for family |
| `Schedule.test.tsx` | Text matching `/driving this week/i` |
| `ScanReview.test.tsx` | Label `/scan label/i`; button `/add to regimen/i`; text `/check each line against the label/i` |
| `BpChart.test.tsx` | `/Systolic — top number/i`, `/Diastolic — bottom number/i` (em dash) |

## F. Suggested order of work

1. **Bug fixes (A1 to A6).** Small, isolated, and one of them prints the wrong date range for a clinician.
2. **Shared helpers.** `formatDate` in `lib/format.ts` with tests; `cancelLabel` and `aria-labelledby` on `ConfirmDialog`; `Dismiss` button on `ErrorBanner`; `PromptDialog` component.
3. **Consistency sweep (B1 to B9).** Mostly string edits. Run `npm test` in `frontend/` after each screen because of the pinned strings above.
4. **Clarity and empty states (C section).** Screen by screen: Todo, Grocery, Medications, BpLog, Today, Schedule, Birthdays, Contacts, Accounts, ScanReview.
5. **Accessibility labels (D section).** Add tests that query by the new labels so they stay in place.
6. **README.** Fix "Keep photo with this entry", note that Today shows open to-dos, and mention the renamed buttons.

Optional but worthwhile: collect all user-facing strings into `lib/copy.ts` so tone and case are enforced in one file, and add a lint rule or test that fails on `window.prompt`.
