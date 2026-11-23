# Research record

Compiled 23 November 2026. This is the evidence behind the decisions in `CLAUDE.md`.

## How far to trust this

The research was done by web search. Several primary sites could not be opened from the build environment (Meta's developer pages, Google's developer pages, Cloudflare and Supabase documentation, and some news sites), so many facts below come from search extracts and third party write ups, not from the source page. Each such fact is listed in the last section and must be checked at source before the phase that depends on it.

## 1. WhatsApp routes

**Headline: a bot cannot officially join an existing family group.**

* **Official groups interface.** It exists, but only for groups the business number creates itself, with at most 8 participants, and it requires official business account status, which a family cannot realistically obtain. [Groups documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/), [360dialog notes](https://docs.360dialog.com/docs/messaging/groups)
* **Official direct messages.** Possible for an individual with a Meta business portfolio and a spare number. Free text can be sent only within 24 hours of the person's last message; outside that window an approved template is needed. Reminders fit the utility category. Reply buttons (up to three) suit "Done / Snooze / Reassign".
* **Pricing.** Charged per delivered template message since 1 July 2025. From 1 October 2026, utility templates are charged even inside the 24 hour window, and free text replies are charged beyond a free allowance of 1,000 a month. Singapore utility rate is reported at about US$0.016 to 0.018 per message. Rough cost for a family: US$10 to 20 a month. [Twilio notice](https://support.twilio.com/hc/en-us/articles/53100462475931-Notice-Changes-to-WhatsApp-s-Pricing-October-2026), [SleekFlow](https://sleekflow.io/en-sg/blog/whatsapp-business-price)
* **Unofficial linked device libraries** (Baileys, whatsapp-web.js and hosted wrappers). They work fully in existing groups, but breach WhatsApp's terms and the number can be banned without warning. [Messaging guidelines](https://www.whatsapp.com/legal/messaging-guidelines?lang=en)
* **Ban on general purpose AI assistants** on the official platform, in force since 15 January 2026. A task specific family bot is very likely outside it; an "ask me anything" assistant would not be. [TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/)
* **Telegram.** Free, allowed, works in existing groups with buttons. The cost is moving the family to a second chat app. [Bot features](https://core.telegram.org/bots/features)

**Decision taken:** the portal sends its own notifications; for the WhatsApp group it drafts a message a person posts with one tap.

## 2. The product landscape

* **Message first assistants.** Ohai, Milo (daily digest by text), Jam (suggests preparation steps for each event), Maple (shared family inbox), Goldee (reads school messages), Nori (family memory), Zazu (lives in WhatsApp and iMessage; US$19 a month after a 7 day trial; asks both parents who will handle each task; new and little reviewed). [Milo](https://joinmilo.com/), [Zazu](https://www.getzazu.io/)
* **Displays and classic hubs.** Skylight, Hearth (asks for approval before adding extracted events), Cozi (members who never open the app still receive reminders).
* **Chores and lists.** Tody (need based recurrence: "dirtiness" builds up over time), Sweepy (effort weighted fairness), AnyList and Bring! for groceries.
* **Vendor fragility.** Ollie shut down in November 2026, eight weeks after raising funds; OurHome went dark around 2023. [TechCrunch on Ollie](https://techcrunch.com/2026/10/30/ollie-a-privacy-focused-ai-assistant-is-shutting-down/)
* **Claude Duet.** Anthropic's proactive personal agent, launched 21 October 2026 as a research preview. Reported as available in the United States only, by waitlist. It is one person's assistant, not a family coordinator. [MacRumors](https://www.macrumors.com/2026/10/21/anthropic-claude-duet/), [TechCrunch](https://techcrunch.com/2026/10/22/claude-duet-app-is-anthropics-bet-on-agents/)

**Gaps found:** no product clearly does clash detection across people, "who is driving", cascading reschedules, or home maintenance and expiry tracking suited to Singapore.

## 3. Why family apps fail

* The thinking work is unevenly held, and apps capture the doing, not the noticing. Daminger's four stages: anticipate, identify, decide, monitor. [Harvard Kennedy School](https://inequality.hks.harvard.edu/publications/cognitive-dimension-household-labor)
* One parent becomes the data entry clerk; getting the other adult on board is the hard part.
* Fair Play's model (conception, planning, execution): handing over only the execution leaves the mental load where it was.
* Extraction by AI makes mistakes; the better products ask for confirmation.

## 4. Behavioural evidence

* Batching notifications about three times a day improved attention, mood and sense of control in a field trial; hourly batching did little, and switching notifications off raised anxiety. [Fitz et al. 2019](https://scholars.duke.edu/display/pub1402953)
* Rewards can crowd out a child's own motivation (Deci et al. 1999; Lepper 1973).
* No direct evidence was found on escalation or nagging thresholds within families.

## 5. Singapore specifics

* **Parents Gateway.** No public interface or bulk export was found. Each event has an "Add to Calendar" button. The realistic way in is a screenshot or an exported calendar file.
* **HealthHub.** Caregiver profiles cover appointments for children and grandparents. SingHealth's Health Buddy app is reported to be closing in February 2027, with reminders moving to HealthHub. [SingHealth](https://www.singhealth.com.sg/patient-services/health-buddy)
* **Condo and community bookings, groceries.** Separate apps, with no public interfaces found.

Consequence: "connects to individual apps" means deep links out, plus email and calendar feeds in.

## 6. Architecture findings

* **Calendar.** Keep Google Calendar for event times; hold owners, dependencies, tasks and reminders in our own database, linked by the Google event identifier. Poll with sync tokens. An OAuth app left in testing mode loses access after 7 days. A service account that the family calendars are shared with may avoid user OAuth entirely.
* **Hosting.** Cloudflare Workers with D1 suits a hobbyist best: JavaScript, nothing to patch, scheduled jobs each minute, and no pausing. Supabase's free tier pauses idle projects; Vercel's hobby tier has coarse scheduling.
* **Reminders.** Poll each minute, make sends idempotent, back off on retry.
* **Model use.** A small typed tool set; confirmation before any move or cancellation; today's date and the Singapore zone in every prompt. Estimated cost at about 50 messages a day: US$3 to 13 a month depending on the model.
* **Privacy.** Singapore's data protection law excludes individuals acting in a personal or domestic capacity, so a purely family system is likely outside it; follow its principles regardless. [PDPA](https://sso.agc.gov.sg/Act/PDPA2012?WholeDoc=1)
* **Open source to learn from.** `werdnum/family-assistant`, [home-os](https://dev.to/htekdev/i-open-sourced-the-ai-that-runs-my-household-57ep), [homeclaw](https://github.com/Jayphen/homeclaw). Activity and quality not verified.

## 7. Second round: coordination tools (23 November 2026)

Two further strands looked for the single best mechanism in each small group coordination tool. Both worked from search summaries; many product claims come from the vendors' own pages.

**Operations tools outside the office** gave the eight rules now in `CLAUDE.md` 6.1:

* Escalation with an acknowledgement timer, urgency tiers, and rota layers with dated overrides. [incident.io](https://incident.io/blog/escalation-policy-best-practices), [PagerDuty schedules](https://support.pagerduty.com/v1/docs/schedules)
* Chasing only those who have not answered; carpool and duty assignment. [Spond](https://www.spond.com/en-us/news-and-blog/team-availability-management-app/), [TeamSnap](https://www.teamsnap.com/blog/general-sports/plan-better-with-member-availability)
* A swap as a proposal needing acceptance, with overload warnings. [Deputy](https://help.deputy.com/hc/en-au/articles/4688726501135), [When I Work](https://help.wheniwork.com/articles/overtime-visibility/?mode=grid)
* Structured handoffs with read back: I-PASS cut medical errors by 23 percent across 10,740 admissions. [Starmer 2014 via PSNet](https://psnet.ahrq.gov/issue/changes-medical-errors-after-implementation-handoff-program)
* Tickets that change colour as they age on a shared kitchen screen. [Square](https://squareup.com/help/article/7944)
* Tell the person waiting once, before they wonder. [Onfleet](https://support.onfleet.com/hc/en-us/articles/360023669392)
* Schedule change requests that lapse into no change. [OurFamilyWizard](https://www.ourfamilywizard.com/node/12394)
* Graded location sharing; nearly 1 in 5 children in monitoring app reviews said they felt watched. [MIT Technology Review](https://www.technologyreview.com/2026/08/19/1141623/child-monitoring-apps-need-reboot/)

**Office productivity tools** gave:

* A shared triage queue with a rotating captain: accept, decline with a reason, or snooze. [Linear](https://linear.app/docs/triage)
* Hill charts, and sizing a project before it starts. [Basecamp](https://basecamp.com/features/hill-charts)
* Flexible blocks that harden as the day fills. [Reclaim](https://help.reclaim.ai/en/articles/4129290-how-time-defense-settings-work)
* Planning rituals that warn of overload. [Sunsama](https://help.sunsama.com/docs/daily-shutdown)
* Propose, review, merge and revert for shared plans. [Ink and Switch, Patchwork](https://www.inkandswitch.com/patchwork/notebook/2024-version-control/)
* No presence dots, because presence becomes an expectation. [Doist](https://medium.com/ten-timezones/designing-twist-the-challenge-of-making-teamwork-less-stressful-bdd5b440a223)

**A warning from the same research:** Height (September 2025), Clockwise (March 2026) and Ollie (November 2026) all shut down, some deleting user data. The household must own its data and be able to export it.

## 8. Unverified: check at source before relying on these

1. That an existing WhatsApp group cannot be brought under the official interface (rests on a developer forum post).
2. Official WhatsApp eligibility rules for groups, and all WhatsApp prices for Singapore (sources conflict).
3. Whether a service account can read and write shared family calendars without user OAuth.
4. All free tier limits for Cloudflare Workers and D1, including the reported enforcement of D1 daily limits from 1 September 2026.
5. Web push behaviour on iPhone for a web app added to the home screen. This was not researched in this session and is essential to the Phase 1 gate.
6. Model prices.
7. Claude Duet's availability outside the United States (no primary Anthropic page was read).
8. Zazu's claims, which come from its own site and listings.
9. The Health Buddy closure date.
10. Home speaker announcements as a nudge channel (an idea, not researched).
11. The statistics and product behaviours in section 7, most of which come from vendor pages read as search summaries.
