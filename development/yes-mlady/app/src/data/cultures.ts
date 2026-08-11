import type { Culture, CultureId } from './types'

/**
 * Eight cultures, one per biome. These are not flavour text. Each one defines
 * what counts as forward, what counts as tender and how silence is read, and
 * those three things change what the same verb means from one place to another.
 *
 * Saying nothing to a Reedkin is a kindness. Saying nothing to a Moot courtier
 * is a verdict. The tell does not change. What it costs you does.
 */
export const CULTURES: Record<CultureId, Culture> = {
  rowfolk: {
    id: 'rowfolk',
    name: 'Rowfolk',
    seat: 'marrow',
    blurb:
      'Nine streets of people who have all been robbed by the same four families and have organised accordingly. Loud, quick, and unsentimental about everything except the dead.',
    greeting: 'Names last. Business first, and then you are told who you have been talking to.',
    forward: 'Asking where somebody sleeps.',
    tender: 'Fixing a thing of theirs without mentioning that you have.',
    taboo: 'Paying for something that was offered. It makes the offer a transaction and the offer was the point.',
    silence: 'Read as agreement. Rowfolk assume you would have said so.',
  },
  fieldborn: {
    id: 'fieldborn',
    name: 'Fieldborn',
    seat: 'lowfield',
    blurb:
      'Tenants three generations deep on ground they will never hold the paper for. Enormous patience, long memories, and a very particular sense of humour about landlords.',
    greeting: 'The weather, at length, and it is not small talk. It is a status report.',
    forward: 'Touching someone’s hands while they are working.',
    tender: 'Waiting for someone to finish before you speak.',
    taboo: 'Talking about next year as though it is promised.',
    silence: 'Read as company. It is the ordinary state of two people who like each other.',
  },
  ashcombe: {
    id: 'ashcombe',
    name: 'Ashcombe',
    seat: 'ashcombe',
    blurb:
      'What is left of a great household, keeping the forms of a house that no longer has a roof. Everyone here is performing a version of a life that ended.',
    greeting: 'Full titles, correctly, including the ones that no longer attach to anything.',
    forward: 'Referring to the fire.',
    tender: 'Arriving on time to something that no longer matters.',
    taboo: 'Kindness offered where a third person can see it.',
    silence: 'Read as tact, and valued above almost anything else.',
  },
  stairhold: {
    id: 'stairhold',
    name: 'Stairhold',
    seat: 'palestair',
    blurb:
      'Old blood below the chapel, keeping hours that do not match anybody else’s and accounts that go back further than the parish records.',
    greeting: 'A count. Of steps, of years, of how long it has been. Always a number first.',
    forward: 'Interrupting.',
    tender: 'Letting someone finish something that has no reason to be finished.',
    taboo: 'Rounding a number.',
    silence: 'Read as permission to continue. Which is not always what you meant.',
  },
  thornsworn: {
    id: 'thornsworn',
    name: 'Thornsworn',
    seat: 'thornmarch',
    blurb:
      'The wood keeps accounts and the people who live under it have adapted. Nothing here is free and everyone is scrupulously honest about that, which outsiders find unnerving.',
    greeting: 'A statement of what you are owed and what you owe. It takes some getting used to.',
    forward: 'Giving a gift with no price named.',
    tender: 'Refusing something, clearly, so that no debt forms.',
    taboo: 'Saying thank you. It closes a ledger that was doing useful work.',
    silence: 'Read as a counter-offer. Nobody here believes silence is empty.',
  },
  reedkin: {
    id: 'reedkin',
    name: 'Reedkin',
    seat: 'reeds',
    blurb:
      'People and things living in standing water where nothing rots and nothing is buried. Slow, watchful, and entirely at peace with keeping company with the preserved.',
    greeting: 'Nothing. You stand near each other for a while and then it has happened.',
    forward: 'Asking someone how long they have been here.',
    tender: 'Touch, offered plainly, without a reason attached.',
    taboo: 'Hurrying.',
    silence: 'Read as the highest form of courtesy. Most of the good conversations here are silent.',
  },
  moot: {
    id: 'moot',
    name: 'The Moot',
    seat: 'kingsmoot',
    blurb:
      'Gold leaf over rot. Everything is a position, every kindness has a creditor, and mentioning the smell is the only unforgivable act.',
    greeting: 'A compliment with a hook in it, returned in kind, twice, before anything real starts.',
    forward: 'Plainness. Say what you mean here and you have made a scene.',
    tender: 'Being unwitty on purpose, briefly, where nobody else can hear.',
    taboo: 'Sincerity in a room with more than three people in it.',
    silence: 'Read as a verdict, and usually a bad one. Silence at the Moot is how careers end.',
  },
  roadless: {
    id: 'roadless',
    name: 'The Roadless',
    seat: 'longroad',
    blurb:
      'Not a people so much as a condition. Everyone met on the long road is between two places and is briefly, dangerously honest about it.',
    greeting: 'Where you have come from. Never where you are going, which is considered unlucky.',
    forward: 'Asking someone to travel with you past the next town.',
    tender: 'Sharing fire without conversation.',
    taboo: 'Promising to meet again.',
    silence: 'Read as trust. You do not have to entertain someone you are not lying to.',
  },
}

export const cultureOf = (id: CultureId) => CULTURES[id]
export const CULTURE_LIST = Object.values(CULTURES)
