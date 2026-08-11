import { CHARACTERS } from './characters'
import { MORE } from './scenes-b'
import { quirksOf } from './quirks'
import type { Beat, Character, Fact, Scene, Verb } from './types'

/**
 * Scenes are three beats long. Each beat gives you two or three concrete things
 * you can do, phrased as actions rather than abstract verbs, so you never have
 * to guess what a button means.
 *
 * Closeness comes from choices, not from waiting. A good scene is worth 12 to
 * 15, so a character opens up over five or six exchanges rather than five or
 * six days.
 */

/* ------------------------------------------------------- written by hand */

const WRITTEN: Record<string, Scene[]> = {
  aldous: [
    {
      id: 'aldous-fire',
      title: 'The fire',
      to: 45,
      beats: [
        {
          text: 'He knelt to bank the coals and then stayed down, arranging them into a shape that did not need arranging.',
          choices: [
            {
              label: 'Tell him to get up',
              reply:
                'He rose at once. He looked at you a beat too long, then thanked the floor rather than you.',
              close: 5,
            },
            {
              label: 'Say nothing',
              reply:
                'The coals went out under his hands. He did not move. He seemed to be waiting for the room to tell him something.',
              close: 1,
            },
            {
              label: 'Kneel down beside him',
              reply:
                'He went completely still. Then he shifted, very slightly, to make room, and did not look at you at all.',
              close: 3,
            },
          ],
        },
        {
          text: 'He is standing now, near the hearth, with his hands at his gorget. He does this when he is thinking and he does not know he does it.',
          says: 'You will want the north room aired, m’lady. I have done it.',
          choices: [
            {
              label: 'Ask who taught him to do that',
              reply:
                '"A house that no longer exists." He said it evenly. Then he found a reason to be at the other end of the room.',
              close: 4,
            },
            {
              label: 'Tell him he does not have to report to you',
              reply:
                'Something went out of his shoulders that had been in them since he arrived. Then it came back, because he had nowhere to put it.',
              close: 5,
            },
            {
              label: 'Thank him',
              reply: 'He accepted it correctly and it did nothing for either of you.',
              close: 1,
            },
          ],
        },
        {
          text: 'It is late. He has not been dismissed and will not go up until he is.',
          choices: [
            {
              label: 'Send him to bed',
              reply:
                'He went immediately, and gratefully, and at the door he stopped as though he had meant to say something and had decided against it.',
              close: 5,
            },
            {
              label: 'Let him stay',
              reply:
                'He stood by the fire until it was out and then stood by where the fire had been.',
              close: 2,
            },
          ],
        },
      ],
    },
    {
      id: 'aldous-order',
      title: 'The order',
      from: 45,
      beats: [
        {
          text: 'You asked him to do something small and he did it wrong on purpose, so that you would have to ask again.',
          choices: [
            {
              label: 'Ask again, gently',
              reply: 'He did it properly, slowly, and looked almost well for an hour afterward.',
              close: 5,
            },
            {
              label: 'Call him on it',
              reply:
                '"Yes." No excuse offered. He looked at the floor and then, deliberately, back up at you.',
              close: 6,
            },
          ],
        },
        {
          text: 'He has been carrying something all evening and has put it down twice.',
          says: 'May I ask you a thing, m’lady, and have it not be an order.',
          choices: [
            {
              label: 'Yes',
              reply:
                '"Tell me to stand." He said it fast. "Not tonight. Some day when I have not asked."',
              close: 6,
            },
            {
              label: 'Tell him he does not need permission to speak',
              reply: 'He nodded, and did not speak, and the thing stayed down.',
              close: 2,
            },
          ],
        },
        {
          text: 'He is waiting on the answer he did not quite ask for.',
          choices: [
            {
              label: 'Promise nothing',
              reply:
                'He took that well. He takes everything well. It is the single most exhausting thing about him.',
              close: 3,
            },
            {
              label: 'Say you will remember',
              reply:
                'He said "yes, m’lady," and it came out wrong, too quiet, and he heard it come out wrong.',
              close: 6,
            },
          ],
        },
      ],
    },
  ],

  wick: [
    {
      id: 'wick-comb',
      title: 'The comb',
      to: 45,
      beats: [
        {
          text: 'Your comb went missing this morning. It is on the sill tonight with two teeth replaced in a wood that does not match. He has not looked at the sill once.',
          choices: [
            {
              label: 'Hold his eye until he looks back',
              reply:
                'He met it. He did not look away and he did not explain, and something in him unclenched that you had not known was clenched.',
              close: 5,
            },
            {
              label: 'Say nothing about it',
              reply: 'The comb stayed. So did the silence. He seemed to find it bearable.',
              close: 3,
            },
            {
              label: 'Tell him not to take your things',
              reply:
                'He apologised very fast and very smoothly, the way a man apologises who has had practice, and put his hands where you could see them.',
              close: 0,
            },
          ],
        },
        {
          text: 'He eats standing, near the door, the way he always does. There is a chair between you and it has been there nine days.',
          choices: [
            {
              label: 'Tell him to sit',
              reply: 'He sat the way a man sits on a fence he intends to be over shortly.',
              close: 1,
            },
            {
              label: 'Move the chair out of the way',
              reply:
                'He laughed, once, surprised into it. He stayed by the door. He stayed by the door for another hour, which was longer than he needed to.',
              close: 5,
            },
          ],
        },
        {
          text: 'He knew where the draught came from before you did. He moved the chair, then moved it back, and said nothing about either.',
          says: 'Old house. They all do it.',
          choices: [
            {
              label: 'Ask how he knew',
              reply:
                'He told you which wall and how, and then heard himself, and stopped. The stopping told you more than the telling.',
              close: 5,
            },
            {
              label: 'Let him have the lie',
              reply:
                'He glanced at you once to check that you had let him, and you had, and that was the whole conversation.',
              close: 4,
            },
          ],
        },
      ],
    },
  ],

  orsolt: [
    {
      id: 'orsolt-beads',
      title: 'Ninety two steps',
      to: 45,
      beats: [
        {
          text: 'A string of beads broke on the stair before midnight. He is on the ninth step with his back to you and he is not going to stop.',
          choices: [
            {
              label: 'Sit down and wait it out',
              reply:
                'It took an hour and eleven minutes. When he finished he stood, and turned, and looked at you as though you had done something to him.',
              close: 6,
            },
            {
              label: 'Tell him to leave it',
              reply:
                'He stopped. He is counting silently now, which means he is only half here, and he knows you cannot prove it.',
              close: 0,
            },
            {
              label: 'Help him pick them up',
              reply:
                '"No." Flat, and instant, and then, much later, "Thank you." He does not want it made easier. He wants it permitted.',
              close: 3,
            },
          ],
        },
        {
          text: 'He warmed his hands at the fire for most of an hour before coming near you. The hands are the correct temperature. Nothing else about him is.',
          says: 'Better.',
          choices: [
            {
              label: 'Tell him it is not better',
              reply:
                'He took them back. A long pause, and then, "Yes. It was theatre." He has not tried it again, which is its own answer.',
              close: 5,
            },
            {
              label: 'Let him have it',
              reply: 'He does this every evening now. He has begun timing it.',
              close: 1,
            },
          ],
        },
        {
          text: 'The household accounts have been corrected in a hand two hundred years out of fashion. Nobody asked. It is a considerable sum you were losing.',
          choices: [
            {
              label: 'Ask what else he has been counting',
              reply:
                'He explained the error, then who had been making it, and for how long, and you understood he had not been counting money.',
              close: 6,
            },
            {
              label: 'Say nothing and find the second one yourself',
              reply:
                'You found it on Thursday. He was in the room when you did and did not look up, and was insufferable about it for a week.',
              close: 5,
            },
          ],
        },
      ],
    },
  ],

  corvane: [
    {
      id: 'corvane-exits',
      title: 'The chair by the wall',
      to: 45,
      beats: [
        {
          text: 'She has taken the seat with its back to the wall again, without appearing to choose it. You have never seen her sit anywhere else.',
          choices: [
            {
              label: 'Take the seat facing the door yourself',
              reply:
                'She noticed within a second. She did not say anything. About an hour later her shoulders came down, which you have not seen before.',
              close: 6,
            },
            {
              label: 'Ask why',
              reply: '"Habit." Pleasantly said, and the door closed on it.',
              close: 1,
            },
            { label: 'Say nothing', reply: 'She sat. You sat. It was fine, and it was guarded.', close: 2 },
          ],
        },
        {
          text: 'A man in the street said something as you passed. She did not turn or break stride. She simply put herself between, and the man found somewhere else to be.',
          choices: [
            {
              label: 'Tell her that was well done',
              reply:
                '"Of course." She meant it entirely, and then was quiet for a street and a half about how fast she had done it.',
              close: 4,
            },
            {
              label: 'Tell her you did not need her to',
              reply:
                'She apologised. She thought she had overstepped. It took the rest of the walk to undo and it was not fully undone.',
              close: 1,
            },
            {
              label: 'Take her arm and keep walking',
              reply:
                'She went very still for a step and then matched you. She has been on that side ever since.',
              close: 6,
            },
          ],
        },
        {
          text: 'She mended a hinge, a strap and a bowl tonight with the same hands and the same care, and looked more herself than she does doing anything else.',
          choices: [
            {
              label: 'Leave her to it',
              reply:
                'Hours. When she finished she looked for the next thing, and there was not one, and she sat down, which is unheard of.',
              close: 6,
            },
            {
              label: 'Bring her something else to fix',
              reply: 'She took it gratefully. She is easier with a task than without one, and you have just made sure she had one.',
              close: 3,
            },
          ],
        },
      ],
    },
  ],

  sable: [
    {
      id: 'sable-face',
      title: 'Four descriptions',
      to: 45,
      beats: [
        {
          text: 'You described them to someone in the market this morning and got it wrong in three particulars. They were standing behind you.',
          choices: [
            {
              label: 'Correct yourself, out loud, now',
              reply:
                '"You said grey eyes." A pause. "It has been eleven years since anybody corrected themselves." Then they changed the subject at speed.',
              close: 6,
            },
            {
              label: 'Pretend you did not see them',
              reply: 'They were charming all evening, from about a foot further away than usual.',
              close: 1,
            },
          ],
        },
        {
          text: 'Somebody at the table asked what they were. They gave an answer that satisfied everyone and contained nothing, then looked at you to see if you had noticed the trick.',
          choices: [
            {
              label: 'Hold their eye',
              reply:
                'They held it. They did not perform anything for a full second, which from them is nakedness.',
              close: 5,
            },
            {
              label: 'Answer for them, badly, on purpose',
              reply:
                'They laughed. Actually laughed, wrong-footed, and the table looked round at the sound of it.',
              close: 6,
            },
            {
              label: 'Let it pass',
              reply: 'The table moved on. They were quiet for the rest of it, in a room where they are never quiet.',
              close: 2,
            },
          ],
        },
        {
          text: 'They have started leaving one detail the same each day. The ring on the left hand, three days running. It is not a large thing and it took them some effort.',
          choices: [
            {
              label: 'Mention the ring',
              reply:
                'Four days running now. Then five. Neither of you has said another word about it and it is the loudest thing in the house.',
              close: 6,
            },
            {
              label: 'Say nothing, and keep count',
              reply: 'The ring stayed. So did they.',
              close: 4,
            },
          ],
        },
      ],
    },
  ],
}

/* ------------------------------------------------ generated for the rest */

const LABEL: Record<Verb, string> = {
  yes: 'Tell them you liked it',
  no: 'Tell them to stop',
  nothing: 'Say nothing',
  look: 'Hold their eye',
  ask: 'Ask about it',
  wait: 'Leave them to it',
  withhold: 'Give them nothing',
  latch: 'Leave the door on the latch',
}

const ORDER: Verb[] = ['yes', 'no', 'nothing', 'look', 'ask', 'wait', 'withhold']

/** Turns an old single-response deed into a one beat scene. */
function beatOf(d: Character['deeds'][number]): Beat {
  const choices = ORDER.filter((v) => d.replies[v])
    .slice(0, 3)
    .map((v) => ({
      label: LABEL[v],
      reply: d.replies[v]!,
      close: v === d.tell ? 5 : 1,
    }))
  // always make sure the correct read is on the table
  if (!choices.some((c) => c.label === LABEL[d.tell]) && d.replies[d.tell]) {
    choices[choices.length - 1] = {
      label: LABEL[d.tell],
      reply: d.replies[d.tell]!,
      close: 5,
    }
  }
  return {
    text: d.scene ? `${d.scene} ${d.text}` : d.text,
    says: d.says,
    choices,
  }
}

function generated(c: Character): Scene[] {
  const beats = c.deeds.map(beatOf)
  if (!beats.length) return []
  return [
    {
      id: `${c.id}-gen`,
      title: 'An evening',
      beats: beats.slice(0, 3),
    },
  ]
}

export const SCENES: Record<string, Scene[]> = Object.fromEntries(
  CHARACTERS.map((c) => {
    const written = [...(WRITTEN[c.id] ?? []), ...(MORE[c.id] ?? [])]
    return [c.id, written.length ? written : generated(c)]
  }),
)

/**
 * Returns null when there is genuinely nothing new tonight. That is a real
 * state and the game says so plainly, rather than replaying an evening you have
 * already had and pretending it is fresh.
 */
export function sceneFor(c: Character, closeness: number, done: string[]): Scene | null {
  const all = SCENES[c.id] ?? []
  const inRange = all.filter((s) => closeness >= (s.from ?? 0) && closeness < (s.to ?? 999))
  const unplayed = inRange.filter((s) => !done.includes(s.id))
  if (unplayed.length) return unplayed[0]

  // scenes gated above your closeness are still ahead of you, so it is worth
  // saying that there is more, just not yet
  const ahead = all.some((s) => closeness < (s.from ?? 0))
  if (ahead) return null

  // otherwise you have had every evening this person has to give
  return null
}

/** Is there more to come if you get closer, or have you had all of it. */
export function hasMoreLater(c: Character, closeness: number): boolean {
  return (SCENES[c.id] ?? []).some((s) => closeness < (s.from ?? 0))
}

/* ------------------------------------------------------------------ facts */

export function factsFor(c: Character): Fact[] {
  if (c.facts?.length) return c.facts
  // tuned so the first one lands at the end of your first proper conversation,
  // the second around the third, the last around the fifth. no waiting.
  const q = quirksOf(c.id)
  const middle = q[q.length - 1]
  return [
    { at: 15, label: 'What they actually want', text: c.need },
    {
      at: 45,
      label: 'Something they do not know they do',
      text: middle ? `${middle.name}. ${middle.detail}` : c.presents,
    },
    { at: 75, label: 'The thing they have told nobody', text: c.secret },
  ]
}
