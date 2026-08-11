# Yes M'lady — the lexicon

The word bank, the glossary system, and the machinery for growing a language.

This is the highest leverage document in the project. If the bank is good, players will write poetry and filth with it and no string will ever need moderating. If the bank is mediocre, the game is a form.

---

## 1. Why there is no text field

Expression comes from **combination**, not typing.

Dark Souls runs on roughly two hundred words in two template slots and has produced a decade of genuine comedy and genuine cruelty without a single moderatable string. That is the model. The player's creative act is **selection under constraint**, which is more satisfying than free typing, not less, because every choice is legible against the alternatives she did not pick.

Constraint also does something free text cannot. It forces the whole player base to speak **one language**, so meaning accretes. A word means more on its four hundredth use than its first. That is how a real cant forms, and a real cant is the thing that makes this world feel inhabited rather than authored.

---

## 2. The term object

Every word in the bank is a record, not a string.

```
term
  slug            "thrall-warm"
  display         "thrall-warm"
  part            adj | noun | verb | phrase
  tier            common | cant | coined
  gloss           the definition, written in world, one or two sentences
  note            optional second line, usually the joke or the knife
  coined_by       keeper handle, null for founding cant
  coined_on       date
  first_of        character id the word was first used about
  uses            integer
  top_subject     character most often described with it
  related         [slugs]
  slots           [TRAIT, FAILING, ...]  which composer slots accept it
  register        tender | wry | cruel | reverent | filthy
```

`uses`, `top_subject` and `first_of` are the parts that make the glossary feel alive. A word with a face attached to it is a word people will use.

---

## 3. The rollover

Any cant or coined term, anywhere it appears (card, note, ledger, edit history, another glossary entry), is underlined in a hairline and is hoverable on desktop, tappable on mobile.

**Hover, desktop.** A small parchment slip, roughly 260px, appearing after 250ms:

> **lamplit** *(adj.)*
> Of a flaw seen fully, in good light, and wanted anyway.
> The highest praise this language has.
>
> Coined by **Maryam of the Low Field**, 12th of the Ninth.
> First said of **Wick**. Used 4,112 times since.
> Most often of **Brother Anselm**.

**Tap, mobile.** Same content in a sheet from the bottom, with the related terms as tappable chips so the glossary becomes browsable by wandering.

**The term page.** Every word has a permanent page. Its definition, its coiner, its full usage curve over time, the characters most associated with it, and a wall of recent notes that used it. This page is the AO3 tag page of this game, and it will be one of the most visited surfaces in the product.

**Design note.** Do not gloss common tongue. If every third word is underlined the effect dies. The cant must stay rare enough to feel like cant. Target: no more than two glossable terms per note.

---

## 4. The three tiers

**Common tongue.** Plain words. Not glossed, not tracked, freely available in every slot. The connective tissue.

**Court cant.** The founding vocabulary, below. Authored, glossed, and seeded so that the language has a shape before the players arrive. Roughly forty at launch. A language with no starting grammar does not grow, it just gets noisy.

**Coined.** Player-made, wrangled in. See section 7.

---

## 5. The founding cant

Forty terms. Each is glossed as it will appear on rollover.

### Of warmth and its counterfeits

**thrall-warm** *(adj.)* Warm only because the warmth was borrowed from somewhere else. Of vampires, of the newly kind, of anyone performing a temperature.

**thaw-lie** *(n.)* A warmth performed so well that both parties agree not to check it.

**tallow-hearted** *(adj.)* Melts under any warmth at all and sets again in the wrong shape. Pitiable. Extremely common.

**scold-warm** *(adj.)* Affection delivered as complaint, because that is the only shape it fits in.

**rushlight** *(n.)* Devotion from a man with nothing. Burns fast, smells of fat, and is still light.

### Of thresholds and doors

**doorframe hours** *(n.)* The time a man spends in a threshold, neither entering nor leaving. Counted by some keepers as the best hours of a keeping.

**latchless** *(adj.)* Of a door left unlocked deliberately. Also of the woman who left it that way, and of the night that follows either.

**threshold-hungry** *(adj.)* Of anything that cannot come in until it is asked, and has been very obviously waiting.

**saltbound** *(adj.)* Kept out by a rule rather than a wall. Of thresholds, of vows, and of the very well behaved.

**breadbound** *(adj.)* Bound by hospitality. Fed once, and now it will not leave, and there is no unfeeding it.

**hearthright** *(n.)* What a house owes a thing that has served it. Rarely honoured.

**understair** *(n.)* Where a household keeps what it will not name. Also, a place two people can stand.

**the ninth stair** *(n.)* The step that announces you. Any small betrayal by an otherwise loyal thing.

### Of hands and looking

**glovebare** *(adj.)* Of a hand shown without its glove in a house where gloves are worn. Scandalous, in the old sense.

**the long look** *(n.)* Held past the point where it could still be called an accident, and well short of the point where anything is said.

**unhanded** *(v.)* Released from a grip you had not finished being in.

**soft-mouthed** *(adj.)* Carrying something fragile in a mouth built for other work.

**gentling** *(n.)* Being handled carefully by something that could obviously kill you. The care is the point. So is the could.

### Of restraint and its failures

**honeyfast** *(n.)* Going without a sweet thing that is sitting right there, on purpose, for reasons.

**beast-patient** *(adj.)* Patient the way a predator is patient, which is not the same as kind and is frequently mistaken for it.

**wolfhour** *(n.)* The hour a man stops managing himself. Not always at night. Not always a wolf.

**moonlast** *(n.)* The week before the change, when he cannot lie and everyone wishes he could.

**counting-cold** *(adj.)* Taken by an old compulsion at the worst possible moment.

**grain-scattered** *(adj.)* Deliberately distracted with a small compulsion so that he cannot attend to you. Cruel. Effective. Named for the old trick with the barley.

### Of service and its postures

**kneeling weight** *(n.)* How much a man weighs when he goes down. Some are much heavier than others.

**hollow-serving** *(n.)* Service performed by a thing with nobody inside it. Of the Harness. Also of certain knights.

**unbidden** *(adj.)* Done without an order, which for some of them is the entire erotic event.

**the flinch** *(n.)* The beat of resistance before the words. Everyone gets one. Some are very small.

**the second yes** *(n.)* The softer repetition, offered when the first did not feel like enough.

**owing** *(n.)* The fae condition. Nothing given freely, everything a ledger, and the ledger is itself a kind of touch.

### Of keeping and being kept

**half-kept** *(adj.)* Taken in and not attended to. The commonest cruelty here, and the rules do not punish it.

**cellar-kept** *(adj.)* Preserved by being hidden. Of wine, of grief, and of certain men.

**kept-past-nine** *(adj.)* Held longer than any previous keeper managed. A boast, usually hers.

**votive** *(n.)* A thing used up by being adored. Candles. Wax. Occasionally people.

**wick-thin** *(adj.)* Worn down by being needed. Of the poor, the useful, and anyone kept too long by too many.

**the pale stair** *(n.)* A descent taken knowingly. Named for Orsolt's house, now said of any of them.

### Of flaw and its light

**lamplit** *(adj.)* Of a flaw seen fully, in good light, and wanted anyway. The highest praise available in this language.

**name-shy** *(adj.)* Of a thing that loses its power when named. Also of a want that does the same.

**hedge-sworn** *(adj.)* Bound by a vow made outside any church, binding anyway, and usually worse.

**hedge-fine** *(adj.)* Beautiful in a cheap way that only works outdoors, in a certain light, and works terribly well there.

---

## 6. Slot banks

The composer draws from typed banks. Sizes below are launch targets, not what is written here.

| Bank | Target | Contents |
|---|---|---|
| `TRAIT` | 180 | qualities an edit can push. cold, ravenous, courtly, feral, honest, obedient, proud, quiet, thrall-warm, beast-patient |
| `FAILING` | 140 | what went wrong. counting, kneeling, confessing, taking, owing, forgetting, announcing, apologising, melting |
| `DEED` | 220 | things he did. waited, knelt, lied badly, brought the wrong flowers, stood in the doorway, mended it worse, watched the road |
| `PART` | 60 | strictly suggestive. hands, wrists, throat, the back of his neck, the line of his jaw, his shoulders in a doorway, his mouth when he is deciding |
| `OBJECT` | 200 | glove, latch, rushlight, ninth stair, barley, salt line, bell rope, wax, mirror, his gorget, the wrong key |
| `TIME` | 80 | the third night, moonlast, the wolfhour, before the bell, after everyone slept, the whole of a wet week |
| `PLACE` | 70 | the threshold, the understair, the cellar, the low field, the chapel he will not enter, the top of the pale stair |
| `VERB` | 160 | kneel, wait, count, confess, take, owe, mend, announce, warm, unhand, gentle, hold |
| `TONE` | 40 | modifiers on delivery. badly, beautifully, too fast, too late, on purpose, without being asked |

**Rules for writing bank entries.**

Every entry must be **specific enough to be evocative and general enough to combine.** "brought the wrong flowers" works against any of the twelve and means something different against each. "brought lilies to the chapel" is too tight.

Every entry must be **clean in isolation and suggestive in combination.** Nothing in `PART` is explicit on its own. The heat comes from what sits next to it.

Nothing in any bank may be cruel about a real category of person. The cruelty in this game is aimed at fictional men and at the world that made them.

---

## 7. Coinage, the growth engine

The language must grow or the game is a static form with a nice skin.

**The pipeline.**

1. Composing a note, a keeper may propose a phrase into a single slot. It is typed. It is **not published**.
2. It goes to the wrangling queue with its context: the character, the note, the axes at release.
3. Weekly, a small wrangling group canonicalises. Merge synonyms, fix register, write the gloss, assign slots and related terms.
4. Accepted terms enter the bank with **her handle on it, permanently.**
5. She is told. This is the single best notification the game can send.

**Why this works.** It is AO3's curated folksonomy, which has scaled to millions of tags in the most kink-fluent community on the internet using roughly a hundred and sixty volunteers. It is a compromise between a locked taxonomy, which is safe and sterile, and open folksonomy, which is expressive and ungovernable.

**Why it is more than moderation.** Authorship is the deepest retention hook available here. A woman who coined **lamplit** will come back for years to watch her word spread. The usage curve on her term page is a personal monument. And the language ends up genuinely co-written, which is what makes it feel like a world instead of a product.

**Volume control.** Cap proposals at one per release. Publish a weekly changelog as an in-world document, the wranglers as an in-world body, something like the Keepers of the Register, so that the growth of the language is itself content.

**The unwritten bank.** Reserve room for taboo and object-directed vocabulary that the founding cant only gestures at. Do not author all of it. The strangest and most specific desires in this game should arrive from the players, wrangled and glossed and credited, because a want the house did not think of is worth more than one it did.
