import type { Scene } from './types'

/**
 * The rest of the roster. House style: say what happened, not how it felt. One
 * concrete detail per beat. The heat is in what is left out, so no line ever
 * names the thing it is about.
 */
export const MORE: Record<string, Scene[]> = {
  bran: [
    {
      id: 'bran-gate',
      title: 'The gate',
      to: 50,
      beats: [
        {
          text: 'He mended the gate this morning. He mended it yesterday too. At this rate he will be mending it all week.',
          choices: [
            {
              label: 'Say nothing about the gate',
              reply:
                'He mended it badly again. Neither of you mentioned it. It was the best evening of the week.',
              close: 6,
            },
            {
              label: 'Ask why it keeps breaking',
              reply:
                'He is four days from the moon. He told you the whole answer in one sentence and then had to go stand somewhere else.',
              close: 5,
            },
            {
              label: 'Tell him to fix it properly',
              reply: 'Four minutes. Then he had nowhere to be, and stood in the yard about it.',
              close: 1,
            },
          ],
        },
        {
          text: 'There is a bed. There has been a bed all week. He has slept outside every night of it.',
          says: 'It is warm enough out.',
          choices: [
            {
              label: 'Let it go',
              reply:
                'He slept outside. The water was in and the fire was going before you woke, and he would not meet your eye about either.',
              close: 5,
            },
            {
              label: 'Ask him properly',
              reply:
                '"Because I would not sleep. And then I would be awake. In a house. With you in it." He looked appalled at himself.',
              close: 6,
            },
          ],
        },
        {
          text: 'A hare on the step, very neatly taken. He got about halfway through the gesture before he saw it from the outside.',
          choices: [
            {
              label: 'Take it',
              reply:
                'His whole face changed. He talked for ten minutes about the hedge it came from and none of it was about the hedge.',
              close: 6,
            },
            {
              label: 'Tell him not to',
              reply: 'He buried it. That was worse than either of you expected.',
              close: 1,
            },
          ],
        },
      ],
    },
  ],

  ilyr: [
    {
      id: 'ilyr-flower',
      title: 'The flower',
      to: 50,
      beats: [
        {
          text: 'There is a flower on the table that does not grow in this country or this season. It is repayment for a compliment you paid him on Tuesday. It is worth slightly more than the compliment.',
          choices: [
            {
              label: 'Refuse it',
              reply:
                'He took it back with perfect grace and it cost him something real. For about four seconds he was actually in the room.',
              close: 6,
            },
            {
              label: 'Leave it where it is',
              reply:
                'By morning it had wilted, which flowers of that kind are not supposed to do.',
              close: 5,
            },
            {
              label: 'Keep it',
              reply: 'He was delighted. You owe him now, and he has already decided what for.',
              close: 1,
            },
          ],
        },
        {
          text: 'He has been in the doorway all evening. He has not been asked in and will not raise it.',
          choices: [
            {
              label: 'Leave him there',
              reply:
                'He stayed. He was better company from the threshold than he has been anywhere else in this house.',
              close: 6,
            },
            {
              label: 'Ask him in',
              reply:
                'He came in. Something went out of the evening that neither of you could name.',
              close: 2,
            },
          ],
        },
        {
          text: 'You asked him something directly. He gave you three true statements in a row, none of them the answer, and waited to see whether you noticed.',
          says: 'All of that is true, m’lady.',
          choices: [
            {
              label: 'Ask again, worded tighter',
              reply:
                'He smiled, and answered, and the answer cost him. He will be repaying himself for it all week.',
              close: 6,
            },
            {
              label: 'Tell him you noticed',
              reply: '"Yes." A pause. "Most people do not." He did not sound pleased about most people.',
              close: 5,
            },
            {
              label: 'Let it go',
              reply: 'The three statements remain true and remain useless.',
              close: 1,
            },
          ],
        },
      ],
    },
  ],

  anselm: [
    {
      id: 'anselm-table',
      title: 'At the table',
      to: 50,
      beats: [
        {
          text: 'He started confessing at supper and got four sentences in before you understood it was about you. He has not stopped. He is being thorough.',
          choices: [
            {
              label: 'Cut him off',
              reply:
                'He stopped mid word. He looked at you with something close to gratitude and something not close to it at all.',
              close: 6,
            },
            {
              label: 'Let him finish',
              reply:
                'He talked to the end and then sat in the wreckage of it, alone, which is where he always ends up.',
              close: 2,
            },
          ],
        },
        {
          text: 'There are pages now. Not hidden. On the sill, on the stair, one folded into the book you have been reading.',
          choices: [
            {
              label: 'Look at him over the top of the page',
              reply:
                'He went the colour of the candle and did not look away, which is new.',
              close: 6,
            },
            {
              label: 'Leave them where they are',
              reply: 'There are more of them now. They have started being addressed.',
              close: 4,
            },
            {
              label: 'Burn them',
              reply: 'He helped. There were fresh ones by Thursday.',
              close: 2,
            },
          ],
        },
        {
          text: 'He has not eaten since yesterday. Visibly. In the room where you were eating. He has mentioned it exactly no times, which from him is a scream.',
          choices: [
            {
              label: 'Ask why',
              reply:
                '"Because it is the only thing I am able to deny myself." He said it evenly. Then he heard it. Then he left the room.',
              close: 6,
            },
            {
              label: 'Put a plate in front of him',
              reply:
                'He ate. He hated it. He was better company afterward and resented that too.',
              close: 4,
            },
          ],
        },
      ],
    },
  ],

  corwin: [
    {
      id: 'corwin-again',
      title: 'The eleventh time',
      to: 50,
      beats: [
        {
          text: 'He introduced himself again. Better this time. He will not remember having done it and he was pleased with how it went.',
          says: 'Corwin Ash. I am glad of the fire.',
          choices: [
            {
              label: 'Tell him the truth about the hour',
              reply:
                'He took it well. He always takes it well. That is the part that costs you.',
              close: 6,
            },
            {
              label: 'Let him have it',
              reply:
                'He brightened the way people do when they have got something right, and he has got it right eleven times.',
              close: 4,
            },
          ],
        },
        {
          text: 'He has been standing watch over a side of the house with no road on it. There has not been a road there in forty years.',
          choices: [
            {
              label: 'Call him in',
              reply:
                'He came. Within the hour he was back out, apologising for being out there, not knowing what for.',
              close: 4,
            },
            {
              label: 'Go and stand with him',
              reply:
                'Two hours. He talked about the road as though it were there. By the end you could see it too.',
              close: 6,
            },
          ],
        },
        {
          text: 'There are notes around the house in a hand very like yours, because he has been copying yours. Where the water is. That the third stair is loud. Her name is. He has not finished that one.',
          choices: [
            {
              label: 'Ask about the system',
              reply:
                'He showed you all of it. He was proud of it. He explained it twice in the same hour with the same pride.',
              close: 5,
            },
            {
              label: 'Finish the note for him',
              reply:
                'He found it that evening. He read it eleven times. He was still reading it in the morning.',
              close: 6,
            },
            { label: 'Leave them alone', reply: 'Four more by evening. One of them was about you.', close: 4 },
          ],
        },
      ],
    },
  ],

  ceril: [
    {
      id: 'ceril-gift',
      title: 'The ring',
      to: 50,
      beats: [
        {
          text: 'Something arrived that you did not ask for and could not have afforded. It is in your name. So is the note against it.',
          choices: [
            {
              label: 'Send it back',
              reply:
                'He did. He was quiet for a day afterward and it was the first honest day he has had here.',
              close: 6,
            },
            {
              label: 'Leave it unopened',
              reply: 'It sat between you for a week. He looked at it more often than you did.',
              close: 5,
            },
            { label: 'Wear it', reply: 'He was delighted, briefly, like a man who has bought an evening.', close: 1 },
          ],
        },
        {
          text: 'He was called away at supper. Again. He did not say by whom. He apologised beautifully and went.',
          choices: [
            {
              label: 'Ask who',
              reply:
                '"A man with a ledger." Lightly said. The lightness was the most expensive thing he has given you.',
              close: 6,
            },
            {
              label: 'Be asleep when he returns',
              reply:
                'He came in at three and sat downstairs until it was light. You heard the chair move once.',
              close: 4,
            },
          ],
        },
        {
          text: 'He gave you a stone out of the yard. No setting, no story, nothing owed against it. He would not say why.',
          choices: [
            {
              label: 'Keep it where he can see it',
              reply:
                'He checks twice a day whether it has moved. It has not. It is the only thing in this house that is his.',
              close: 6,
            },
            { label: 'Ask why', reply: 'He changed the subject in one move, which he is very good at.', close: 3 },
          ],
        },
      ],
    },
  ],

  dred: [
    {
      id: 'dred-boards',
      title: 'The floorboards',
      to: 50,
      beats: [
        {
          text: 'He has been standing on the stone part of the floor all evening, because the boards mark. He has arranged the whole night around not being a nuisance.',
          choices: [
            {
              label: 'Tell him to come onto the boards',
              reply:
                'He did. They marked. He watched the marks the whole time and you watched him watch them.',
              close: 6,
            },
            {
              label: 'Go and stand on the stone with him',
              reply:
                'It is a small piece of floor. Neither of you said anything about how small.',
              close: 6,
            },
            { label: 'Leave it', reply: 'He was good company from over there. He is used to being good company from over there.', close: 3 },
          ],
        },
        {
          text: 'You reached past him for the lamp. He flinched. Not away from you. Ahead of you, before contact.',
          choices: [
            {
              label: 'Hold still and look at him',
              reply:
                'He did not flinch the second time. He looked as though something very old had been set down.',
              close: 6,
            },
            {
              label: 'Pretend you did not see',
              reply:
                'He apologised for it. Then for the apology. He is very practised at this.',
              close: 2,
            },
          ],
        },
        {
          text: 'There is water on the sill in a shape that is nearly a word. Four nights now, and nearly the same word each time.',
          choices: [
            {
              label: 'Ask what it says',
              reply:
                'A long moment. "It is a name. It is not mine." Then he wiped the sill, carefully, and that was that.',
              close: 6,
            },
            { label: 'Leave the sill alone', reply: 'It was there again in the morning. Closer to finished.', close: 5 },
          ],
        },
      ],
    },
  ],

  vasha: [
    {
      id: 'vasha-hands',
      title: 'The left hand',
      to: 50,
      beats: [
        {
          text: 'Her right hand was shaking over the basin. She switched to the left without comment and carried on. She is faster with the left than most people are with either.',
          choices: [
            {
              label: 'Tell her to stop',
              reply:
                'She sat down. She was furious about it for about ninety seconds and then she was asleep.',
              close: 6,
            },
            {
              label: 'Hand her the next instrument',
              reply: 'She took it without looking up. There is always a next one.',
              close: 2,
            },
          ],
        },
        {
          text: 'Somebody brought her supper. She thanked them, moved it to the far end of the bench, and used the space for her instruments.',
          choices: [
            {
              label: 'Sit down opposite her and say nothing',
              reply:
                'She ate it eventually, without acknowledging that she had, and did not ask you to leave.',
              close: 6,
            },
            {
              label: 'Tell her to eat',
              reply: 'Four mouthfuls, standing, to end the conversation. It worked.',
              close: 2,
            },
          ],
        },
        {
          text: 'There is a cut on your hand you had not mentioned. She saw it across a room, through a crowd, and had it clean and wrapped before you finished your sentence.',
          choices: [
            {
              label: 'Let her',
              reply:
                'She said "good," and did not let go for a moment longer than the work needed, and then let go very fast.',
              close: 6,
            },
            {
              label: 'Ask who looks after her',
              reply: 'She laughed. It was not a good laugh and she knew it, and she tidied instead of answering.',
              close: 5,
            },
          ],
        },
      ],
    },
  ],

  ottoline: [
    {
      id: 'otto-gallery',
      title: 'The long gallery',
      to: 50,
      beats: [
        {
          text: 'It rained into the gallery for most of the audience. She did not move her chair and did not acknowledge the water, and conducted an hour of ordinary conversation with her hair going flat.',
          choices: [
            {
              label: 'Say nothing about the rain',
              reply: 'At the end she said "thank you" in a tone that had nothing to do with the conversation.',
              close: 6,
            },
            {
              label: 'Move your own chair into the wet',
              reply:
                'She looked at you for a long moment. Then she carried on with the sentence she had been in the middle of.',
              close: 6,
            },
            { label: 'Offer to have it seen to', reply: 'She thanked you for your understanding. The gallery got several degrees colder.', close: 0 },
          ],
        },
        {
          text: 'Three dresses in rotation for the whole of your acquaintance, arranged so that it would not be obvious. It is a considerable feat of engineering.',
          choices: [
            {
              label: 'Let her see that you know',
              reply:
                'She held your eye and did not flinch, and something between you was settled without a word spent on it.',
              close: 6,
            },
            { label: 'Never mention it', reply: 'There is a fourth now. She has not explained it.', close: 4 },
          ],
        },
        {
          text: 'There is a covered glass at the end of the gallery. She walks the long way around it. Today she stopped beside it, briefly, and then went on.',
          choices: [
            {
              label: 'Say nothing and let the day pass',
              reply:
                'That evening she uncovered it herself, looked once, covered it again, and slept badly.',
              close: 6,
            },
            { label: 'Ask what it is', reply: '"It is a mirror. It works." That was the entire answer and it was more than she meant to give.', close: 5 },
          ],
        },
      ],
    },
  ],

  morrow: [
    {
      id: 'morrow-north',
      title: 'North and a bit west',
      to: 50,
      beats: [
        {
          text: 'She stood at the window a long time facing a direction with nothing in it. When she noticed you noticing she came away smoothly and asked about supper.',
          choices: [
            {
              label: 'Ask what is that way',
              reply:
                '"North. And a bit west." Then she asked about supper again, and you understood the door had been open about two seconds.',
              close: 6,
            },
            { label: 'Answer about supper', reply: 'It was very good. She was somewhere else for all of it.', close: 3 },
          ],
        },
        {
          text: 'You offered her something she plainly wanted. She refused before she had finished looking at it. That is four times, each one faster.',
          choices: [
            {
              label: 'Stop offering',
              reply:
                'Within the week she took something small without being offered it, and checked your face afterward.',
              close: 6,
            },
            { label: 'Offer again', reply: 'She refused again and thanked you again and the wall went up another course.', close: 1 },
          ],
        },
        {
          text: 'Her hair was wet this morning. There is no water within an hour of here. There is salt on the sill.',
          choices: [
            {
              label: 'Say nothing',
              reply: 'It happened again on Thursday. She has stopped hiding the sill, which is not the same as telling you.',
              close: 5,
            },
            {
              label: 'Ask',
              reply:
                'She said it was the rain. It has not rained. She knew you knew and said it anyway, and looked tired.',
              close: 4,
            },
            {
              label: 'Hand her a cloth',
              reply:
                'She dried it in front of you, deliberately, without a word. That was the whole confession.',
              close: 6,
            },
          ],
        },
      ],
    },
  ],

  ilsabet: [
    {
      id: 'ilsa-price',
      title: 'The price',
      to: 50,
      beats: [
        {
          text: 'She fixed the thing you did not ask her to fix and named her price. It is small, and reasonable, and built so that paying it will require you to come back.',
          choices: [
            {
              label: 'Refuse to pay it',
              reply:
                'She laughed, actually laughed. "Then it is a gift," she said, and looked deeply uncomfortable saying it.',
              close: 6,
            },
            { label: 'Pay it', reply: 'Noted. She will see you Thursday. Thursday will have a price too.', close: 2 },
          ],
        },
        {
          text: 'Somebody came to the hedge at night. She dealt with them at the gate, did not let them past it, and came back in mid sentence.',
          choices: [
            {
              label: 'Carry on as though nothing happened',
              reply:
                'Later, without preamble, she said "that was my brother." And then nothing else, all evening.',
              close: 6,
            },
            { label: 'Ask who it was', reply: '"Someone who owes me." True, and the least of it, and the subject shut with the door.', close: 3 },
          ],
        },
        {
          text: 'You have been given nothing today. No cure, no charm, no favour. She has worked in the same room and let you simply be there.',
          choices: [
            {
              label: 'Stay where you are',
              reply:
                'Three hours. It is the most she has ever given anybody and neither of you called it anything.',
              close: 6,
            },
            { label: 'Ask if she needs anything', reply: 'She found something for you to do, and the afternoon was over.', close: 1 },
          ],
        },
      ],
    },
  ],

  harness: [
    {
      id: 'harness-water',
      title: 'Three trips',
      to: 50,
      beats: [
        {
          text: 'It carried the water in. Nobody asked. The buckets were not heavy and it made three trips anyway, then stood by them as though awaiting inspection.',
          choices: [
            {
              label: 'Inspect them',
              reply:
                'The gauntlets came together once, very quietly. It has stood differently since.',
              close: 6,
            },
            { label: 'Say nothing', reply: 'It stood by the buckets until well after dark.', close: 3 },
          ],
        },
        {
          text: 'It has moved nearer the hearth by degrees all evening, and then, at some point you did not see, nearer to you. The metal is warm. That is not a figure of speech.',
          choices: [
            {
              label: 'Stay where you are',
              reply: 'It was warm for a long time. Nothing else happened and it was a great deal.',
              close: 6,
            },
            {
              label: 'Put your hand flat against the breastplate',
              reply:
                'It did not move for eleven minutes. Neither did you. The fire went out at some point and neither of you attended to it.',
              close: 6,
            },
            { label: 'Send it back to the wall', reply: 'It withdrew at once and was cold by morning.', close: 0 },
          ],
        },
        {
          text: 'Someone at the gate spoke in a certain register and it went down on one knee before you had turned around.',
          choices: [
            {
              label: 'Tell it to stand',
              reply: 'It rose. It has faced the gate all night, which it has not done before.',
              close: 6,
            },
            { label: 'Go and see who is at the gate', reply: 'Nobody. It is still down. It stayed down until morning.', close: 4 },
          ],
        },
      ],
    },
  ],

  stair: [
    {
      id: 'stair-hour',
      title: 'An hour you would rather nobody knew',
      to: 50,
      beats: [
        {
          text: 'You went down at an hour you would rather nobody knew about. It announced you at volume, and then, in the silence afterward, made a smaller sound that was not structural.',
          choices: [
            {
              label: 'Tell it that was all right',
              reply:
                'It creaked once, differently. The whole flight has been warmer underfoot since and there is no fire near it.',
              close: 6,
            },
            { label: 'Go back up', reply: 'It announced that too. It has been very quiet all day.', close: 2 },
          ],
        },
        {
          text: 'You stood on it on purpose. Not passing through. Just stood, in the middle of the day, with nowhere to be.',
          choices: [
            {
              label: 'Stay a while',
              reply:
                'It stopped creaking altogether, which it has never managed. It started again the moment you moved, apologetically.',
              close: 6,
            },
            { label: 'Move on', reply: 'It creaked, uncertainly, at intervals, like somebody filling a silence.', close: 3 },
          ],
        },
        {
          text: 'It let someone else past in silence last night. It has never done that. It has been making very small noises all day in an empty house.',
          choices: [
            {
              label: 'Walk down it slowly',
              reply: 'It announced you the whole way, at full volume, and sounded enormously relieved to be doing it.',
              close: 6,
            },
            { label: 'Leave the house to itself', reply: 'The noises stopped by evening. It has been silent since and you find you do not like it.', close: 4 },
          ],
        },
      ],
    },
  ],

  mirror: [
    {
      id: 'mirror-doorway',
      title: 'The doorway',
      to: 50,
      beats: [
        {
          text: 'It showed you the doorway. There was nothing in the doorway. You checked twice. It has not shown you anything since.',
          choices: [
            {
              label: 'Go back and look into it properly',
              reply: 'A long time. It showed you your own hands. That was all, and it was plenty.',
              close: 6,
            },
            { label: 'Stay out of that room', reply: 'The glass went ordinary for four days. Ordinary, from this thing, is unnerving.', close: 2 },
          ],
        },
        {
          text: 'You covered it. The cloth was off again by morning, folded, on the chair. Nobody in this house folds like that.',
          choices: [
            {
              label: 'Leave it uncovered and do not look',
              reply:
                'Three days. On the fourth it showed you something small and kind, which it has never done, and then went dark.',
              close: 6,
            },
            { label: 'Cover it again', reply: 'It has not fought you since. You keep checking that the cloth is still on.', close: 3 },
          ],
        },
        {
          text: 'It showed you a mended latch. You have not seen that latch in years and did not know you remembered it.',
          choices: [
            {
              label: 'Look for as long as it will hold it',
              reply:
                'It held it. Then, for half a second, the hands that mended it. Then the room, correctly, and nothing else all night.',
              close: 6,
            },
            { label: 'Look away', reply: 'It held the image most of the evening and then let it go.', close: 3 },
          ],
        },
      ],
    },
  ],

  wren: [
    {
      id: 'wren-ink',
      title: 'Ink on three surfaces',
      to: 50,
      beats: [
        {
          text: 'She has been up since four writing something she will not show you. She is delighted about it. There is ink on three separate surfaces and she has noticed none of them.',
          choices: [
            {
              label: 'Ask to hear a line',
              reply:
                'She read you two, immediately, without being asked twice. They were good. She has no idea they were good.',
              close: 6,
            },
            { label: 'Clean up the ink', reply: 'She wrote around where it had been for the rest of the week.', close: 3 },
          ],
        },
        {
          text: 'She woke on the floor again, dressed, with the candle burned down. She made a joke of it. It is the same joke.',
          choices: [
            {
              label: 'Ask what happens at night',
              reply:
                'The laugh went. "They tidy. That is the worst part. I wake up and my things are in better places than I left them."',
              close: 6,
            },
            { label: 'Laugh with her', reply: 'She picked the joke back up and put it away.', close: 2 },
          ],
        },
        {
          text: 'There is a letter on the table in a hand not quite hers, addressed to her, read and folded and left where she will find it.',
          choices: [
            {
              label: 'Leave it exactly as it is',
              reply:
                'She read it at the table with her back to you in the morning, and did not say what was in it, and was in a very good mood.',
              close: 6,
            },
            {
              label: 'Sit up and wait for whoever wrote it',
              reply:
                '"It is not for you." Said without heat. Then, after a while: "She is not as tired as she says. Ask her about the Tuesdays."',
              close: 6,
            },
          ],
        },
      ],
    },
  ],
}
