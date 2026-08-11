# One Thing — category research

Working title. A browser game where fantasy men circulate between strangers, each keeper allowed exactly one mandatory edit before release.

Research date: 2026-08-06

---

## Headline finding

**Nobody has shipped this.** The specific combination (a persistent romantic character, passed between strangers, with a mandatory single edit and a visible lineage) does not exist as a product.

Four separate lineages contain pieces of it. None of them have been combined, and the two biggest ones (otome games, AI companions) have never been crossed with the third (collaborative evolution).

---

## A. Collaborative interactive evolution — the real ancestor

This is the tradition the idea actually belongs to, and it is academic rather than commercial.

**Picbreeder** (Secretan, Beato, Stanley et al., UCF, 2007 to 2011). A public website where users evolve images by selecting from mutated offspring. The critical feature: users can **branch from other users' published images** and keep evolving them. Published at CHI 2008 and in Evolutionary Computation 19(3), 2011.

What they found, and it maps directly onto this project:

- Chained branching by many hands reaches results **no single user could have targeted**. A car becomes a face becomes a skull, and nobody set out for any of it. This became Kenneth Stanley's book *Why Greatness Cannot Be Planned*, and the term for it is "stepping stones."
- The valuable artifact is the **lineage tree**, not any single image.
- A small minority of users produce most of the productive branches. Most branches die immediately.
- Users converge on local optima and need novelty pressure to escape.

Older relatives: Dawkins' Blind Watchmaker biomorphs (1986), Karl Sims' evolved images, Electric Sheep (Scott Draves, users vote and fractal flames breed).

**Implications**

1. Show the lineage. The genealogy of a character is more compelling than the character.
2. Expect a power law. Design for the 5% who produce good mutations, and make their work visible to everyone else.
3. Build in novelty pressure, or every man in the pool converges to the same man.

---

## B. Constrained expression as moderation — the solved problem

The notes problem has a well tested answer, and it is not free text.

**Dark Souls / Elden Ring messages.** Players write ground messages from a **fixed template plus a fixed word list**. Two slots, roughly 200 words, and yet the system produces genuine comedy, genuine helpfulness and genuine cruelty. The vocabulary covers creatures, objects, tactics and conjunctions. It is impossible to type a slur and entirely possible to be filthy, and players spent a decade doing exactly that. Combinatorics, not typing, produces the expression.

**Kind Words** (Popcannibal). Anonymous letters between strangers about personal struggles, which sounds impossible to moderate. It works. Two design moves do the heavy lifting: a **signed social contract at first launch** stating trolls are not welcome, and a narrow contextual frame that makes off-topic content feel out of place. Roughly **3% of messages flag for review, and most of those are off-topic rather than abusive.** The framing does the moderation.

**AO3 tag wrangling.** A **curated folksonomy**. Users type any tag they want, and roughly 160 volunteer wranglers merge synonyms into canonical tags that feed autocomplete and filters. It is an explicit compromise between a locked taxonomy (safe, sterile) and a folksonomy (expressive, chaotic). It has scaled to millions of tags in the most kink-fluent community on the internet.

**Implications**

Three layers of feedback, no open text field anywhere in v1.

| Layer | When | Form | Moderation cost |
|---|---|---|---|
| Daily reaction | While kept | Thumb up or down on the day's deed | Zero. Pure telemetry, and the truest signal you will get. |
| The edit | On release | `Make him [more/less] [trait] about [domain]` from a wrangled bank | Zero |
| The note | On release | Template plus slot fill from a curated romantasy word bank | Zero |

The artistry moves into **the word bank**. If the bank is written well, in the actual register of romantasy and innuendo, players will produce poetry and filth with it and you will never moderate a string.

Then grow the bank AO3 style. Free typed phrases go to a suggestion queue, you canonicalize the best weekly, and players **watch their coinages enter the game's language.** That is a serious retention hook and it converts the moderation burden into a content pipeline.

---

## C. The market — validated, enormous, and structurally blind to this idea

**Otome and women's romance mobile games**

- *Love and Deepspace* (Papergames): roughly **$933M lifetime** across App Store and Google Play, with **$522.6M in year two, up 27% YoY**, and 50M+ players. Second highest grossing mobile game globally by some 2025 counts. China roughly 60% of revenue, US roughly 13%, Japan roughly 9%.
- The top seven Chinese otome titles together cleared **10B yuan in 2024**.
- Established franchises: Mr Love: Queen's Choice, Tears of Themis, Obey Me!, the Ikemen series (Cybird), Mystic Messenger.

**Every one of them is single player with a fixed, authored love interest.** The character you romance is byte-identical to the one every other player romances, forever. There is no product in this category with a **socially mutable** love interest. That is the white space, and it is unusually large for a category this rich.

**Publishing side**

- Fantasy romance is roughly **35% of adult fiction bestsellers in 2026**, up from roughly 28% in 2024.
- The trend line is **darker, weirder, bloodier**: dark romantasy, monster romance, villain romance, and the rising "femgore" subgenre. The morally grey fae remains the defining archetype.

The instinct to go strange is not ahead of the audience. It is where the audience has already moved.

---

## D. AI companions — the fork mechanic exists, the constraint does not

Character.AI, Talkie, Linky, Chai, Janitor. These already have public character libraries where users **remix and republish** other people's characters, and they prove decisively that women will invest daily, emotionally and financially in a persistent male character.

What they lack is exactly the thing that makes this idea a game:

- Unbounded chat means the character has **no nature to resist an edit**. It becomes whatever you say. No friction, no reveal, no lineage worth tracking.
- Unbounded chat is a genuine moderation swamp.
- **Talkie was pulled from the US App Store in December 2024** with no public explanation. A clear signal about where Apple's line sits on suggestive AI companionship.

Browser is the right call, and it is worth writing that down as a deliberate strategic choice rather than a convenience.

---

## E. Community mutated persistent characters — Blaseball, and the warnings

**Blaseball** (The Game Band, 2020). A text only baseball sim where fans voted at season end on **rule changes and modifications to persistent players**. The sim was deliberately thin. The fans wrote the lore, collaboratively, on a wiki, and projected identity onto under specified characters at enormous scale.

Two lessons, one positive and one cautionary:

1. **Leave gaps.** Under-specified characters get filled in by the audience, and that filling-in is the loyalty engine. Do not over-author the profiles. The card format already pushes in this direction.
2. **Pace the drift.** Blaseball's chaos accelerated past what players could emotionally track, and the churn contributed to its wind-down. If a character mutates too fast, nobody can love him.

**Other precedents worth knowing**

- **Pokémon Wonder Trade.** Send a creature to a random stranger and receive one back, sight unseen. The pure gifting-into-the-void mechanic, and evidence that anonymous exchange with strangers is genuinely thrilling.
- **Creatures** (1996) Norns. Exportable creature files with persistent genetics, traded between players. The community famously included a large contingent who **tortured them**. Expect players to breed intentionally awful men. Design for it, because it is funny, and it will produce the most shared screenshots in the game.
- **Mon**, a small itch.io project where every player tends the same single creature.

---

## Design implications, ranked by risk

**1. The daily deed is the hardest content problem, not the images.**
He does something every day. It must be in character, varied, and responsive to accumulated edits. Options: a large hand-authored pool tagged by trait, selected against the character's current stat vector (cheap, safe, ships), or LLM generation with heavy guardrails (expensive, unbounded, better). Start with the pool, and use the thumb data to learn which deeds land before spending on generation.

**2. Failure is the best content in the game.**
Make the failed edit the thing people screenshot. The magic compels him to try, so the explanation of **how he tried and what happened instead** is where the archetype's nature becomes visible. A vampire told to be warmer warms his hands at the fire before he touches you. Compliance that reveals the monster is the money.

**3. Model nature as resistance, and produce warped compliance rather than refusal.**
Each archetype gets a nature vector. Edits pushed against nature have low success odds and resolve into a third thing, neither the old trait nor the requested one. Never a flat refusal. Always a strange yes.

**4. Leaderboards on retention will select for blandness.**
"Longest average keep" optimises toward pleasant, safe men. That is the opposite of the experiment. Rank on volatility, on most-edited, on release regret, on divisiveness. Reward the men who split the room.

**5. Releasing must cost something.**
Keeping is only meaningful if letting go hurts. One at a time, or a small hard-capped collection. If she can hoard, nothing circulates.

**6. Images: do not regenerate per edit.**
One strong base portrait per archetype, with palette and overlay shifts for accumulated drift, and a full regeneration only at milestone edits. Tarot register, where mood is carried by the text and the portrait ages slowly.

---

## Open questions

- Does a character retire, or drift forever? Lineage depth is the sociologically interesting artifact, which argues for forever, with a hall of legends for the deepest lines.
- One edit per keeper is fixed. Is one edit per *character per day* also needed, to control drift speed?
- Is the pool global, or sharded so a character can plausibly return to a previous keeper? Return is emotionally enormous. "He came back, and someone changed him."
- Who writes the word bank, and how big does it need to be at launch? This is the single highest leverage piece of writing in the project.

---

## Sources

- [Picbreeder: A Case Study in Collaborative Evolutionary Exploration of Design Space](https://direct.mit.edu/evco/article/19/3/373/1371/Picbreeder-A-Case-Study-in-Collaborative)
- [Picbreeder: Collaborative Art Evolution](http://picbreeder.org/behind.php)
- [Dark Souls Messaging system](https://darksouls.fandom.com/wiki/Messaging)
- [Kind Words is successfully resisting trolls (Kotaku)](https://kotaku.com/kind-words-a-game-about-sending-nice-letters-to-strang-1840537946)
- [Kind Words 2 (GamesRadar)](https://www.gamesradar.com/kind-words-2-is-a-different-kind-of-social-media-its-a-social-space-where-you-can-share-your-troubles-with-no-followers-or-likes/)
- [The past, present and hopeful future for tags and tag wrangling on AO3](https://www.transformativeworks.org/past-present-and-hopeful-future-tags-tag-wrangling-ao3/)
- [AO3 Tagging System (Fanlore)](https://www.fanlore.org/wiki/AO3_Tagging_System)
- [Love and Deepspace market and revenue analysis](https://otome.com/2025/10/26/love-and-deepspace-market-and-revenue-analysis/)
- [Love and Deepspace 2025 profit (Pocket Tactics)](https://www.pockettactics.com/love-and-deepspace/2025-profit)
- [Top 5 Otome Games in the US, Q2 2025 (Sensor Tower)](https://sensortower.com/blog/2025-q2-unified-top-5-otome%20games-revenue-us-60789073241bc16eb88c6e7f)
- [The Rise of Romantasy 2026](https://publishdrive.com/romantasy-book-trends.html)
- [Romantasy trends and the shift toward dark romance](https://atmospherepress.com/romantasy-trends-2026/)
- [Blaseball (TV Tropes)](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Blaseball)
- [Blaseball Wiki: Community Lore](https://www.blaseball.wiki/w/Help:Community_Lore)
- [What Blaseball taught me about storytelling and fandom](https://www.marygeorgescu.com/blog/blaseball)
- [Pokémon Wonder Trade with strangers (GamesRadar)](https://www.gamesradar.com/pokemon-brilliant-diamond-and-shining-pearl-finally-lets-you-trade-mons-with-strangers/)
- [Otome game archetypes primer (Blerdy Otome)](https://blerdyotome.com/2019/06/20/a-beginners-guide-to-otome-games-part-3-common-character-archetypes/)
- [Best AI companion apps 2026](https://aicompanionguides.com/blog/best-ai-companion-apps-2026/)
