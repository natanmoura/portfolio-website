/**
 * Quirks replace the hidden six-axis model. Everything about a person that can
 * change is on this list, in plain words, visible from the moment you meet them.
 *
 * Each one carries what happens if somebody tries to change it. `warp` is the
 * usual outcome, because the magic compels them to try and does not make them
 * able. `took` is the rare clean one. Neither ever removes the quirk. It moves.
 */
export type Quirk = {
  id: string
  /** short, concrete, peculiar. reads as an observation, not a stat. */
  name: string
  /** one line. the specific detail that makes it real. */
  detail: string
  /** what it becomes when someone changes it and they get it wrong */
  warp: string
  /** what it becomes when it takes cleanly. rarer. */
  took: string
}

export const QUIRKS: Record<string, Quirk[]> = {
  aldous: [
    {
      id: 'aldous-kneel',
      name: 'Kneels, and waits to be told to stand',
      detail: 'He will hold it past the point of comfort. He does not shift.',
      warp: 'He stands now. Too close, too straight, waiting for an order that is not coming.',
      took: 'He gets up when he is finished. He has begun deciding when that is.',
    },
    {
      id: 'aldous-gorget',
      name: 'Puts a hand to his throat when he is thinking',
      detail: 'The gorget is not there half the time. The hand goes anyway.',
      warp: 'The hand goes to his belt instead, and stays, and he grips it hard enough to mark the leather.',
      took: 'The hand stays down. He looks unfinished for a week and then he does not.',
    },
    {
      id: 'aldous-apology',
      name: 'Apologises for being right',
      detail: 'He will correct you, then spend six hours making amends for the correction.',
      warp: 'He stopped apologising. He also stopped correcting you, and you have made two errors since.',
      took: 'He says the thing and lets it stand. He watches you take it, every time, to check.',
    },
  ],

  wick: [
    {
      id: 'wick-take',
      name: 'Takes small things and gives them back mended',
      detail: 'Two teeth on a comb, in a wood that does not match. He never mentions it.',
      warp: 'He stopped taking. He leaves things instead. Better things, from somewhere.',
      took: 'He asks first now. It is a strange thing to be asked and it takes some getting used to.',
    },
    {
      id: 'wick-door',
      name: 'Eats standing, near the door',
      detail: 'There has been a chair available for nine days.',
      warp: 'He sits. He sits the way a man sits on a fence he intends to be over shortly.',
      took: 'He sits, badly, and stays sat, and hates every minute of the first month.',
    },
    {
      id: 'wick-hands',
      name: 'Shows you his hands when he is nervous',
      detail: 'Palms out, low, without being asked. Somebody taught him that.',
      warp: 'He keeps them in his pockets now, which reads as insolence to everyone but you.',
      took: 'He stopped. He had not known he was doing it, and finding out was worse than the habit.',
    },
  ],

  orsolt: [
    {
      id: 'orsolt-count',
      name: 'Counts anything spilled, to the end',
      detail: 'Barley, beads, steps, the pulse in a wrist. He cannot leave a set unfinished.',
      warp: 'He counts silently. He is half absent at all times now and you cannot prove it.',
      took: 'He can leave one set unfinished a day. He spends it very carefully.',
    },
    {
      id: 'orsolt-warm',
      name: 'Warms his hands at the fire before touching anyone',
      detail: 'A full hour, some nights. The hands come out correct. Nothing else does.',
      warp: 'He stopped warming them and touches you cold, deliberately, to see what you do.',
      took: 'He does it in ten minutes and no longer announces that he has.',
    },
    {
      id: 'orsolt-92',
      name: 'Insists the stair is ninety two steps',
      detail: 'It is ninety three. Everyone who has counted agrees. He is not wrong about anything else.',
      warp: 'He has stopped saying the number. He still walks it as though it were ninety two and he still misses the last one.',
      took: 'He says ninety three. He says it like a man reading his own name off a stone.',
    },
  ],

  bran: [
    {
      id: 'bran-honest',
      name: 'Cannot lie in the week before the moon',
      detail: 'Not even the small kind ones. He knows the date better than anyone alive.',
      warp: 'He learned silence instead. In that week the silence acquires a shape and it is louder.',
      took: 'He can manage one lie a day, and he spends it on something enormous and stupid.',
    },
    {
      id: 'bran-gate',
      name: 'Mends the gate badly on purpose',
      detail: 'So that it will need mending again tomorrow, and he will have a reason to be there.',
      warp: 'He mends it properly and then finds three other things wrong with the house.',
      took: 'He fixed the gate and asked, out loud, whether he could come by anyway.',
    },
  ],

  ilyr: [
    {
      id: 'ilyr-owe',
      name: 'Repays every gift slightly too well',
      detail: 'So the debt reverses. He has been ahead of everyone he has ever met.',
      warp: 'He repays in attention now instead of objects, and you find you preferred the objects.',
      took: 'He accepted something and gave nothing back and had to sit down afterward.',
    },
    {
      id: 'ilyr-true',
      name: 'Says only true things, none of them answers',
      detail: 'Three true statements in a row and you leave the room with nothing.',
      warp: 'He answers directly, briefly, and then leaves for two days.',
      took: 'He answers. It is the plainest voice you have heard from him and it does not suit him at all.',
    },
    {
      id: 'ilyr-door',
      name: 'Will not come in unless asked, and will not ask',
      detail: 'He will run an entire evening from the threshold rather than raise it.',
      warp: 'He comes in without being asked and is somehow less present in the room than he was in the door.',
      took: 'He asked. Four words. He looked ill afterward.',
    },
  ],

  anselm: [
    {
      id: 'anselm-confess',
      name: 'Confesses out loud to whoever is nearest',
      detail: 'His, yours, and several that have not happened. He does not stop when you leave.',
      warp: 'He writes it down instead and leaves the pages where you will certainly find them.',
      took: 'He tells one person one thing per day, on purpose, and it costs him the whole day.',
    },
    {
      id: 'anselm-word',
      name: 'Stops at the same word in the same prayer',
      detail: 'Every night. It is a very ordinary word and he will not say which.',
      warp: 'He skips it now. The prayer finishes and it is not the same prayer and he knows.',
      took: 'He got past it once. He has not been able to repeat it and he has tried every night since.',
    },
  ],

  corwin: [
    {
      id: 'corwin-hour',
      name: 'Loses the last hour, every hour',
      detail: 'Everything else survives. He is very good at the first ten minutes.',
      warp: 'He leaves himself notes now, in your handwriting, because he copies yours.',
      took: 'He keeps two hours. He spends the second one checking that he still has it.',
    },
    {
      id: 'corwin-watch',
      name: 'Stands watch over a road that is not there',
      detail: 'It was there forty years ago. Nobody has told him and he has not asked.',
      warp: 'He watches the door instead, from inside, all night, which is worse for everyone.',
      took: 'He stopped. He has not found anything to do with the hours and it shows.',
    },
  ],

  ceril: [
    {
      id: 'ceril-owed',
      name: 'Gives you things that belong to creditors',
      detail: 'Beautiful, generous, and already promised. He knows and he does it anyway.',
      warp: 'He gives you nothing at all now and is charming about it, which costs him more.',
      took: 'He gave you a stone out of the yard. It is the only thing here that is actually his.',
    },
    {
      id: 'ceril-called',
      name: 'Gets called away at supper',
      detail: 'Never says by whom. Apologises beautifully. The apology is the one thing he owns.',
      warp: 'He stays, and is somewhere else for all of it, and somebody pays for that later.',
      took: 'He told them no. Once. You have not seen what it cost and he will not say.',
    },
  ],

  dred: [
    {
      id: 'dred-wet',
      name: 'Cannot be dry',
      detail: 'Wet at the hairline in every weather. He arranges his whole evening around the floorboards.',
      warp: 'He dried out. He is lighter, and quieter, and something has gone out of his face.',
      took: 'He stopped apologising for the marks. The marks are still there. He walks through the middle now.',
    },
    {
      id: 'dred-flinch',
      name: 'Flinches before you touch him, not after',
      detail: 'Ahead of contact. He has learned what usually follows.',
      warp: 'He holds still now, deliberately, with visible effort, which is not the same as not flinching.',
      took: 'He did not flinch. He looked as though something very old had been set down.',
    },
  ],

  vasha: [
    {
      id: 'vasha-left',
      name: 'Switches to her left hand when the right shakes',
      detail: 'Without comment. She is faster with the left than most people are with either.',
      warp: 'She stopped switching. She works through the shake and the work is worse and she knows.',
      took: 'She put the instruments down. First time in four years. She sat there furious about it.',
    },
    {
      id: 'vasha-supper',
      name: 'Moves food to the far end of the bench',
      detail: 'To make room for instruments. It is always still there in the morning, cold.',
      warp: 'She eats standing, in four mouthfuls, to end the conversation. It works.',
      took: 'She eats when somebody sits down opposite her and does not talk.',
    },
    {
      id: 'vasha-name',
      name: 'Keeps a name written where she can see it while she works',
      detail: 'Not a list. One name. She has never explained it and nobody has asked twice.',
      warp: 'She turned it to the wall. She still knows exactly where it is and looks at the wall.',
      took: 'She said it out loud, once, to you, and then went back to work.',
    },
  ],

  ottoline: [
    {
      id: 'otto-rain',
      name: 'Will not acknowledge the leak',
      detail: 'She holds an hour of ordinary conversation with her hair going flat.',
      warp: 'She has the chairs moved. She now conducts everything from the one dry corner and calls it preference.',
      took: 'She said "it is raining in" and carried on, and it was the most shocking thing she has ever done.',
    },
    {
      id: 'otto-three',
      name: 'Three dresses, rotated so you will not notice',
      detail: 'The rotation is a genuine feat of engineering and you were not supposed to see it.',
      warp: 'Four now. The fourth is not hers and she will not say whose.',
      took: 'She wears the same one twice running and dares you, with her whole face, to remark on it.',
    },
  ],

  morrow: [
    {
      id: 'morrow-north',
      name: 'Faces north and a bit west when she thinks nobody is looking',
      detail: 'There is nothing in that direction for two hundred miles.',
      warp: 'She faces the wall now. Same length of time. Same hour.',
      took: 'She told you what is that way. She has not gone. That is a separate problem.',
    },
    {
      id: 'morrow-refuse',
      name: 'Refuses things before she has finished looking at them',
      detail: 'Gracefully, instantly, and a little faster each time.',
      warp: 'She accepts everything now, all of it, and none of it reaches her.',
      took: 'She took something small without being offered it, and checked your face afterward.',
    },
    {
      id: 'morrow-wet',
      name: 'Her hair is wet some mornings',
      detail: 'There is no water within an hour of here. There is salt on the sill.',
      warp: 'The sill is clean now. Her hair is still wet and she has stopped hiding it, which is not the same as telling you.',
      took: 'She dried it in front of you, deliberately, without a word, and that was the whole confession.',
    },
  ],

  ilsabet: [
    {
      id: 'ilsa-price',
      name: 'Names a price small enough that you will come back',
      detail: 'It is never about the money. The arithmetic is about the return trip.',
      warp: 'She names no price at all now and stands there afterward looking robbed.',
      took: 'She said "come back anyway" and heard herself say it.',
    },
    {
      id: 'ilsa-gate',
      name: 'Deals with callers at the gate and never past it',
      detail: 'Whoever it is. Whatever the hour. She comes back in and picks up mid sentence.',
      warp: 'She lets them in now and conducts it in front of you, which is a punishment for somebody.',
      took: 'She let one past. She told you who he was afterward, unprompted, in four words.',
    },
  ],

  corvane: [
    {
      id: 'corv-wall',
      name: 'Always takes the seat with its back to the wall',
      detail: 'Without appearing to choose it. You have never once seen her sit elsewhere.',
      warp: 'She takes any seat now and spends the evening with her hand near the table edge.',
      took: 'She sat facing away from the door. She managed forty minutes and then laughed at herself.',
    },
    {
      id: 'corv-between',
      name: 'Puts herself between you and things, mid sentence',
      detail: 'Without breaking stride or losing the thread of what she was saying.',
      warp: 'She asks first now. The asking takes two seconds and both of you have thought about those two seconds.',
      took: 'She stopped. She walks beside you. She is much worse company and much better off.',
    },
    {
      id: 'corv-mend',
      name: 'Mends things with the same hands, and looks well doing it',
      detail: 'A hinge, a strap, a bowl. It is the only time her shoulders come down.',
      warp: 'She mends compulsively now and has started breaking small things to have them to fix.',
      took: 'She finished, found nothing else, and sat down, which is unheard of.',
    },
  ],

  harness: [
    {
      id: 'harn-voice',
      name: 'Kneels to the right voice, not the right person',
      detail: 'It has been wrong about this before. It will be wrong again.',
      warp: 'It kneels to nobody now and vibrates faintly when it wants to. Nobody has explained the vibration.',
      took: 'It kneels only to you. Everyone finds this much more disturbing than the old arrangement.',
    },
    {
      id: 'harn-warm',
      name: 'Holds heat, and moves nearer by degrees',
      detail: 'It is metal. That is the whole explanation and it is somehow sufficient.',
      warp: 'It keeps its distance and stays cold, and the room is worse, and it knows the room is worse.',
      took: 'It stopped pretending the fire was the reason.',
    },
  ],

  stair: [
    {
      id: 'stair-announce',
      name: 'Announces everyone who walks on it',
      detail: 'Not will not. Cannot. It is sorry every single time.',
      warp: 'It creaks at a lower pitch now. Lower is not quieter. Lower is worse.',
      took: 'It can hold one silence a night. It saves it, and you can feel it saving it.',
    },
    {
      id: 'stair-warm',
      name: 'Warmer than the eighth and the tenth',
      detail: 'There is no fire near it. Nobody has explained this either.',
      warp: 'It went cold. The eighth and tenth are unchanged. You keep checking.',
      took: 'It warms under you specifically and cools the moment anyone else is on the flight.',
    },
  ],

  mirror: [
    {
      id: 'mir-show',
      name: 'Shows you the thing you were not looking at',
      detail: 'Not the future. Not a lie. Attention, redirected, without permission.',
      warp: 'It is kind about it now. It shows you anyway, gently, which is very much worse.',
      took: 'It waits to be asked. It has been waiting eleven days.',
    },
    {
      id: 'mir-slow',
      name: 'The reflection is half a second late',
      detail: 'Only when you are not testing for it.',
      warp: 'It is on time now, exactly, always, and you have started testing for it constantly.',
      took: 'It caught up. You have not been able to shake the feeling that something is standing very still.',
    },
  ],

  sable: [
    {
      id: 'sable-face',
      name: 'Nobody remembers their face correctly',
      detail: 'Four people will describe four people. None of them notice.',
      warp: 'Everyone agrees on the face now and none of them can recall the conversation.',
      took: 'One face. It is not a remarkable one and they are visibly braced about it.',
    },
    {
      id: 'sable-ring',
      name: 'Keeps one detail the same each day',
      detail: 'The ring on the left hand, four days running now. It took them some effort.',
      warp: 'They keep everything the same and have stopped being in the room very much.',
      took: 'Five details. Then seven. You could pick them out of a crowd and neither of you says so.',
    },
  ],

  wren: [
    {
      id: 'wren-ink',
      name: 'Spills ink and writes around it',
      detail: 'Three surfaces this week. She has not noticed any of them.',
      warp: 'She is careful now. She is also much slower, and the writing is worse, and she has noticed that.',
      took: 'She still spills it. She wipes it up. It takes four seconds and it took eleven years.',
    },
    {
      id: 'wren-floor',
      name: 'Wakes on the floor and makes a joke of it',
      detail: 'The same joke. She has been making it for a while now.',
      warp: 'She stopped joking. She wakes, and looks at where her things have been moved to, and says nothing.',
      took: 'She asked what happened. Out loud. To the empty room. And then waited.',
    },
    {
      id: 'wren-tidy',
      name: 'The other one tidies',
      detail: 'She wakes to her things in better places than she left them. That is the worst part.',
      warp: 'The tidying stopped. Nothing else changed. She has been very quiet about how much she minds.',
      took: 'They leave one thing out of place on purpose, every night, as a greeting.',
    },
  ],
}

export const quirksOf = (id: string): Quirk[] => QUIRKS[id] ?? []
