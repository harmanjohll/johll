# CLAUDE.md
# The Johll Family Portal
# Build contract for Claude Code

Repo: `harmanjohll/johll` (private)
Owner: Harman Johll
Status: Phase 0 (contract awaiting approval). A clickable prototype exists with an invented week; the family's names are in it only in encrypted form. No real backend or family schedule yet.

## 1. Read this file fully before every session

This file is the complete specification for the family portal: what it is for, the principles and ethics that bind it, the architecture, the data model, the phases with their acceptance gates, and the voice of the system. Read all of it before every session. Disagreements with anything here are raised with Harman as a question, never resolved silently.

Companion files:

* `docs/research.md`: the evidence behind the decisions, with sources and a list of facts still unverified.
* `docs/household.md`: the household sheet Harman completes. It replaces guessing about who is served.

## 2. Mission

One portal that runs the family. It holds schedules and reminders, bookings that alert the right people and ripple into other appointments, activities and classes, the small updates that keep everyone posted, and home admin (groceries, chores, maintenance). Each person controls exactly which notifications reach them and how.

Shared calendars are not the goal; the family already has those. The portal is the hub. Other apps are spokes it links out to and takes information in from.

## 3. The thesis

Three findings from the research drive every feature choice.

1. **The gap is the ripple.** Existing products turn a forwarded email into an event and stop. None that we found clearly does clash detection across people, "who is driving", or cascading reschedules. A change to one commitment should show everything it touches, like a perturbation moving through a coupled system.
2. **Adoption is the risk, not features.** Family apps fail in three ways: one parent becomes the data entry clerk; the app goes unopened; the vendor dies and takes the data. Our answers: anyone can capture from anything; notifications come to the person; the family owns the data and can export it plainly.
3. **Tools do not redistribute mental load on their own.** The thinking work of a household (anticipate, identify, decide, monitor) is the hidden labour. The portal should take over anticipating and monitoring, and give every responsibility one clear owner.

## 4. The through line

This is the architecture of the Singapore Primary Science Lab (`harmanjohll/johllygoodlearning`) at family scale:

* **Compass**: what today and this week hold, for each person.
* **Coach**: the nudges, calibrated and never nagging.
* **Mirror**: the honest picture of time, load and connection.

The Science Lab becomes one spoke of the portal.

## 5. Decisions already taken (23 November 2026)

* Bookings are recorded first. Real booking with outside providers by an agent comes later, provider by provider.
* The portal sends its own notifications. For the family WhatsApp group it drafts a message that a person posts with one tap. A bot cannot officially join an existing WhatsApp group; see `docs/research.md`.
* Phones in the family are mixed, iPhone and Android.
* All eight core ideas are in scope, sequenced by phase (section 9).
* Google Calendar remains where event times live. The portal's database holds what Google cannot model.

### 5.1 Decisions taken on 24 November 2026

* The household is four people, known in this repo only by the codes `H`, `K`, `A1` and `A2`. One car; both parents drive. `A2` is 8 with limited phone access: nothing is pushed to her, and her items show on the board.
* Names depend on who is looking and on context. One function, `nameFor` in `app/js/names.js`, chooses between three registers: personal (what the viewer calls that person), family (what everyone uses; the board and the WhatsApp group draft), and formal (the given name; anything sent outside the family). Text that mentions a person carries a token such as `{A2}`, never a name.
* Real names and pet names live only in `app/js/data/names.enc.json`, encrypted. A four digit family code unlocks them on a device, where they stay unlocked until that device is locked.
* The code is never written into this repo: not in code, tests, commit messages or documents.
* Dinner is part of the portal: who cooks, requests to the cook, what is likely in the house, and receipts that fill the pantry.

## 6. Principles

* **Code decides, the model words.** Clash detection, routing and scheduling are deterministic code. The language model reads messages and phrases proposals; it never decides a clash and never acts alone.
* **Confirm before commit.** Anything extracted by the model, and any move or cancellation, is a proposal until a person taps to confirm.
* **Sender states intent, receiver decides delivery.** Notification contracts belong to the person receiving.
* **One owner per responsibility.** Ownership includes the noticing, not only the doing.
* **Spine first, spokes one at a time.** The portal must not become a super app that does everything badly.
* **Swappable channels.** Notification channels sit behind one layer so that a channel can be added or replaced without redesign.
* **Honest about limits.** If a fact is unverified or an integration is not possible, say so; do not invent.

### 6.1 The coordination grammar (added 23 November 2026)

Eight rules drawn from tools that coordinate real operations: on call rotas, sports team apps, shift scheduling, hospital handoffs, kitchen displays and delivery dispatch. Every feature should obey them.

1. One named owner, with an end time. Covers are overrides, not edits.
2. Silence escalates. Every alert that matters has an acknowledgement deadline, then a named next person.
3. Severity decides the channel. Low urgency goes to the board and never escalates.
4. Changes are proposals. Swaps need acceptance; an expired proposal means no change.
5. Handoffs follow a structure and end in a read back.
6. One ambient board, ageing by colour, answers "what is happening" without a notification.
7. Notify on change, once. Chase only those who have not answered.
8. Privacy has graded levels, and every override is visible to the person watched.

Every notification states its reason ("Why: you follow Leo"), so nobody has to guess why they were told.

### 6.2 Patterns the portal must not contain

Streaks, points or badges, presence dots, read receipts for children, and schedulers that hide their reasons.

## 7. Ethics and protect list

### 7.1 Never acceptable
* Surveillance. Location and status sharing are opt in per person and off by default. Every person, children included, can see what the system holds about them.
* Dark patterns: no fake urgency, no guilt, no streak anxiety.
* Gamified chore rewards for children. The motivation research suggests rewards crowd out a child's own drive.
* Sending family data to any model tier that trains on it. Paid tiers only.
* Acting on a person's behalf (sending, booking, paying, cancelling) without that person's confirmation.

### 7.2 Data rules
* Data minimisation: first names, no identity numbers. Raw photos and voice recordings are deleted after extraction.
* Secrets live in the hosting platform's secret store or repository secrets, never in the repo and never in chat.
* Plain exports (calendar files, spreadsheets) must always work, so the data outlives the system.
* Every change to a commitment is written to an audit log.
* **The name lock is a diary lock, not a safe.** The site is public, so the encrypted names file is public, and a four digit code has only 10,000 possibilities. It keeps names from search engines and casual visitors; it would not stop someone determined. It therefore guards names and pet names only. Real schedules, venues, school details or anything about health must not enter the repo until the portal sits behind a proper sign in (Phase 1).

### 7.3 Distress
If anything a family member writes suggests distress, the system does not diagnose. It responds once, briefly, suggests speaking to a trusted adult, and does not escalate to others without that person knowing.

## 8. Architecture

### 8.1 Stack
* **Portal**: an installable web app, opened from the home screen on iPhone and Android. Vanilla HTML, CSS and JavaScript. No framework and no build step unless unavoidable. The same shell provides a kitchen display mode.
* **Backend**: one Cloudflare Worker in JavaScript, a D1 database, a scheduled job every minute for reminders, and web push to each installed device.
* **Calendar**: Google Calendar, synchronised by polling with sync tokens. Do not build on watch channels.
* **Intelligence**: a Claude Haiku class model called through a small typed tool set: create a commitment, move a commitment, find conflicts, create a task, add a list item, assign, remind, ask for clarification. Every tool call is validated against a schema.
* **Channel layer**: web push first; tap to share for WhatsApp; official WhatsApp direct messages may be added later behind the same layer.

### 8.2 Data model (D1 tables)
* `members`: person, role, whether they drive, quiet hours.
* `devices`: installed devices and their push subscriptions.
* `commitments`: events and bookings, fixed or flexible, with owner and status, linked to a Google event where one exists.
* `commitment_people`: who attends, who drives, who must be told.
* `needs`: what a commitment requires (driver, kit, payment, consent form).
* `resources`: shared things with limited capacity (the car, the helper's hours).
* `tasks`: follow up work with one assignee, optionally born from a commitment.
* `reminders`: target, due time, status, attempts, escalation target, send key.
* `notification_rules` and `follows`: each person's contracts and what they follow.
* `activities` and `terms`: classes as seasons, with fees, kit, contacts, attendance and renewal dates.
* `playbooks`: rules by commitment type that generate needs and tasks.
* `pending_actions`: proposals awaiting a tap to confirm, with expiry.
* `status_updates`: one tap updates and who they affect.
* `captures`: things forwarded or snapped, before and after extraction.
* `lists`: groceries, chores, maintenance.
* `facts`: household memory.
* `audit_log` and `sync_state`.

Store times in UTC with the zone `Asia/Singapore`.

### 8.3 Notification contracts
Four tiers, from quietest to loudest:

1. **Ambient**: appears on the board only.
2. **Digest**: gathered into a batch, about three times a day.
3. **Nudge**: a notification to the person.
4. **Interrupt**: a notification that repeats and escalates to a named person if unacknowledged.

A person follows another person or an activity at a chosen tier. Quiet hours defer everything below interrupt.

### 8.4 Reminder engine
* Poll every minute for due reminders; do not schedule one alarm per reminder.
* Sends are idempotent: mark as sending with a send key in the same update, then mark as sent.
* Retries use backoff. Snooze rewrites the due time. Escalation goes to the named person after a set wait.

## 9. Phased delivery

Each phase ends with a gate. Do not start the next phase until Harman signs off in writing.

### Phase 0: the contract
Write this file, `docs/research.md` and `docs/household.md`.

A clickable prototype is part of Phase 0, so the contract can be judged by using it. It lives at the repo root (`index.html`, `app/`) and runs entirely in the browser. Because the site is published publicly, every time, venue and event in it is invented, and the only real family data it holds is the encrypted names file described in 5.1 and 7.2. Its coordination logic in `app/js/engine/` is written as pure functions with tests (`npm test`) and is intended to be kept for Phases 1 and 2. Its look is a starting point, set by tokens in `app/css/tokens.css`.

**Gate.** Harman approves the contract and completes the household sheet.

### Phase 1: the spine (graph and notification contracts)
* Worker and database schema; sign in by personal invite link bound to a device.
* Installable portal shell; a Today view per person; manual entry of commitments with people and needs.
* Notification contracts as in 8.3.
* Reminder engine as in 8.4.
* Tap to share: draft a WhatsApp message and open the share sheet.
* Read from Google Calendar so existing events appear.

**Gate.** One iPhone and one Android phone receive correctly tiered notifications. A commitment entered by one person reaches only those whose rules say it should.

### Phase 2: cascades and forecast
* Playbooks: a commitment type implies needs and follow up tasks.
* Deterministic clash detection per person and per resource; a ripple preview; proposals stored as pending actions and applied only on confirmation; write back to Google Calendar.
* The week ahead pressure map (red days) and a what if mode.

**Gate.** "Dentist moved to Thursday 4pm" produces the correct clashes, proposals, tasks and notifications, and nothing changes before confirmation.

### Phase 3: capture, seasons and home admin
* Universal capture: typed text, a photo or screenshot, a voice note, a forwarded email. The model extracts; the person confirms.
* Activities as seasons.
* Groceries, chores, and maintenance with need based recurrence; document and expiry tracking; household memory.
* Dinner and pantry for real: reading forwarded FairPrice and RedMart order emails and photos of paper receipts with the model, confirmed by a person before the pantry changes. The pantry always says "likely", because a receipt shows what came in and never what was eaten.

**Gate.** A Parents Gateway screenshot and a forwarded booking email each become a correct, confirmed commitment. At this gate, raise the parked second brain idea (section 11) with Harman.

### Phase 4: status and spokes
* One tap status, sent only to those affected.
* A launchpad of deep links to Parents Gateway, HealthHub, condo booking and grocery apps.
* Kitchen display mode.
* The Science Lab spoke: study sessions proposed in real free windows.

**Gate.** A status update reaches only the affected people; the display mode runs unattended for a week.

### Phase 5: mirror and agents
* The connection ledger (family time and one to one time) and the planning load view.
* Negotiating agents that propose swaps for human approval.
* Exploration of bookings made by an agent.

**Gate.** Defined with Harman when Phase 4 closes.

## 10. Voice

* **Nudges**: brief, specific, calm. State what, when and who. Never nag; never guilt.
* **Proposals**: say what would change and what it touches, then ask. "Move the dentist to Thursday 4pm? It clashes with football."
* **Mirror**: neutral and factual. No cheerleading, no doom.
* In all system text: no hyphens or dashes of any kind; use commas, semicolons and colons. No emoji in system speech.

## 11. Parked ideas

* **A Johll second brain for the whole family** (raised 23 November 2026). Harman has a personal knowledge core tied to the `Tuesday` repo. The idea is a shared one for all Johlls, possibly a layer per person plus a family layer. The natural seed is the household memory built in Phase 3. Open questions: what is private per person and what is shared, and how it relates to `Tuesday`. Raise again at the Phase 3 gate.
* Official WhatsApp direct messages for the few alerts that must not be missed.

## 12. Conventions

* One feature branch per phase. A pull request per phase only when Harman asks for one; its body lists the gate items as checkboxes.
* Commit messages in the imperative mood with a short subject.
* `main` stays deployable at all times.
* Tests: unit tests for clash detection, notification routing and reminder idempotency, since these pure functions are the heart of the system. Scenario tests for each phase gate. Browser checks at 390px and 768px, with keyboard navigation and contrast.

## 13. What Harman must provide

* A Cloudflare account and an access token for deployment, stored as a secret.
* A model provider key, needed from Phase 3.
* The completed household sheet.
* Access to the blocked documentation sites from the build environment, so the unverified facts in `docs/research.md` can be checked at source.

*Last updated: 24 November 2026*
*Author: Harman Johll, with Claude (Anthropic)*
