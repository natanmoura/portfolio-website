# Narrator Voice Lab

Working log for calibrating the narrator register in the `mosey-voice` skill (`C:\Users\NATAN\.claude\skills\mosey-voice\SKILL.md`). Every line gets a verdict; verdicts accumulate into rules; rules eventually get folded back into the skill file itself.

## How it works

1. I feed lines, numbered, tagged with the comedy shape or rule they're testing.
2. You reply per line: **yes** (keeps as written), **no** (cut it — say why if it's not obvious), or **other: <fix>** (the most valuable one — shows me the actual boundary).
3. I log every verdict below, no editing after the fact.
4. Every ~15 lines I read the log back for patterns and propose a specific skill-file edit — not vibes, an actual diff.

Reply however's fastest: one line at a time, or a batch like `1 yes, 2 no too zany, 3 other: cut the last clause, 4 yes...`.

## Legend
- **Y** = yes | **N** = no | **O** = other (fix given)
- Shape tags reference the "Comedy shapes" menu and hard rules in the skill.

---

## Round 1

| # | Line | Shape/rule tested | Verdict | Note |
|---|------|---|---|---|
| 1 | Mosey found the leaf from Tuesday. It has been reclassified as evidence. | specificity/callback energy | **N** | "reclassified as evidence" officialese punchline died |
| 2 | You said "walk." Mosey heard "walk" the way other dogs hear their names. | register clash / plain-ish | **N** | writerly simile; also compares Mosey to "other dogs" |
| 3 | The Squirrel crossed the yard at 4:12 PM. No comment was issued by either side. | declined investigation + register clash | **O** | → "The Squirrel crossed the yard. Mosey is suddenly very quiet." Cut clock-time + officialese; put Mosey in it, reacting. |
| 4 | Mosey stared at the door for six minutes. [beat] The door did not move first. | afterthought | **Y** | afterthought clean; duration number ("six minutes") survives |
| 5 | Forecast: cloudy, with a chance of the Snail arriving by evening. | register clash (meteorology) | **O** | → "Forecast: sunny, with a chance of a dehydrated Snail arriving by evening." Keep the frame; add a vivid absurd-true specific. |
| 6 | Mosey brought you the sock. Not the other sock. This one specifically. | specificity over category | **O** | → "Mosey brought you the best sock. This sock is unmatched. Because there is no other pair." Wants a real logical/pun payoff, not bare specificity. |
| 7 | The Pigeon delivered the letter upside down. It is unclear if this was intentional. No further information is available. | declined investigation | **N** | double declined-investigation; no Mosey, no payoff |
| 8 | Mosey ate ~~with dignity~~. | strikethrough (away from overstatement) | **O** | → "Mosey ate ~~calmly~~." Prefers a plain single struck adverb over a fancy phrase. |
| 9 | You came home late. Mosey did not mention it. Mosey mentioned it four times. | escalating flat facts / self-contradiction | **N** | "you came home late" tips toward mild accusation of user |
| 10 | Nothing happened between 2 and 3 PM. [Mosey: reviewing the nothing with great interest] | joy juxtaposition (signature move) | **N** | cue too narrator-cute; not pure disproportionate joy |
| 11 | The Tortoise has not arrived. The Tortoise was never going to arrive today. The Tortoise remains, in every sense, on schedule. | escalating flat facts + callback | **N** | triple escalation, all narrator, no Mosey, overlong |
| 12 | You scratched behind the left ear. Mosey has filed a formal request for the right ear as well. | reaction to user action + register clash | **O** | → "You scratched behind the left ear. Mosey's right ear is jealous." Cut officialese; concrete warm personification of Mosey's body. |
| 13 | Mosey does not know what Tuesday is. Mosey knows it was a good one. | sincerity (shorter sentences, concrete) | **O** | → "Mosey does not know what Tuesday is. Mosey is happy." Strip to the barest sincere statement. |
| 14 | The Cat watched the whole walk from the windowsill. The Cat has opinions. The Cat will not be sharing them. | declined investigation, new character use | **O** | → "The Cat stares at Mosey. The Cat got overwhelmed and left to take a nap." Wants character action + a turn, not the coy "won't share" move. |
| 15 | Mosey missed ~~the yard~~ you. | sincerity-strike (toward truth, not away) | **N** | sentimental strike-toward-longing rejected |

**Round 1 tally:** 1 clean yes, 6 no, 8 other. High "other" rate is the point — every rewrite marks a boundary.

## Emerging rules (hypotheses — from Round 1 only, n=15, one rater, one session; do NOT fold into the skill yet)

1. **Put Mosey IN the line, reacting.** The single strongest signal. Every "no" that became an "other" got fixed by adding Mosey (or another animal) *doing something concrete and emotional*. Pure narrator-about-the-world lines (#7, #11) die. `The Squirrel crossed the yard. Mosey is suddenly very quiet.` beats any amount of narrator commentary.
2. **Officialese is on thin ice** — directly contradicts the skill, which elevates "register clash" and officialese as core shapes. Natan cut it in #1 ("reclassified as evidence"), #3 ("no comment was issued"), #12 ("filed a formal request"), #14 ("will not be sharing them"). Hypothesis: bureaucratic register is only welcome when it *is* a character (the Squirrel's letters), not when the narrator wears it to describe Mosey. **Needs a clean test before touching the skill.**
3. **The "declined investigation" trope is disfavored.** #7 rejected, #3/#14 rewritten to remove it. The coy "no further information is available / we may never know" move reads as the narrator hiding instead of feeling. Another core skill shape under pressure — test it.
4. **Payoffs must reveal, not just assert.** #6 bare specificity got upgraded to a real pun ("unmatched... no other pair"). Wordplay with a logical click lands.
5. **Vivid absurd-but-true specifics** beat generic ones (#5 "dehydrated Snail").
6. **Concrete personification of Mosey's body/feeling** ("right ear is jealous", "suddenly very quiet") beats bureaucratic framing of the same beat.
7. **Sincerity = very plain + about Mosey's simple present happiness**, NOT longing/absence. #13 stripped to "Mosey is happy"; #15 (missing *you*) rejected outright.
8. **Numbers:** durations survive ("six minutes" #4 kept), clock-times don't ("4:12 PM" #3 cut). Tentative.

---

## Round 2 (the 12 lines actually rated)

| # | Line | What it tests | Verdict | Note |
|---|------|---|---|---|
| 1 | You picked up the keys. Mosey is already three rooms ahead. | H1 Mosey concrete anticipation | **N** | Mosey present + concrete, still rejected — "you do X → Mosey already did Y" anticipation structure is weak |
| 2 | Mosey found a stick. Mosey found the stick. There is only one stick, and Mosey found it. | H4 logic/pun reveal | **O** | → "Mosey found a stick. Mosey found the stick. It's the best one." CUT the logical explanation; land on the simple warm superlative. |
| 3 | Forecast: one sunbeam, moving slowly across the floor. Mosey is in pursuit. | register frame + Mosey present | **N** | forecast frame worked w/ the Snail but not a static sunbeam; "in pursuit" flat |
| 4 | The Squirrel is back. The truce is over. It was never much of a truce. | officialese RETEST (Squirrel) | **O** | → "The Squirrel is back. The truce is over. The war has begun." Squirrel war wants EARNEST escalation/drama, NOT the deflating afterthought. |
| 5 | Mosey does not know it is raining. Mosey knows you are home. | sincerity, present happiness | **N** | sincerity about the USER-BOND rejected (cf R1 #15 "missed you"); only Mosey's own state survives |
| 6 | You stopped scratching. Mosey's paw is now operating your hand for you. | H6 body personification | **O** | → "You stopped scratching. Mosey will wait patiently. [Mosey's tail wagging rapidly]" Converted to joy-juxtaposition: flat line + contradicting animation. |
| 7 | Mosey is guarding the house. [beat] Mosey is asleep. | afterthought, confirmed | **O** | → "Mosey is guarding the house. [beat] In his dreams." Kept the beat; "In his dreams" adds a double meaning. (Note: "his".) |
| 8 | You put on your shoes. Mosey has already chosen a toy for the occasion. | H1 reaction to user | **N** | second rejection of the "you prep → Mosey anticipates" structure |
| 9 | It was an ordinary walk. [Mosey: telling everyone it was the best walk] | joy juxtaposition | **O** | → "It was an ordinary walk. [Mosey wearing a party hat]" KEPT the flat line; swapped narrator-editorial cue for a concrete VISUAL cue. |
| 10 | Mosey came back inside smelling of triumph. We are not asking about the triumph. | declined-investigation RETEST | **N** | declined-investigation rejected again — now 0-for-3 across rounds |
| 11 | Mosey waited by the bowl. Dinner was eleven minutes away. Mosey waited anyway. | duration-number RETEST | **O** | → "Mosey waited by the bowl. Mosey forgot he finished eating." CUT the number; replaced with a dog-true absurdity. (Note: "he".) |
| 12 | Mosey dug a hole. The hole is done. Mosey is not. | short reveal / turn payoff | **Y** | clean yes — short escalation, behaviorally-true turn on the last beat |

**Round 2 tally:** 1 yes, 5 no, 6 other.

## Refined hypotheses (2 rounds of data — still NOT skill edits)

- **A. Mosey-in-frame is necessary but not sufficient.** Round-1 rule #1 was overstated. The specific "you do a prep action → Mosey already anticipated it" structure is weak (R2 #1, #8 both cut).
- **B. Declined-investigation is dying: 0-for-3+.** ("no further information", "we are not asking"). Strongest demote candidate. Needs one or two more nails.
- **C. Animation CUE FORMAT is a real rule.** Winning cues are simple concrete VISUAL/physical actions: `[Mosey wearing a party hat]`, `[Mosey's tail wagging rapidly]`. Losing cues editorialize Mosey's inner life: `[Mosey: telling everyone...]`, `[Mosey: reviewing the nothing...]`. Both his fixes converged here.
- **D. The joy-juxtaposition is the engine.** Flat deadpan line + animation showing the opposite. He converts other shapes INTO it. His clear favorite.
- **E. Sincerity stays about Mosey's own state, never the user-bond.** "Mosey is happy" ✓; "Mosey knows you are home" ✗; "Mosey missed you" ✗. The love is shown through behavior/structure, never stated. (Contrast the couch-structure line — Round 3 tests this.)
- **F. The "best" framing wins.** "It's the best one" / "the best sock" — Mosey's disproportionate valuing of an ordinary object, stated simply and warmly.
- **G. The Squirrel war is played STRAIGHT and dramatic.** "The war has begun," not deflation. The "understatement scales with the moment" rule does NOT apply to the Squirrel.
- **H. Numbers usually get cut** (4:12, four times, eleven minutes all cut; only "six minutes" survived once). Trending toward "cut unless the number IS the joke."
- **I. Best clean-yes shape:** short escalation, concrete action, a behaviorally-true TURN on the final beat (#12 the hole).
- **⚠ OPEN QUESTION — pronouns.** Natan wrote "In his dreams" and "Mosey forgot he finished eating" — using "he/his" for Mosey. The skill's #1 HARD RULE bans any pronoun for Mosey ("always Mosey"). This needs Natan's decision before it can touch the skill. Logged, not resolved.

---

## Round 3 (WIDE — retests + wildcards)

Retests officialese ×2, declined-investigation-adjacent, no-Mosey ×1, reported speech, clock-time, the "best" framing, Squirrel-drama, the user-bond boundary, plus wildcards.

| # | Line | What it tests | Verdict | Note |
|---|------|---|---|---|
| 1 | The Puddle is back. The Puddle has been back before. The Puddle will be back again. | pure-narrator, no Mosey | **O** | → "The Puddle is back. [Mosey running in circles like a lunatic]" Cut the no-Mosey repetition; converted to joy-juxtaposition. |
| 2 | Mosey says the mailman started it. The mailman was delivering mail. | reported speech (new shape) | **N** | reported speech rejected |
| 3 | The sock has been recovered. The sock is not talking. Mosey will get it to talk. | officialese + sock callback | **N** | officialese rejected |
| 4 | Mosey barked at the vacuum. The vacuum did not bark back. Mosey considers this a win. | wildcard, dog-true + turn | **O** | → "...Mosey was just checking." Flatter, humbler, more dog-true turn beats "considers this a win" (narrator ego-editorializing). |
| 5 | It is 6:02 AM. Mosey has decided the day begins now. | clock-time RETEST | **N** | clock-time dead |
| 6 | Mosey saw a bird. That was the whole morning. | very short plain-truth | **O** | → "Mosey saw a bird. The day is looking up." Prefers the WARM upswing to the flat deadpan close. |
| 7 | You are on the couch. Mosey is on the couch. This is the correct arrangement. | warmth via STRUCTURE (tests E) | **O** | → "You are at the door. Mosey is at the door. The only way is through." Kept the parallel; pointed it at THE DOOR (app's emotional core). |
| 8 | Mosey met a much larger dog today. Mosey has invited it over. This was not Mosey's decision to make. | wildcard / social | **O** | → "Mosey met a friend today. The friend is in your house. Mosey blames the friend." Last beat = comic blame-shift (dog logic). |
| 9 | Mosey brought you a rock. Of all the rocks, this one. The best rock. | "best" framing RETEST | **N** | "best" framing FAILS when over-constructed ("Of all the X, this one. The best X."). It's not the word — it's not over-engineering it. |
| 10 | The Squirrel has crossed the fence line. This means war. It has always meant war. | Squirrel-drama, straight | **N** | Squirrel drama yes but must stay CRISP; "it has always meant war" is over-egged/portentous |
| 11 | Mosey heard thunder. [beat] Mosey has relocated to your lap. | afterthought RETEST | **O** | → "Mosey heard thunder. Mosey is very brave. [Mosey trembling]" Dropped the afterthought; converted to flat-claim + contradicting animation. |
| 12 | It rained all day. [Mosey at the window, making plans] | joy-juxtaposition, concrete cue | **O** | → "It rained all day. [Mosey trotting in circles]" "making plans" = inferred inner state (✗); "trotting in circles" = pure physical action (✓). |
| 13 | A leaf fell. Mosey conducted a full investigation. The leaf has been cleared of wrongdoing. | officialese narrator-worn | **N** | officialese rejected |
| 14 | You came home. Mosey has no other news. That was the news. | user-bond boundary | **N** | stated user-bond rejected (3rd time) |
| 15 | Mosey chased the ball. Mosey caught the ball. Mosey has decided to keep it forever. | short escalation + turn | **N** | turn was a generic gag ("forever"); turns must be genuinely surprising/true, not expected dog-jokes |

**Round 3 tally:** 0 yes, 7 no, 8 other.

## Findings by confidence (3 rounds of data)

### HIGH confidence (survived 3–5 tests — bankable, pending Natan's OK to edit the skill)
- **THE ENGINE: flat narrator claim + concrete animation cue that contradicts it.** He converts other shapes INTO this move again and again: `[tail wagging rapidly]` vs "wait patiently", `[party hat]` vs "ordinary walk", `[running in circles like a lunatic]` vs flat "Puddle is back", `[trembling]` vs "very brave", `[trotting in circles]` vs rainy day. This is the narrator's signature, and it's more central than the current skill implies.
- **CUE FORMAT = pure observable physical action.** trembling / trotting in circles / spinning / tail wagging / wearing a party hat. NEVER an inferred inner state: "making plans" ✗, "telling everyone" ✗, "reviewing the nothing" ✗, "considers this a win" ✗. Confirmed ~4×. This should become an explicit skill rule.
- **Officialese → DEMOTE.** Rejected every clean test across all 3 rounds. Only survives, crisply, as the Squirrel's own drama.
- **Declined-investigation → DEMOTE.** 0-for-4 ("no further information", "we are not asking", "details withheld", "not talking").
- **Stated user-bond sincerity → BANNED.** "knows you are home" ✗, "missed you" ✗, "has no other news" ✗. Love is shown through behavior/structure, never told. (But structure pointed at THE DOOR works — see below.)
- **Numbers/clock-times → cut** unless the number IS the joke.

### MEDIUM confidence (2 tests, consistent — keep testing)
- **Warm upswing over arch deadpan.** He keeps warming the ending: "The day is looking up", "Mosey is glad it is here"-shaped. The fondness is becoming LESS secret than the skill's "dry, secretly fond" says. **Directional — may shift the narrator's core identity, so wants Natan's explicit blessing.**
- **The DOOR is the emotional center.** He redirected a generic couch line to the door ("The only way is through"). The app's compassion-about-the-threshold belongs in the narrator.
- **Parallel "You [verb]. Mosey [verb]." structure works** (door, couch-kept-structure). Companionship via mirroring.
- **Last beat must TURN on something genuinely true/surprising** — not a generic gag. "was just checking" ✓, "Mosey blames the friend" ✓, "Mosey is not [done]" ✓; "keep it forever" ✗.
- **He keeps the setup, rewrites the last beat.** The craft lives in the landing.

### LOW / single data point
- Reported speech: rejected once.
- "best" framing: works light (sock, stick), fails over-constructed (rock).
- ⚠ **Pronouns still open.** R3 fixes used "Mosey" consistently (no "he"), so R2's "he/his" may have been casual slips. Re-raising once, then dropping it.

---

### ★ CRAFT PRINCIPLE — direct from Natan (authoritative, not inferred)

**The two-beat punchline is the core word-engine.** Sentence one sets up; sentence two delivers a twist, a funny truth, or honest endearing emphasis. That is the shape to reach for.

- **Stop over-using three-beat restatement.** Repeating the same idea several times ("The Puddle is back. The Puddle has been back before...") is usually boring — it wears the tone as a costume with no real point. Repetition is allowed ONLY when done tastefully, with a real point and a precise reason (e.g. genuine escalation where each beat adds new information).
- **Elaborate only when the extra clause is funnier.** Don't over-explain by default; a second/third clause has to earn its place by adding comedy, not just restating.
- **Every line needs a real point.** Stylistic tics are not a substitute for a joke or a true feeling landing.

This is now the top filter for writing lines. (Self-critique: Rounds 1–4 over-relied on the 3-beat restatement device — the Puddle, the Snail, the Tortoise, "the bench has been reached." Corrected below.)

### ★ CRAFT PRINCIPLE #2 — the documentarian is an INFLUENCE, not a costume (direct from Natan)

The narrator is documentarian-*ish*, but do NOT mimic David Attenborough / nature-doc narration on the nose ("here we observe the Mosey in its natural habitat..."). That register is a reference point to reach through *occasionally* when it produces a genuinely funny phrase — not the narrator's identity, and not a crutch.

- Use it sparingly, "some of the time," as one flavor among many (deadpan, wit, joy-cues, sincerity).
- The meteorology/forecast register-clash (L003) is fine as an *occasional* move — it works precisely because it's rare, not because the narrator lives there.
- If a line reads as "nature documentary about a dog," it's too on the nose. Pull it back toward plain observation with a Mosey-POV turn.

---

## Round 4 (WIDE — reshaped to the two-beat punchline principle)

Original Round 4 draft was revised before rating: three-beat restatements cut, lines sharpened toward setup → payoff. Still wide — door theme, residents (Crow, Snail, Tortoise), joy-juxt edges, warm upswing, one FINAL officialese nail, and one deliberately EARNED escalation (#14) to distinguish good 3-beat from boring restatement.

| # | Line | What it tests | Verdict | Note |
|---|------|---|---|---|
| 1 | The door is right there. Mosey is looking at you instead. | door center, endearing 2-beat | **O** | → "Mosey looks at the door. Mosey looks at you." PRESENT tense, tighter parallel, cut "instead"/"right there" — let the pivot do the work. |
| 2 | Nothing is happening. [Mosey vibrating] | joy-juxt, minimal cue | **N** | joy-at-NOTHING rejected (cf R1 #10). The cue needs a concrete TRIGGER, not a void. |
| 3 | The mail came. It was a coupon. Mosey accepted it as tribute. | setup → twist (mundane object) | **O** | → "The mail came. It was a flyer. [Mosey running around happily with the flyer]" Converted the verbal joy-punch into a physical CUE. |
| 4 | You sighed. Mosey sighed back. It seemed like the supportive thing to do. | parallel + empathy, warm 2-beat | **O** | → "You sighed. Mosey sighed. Mosey is very supportive." Shorter, flatter, DEADPAN punch beats the explanatory clause. |
| 5 | Mosey went to bark at the mailman. It is the only appointment Mosey keeps. | setup → funny truth + callback | **O** | → "Mosey is barking at the mailbox. [mailbox full of mail]" Use the CANON Mailbox (not generic mailman); present tense; show via cue. |
| 6 | The Crow left something shiny on the step. Gifts from the Crow are never free. | resident: Crow, setup → truth | **O** | → "...Mosey does not understand bribes." Route the punch through MOSEY's innocence, not narrator worldliness. |
| 7 | Something happened at the fence. The Squirrel is not available for comment. | officialese/declined-invest FINAL nail | **N** | declined-investigation DEAD — final nail, even as a clean 2-beat |
| 8 | It is Monday. Mosey is glad it is here. | warm upswing, tightest 2-beat | **O** | → "It is Monday. Mosey has no opinions about this." REVERSED my warmth to DRY DEADPAN. Unearned warmth is saccharine; deadpan is funnier. |
| 9 | The Snail set out this morning. It is expected to arrive in spring. | resident: Snail, setup → truth | **O** | → "The Snail has not arrived. Nor was he expected. As always." The Snail gag works compressed, landing on a dry running-gag tag ("As always"). |
| 10 | The leash is out. [Mosey spinning] | joy-juxt, minimal cue | **Y** | clean yes — concrete trigger (leash) + pure physical cue |
| 11 | The ball rolled under the couch. Mosey has decided to wait it out. | short, true turn | **N** | turn not surprising enough; flat |
| 12 | You made it outside. So did Mosey. That was the hard part. | door/arrival, endearing core | **N** | "that was the hard part" NAMES the user's difficulty — too therapeutic. Compassion stays structural ("the only way is through" ✓), never stated. |
| 13 | It was a gray day. Mosey went out in it anyway. | quiet 2-beat, floor of deadpan | **O** | → "It is a gray day. Mosey's ambitions are unaffected." PRESENT tense + a wittier register-clash punch ("ambitions"). |
| 14 | Mosey heard the treat bag. Mosey appeared. Mosey has been sitting politely for a while now. | EARNED 3-beat escalation | **N** | even "earned" 3-beat rejected — soft trailing 3rd beat, no real punch. Default to TWO beats. |
| 15 | The Tortoise sent a letter. It took a season to arrive, and was worth it. | resident: Tortoise, warm twist | **N** | "and was worth it" = unearned sentimental tag; also the Tortoise really belongs in the letters register, not narration |

**Round 4 tally:** 1 yes, 5 no, 9 other.

## Findings update after Round 4 (NEW + corrections)

### Promoted / newly HIGH confidence
- **PRESENT TENSE for live narration.** He converted past→present repeatedly (#1, #5, #13). Enforce it.
- **TWO ENGINES, chosen by payoff type:**
  - Payoff = Mosey's disproportionate JOY/emotion → **SHOW it with a physical animation cue** (flat line + `[cue]`). He converted verbal joy-punches into cues (#3, #5).
  - Payoff = WIT / a funny truth about the world → **TELL it as a verbal two-beat punchline** (#4, #6, #13).
  - This is the cleanest structural rule to give the skill.
- **Route punchlines through MOSEY's POV/innocence,** not narrator worldliness. "Mosey does not understand bribes" > "gifts are never free" (#6).
- **Use CANON objects** (the Mailbox + red flag, leash, door, Puddle) over generic stand-ins (mailman) (#5).
- **Declined-investigation → DEAD.** Final nail (#7). Same for officialese.

### CORRECTED
- **Warmth is NOT a default — it must be EARNED by a concrete trigger.** He reversed my warm "glad it is here" to dry "no opinions" (#8), and rejected joy-at-nothing (#2). Default stays DRY DEADPAN; warmth only when a concrete small thing triggers it (the bird → "the day is looking up"). Downgraded from the earlier "warm upswing" read.
- **The DOOR is emotional core, but never NAME the difficulty.** "that was the hard part" rejected (#12) as therapeutic; "the only way is through" (structural) still stands. Compassion in structure, never statement.
- **Three-beat → default NO.** Only survives very tight, landing on a real gag tag ("As always" #9). Soft trailing thirds rejected (#11, #14).

### Cue needs a concrete trigger (MEDIUM-HIGH)
Joy-juxt works with a real trigger + pure physical cue (#10 leash ✓); fails on a void (#2 "nothing is happening" ✗).

---

## Round 5 (CONFIRM the new findings, then draft the skill diff)

Present tense throughout. No dead shapes (officialese/declined-investigation retired). Confirms: the two-engine split, canon objects, Mosey-POV punchlines, earned-vs-unearned warmth, plus boundary tests (a number in a wit #3, a SHOWN homecoming #11) and wildcards.

| # | Line | What it tests | Verdict | Note |
|---|------|---|---|---|
| 1 | The Mailbox has raised its flag. Mosey treats this as a summons. | canon Mailbox+flag, Mosey-POV wit | **O** | → "...Nearby canines have taken note." Widened to the DOG-WORLD lens — the good, light use of documentarian influence. |
| 2 | You reach for your shoes. [Mosey already waiting at the door] | joy→cue, concrete trigger | **O** | → "You looked at your shoes. [Mosey panting and wagging tail]" Even smaller trigger (a glance); cue = visceral immediate body state. |
| 3 | The Cat stared at Mosey for a full minute. Mosey took it as a compliment. | Mosey-POV wit + number test | **O** | → "...Mosey is feeling like a celebrity." KEPT the number ("a full minute"); vivid specific self-image beats "compliment". Numbers CAN live when flavorful. |
| 4 | The first warm day is here. Mosey has forgiven winter. | EARNED warmth + wit | **O** | → "The first warm day is here. Owners go out on warm days. According to Mosey." NEW SHAPE: state a self-serving "fact," tag "According to Mosey" to reveal it's dog-logic. |
| 5 | The Puddle is enormous today. [Mosey heading straight for it] | canon Puddle, joy→cue | **N** | cue was an intention, not a vivid joy-state; flat |
| 6 | Mosey found a patch of sun. The rest of the day is cancelled. | deadpan wit | **N** | "the day is cancelled" = narrator quip, not Mosey-POV; try-too-hard |
| 7 | The Pigeon delivered a leaf and left immediately. Mosey is thrilled with the service. | canon Pigeon, Mosey-POV wit | **O** | → "The Pigeon delivered someone else's mail again. Mosey is okay with this." Canon-accurate (Pigeon = WRONG mail); dry "okay with this" > "thrilled". |
| 8 | You are putting on your coat. Mosey is supervising. | door-adjacent, dry | **N** | "supervising" is a stock dog-joke |
| 9 | The leash comes off the hook. [Mosey has already circled the room twice] | joy→cue | **N** | cue = narrated past count, not immediate physical state (cf L030 "spinning" ✓) |
| 10 | A truck goes by outside. Mosey has added it to the list. | dog-true, dry | **N** | "added it to the list" too oblique without setup |
| 11 | You are home. Mosey heard the car before it parked. | homecoming SHOWN (boundary) | **N** | homecoming/attunement weak even when shown; avoid the beat |
| 12 | It is raining. Mosey is deeply against it. | deadpan, Mosey-POV | **N** | "deeply against it" formulaic; "has no opinions" (L028) is the drier, better version |
| 13 | The Spider has not left the Mailbox. This is simply the arrangement now. | canon Spider, dry | **N** | flat; Spider needs a real POV/joke, not a summary |
| 14 | Mosey rolled in something. Mosey is proud. You are not. | Mosey/user contrast | **O** | → "Mosey is proud. Of rolling in something." FRAGMENT-TIMING: claim first, mundane cause revealed as a fragment after the period. |
| 15 | You reach the Good Bench. Mosey approves of the Good Bench. | canon Good Bench, dry-warm | **O** | → "...Mosey loves the Good Bench. There's always a friend waiting." Warmth + worldbuilding, EARNED by a concrete place with a concrete promise. |

**Round 5 tally:** 0 yes, 8 no, 7 other. (Confirmation round that mostly DIS-confirmed my guesses — the "don't narrow too soon" lesson, live.)

## Findings update after Round 5 (new shapes + the big meta-lesson)

### NEW shapes / engines discovered
- **Attributed-belief ("According to Mosey").** State a self-serving generalization as fact, then tag it to Mosey to reveal it's dog-logic/propaganda. "Owners go out on warm days. According to Mosey." / "It has been dinner time since three, according to Mosey."
- **The dog-world lens.** Occasionally widen from Mosey to all dogs ("nearby canines have taken note", "every dog on the block has a plan"). This is the GOOD, light use of the documentarian influence (Principle #2) — a dry species-truism, NOT nature-doc cosplay. (Note: referencing "canines"/"owners" as a joke ≠ replacing "Mosey" with a pronoun; the no-pronoun rule is about Mosey specifically.)
- **Fragment-for-timing.** Lead with the abstract claim, then reveal the mundane/gross cause as a sentence fragment after the period: "Mosey is proud. Of rolling in something."

### Sharpened rules
- **THE WELL is Mosey's specific felt experience, stated plainly — NOT the narrator's clever abstraction.** Winners: "feeling like a celebrity", "proud", "okay with this", panting/wagging. Losers (narrator quips): "the day is cancelled", "added it to the list", "supervising", "deeply against it". When a punch is narrator-cleverness *about* the situation rather than Mosey's disproportionate inner take, it fails.
- **Understatement wins the reaction beat.** "is okay with this" > "thrilled"; "has no opinions" > "deeply against it". Reach for the driest option.
- **Cue = immediate physical body state** (panting, wagging, spinning, trembling, sitting-so-fast), never a narrated past count ("has circled the room twice" ✗).
- **Warmth is EARNED by a concrete world-thing.** The Good Bench + "a friend waiting" works; vague "you are home" fails. Anchor fondness to a place/object/promise, never a free-floating feeling.
- **Numbers survive when flavorful/load-bearing** ("a full minute" kept). Refines "numbers die" → "numbers must add something".
- **Canon-accurate resident behavior** (the Pigeon delivers the WRONG mail, per the bible — not a leaf).
- **Homecoming/attunement beat is weak** even when shown — avoid it.

---

## Round 6 (confirm the 3 new shapes + fill thin inventory categories)

Tests: attributed-belief ×2, dog-world lens ×1, fragment-timing ×2. Fills gaps: mischief, sincere-anchored, mailbox, resident:spider, post-walk, weather-wonder. Present tense, Mosey's felt experience over narrator quips, driest-option reactions.

| # | Line | What it tests | Verdict | Note |
|---|------|---|---|---|
| 1 | The couch is a shared resource. According to Mosey. | attributed-belief (new), home-idle | **N** | attributed-belief RETEST fails — 1-for-3 now, unreliable |
| 2 | Mosey has an announcement. It is about a smell. | fragment-timing (new), wildcard | **O** | → "There is a mysterious smell today. Detectives have been notified." Wants a BIGGER absurd mock-serious swing. |
| 3 | A squirrel appears. Every dog on the block now has a plan. | dog-world lens (new), resident:squirrel | **N** | dog-world lens RETEST fails — 1-for-2, unreliable |
| 4 | You dropped a crumb. Mosey witnessed the whole thing. | Mosey-POV felt, dry | **N** | mild/expected; the POV take must be genuinely vivid or surprising, not just dry |
| 5 | Mosey found mud. Mosey brought most of it inside. | mischief, dog-true 2-beat | **O** | → "Mosey found mud. All over his body." FRAGMENT-timing reconfirms; prefers the gross-physical reveal. |
| 6 | It is late. The house is quiet. Mosey is where you are. | sincere, anchored location | **O** | → "It is late. Mosey is finally sleeping calmly. [mosey twitching his legs in the air having a dream]" Converted sincere→JOY-CUE; tenderness via IMAGE not statement. |
| 7 | The Mailbox flag is down. Mosey checks anyway. Twice. | mailbox + number-flavor | **N** | fragment "Twice." doesn't land; too minor |
| 8 | The Spider in the Mailbox has seen everything. The Spider is not impressed. | resident:spider POV | **N** | Spider weak subject — 0-for-2 |
| 9 | The treat jar opens. [Mosey sitting so fast it looks painful] | joy-cue, visceral body | **O** | → "Biscuit engaged. Target acquired and ready. Target leaking from the mouth. Target is making a mess." MOCK-SERIOUS military escalation w/ gross-physical detail. |
| 10 | It started to snow. Mosey does not know what this is. Mosey approves. | weather-wonder, dry | **N** | flat; 3-beat-ish |
| 11 | Outings today: one. Distance: modest. Mosey rated it highly. | post-walk field-report | **N** | field-report register doesn't work as a spawned narrator line |
| 12 | You said Mosey's name. Mosey arrived at full speed. | user-interaction, warm | **N** | flat |
| 13 | It has been dinner time since three o'clock. According to Mosey. | attributed-belief + number | **N** | attributed-belief fails again (2nd this round) |
| 14 | A leaf blew past. Mosey gave chase on principle. | on-walk, Mosey-logic dry | **N** | "on principle" = narrator cleverness, not vivid |
| 15 | You reached for the leash. Mosey has been ready since birth. | getting-out, warm hyperbole | **N** | cute but flat |

**Round 6 tally:** 0 yes, 11 no, 4 other. High rejection — the reconfirm round that corrected me.

## Findings update after Round 6 (major corrections)

### CORRECTED — my premature "new shapes" mostly failed to reconfirm
- **Attributed-belief ("According to Mosey") → DOWNGRADED to unreliable (1-for-3).** Keep the one approved instance (L035); do NOT treat it as a reliable, repeatable shape.
- **Dog-world lens → DOWNGRADED to unreliable (1-for-2).** Same. Occasional at best.
- Lesson: R5's single hits were flukes I over-weighted. Retesting caught it. This validates Natan's "retest several times before concluding" instruction — do not promote a shape on one hit.

### RESURRECTED — mock-serious register is ALIVE (I wrongly buried it)
- **MOCK-SERIOUS ESCALATION is a strong engine** when it's a COMMITTED frame (military, detective) that ESCALATES over beats, each adding vivid/gross physical comedy: "Detectives have been notified." / "Biscuit engaged. Target acquired... Target leaking from the mouth. Target is making a mess."
- The distinction from the DEAD officialese: dead = one lazy bureaucratic tag, no payoff ("no comment issued", "cleared of wrongdoing"). Alive = commitment + multi-beat escalation + vivid/gross physical specificity + real absurdity.
- This reconciles with the "3-beat restatement is boring" rule: escalation is fine — great, even — when each beat adds NEW vivid info; only pure restatement is boring.
- Inside a committed bit, Mosey may be renamed for the joke ("Target").

### CONFIRMED
- **Fragment-for-timing holds** (2nd approval: "Mosey found mud. All over his body."). Favors gross/physical reveals.
- **Joy-cue dominates even tender moments.** The sincere nighttime beat became flat-claim + contradicting dream-twitch animation. Tenderness lands through the concrete IMAGE, never a stated feeling.
- **The Mosey-POV bar is HIGH.** Mild dry observations fail ("witnessed the whole thing", "arrived at full speed", "gave chase on principle"). The POV take must be vivid or genuinely surprising.

### Weak subjects to avoid
- The Spider (0-for-2), post-walk/field-report register, homecoming/"you are home", warm-hyperbole one-liners.

---

## Round 7 (nail the mock-serious engine + fill sincere, raise the POV bar)

Heavy on committed mock-serious escalation across varied frames (sports, detective, clinical, forecast) to map where it works vs tips into lazy officialese. Plus fragment-timing confirms, sincere-via-image, and higher-bar Mosey-POV. Attributed-belief / dog-world lens retired (not featured).

| # | Line | What it tests | Verdict | Note |
|---|------|---|---|---|
| 1 | Mosey has spotted the ball. Mosey is making a move. The ball is under the couch now. | mock-serious sports escalation → deflate | **N** | long mock escalation fails |
| 2 | A sock has gone missing. The prime suspect is asleep. The prime suspect is lying on the sock. | mock-detective escalation → physical reveal | **N** | long mock escalation fails |
| 3 | Mosey has sustained a great injury. The injury is a bath. | mock-clinical, 2-beat | **O** | → "A great misfortune has befallen Mosey. Bath time." Mock-grand SETUP → deflating FRAGMENT. Tight beats the long version. |
| 4 | Conditions are ideal. Sun located. Mosey has claimed the sunbeam and will not be relieved. | mock-forecast escalation | **N** | long mock escalation fails |
| 5 | Mosey brought you a gift. It is wet. | fragment-timing confirm | **Y** | clean yes |
| 6 | Mosey has made a decision. It is the couch. | fragment-timing confirm | **Y** | clean yes |
| 7 | You put your hand down. Mosey put a paw on it. Neither of you moved for a while. | sincere via concrete action | **N** | sincere fails again |
| 8 | The lights are off. Mosey found your side of the bed first. [Mosey already asleep] | sincere image + cue | **N** | sincere fails again |
| 9 | You opened the fridge. Mosey now lives here. | Mosey-POV, vivid (high bar) | **N** | rejected |
| 10 | A stranger said Mosey was cute. Mosey knew. | Mosey-POV ego, tight | **N** | abstract; "feeling like a celebrity" (vivid) worked, "Mosey knew" (abstract) doesn't |
| 11 | The doorbell rang. [Mosey achieving liftoff] | joy-cue, hyperbolic body | **N** | "achieving liftoff" is FIGURATIVE — cues must be LITERAL physical action |
| 12 | The Squirrel used the good tree today. This will be addressed. | Squirrel drama, crisp dry threat | **N** | terse threat weak; Squirrel wants paranoid dog-LOGIC (see Natan's line below) |
| 13 | Your keys made a sound. Mosey is at the door. You have not decided to go anywhere yet. | getting-out, dry anticipation | **N** | "you do X → Mosey anticipates" structure keeps dying (cf R2 #1/#8) |
| 14 | Mosey found something dead. Mosey wore it like a prize. | mischief, gross dog-true | **N** | rejected |
| 15 | The Crow is back with another gift. Mosey checks it for tracking devices. | resident:crow, suspicion | **N** | rejected |

**Round 7 tally:** 2 yes, 12 no, 1 other.

### ★ Natan's own lines (author-authored = canonical; added to inventory)
- "Mosey is practicing his meowing for no particular reason. [after seeing the cat]" — NEW micro-move: **"for no particular reason"** = deadpan disavowal of an obvious cause, with the cause in brackets. (Also: "his" for Mosey — pronoun question, see below.)
- "Mosey has not seen the squirrel in 4 days. Mosey does not remember making a truce. The enemy must be scheming." — the Squirrel war as **paranoid dog-logic escalation**, played straight; number ("4 days") survives.

## Findings update after Round 7 (consolidation)

- **THE SPINE is now clear: SETUP → DEFLATING SHORT REVEAL (usually a fragment).** Most reliable engine we have. The setup can be plain ("Mosey brought you a gift.") or mock-grand ("A great misfortune has befallen Mosey."); the payoff is a terse deflation ("It is wet." / "Bath time."). `fragment-for-timing` and the working half of `mock-serious` are the same move.
- **Mock-serious: TIGHT (2-beat + fragment) works; LONG escalation fails.** R6's "Biscuit engaged" 4-beat was the exception, not the rule — all three long mock-escalations this round died. Default to the tight deflation.
- **Cues must be LITERAL physical action.** "achieving liftoff" (figurative) rejected; spinning/trembling/panting/vibrating (literal) approved.
- **Sincere is genuinely hard and rare — stop manufacturing it.** 0-for-4 across attempts (stated, shown, image, action). Matches the bible: sincerity is a 3–4×/year event, not a spawnable everyday category. Park it.
- **Anticipation-at-the-door ("you do X → Mosey already did Y") is dead** — confirmed a 3rd time.
- **The Squirrel wants paranoid dog-logic** (Natan's line), not terse threats.
- **Mosey-POV needs a VIVID specific, not an abstract claim** — "feeling like a celebrity" ✓ vs "Mosey knew" ✗.

---

## Round 8 (lean into the proven spine + Natan's new moves)

Weighted to setup→deflation (the reliable spine), Natan's "for no particular reason" and Squirrel-paranoia moves, literal joy-cues, and mock-grand→fragment. Dead structures retired. All lines pronoun-free pending the pronoun decision.

| # | Line | What it tests | Verdict | Note |
|---|------|---|---|---|
| 1 | Mosey has an opinion about the mailman. It is not a kind one. | setup → deflation | **N** | generic deflation, no specific joke |
| 2 | Mosey has claimed a spot on the couch. It is your spot. | setup → deflation | **N** | expected reveal |
| 3 | Mosey prepared a surprise today. It is a hole. | setup → deflation (fragment) | **N** | "a hole" not surprising |
| 4 | An intruder has breached the perimeter. It is the vacuum. | mock-grand → deflation | **N** | vacuum reveal is expected |
| 5 | Mosey has entered a state of high alert. A leaf moved. | mock-grand → deflation | **N** | |
| 6 | Grave news from the yard. The Squirrel is back. | mock-grand → deflation | **N** | |
| 7 | Mosey is sitting by the fridge for no particular reason. [it is dinner time] | Natan "for-no-reason" move | **N** | even the borrowed move failed — proves the move alone isn't the magic |
| 8 | Mosey started digging by the front door for no reason at all. [the leash is out] | Natan "for-no-reason" move | **N** | |
| 9 | The Squirrel waved today. Mosey does not trust a waving Squirrel. Something is being planned. | Squirrel paranoia escalation | **N** | thinner than Natan's own (L044) |
| 10 | Mosey watched the Cat all afternoon. The meowing practice has resumed. | resident:cat, callback | **N** | leaned on the callback instead of a fresh joke |
| 11 | The treat bag crinkled. [Mosey sits, stares, vibrates] | joy-cue, literal trio | **N** | |
| 12 | You picked up the ball. [Mosey frozen, entire body aimed at it] | joy-cue, literal | **N** | |
| 13 | Mosey barked at the reflection in the window. The reflection started it. | verbal-wit, blame-shift | **N** | reused blame-shift device (cf L020) — felt recycled |
| 14 | Mosey came back from the walk victorious. And covered in something. | mock-grand + gross fragment | **N** | |
| 15 | Mosey has been guarding the window for an hour. The threat is a pigeon. | mock-grand → deflation + number | **N** | |

**Round 8 tally: 0 yes, 15 no, 0 other. TOTAL WIPEOUT.** Not one line even worth rewriting.

## ★★ Round 8 post-mortem — the biggest lesson so far

Round 8 was written entirely from the "consolidated findings," and it failed completely. Diagnosis:

- **I turned an insight into a FORMULA and mass-produced it.** 8 of 15 were "[setup]. It is [X]." I pattern-matched the SHAPE of the winning lines without reproducing the PAYOFF. The shape is a vessel; it is not the joke.
- **No line had a genuinely surprising/funny/true specific payoff.** "It is a hole." / "It is the vacuum." / "The threat is a pigeon." — each is the *shape* of a deflation but the reveal is flat and expected. The approved deflations worked because the reveal was specifically funny or gross or true ("It is wet." "Bath time."), not because of the structure.
- **The batch was monotone** — 15 lines in ~2 shapes. This is precisely what Natan warned against in his craft note ("too repetitive and boring... stylistically repetitive for the tone is not good without a real point"). I failed to apply his own principle.
- **Borrowed moves failed too** (#7/#8 "for no reason", #9 Squirrel paranoia, #10 Cat callback). Proves the MOVES aren't magic — Natan's versions (L043/L044) work because of a specific, surprising core observation, not the template.

**The correction (candidate rule #1 for the skill):** The payoff is the point; the shape is only a container. Before writing any line, name what is *specifically* funny/true/endearing about it. If that can't be named — or it's the same joke a prior line already made — cut it. Never mass-apply one shape; a batch must vary. This also means the skill must NOT be written as "use these shapes" — it must be "here is the bar for a payoff; here are containers it can travel in."

→ Diagnosis confirmed by Natan (all three: formula / samey / bar too low) — AND he named the missing layer. See Principle #3.

### ★★★ CRAFT PRINCIPLE #3 — the missing layer: DEPTH / microcosm (direct from Natan, most important note in the project)

The lines were failing because they were *only* jokes about dog behavior. The voice's real engine is **the mundane opening onto something larger**. A dumb little dog-life thing should quietly relate to a big, relatable human topic — discovered almost by accident, never named.

- **Mosey is introspective and philosophical at times, almost by accident.** Not wise — a dog — but the everyday moment lands on a real thought and then usually gets punctured by dog-nature.
- **Tonal target: Calvin & Hobbes** and comic strips that are secretly about life at large. Stay concrete (snowball, wagon, a leaf); let the resonance emerge. **NEVER name the big theme** — on-the-nose kills it ("patience is a virtue" = death).
- Go **weirder and broader** than safe dog-jokes. The everyday occurrence is a microcosm for a larger topic.

### ★★★ Character-as-theme map (from Natan — canon; belongs in the bible + skill)

Each resident is a lens on a larger life theme. Write them as themes, not gags.

| Resident | Behavior | The larger topic it's really about |
|----------|----------|-----------------------------------|
| **The Squirrel** | The nemesis; appears and vanishes | Battles, tactics, strategy, patience in waiting, the rivalries that keep us sharp; the private wars we wage |
| **The Cat** | Says nothing, indifferent to Mosey; Mosey adores it, in awe like a celebrity | Unrequited admiration; idolizing the aloof; how little the adored must give; devotion without an audience |
| **The Crow** | Devious, thieving, up to no good; Mosey doesn't grasp the bad intent and happily goes along; **the USER has to quietly clean up the Crow's shenanigans on Mosey's behalf** | Innocence vs. bad actors; loving someone who gets you into trouble; the protector role; naivety |
| **The Snail** | Minimal, extremely slow; delivers larger-than-life insights learned on the journey | Wisdom, the long view, slowness as intention, presence over arrival; philosophy delivered plainly |
| **The Pigeon** | Says nothing; eager to hand over whatever mail it has; very proud; always certain it found the right person | Misplaced confidence; earnest pride in a job done wrong; certainty vs. correctness; the peace of the oblivious |

**How to use:** pick a resident-theme, render a concrete small moment, let the larger topic hum underneath. The Crow lines specifically can involve the user correcting/cleaning up after naive Mosey.

---

## Round 9 (the pivot — depth, weirder & broader, one theme per line, shapes varied)

Every line: a concrete dumb dog moment that quietly opens onto a bigger topic, using the character-theme lenses + Mosey's accidental philosophy. No two the same shape. Nothing names its theme.

| # | Line | Theme / lens (NOT stated in line) | Verdict | Note |
|---|------|-----------------------------------|---------|------|
| 1 | The Snail visited today. It is going nowhere, slowly, on purpose. Mosey finds this unbearable. | Snail — presence vs urgency | **Y** | clean yes — theme implied, Mosey's impatience carries it |
| 2 | The Cat acknowledged Mosey today. Briefly. By accident. Mosey will be living off this for weeks. | Cat — adoring the indifferent | **N** | |
| 3 | The Crow brought Mosey a present. It belongs to the neighbors. [+ explanatory tail] | Crow — innocence + protector | **O** | → "...It belongs to the neighbors. Mosey does not know this." CUT the spelled-out tail; imply the user-cleanup and Mosey's innocence. |
| 4 | The Pigeon delivered a bank statement to Mosey. It is not Mosey's. The Pigeon is glowing... | Pigeon — pride without correctness | **N** | |
| 5 | The Squirrel has not appeared in days... Mosey's long game is to keep looking at the fence. | Squirrel — rivalry, patience | **N** | over-explained |
| 6 | The leaves are coming down again... For Mosey this is simply the year the leaves ended, and Mosey is okay. | mortality/acceptance | **N** | over-explained — "the year the leaves ended" NAMES the theme; on-the-nose |
| 7 | Mosey buried a treasure this morning and forgot by noon. Somewhere, a future Mosey will be very surprised. | time, the self | **O** | → "Mosey buried a treasure this morning and forgot by noon." CUT the tail entirely; the bare fact implies everything. |
| 8 | Mosey saw another dog inside the television... Neither, if we are honest, do we. | where the images go | **N** | "neither do we" explicitly widens to humans — on-the-nose |
| 9 | Mosey and the Squirrel have reached a standoff. Only Mosey knows about it. | the private wars | **O** | → "...The Squirrel does not know about this." Sharpen to the character's obliviousness. |
| 10 | Mosey left the Cat an offering by the fence. The Cat did not come. Mosey waits, certain the Cat is simply busy. | faith of the devotee | **N** | |
| 11 | Neither of you wanted to go out today... best decision either of you makes most days. | showing up | **N** | over-explained warmth |
| 12 | The Pigeon has retired for the night, certain every letter reached the right hands. The Pigeon is wrong. The Pigeon sleeps wonderfully. | ignorance as peace | **O** | → "The Pigeon has successfully delivered the mail. To someone." Tight; "To someone." implies the wrong-recipient truth. |
| 13 | Mosey met a dog in the Puddle today. It copied everything Mosey did. Mosey has decided this dog is a genius. | the reflection | **O** | → "...It copied everything Mosey did." CUT the "genius" tail; the reader infers it's Mosey's reflection and that Mosey doesn't know. |
| 14 | The Snail says the trick is to want less ground... They remain friends. | desire, coexistence | **N** | "the trick is to want less ground" states the lesson — on-the-nose |
| 15 | Mosey stared out the window... There is not always a difference. | inner life | **N** | explicit philosophical punch — on-the-nose |

**Round 9 tally:** 1 yes, 8 no, 6 other. Big recovery from the wipeout — the DEPTH approach works, but only with the refinement below.

### ★★★ CRAFT PRINCIPLE #4 — imply the reality; do NOT over-explain (direct from Natan; the key that makes #3 work)

> "I like the approach of implying a reality that Mosey is misunderstanding. That is a very key insight. The narrator does not always have to over-explain it. Allow the person to read between the lines to figure out the real meaning."

The depth comes from **implication, not statement.** The narrator reports the concrete facts deadpan and STOPS. It never names the theme, states the lesson, or widens to "us/we/humans." The reader does that work.

- Every one of Natan's R9 rewrites did ONE thing: **cut the explanatory/resonance-naming tail.** "It belongs to the neighbors." (stop). "...forgot by noon." (stop). "It copied everything Mosey did." (stop).
- On-the-nose kills it: "the year the leaves ended" ✗, "neither do we" ✗, "the trick is to want less ground" ✗, "there is not always a difference" ✗. All rejected.
- **The winning engine: DRAMATIC IRONY.** State facts that reveal a reality a character MISUNDERSTANDS — Mosey misreads a snub as honor, the Crow's theft as friendship, a reflection as a genius; the Squirrel/Pigeon oblivious to their own situation. The gap between what the character believes and what the reader sees IS the joke and the depth. Structures: "[fact]. [Character] does not know this." / "...does not know about this." / a terse fragment that implies the truth ("To someone.").
- Trust the reader. The bare fact is stronger than the fact plus its explanation.

---

## Round 10 (dramatic irony / implication — depth by what's left unsaid)

Every line implies a reality a character misunderstands and STOPS — no stated themes, no "we/us", no lessons. Character-theme lenses, weird & broad, shapes varied.

| # | Line | Implied reality (NOT stated) | Verdict | Note |
|---|------|------------------------------|---------|------|
| 1 | The Cat allowed Mosey to sit nearby today. The Cat was asleep. | Mosey treasures a non-event | **O** | → "...[The Cat asleep while Mosey is panting happily right beside it]" SHOW the irony in the animation cue, don't tell it. |
| 2 | The Crow and Mosey have a system now. Mosey is not aware of the system. | the Crow using naive Mosey | **N** | "not aware of the system" baldly STATES the irony |
| 3 | The Pigeon delivered a letter addressed to "Resident." The Pigeon chose Mosey personally. | Pigeon false pride | **N** | flat |
| 4 | The Squirrel buried something... guarding the other end of the yard all day. | useless vigilance | **N** | explains the uselessness |
| 5 | The Snail has been crossing the patio since Tuesday. Mosey checks on the progress hourly. | disproportionate investment | **N** | |
| 6 | There is a dog in the oven door. Mosey has made peace with it. They keep a respectful distance. | reflection; imagined truce | **N** | |
| 7 | The leaves are gone... Mosey assumes they had their reasons. | seasons misread | **N** | "assumes they had their reasons" is a soft tell |
| 8 | You told Mosey about your day. Mosey understood none of it. Mosey stayed for all of it. | devotion beyond comprehension | **O** | → "You told Mosey about your day. Nothing was understood. Enthusiastically." TIGHTER; fragment-adverb punch; passive voice for variety. |
| 9 | The Cat walked past without looking. Mosey considers this a great honor. | snub misread as honor | **O** | → "The Cat walked past without looking. Mosey looked ~~away too~~." STRIKETHROUGH — Mosey tries to play it cool, can't. Reveals true feeling under the pose. |
| 10 | The Crow left Mosey a watch. It is still ticking. Someone is missing a watch. | theft | **N** | |
| 11 | Mosey has been waiting by the oven... Mosey believes in the oven. | faith vs evidence | **N** | "believes in the oven" states the theme |
| 12 | The Squirrel appeared, then vanished... It was not a message. | need for meaning | **N** | "It was not a message" explains/negates — a tell |
| 13 | Mosey barked at the moon until it went away... It works most nights. | false causation | **O** | → "Mosey is barking at the moon until it goes away. It can take a long time but Mosey does not mind." Present tense; WARM patience angle over the cynical causation gag. |
| 14 | The Pigeon waited to watch Mosey receive the mail. The mail was a receipt. The Pigeon has never been prouder. | pride exceeds deed | **N** | |
| 15 | Mosey found the same stick as yesterday. Mosey does not remember yesterday. It is, once again, the best stick. | eternal present | **N** | "does not remember yesterday" spells out the mechanism |

**Round 10 tally:** 0 yes, 11 no, 4 other. (Regressed from R9 — I over-formulaized the irony into "stated not-knowing.")

### Findings update after Round 10 — HOW to land dramatic irony (the R9 insight, refined)

The approach is right; my execution turned it into a template that STATES the misunderstanding ("not aware," "believes in," "it was not a message," "does not remember"). Bald statement of the irony = a tell = over-explaining. The fixes show the better ways to LAND it:

- **SHOW the irony in the animation cue** when you can — "[The Cat asleep while Mosey is panting happily right beside it]". Dramatic-irony + joy-cue combined; the image does it. (R10#1)
- **Fragment-adverb punch** — "Nothing was understood. Enthusiastically." A single adverb-fragment lands the gap. (R10#8) Passive voice / dropping "Mosey" is fine for variety.
- **Strikethrough for pose-vs-truth** — "Mosey looked ~~away too~~." Mosey attempts the Cat's cool and fails; the strike reveals the real feeling. The typewriter mechanic, under-used, ideal for this. (R10#9)
- **Warm patience over cynical gag** — "It can take a long time but Mosey does not mind." (R10#13)
- **DON'T** bald-state "X does not know / it was not / believes in" — show the behavior and stop, or land it with a device above. (Caveat: R9's "Mosey does not know this" worked as a clean FINAL beat after a concrete gift — so "does not know" isn't banned, but leaning on it as a template is.)

---

## Round 11 (land the irony with DEVICES, not a template — max variety)

Dramatic irony landed through varied craft: SHOW-in-cue, strikethrough, fragment-adverb, warm patience, afterthought, and pure show-and-stop. No two the same. Nothing states the theme or the not-knowing.

| # | Line | Device / lens | Verdict | Note |
|---|------|---------------|---------|------|
| 1 | The Squirrel appeared at the fence. Mosey remained ~~calm~~. | strikethrough — pose vs truth | **N** | |
| 2 | The Cat sat in the sun. [Mosey lying nearby, thrilled, being completely ignored] | show-in-cue (Cat) | **N** | |
| 3 | The Crow dropped off today's delivery. [Mosey proudly guarding a stolen garden gnome] | show-in-cue (Crow theft) | **O** | → "The Crow delivered a present. [Mosey proudly guarding a stolen garden gnome]" Tightened the text; the visual gag stays. |
| 4 | You explained the plan to Mosey. Mosey agreed. Immediately. Without listening. | fragment-adverb | **N** | |
| 5 | The Pigeon delivered the mail. Proudly. Incorrectly. | fragment-adverb (Pigeon) | **N** | |
| 6 | Mosey waits by the door around the time you come home. Mosey is usually early by several hours. | warm patience | **O** | → "Mosey was waiting for you. Like this. For hours. [Mosey panting eagerly]" TEXT POINTS AT THE ANIMATION ("Like this.") + fragment ("For hours.") + cue. |
| 7 | The Snail has not moved much since morning. Mosey has decided to wait with the Snail. | companionship (Snail) | **N** | |
| 8 | The Cat yawned in Mosey's direction. Mosey has not stopped talking about it. | show-and-stop (Cat) | **N** | text-only, no strong visual |
| 9 | The Crow admired Mosey's new collar. The collar is gone now. | implied theft (Crow) | **N** | text-only |
| 10 | Mosey guards the house from the mailman daily. The mailman has a schedule. So does Mosey. | parallel | **N** | |
| 11 | Mosey checks the bath drain sometimes, in case it needs anything. | weird — animism | **N** | also violates setting rule (bath) |
| 12 | It snowed for the first time... Mosey forgives it. | weird/broad | **N** | |
| 13 | Mosey is very brave about thunder now. [beat] It has not thundered in months. | afterthought | **N** | |
| 14 | You packed a suitcase. Mosey packed a toy in it. | show-and-stop (heavy) | **N** | |
| 15 | The Squirrel is back. Mosey has missed the Squirrel terribly. | enemy as companionship | **N** | |

**Round 11 tally:** 0 yes, 13 no, 2 other. Both survivors lean on a STRONG animation gag (gnome; panting eagerly); the text-only implication lines mostly died — evidence the voice is going animation-forward.

### Findings — the strongest device so far: TEXT POINTS AT THE ANIMATION
- R11#6 → "Mosey was waiting for you. Like this. For hours. [Mosey panting eagerly]" — the narrator gestures directly at the drawing ("Like this."), then a fragment lands the disproportion ("For hours."). Text and animation interlock; neither works alone.
- R11#3 confirms: a strong, funny, contrasting VISUAL + tight text beats clever text-only implication. Text-only lines (#8, #9, #10, #15) mostly failed.
- Direction: build lines animation-first. The bracket is not decoration; it's half the joke (often more than half).

(Round 12 — the fully animation-designed round — is below and still PENDING Natan's rating.)

### ★★★ CRAFT PRINCIPLE #5 — text is paired with an ANIMATION; setting is constrained (direct from Natan)

- **Every line is paired with an animation.** Write text + drawing, not text alone. The relationship is a tool: **deadpan** (drawing matches) or **outrageous contrast** (drawing contradicts/oversells — "Mosey is very brave" + [Mosey trembling]).
- **Brackets `[ ]` = animation stage directions** (show-don't-tell). Describe what Mosey/characters DO on screen so the drawing fills the gap or lands the contrast. Design this relationship deliberately. Cues stay LITERAL physical action.
- **Setting limited to the living room + the window** (plus the door, and outside via window/walks). NO house-specific objects the app can't draw — no oven, fridge, bath/drain, bedroom. (See memory: mosey-narrator-production.)
- **Give each character more RANGE** — try multiple modes per resident (the Squirrel as taunting winner AND as paranoid absence; the Cat imitated AND worshiped; etc.) to find which modes land.

---

## Round 12 (range per character + deliberate text↔animation pairing; living room / window only)

Two modes per resident to map range. Every line designed as text + [stage direction], marked deadpan (D) or contrast (C).

| # | Line + [stage direction] | Character / mode · D/C | Verdict | Note |
|---|--------------------------|------------------------|---------|------|
| 1 | The Squirrel is on the fence again, gloating. [Mosey pressed flat against the window, silently losing] | Squirrel: taunting winner · C | **N** | window-tableau Squirrel doesn't land |
| 2 | Mosey has been practicing looking unbothered. [Mosey copying the Cat's still posture at the window, tail wagging uncontrollably] | Cat: imitation · C | **Y** | clean yes — Cat's winning mode |
| 3 | The Crow left another gift on the windowsill. [Mosey beaming beside a single diamond earring] | Crow: proud of stolen gift · C | **Y** | clean yes — Crow's winning mode |
| 4 | The Snail is crossing the window ledge... [Mosey lying down to watch the entire crossing] | Snail: patient companionship · D | **N** | passive companionship flat |
| 5 | The Pigeon has made an important delivery. [Mosey holding a soggy parking ticket like a medal; the Pigeon saluting] | Pigeon: proud wrong delivery · C | **N** | over-staged (two-part animation) |
| 6 | Outside the window, nothing is happening yet. Mosey is ready for when it does. [Mosey statue-still...] | Mosey: readiness · D | **O** | → "Nothing is happening outside. The anticipation is brutal. [Mosey statue-still, staring out the window]" Wry DRAMA of nothing beats flat readiness. |
| 7 | You sat down. So did Mosey. [Mosey leaning full body weight against your leg] | user bond · D | **N** | sweet/quiet, no joke |
| 8 | The Squirrel has not appeared in three days. [Mosey holding position at the window, refusing to blink] | Squirrel: paranoid vigilance · C | **N** | window-tableau again |
| 9 | The Cat blinked at Mosey today. [Mosey turning to you, overwhelmed, as if something enormous has happened] | Cat: treasured crumb · C | **N** | "as if...enormous" is a tell; worship-mode weaker than imitation-mode |
| 10 | The Crow has come to check on its investment. [Mosey wagging; you quietly returning the neighbor's spoon...] | Crow: user cleanup · C | **N** | over-staged; user-cleanup mode weaker than stolen-loot mode |
| 11 | A truck passed by the window. [Mosey looking from the window to you and back, urgently, repeatedly] | Mosey: disproportion · C | **N** | |
| 12 | The cushion did not survive the afternoon. [Mosey sitting in the wreckage, calm, one feather stuck to the nose] | mischief · C | **N** | |
| 13 | The Snail stopped to spend time with a puddle. [Mosey trying to appreciate... before losing interest] | Snail: presence · D→C | **N** | |
| 14 | The Pigeon delivered a leaf and stamped it RECEIVED. [the Pigeon at attention; Mosey saluting back] | Pigeon: ritual · D | **O** | → "The Pigeon is proud to have found the correct recipient once again." DROPPED the animation — Pigeon lands as clean TEXT irony ("correct... once again" implies always wrong). |
| 15 | It is raining. Mosey is watching every drop come down, personally. [Mosey's eyes tracking a drop down the glass] | Mosey: attention · D | **N** | sweet/quiet, no joke |

**Round 12 tally:** 2 yes, 11 no, 2 other.

### ★ Character-mode map (which register each resident wants — from R12 + prior)
- **Cat → Mosey IMITATING/competing with the Cat's cool, and failing** (the wagging tail betrays the pose). ✓ #2, L056, L034. The "narrate Mosey's worship of a tiny gesture" mode is weaker (#9 ✗).
- **Crow → Mosey proudly displaying obviously-STOLEN loot** (the object implies the theft). ✓ #3, L058. The user-cleanup mode is weaker/over-staged (#10 ✗).
- **Squirrel → paranoid internal dog-LOGIC, verbalized** (L044, L051), or crisp war-drama (L010). Window standoff tableaus fail (#1, #8 ✗).
- **Snail → Mosey's IMPATIENCE with the slowness** ("finds this unbearable", L048). Passive companionship / presence-lessons fail (#4, #13 ✗).
- **Pigeon → terse TEXT irony about misplaced certainty** ("correct recipient... once again"; "To someone.", L052). Elaborate salute animations fail (#5, #14-orig ✗).
- **Mosey solo → dry, disproportionate DRAMA** ("the anticipation is brutal"). Sweet/quiet fails every time (#7, #15 ✗).

### Findings
- **Comedic contrast/disproportion beats sweet-and-quiet, always.** Tender lines keep dying; the wry, overstated-stakes register wins.
- **Keep animations SIMPLE** (one clear physical image) — two-part stage directions failed (#5, #10). Some of the best lines have NO animation and win on text irony (#14).
- Bracket tells creep in ("as if something enormous has happened") — keep cues literal.

---

## Round 13 (exploit the winning modes; wry-drama register; simple or no animation)

Only the winning mode per character. Comedic contrast over sweet. Animations simple; several text-only.

| # | Line + [stage direction] | Character / mode | Verdict | Note |
|---|--------------------------|------------------|---------|------|
| 1 | Mosey attempted the Cat's disdain today. [Mosey holding a dignified pose, tail wagging] | Cat: imitation | **N** | text flat; animation carries too much alone |
| 2 | Mosey is ignoring the treat, the way the Cat ignores things. [Mosey vibrating, staring at the treat] | Cat: imitation | **O** | → "Mosey is being as cool as The Cat today. A biscuit would ruin everything." SPECIFIC concrete thing ("a biscuit") whose consequence is implied. No animation. |
| 3 | Another gift has arrived from the Crow. [Mosey guarding a car key to a very nice car] | Crow: stolen loot | **N** | generic vs L058/L061 |
| 4 | The Crow has outdone itself. [Mosey proudly presenting a single designer shoe] | Crow: stolen loot | **N** | samey with #3 |
| 5 | The Squirrel did not appear today. Mosey has concluded the Squirrel is afraid. The Squirrel is asleep. | Squirrel: paranoid irony | **N** | the "concluded X / reality Y" template is worn out |
| 6 | The Squirrel looked at Mosey once and left. Mosey has been analyzing it all afternoon. | Squirrel: obsession | **N** | generic |
| 7 | The Snail is back, and slower than last time. Mosey respects the commitment. Mosey cannot watch. | Snail: impatience | **N** | |
| 8 | The Snail has a story about the journey. Mosey has aged during the telling. | Snail: impatience | **N** | samey with #7 |
| 9 | The Pigeon delivered a jury summons to Mosey. The Pigeon is certain it did the right thing. | Pigeon: certainty | **N** | "is certain it did the right thing" STATES it (tell) |
| 10 | The Pigeon has retired for the day, confident. The recipients would disagree, if asked. | Pigeon: certainty | **N** | samey with #9 |
| 11 | A leaf landed on the window. Mosey has been assigned to it. [Mosey nose-to-glass] | Mosey: duty | **N** | |
| 12 | Something could happen at any moment... Mosey remains on duty. [Mosey vigilant at an empty window] | Mosey: wry waiting | **N** | retread of L062 |
| 13 | The mailman is approaching. This is the most important event of the week. [Mosey scrambling] | Mosey: disproportion | **N** | |
| 14 | Mosey met a much bigger dog today. Mosey has decided they are the same size. [Mosey standing as tall as possible] | Mosey: ego | **N** | |
| 15 | Mosey watched the sun go down and did not panic. Mosey assumes it was handled. | Mosey: cosmic trust | **N** | |

**Round 13 tally: 0 yes, 14 no, 1 other. Near-wipeout — SAME failure mode as R8.**

### ★★ Recurring failure: I systematize → samey pairs of GENERIC lines. The bar is SPECIFICITY.
- Paired 2 lines per character → the batch reads repetitive (Natan's oldest warning).
- My jokes are abstract/stated; the winners are concrete/implied. "A biscuit would ruin everything" (specific object + implied collapse) vs my "ignoring the treat, the way the Cat ignores things" (abstract, explained).
- **NEW device — the precarious pose:** state Mosey's aspirational cool + name the SPECIFIC tiny thing that would shatter it ("A biscuit would ruin everything"). Don't show the collapse; imply it.
- The corrective for Round 14: every line a DISTINCT idea (no two per character, no two shapes), each anchored to a SPECIFIC concrete detail, meaning IMPLIED not stated, text-first (animation only for a strong visual gag). Quality over coverage.

---

## Round 14 (specificity + freshness; every line a distinct idea; text-first)

No repeated character/shape. Each hangs on one concrete specific detail; meaning implied. Dry.

| # | Line + [stage direction] | Idea / lens | Verdict | Note |
|---|--------------------------|-------------|---------|------|
| 1 | The Crow brought Mosey a wristwatch. It is still set to another time zone. | Crow: loot from a traveler | **O** | → cut "still": "It is set to another time zone." Near-approval; clean object→implied-fact. |
| 2 | The Squirrel buried something and glanced around. Mosey saw everything. Mosey will be first on the scene. | Squirrel: surveillance | **O** | → "...Operation excavate: engaged. Step one: heavy breathing. [Mosey panting with excitement]" MOCK-OPERATION with steps + animation. |
| 3 | The Snail has crossed half the doormat since breakfast. Mosey has checked forty times. | Snail: impatience | **N** | |
| 4 | The Pigeon delivered a parking fine to Mosey and waited for thanks. | Pigeon: proud wrong delivery | **O** | → "The Pigeon delivered a parking fine to Mosey. [Mosey dancing with parking fine]" Cut the pride-tell; SHOW disproportionate joy in the animation. |
| 5 | A single bird landed on the railing. Mosey has cleared the afternoon. | wry disproportion | **N** | narrator abstraction |
| 6 | Mosey hid a treat inside the couch for safekeeping. The couch is now under suspicion. | dog-logic | **N** | narrator abstraction |
| 7 | The neighbors are gardening. Mosey supervises from the window. | imagined role | **N** | |
| 8 | You left for eight minutes. Mosey has prepared a reunion. | disproportion | **N** | |
| 9 | Mosey has taken a sock that smells like you. Mosey is holding it hostage. | love as theft | **N** | abstraction ("hostage") |
| 10 | The red flag on the mailbox is up. Mosey takes this personally. | mailbox | **N** | abstraction |
| 11 | The Squirrel is gone for the week. Mosey has nothing to do with the yard now. | rivalry = purpose | **N** | abstraction |
| 12 | The Cat ignored Mosey with great skill today. Mosey is studying the technique. | Cat | **N** | abstraction |
| 13 | Mosey watched a leaf let go of the tree. Mosey will forget it by dinner. | fleeting attention | **N** | abstraction |
| 14 | The Pigeon stamped Mosey's paw DELIVERED and left satisfied. | Pigeon ritual | **N** | |
| 15 | Mosey has started a diet... The diet will not survive it. | precarious pose | **N** | abstraction ("will not survive it") |

**Round 14 tally:** 0 yes, 12 no, 3 other.

### ★★ The real bar (finally clear): the PAYOFF must be CONCRETE, in one of ~3 places — narrator abstraction is dead
Even specific SETUPS fail if the PAYOFF is a clever narrator abstraction ("cleared the afternoon", "under suspicion", "holding it hostage", "will not survive it", "takes this personally"). The 3 survivors land the payoff concretely, in one of three ways:
1. **Object → implied real-world fact** (dry text): "a wristwatch. It is set to another time zone." The specific object tells the story; stop.
2. **Animation showing disproportionate joy / contrast**: "a parking fine. [Mosey dancing with parking fine]." Cut the narrator's explanation; let the drawing do it.
3. **Mock-OPERATION with labeled/numbered steps + animation**: "Operation excavate: engaged. Step one: heavy breathing. [Mosey panting with excitement]." (Reconfirms L042.) The grand frame + a mundane "step one" + physical animation.

**Rule going forward:** land every payoff in one of these three. If the last clause is the narrator being clever *about* the moment, cut it.

---

## Round 15 (ONLY the 3 proven payoff types; no narrator-abstraction endings)

Every line lands concretely: object→implied-fact (A), animation-contrast/joy (B), or mock-operation+animation (C). Distinct ideas, dry.

| # | Line + [stage direction] | Type / idea | Verdict | Note |
|---|--------------------------|-------------|---------|------|
| 1 | Mosey came back from the walk with a golf ball. We do not live near a golf course. | A — object mystery | **N** | |
| 2 | The Pigeon delivered a postcard from Portugal to Mosey. Mosey has never been to Portugal. | A — Pigeon wrong mail | **N** | |
| 3 | The Crow left Mosey a house key. It does not open anything here. | A — Crow loot | **O** | → "The Crow left Mosey a house key. It is the neighbors'." Name the concrete owner — flat and direct beats my oblique riddle. |
| 4 | The vacuum came out of the closet. [Mosey defending the household from the vacuum] | B — heroic overreaction | **N** | |
| 5 | You sneezed. [Mosey rushing over to investigate the emergency] | B — disproportion | **N** | |
| 6 | The walk is cancelled on account of rain. [Mosey pressed to the window, motionless] | B — deadpan drama | **N** | |
| 7 | The mailman has come and gone. [Mosey narrating the entire event to you at high volume] | B — the retelling | **N** | |
| 8 | The Squirrel is at the feeder. Operation window patrol: engaged. Obstacle: the glass, again. [Mosey flattened against the window] | C — operation | **N** | |
| 9 | A treat has fallen behind the couch. Recovery operation underway. Estimated time: this evening. [Mosey wedged halfway under the couch] | C — operation | **N** | |
| 10 | The doorbell rang. Threat assessment initiated. Threat level: one leaf. [Mosey on high alert at the door] | C — operation + deflation | **N** | |
| 11 | The Cat has taken Mosey's spot. Mosey has accepted the second-best spot. [...] | B — Cat's quiet power | **N** | |
| 12 | You brought home groceries. Mosey received the receipt. [Mosey parading the receipt...] | B — joy at the worthless | **N** | |
| 13 | Mosey has a collection behind the couch. None of it belongs to Mosey. | A — implied hoard | **N** | |
| 14 | Mosey has resolved to stay off the couch. The couch is warm. The resolution is under review. | precarious pose | **N** | "under review" = abstraction again |
| 15 | The Snail has started across the doorway. [Mosey lying down beside it, settling in for the evening] | B — impatience deadpan | **N** | |

**Round 15 tally:** 0 yes, 14 no, 1 other.

## Round 16 (VALIDATION — first batch written through the rewritten skill)

Consolidated the skill after R15. This tests whether the rewritten Register 1 raises the hit rate. Every line lands concretely; winning mode per character; distinct ideas.

| # | Line + [stage direction] | Device | Verdict | Note |
|---|--------------------------|--------|---------|------|
| 1 | The Crow brought Mosey a single AirPod. Its owner is nearby, and searching. | Crow object→fact | | |
| 2 | The Pigeon delivered a wedding invitation to Mosey. Mosey is not on the guest list. | Pigeon irony | | |
| 3 | A crumb has been located under the table. Operation retrieval: underway. Complication: the table. [Mosey stuck under the table] | mock-operation | | |
| 4 | You picked up your keys. [Mosey already turning in circles by the door] | joy-cue | | |
| 5 | Mosey is being aloof today, like the Cat. [Mosey looking away from you, then glancing back to check if you noticed] | Cat imitation | | |
| 6 | The Cat sat in the window all afternoon. Mosey sat below, keeping it company. The Cat did not request company. | dramatic irony | | |
| 7 | The Squirrel flicked its tail and left. Mosey has interpreted this as a declaration of war. Mosey accepts. | Squirrel paranoid | | |
| 8 | Mosey returned from the walk with a golf ball, a bottle cap, and a business card. The business card is for a lawyer. | object→fact (weird) | | |
| 9 | The mailman came to the door. Mosey issued the usual response. [Mosey barking at the door with full commitment] | ritual + animation | | |
| 10 | Mosey is not begging. Mosey is simply nearby, and available. [Mosey staring up at the table with quiet intensity] | precarious pose | | |
| 11 | The Snail is back and has chosen the slowest route across the doorway. Mosey has watched the entire first inch. | Snail impatience | | |
| 12 | Mosey watched a fly for an hour and then let it go. Mosey could have ended it at any time. Mosey chose mercy. | weird/broad implication | **N** | |

**Round 16 tally: 0 yes, 12 no, 0 other. VALIDATION FAILED.**

### ★★★ Conclusion: the written skill does not transfer to cold generation
The most carefully-skill-compliant batch scored 0/12. Every principle was applied (concrete payoffs, winning modes, implication, setting, specificity) and it still failed completely. The gap between Natan's ear and any written ruleset is real and not closable by more documentation. My cold lines run wordier and more constructed than his flat, brutally-concrete winners ("It is the neighbors'." / "Bath time." / "To someone.").

**Implication for how to use the skill:** it works as (a) a REVIEW/refinement checklist and (b) documentation of the voice — NOT as a cold line generator by Claude. The productive loop is **Natan generates or seeds → Claude sharpens/reviews**. Cold generation retired. Switching to seed mode.

---

### ⚠ Meta-observation: cold-generation of 15/round is inefficient (R8/R13/R14/R15 all near-wipeouts)
Recent cold-gen hit-rate ≈ 1–3 approvals per 15, and nearly all approvals are Natan's REWRITES, not my lines as-written. My drafts consistently sit a half-step too abstract/oblique; Natan's fixes go flatter, more concrete, more specific (names the neighbors', the biscuit, the time zone). The PRINCIPLE extraction has been productive (great findings + character map + payoff rule), but line YIELD is low. Proposed to Natan: switch to seed-mode (Natan supplies a concrete object/situation, I sharpen 3–5 variants) and/or consolidate the 68-line bank + findings into the skill now. Awaiting his call.
