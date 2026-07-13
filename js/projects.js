// ── Edit this array to populate your portfolio ──
//
// thumbnail  — image/gif shown in the grid card
// page.content — ordered array of content blocks:
//   { type: "text",    html: "..." }          — paragraph (supports inline HTML/links)
//   { type: "heading", text: "..." }          — section subheading
//   { type: "bracket", label: "..." }         — placeholder for media to be added
//   { type: "mux",     src: "player URL" }    — Mux video embed
//   { type: "video",   src: "local path" }    — local video file
//   { type: "image",   src: "path" }          — image
//   { type: "gif",     src: "path" }          — gif
// page.links — array of { label, url } shown as buttons

const projects = [
  {
    title: "Playdate Intro",
    slug: "playdate",
    thumbnailScale: 1.4,
    thumbnail: "https://image.mux.com/vUhx00foLioYArf3rli01oDuPdaNNIaKcNYlwZa8cn93Y/animated.gif?start=28.3&end=35&fps=15&width=576",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/vUhx00foLioYArf3rli01oDuPdaNNIaKcNYlwZa8cn93Y?metadata-video-title=Playdate+Intro+Sequence+-+Device&video-title=Playdate+Intro+Sequence+-+Device&autoplay&muted" },
        { type: "caption", html: `Video courtesy of <a href="https://www.youtube.com/@RetroDodo">Retro Dodo</a>.` },
        { type: "text", html: `Collaborating with <a href="http://chromosphere-la.com">Chromosphere</a>, I animated and composited the interactive first time user experience for the Playdate — a quirky little handheld device from <a href="https://panic.com">Panic</a>.` },
        { type: "text", html: `The sequence runs in two versions: a full-colour promotional cut and a black &amp; white interactive version designed for the Playdate's 1-bit screen.` },
        { type: "media-grid", cols: 2, items: [
          { type: "mux", src: "https://player.mux.com/000013pfy1vF5mvkXA9VKck2Se4G2tNGPHOE32RjWjxdQ?thumbnail-time=0&autoplay&muted", caption: "Colour promotional version — 800×480 pixels", aspectRatio: "5/3" },
          { type: "mux", src: "https://player.mux.com/z3KERXS100cJcyzQnSeQjHM8WZY02TFxPjZDo2nDhzzNU?thumbnail-time=0&autoplay&muted", caption: "Interactive version as seen on the Playdate — 400×240 pixels", aspectRatio: "5/3" },
        ]},
        { type: "text", html: `I also created UI animations and transitions for the Playdate's menu and lock screen.` },
        { type: "media-grid", cols: 2, items: [
          { type: "gif", src: "assets/gifs/playdate-present.gif" },
          { type: "gif", src: "assets/gifs/playdate-catalog.gif" },
          { type: "gif", src: "assets/gifs/playdate-outro.gif" },
          { type: "gif", src: "assets/gifs/playdate-lockscreen.gif" },
          { type: "gif", src: "assets/gifs/playdate-ui.gif" },
        ]},
      ],
      links: [],
    },
  },
  {
    title: "Yuki 7",
    slug: "yuki-7",
    thumbnail: "assets/gifs/thumbs/yuki-7-cover.gif",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/aVATvQRy01N53fzzREi92ZAkUlDecUBGKmSZOC9R9VmA?metadata-video-title=Yuki+7+Micro-Series+Trailer&video-title=Yuki+7+Micro-Series+Trailer&thumbnail-time=0&autoplay&muted", aspectRatio: "4/3", narrow: true },
        { type: "text", html: `As an Epic MegaGrant recipient, <a href="http://chromosphere-la.com">Chromosphere</a> was able to develop the <em>Yuki 7</em> micro-series and explore the power of Unreal Engine for animation productions.` },
        { type: "text", html: `I helped create layout and character animations all done using newly developed workflows in UE5's Sequencer.` },
        { type: "text", html: `Below are two reels of scenes I animated.` },
        { type: "media-grid", cols: 2, items: [
          { type: "mux", src: "https://player.mux.com/pxrAX6tgdsEV3RXX7Bj3e01aS8Eh4401PfAOgl52mERg4?thumbnail-time=0&autoplay&muted", aspectRatio: "4/3" },
          { type: "mux", src: "https://player.mux.com/XyLBEjIlVgMXNiyCHF75c2V5BeSf4g3oEUoaRwjr7Eg?thumbnail-time=0&autoplay&muted", aspectRatio: "4/3" },
        ]},
        { type: "text", html: `We also collaborated with the team at Epic Games to define animation workflow tools that we tested and are now implemented in the core engine.` },
      ],
      links: [],
    },
  },
  {
    title: "Mall Stories",
    slug: "mall-stories",
    thumbnail: "https://image.mux.com/PxWrjrutGz3QAbnkeHFoYgOPJreOCQk1b6Qluy02pzDg/animated.gif?start=141.4&end=144.8&fps=15&width=480",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/PxWrjrutGz3QAbnkeHFoYgOPJreOCQk1b6Qluy02pzDg?thumbnail-time=0&autoplay&muted" },
        { type: "text", html: `<em>Mall Stories</em> is a slice-of-life short film directed by Elizabeth Ito about staff at a mall eatery. Produced at <a href="http://chromosphere-la.com">Chromosphere</a> with an Epic MegaGrant, exploring animation production in Unreal Engine.` },
        { type: "text", html: `I created character animations in Maya that were brought into Unreal Engine for the final render.` },
      ],
      links: [],
    },
  },
  {
    title: "City of Ghosts",
    slug: "city-of-ghosts",
    thumbnailScale: 1.1,
    thumbnail: "https://image.mux.com/500qHgKZEFcpNm8pfxh94uJK834XTc7nLiOPMudziIAY/animated.gif?start=74.5&end=76.4&fps=15&width=480",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/500qHgKZEFcpNm8pfxh94uJK834XTc7nLiOPMudziIAY?thumbnail-time=0&autoplay&muted" },
        { type: "text", html: `I joined <a href="http://chromosphere-la.com">Chromosphere</a> on the Netflix series <em>City of Ghosts</em> to create flashback sequences using toys to tell the story. I animated the characters and camera to capture the charm and feel of home-videos made by kids.` },
        { type: "heading", text: "Water FX." },
        { type: "text", html: `I also animated and composited the water FX in the fourth episode.` },
        { type: "media-grid", cols: 3, items: [
          { type: "gif", src: "assets/gifs/cog-water-01.gif" },
          { type: "gif", src: "assets/gifs/cog-water-02.gif" },
          { type: "gif", src: "assets/gifs/cog-water-03.gif" },
          { type: "gif", src: "assets/gifs/cog-water-04.gif" },
          { type: "gif", src: "assets/gifs/cog-water-05.gif" },
          { type: "gif", src: "assets/gifs/cog-water-06.gif" },
        ]},
      ],
      links: [],
    },
  },
  {
    title: "My Moon",
    slug: "my-moon",
    thumbnail: "assets/gifs/thumbs/my-moon-cover.gif",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/iODGnSn8xnKg8oROoNl01E1akrpHEm601wER3jgec00Myo?thumbnail-time=0&autoplay&muted", aspectRatio: "2.35/1" },
        { type: "text", html: `<em>My Moon</em> is a short film directed by <a href="https://www.eusong.com">Eusong Lee</a> and co-produced by <a href="http://chromosphere-la.com">Chromosphere</a>. I joined this project as animation director in its early stages to create the initial trailer for the Kickstarter. After successfully reaching our $50k funding goal, we were able to continue the production and completion of the film.` },
        { type: "text", html: `I was involved in the full production of the film from animation through to compositing.` },
      ],
      links: [],
    },
  },
  {
    title: "Namoo",
    slug: "namoo-2d",
    thumbnailScale: 1.05,
    thumbnail: "assets/gifs/thumbs/namoo-2d.gif",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/rT5mLXjAqdvocYw9fMrzHPFzeULEkVnv2a00PmaqrQN8?thumbnail-time=0&autoplay&muted" },
        { type: "text", html: `<em>Namoo</em> is an award-winning VR short film directed by <a href="https://erickoh.com">Erick Oh</a> and produced by <a href="https://www.baobabstudios.com">Baobab Studios</a>. I joined the project to help further develop the look for the 2D version of the film and composite the full short on my own.` },
        { type: "instruction", html: `<strong>Hover</strong> or <strong>Tap</strong> on the images below` },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_01.png", before: "assets/images/namoo/namoo_before_01.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_02.png", before: "assets/images/namoo/namoo_before_02.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_03.png", before: "assets/images/namoo/namoo_before_03.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_05.png", before: "assets/images/namoo/namoo_before_05.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_06.png", before: "assets/images/namoo/namoo_before_06.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_07.png", before: "assets/images/namoo/namoo_before_07.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_08.png", before: "assets/images/namoo/namoo_before_08.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_09.png", before: "assets/images/namoo/namoo_before_09.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_10.png", before: "assets/images/namoo/namoo_before_10.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_11.png", before: "assets/images/namoo/namoo_before_11.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_12.png", before: "assets/images/namoo/namoo_before_12.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_13.png", before: "assets/images/namoo/namoo_before_13.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_14.png", before: "assets/images/namoo/namoo_before_14.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_15.png", before: "assets/images/namoo/namoo_before_15.png" },
        { type: "beforeafter", after: "assets/images/namoo/namoo_after_16.png", before: "assets/images/namoo/namoo_before_16.png" },
        { type: "text", html: `The process involved rendering hundreds of layered image sequences from cameras in Unity to composite in After Effects.` },
        { type: "text", html: `Working closely with the art director, we transformed the colors, effects and developed a watercolor treatment for the final version.` },
      ],
      links: [],
    },
  },
  {
    title: "Airbnb Japan",
    slug: "airbnb-japan",
    thumbnail: "assets/gifs/thumbs/airbnb-japan-02.gif",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/eh1rpxFbD6ZmhHB5h00us2gpeG01UOohznvbopngMlIeI?thumbnail-time=0&autoplay&muted" },
        { type: "text", html: `Collaborating alongside the team at <a href="http://chromosphere-la.com">Chromosphere</a>, I helped create the paper animations in this Airbnb public service campaign for the 2020 Olympics in Japan.` },
        { type: "media-grid", cols: 3, items: [
          { type: "gif", src: "assets/gifs/airbnb-japan-01.gif" },
          { type: "gif", src: "assets/gifs/airbnb-japan-02.gif" },
          { type: "gif", src: "assets/gifs/airbnb-japan-03.gif" },
          { type: "gif", src: "assets/gifs/airbnb-japan-04.gif" },
          { type: "gif", src: "assets/gifs/airbnb-japan-05.gif" },
          { type: "gif", src: "assets/gifs/airbnb-japan-06.gif" },
        ]},
      ],
      links: [],
    },
  },
  {
    title: "Sinclair Snake",
    slug: "sinclair-snake",
    thumbnail: "https://image.mux.com/8Bi6AQe9cv02XdnW35B879ae7QVkNw1GqFZ7mWcpwZH00/animated.gif?start=64.9&end=66.2&fps=15&width=480",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/8Bi6AQe9cv02XdnW35B879ae7QVkNw1GqFZ7mWcpwZH00?thumbnail-time=0&autoplay&muted" },
        { type: "text", html: `This project for the <a href="https://wonderscope.com">Wonderscope</a> iOS app is an augmented reality experience for kids in which they explore a museum in search of a snake while learning about history along the way.` },
        { type: "text", html: `I worked with <a href="http://chromosphere-la.com">Chromosphere</a> creating looping 3D animations in Maya for the snake character which I brought into the Unity game engine and sequenced for the interactions.` },
      ],
      links: [],
    },
  },
  {
    title: "Steven Universe: The Movie - Opening Titles",
    slug: "steven-universe-movie-titles",
    thumbnail: "assets/gifs/thumbs/steven-universe-cover.gif",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/wX4PiGnk9VsOF8hVedaCTRWGcGLP5DF26l7p3YNCPbE?thumbnail-time=0&autoplay&muted" },
        { type: "text", html: `I joined <a href="http://chromosphere-la.com">Chromosphere</a> on this project for the opening credit sequence for the Steven Universe movie. The credit sequence was designed to evoke the classic Disney storybook-style openings from their early films.` },
        { type: "text", html: `Here you can see a breakdown of some of the scenes I helped animate and composite alongside a small team.` },
        { type: "mux", src: "https://player.mux.com/7002g2t8xx9XOzk1xCgjZHAdLWiQbd02Rywxa6s028Gr8o?thumbnail-time=0&autoplay&muted" },
        { type: "text-media-row", heading: "Teaser.", text: `I also created this small teaser for the film in Blender!`, gridCols: "1fr 1fr", media: [{ type: "mux", src: "https://player.mux.com/gidTstHDStdIIl9Zi39sc9jVpe28r7Sj3OTV02BlyclA?thumbnail-time=0&autoplay&muted" }] },
      ],
      links: [],
    },
  },
  {
    title: "Eden and the Army of Paradise",
    slug: "eden-army-of-paradise",
    thumbnail: "assets/gifs/thumbs/eden-cover.gif",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/tfPcptKYgz4PNnAU31tpUWDEVFE00D3Ng2w4u1uS8DTU?thumbnail-time=0&autoplay&muted" },
        { type: "text", html: `<em>Eden and the Army of Paradise</em> directed by <a href="https://www.instagram.com/eastwoodwong/">Eastwood Wong</a> in collaboration with <a href="http://chromosphere-la.com">Chromosphere</a> is a concept trailer to accompany Eastwood's <a href="https://eastwoodwong.storenvy.com/products/25726521-eden-and-the-army-of-paradise">book</a>. I helped create character animations in After Effects for some shots.` },
        { type: "media-grid", cols: 3, items: [
          { type: "gif", src: "assets/gifs/eden/eden-01.gif" },
          { type: "gif", src: "assets/gifs/eden/eden-02.gif" },
          { type: "gif", src: "assets/gifs/eden/eden-03.gif" },
          { type: "gif", src: "assets/gifs/eden/eden-04.gif" },
          { type: "gif", src: "assets/gifs/eden/eden-05.gif" },
          { type: "gif", src: "assets/gifs/eden/eden-06.gif" },
        ]},
      ],
      links: [],
    },
  },
  {
    title: "Volta-X",
    slug: "volta-x",
    thumbnail: "assets/gifs/thumbs/voltax-cover.gif",
    page: {
      content: [
        { type: "mux", src: "https://player.mux.com/0000jzfBrVZ395K00vetgSR01kVOHjdg02m4heRqT00qSFwVA?thumbnail-time=0&autoplay&muted" },
        { type: "text", html: `This project by <a href="http://chromosphere-la.com">Chromosphere</a> for GungHo is a cinematic opening for the <em>Volta-X</em> game. I created animations for the robots using Animate and After Effects.` },
        { type: "media-grid", cols: 3, items: [
          { type: "gif", src: "assets/gifs/volta-x/voltax-01.gif" },
          { type: "gif", src: "assets/gifs/volta-x/voltax-02.gif" },
          { type: "gif", src: "assets/gifs/volta-x/voltax-03.gif" },
          { type: "gif", src: "assets/gifs/volta-x/voltax-04.gif" },
          { type: "gif", src: "assets/gifs/volta-x/voltax-05.gif" },
          { type: "gif", src: "assets/gifs/volta-x/voltax-06.gif" },
        ]},
      ],
      links: [],
    },
  },
  {
    title: "Storybots Song Videos",
    slug: "storybots-song-videos",
    thumbnail: "https://image.mux.com/02phDUfkw517NYdqbjvn8ACE2GpYcHvB1DRraFaBflIQ/animated.gif?start=61&fps=15&width=480",
    page: {
      content: [
        { type: "text", html: `As a production artist on the <em>Storybots</em> team, I designed, animated and directed many song videos for the show. Below are a sample of some videos I made.` },
        { type: "media-grid", cols: 2, items: [
          { type: "mux", src: "https://player.mux.com/02xErqkkqXPXcJpt5e028hIbrR3pGT5CI542BxZ2h02q1U?metadata-video-title=Storybots+-+The+Number+8&video-title=Storybots+-+The+Number+8&thumbnail-time=0&autoplay&muted", caption: "The Number 8" },
          { type: "mux", src: "https://player.mux.com/8D8VT4deytB2tuVXaQoBQUVviMEAPtuo5YZG6T7CYd8?thumbnail-time=0&autoplay&muted", caption: "Baby Teeth" },
          { type: "mux", src: "https://player.mux.com/02phDUfkw517NYdqbjvn8ACE2GpYcHvB1DRraFaBflIQ?thumbnail-time=0&autoplay&muted", caption: "Sand" },
          { type: "mux", src: "https://player.mux.com/sIrReFG9IL9VEsmU02kMGGhQnSuL02PKXmbwB3W6AMttc?thumbnail-time=0&autoplay&muted", caption: "The Internet" },
        ]},
      ],
      links: [],
    },
  },
  {
    title: "Storybots Learning App",
    slug: "storybots-learning-app",
    thumbnail: "assets/gifs/storybots/personal-01.gif",
    page: {
      content: [
        { type: "text", html: `On the <em>Storybots</em> team, I collaborated with designers and engineers to bring customizable in-app characters to life.` },
        { type: "text", html: `Below you can see characters I rigged and animated in Spine.` },
        { type: "instruction", html: `Black props replaced by many different 2D assets.` },
        { type: "media-grid", cols: 5, items: [
          { type: "gif", src: "assets/gifs/storybots/ball.gif" },
          { type: "gif", src: "assets/gifs/storybots/food.gif" },
          { type: "gif", src: "assets/gifs/storybots/shower.gif" },
          { type: "gif", src: "assets/gifs/storybots/drink.gif" },
          { type: "gif", src: "assets/gifs/storybots/guitar.gif" },
        ]},
        { type: "instruction", html: `Accessories follow animations by attaching to the character's rig.` },
        { type: "media-grid", cols: 5, items: [
          { type: "gif", src: "assets/gifs/storybots/acc-01.gif" },
          { type: "gif", src: "assets/gifs/storybots/acc-02.gif" },
          { type: "gif", src: "assets/gifs/storybots/acc-03.gif" },
          { type: "gif", src: "assets/gifs/storybots/acc-04.gif" },
          { type: "gif", src: "assets/gifs/storybots/acc-05.gif" },
          { type: "gif", src: "assets/gifs/storybots/acc-06.gif" },
          { type: "gif", src: "assets/gifs/storybots/acc-07.gif" },
          { type: "gif", src: "assets/gifs/storybots/acc-08.gif" },
          { type: "gif", src: "assets/gifs/storybots/acc-09.gif" },
          { type: "gif", src: "assets/gifs/storybots/acc-10.gif" },
        ]},
        { type: "instruction", html: `Children's characters were personalized in-class with pictures provided by their parents.` },
        { type: "media-grid", cols: 5, items: [
          { type: "gif", src: "assets/gifs/storybots/personal-01.gif", span: 2 },
          { type: "gif", src: "assets/gifs/storybots/personal-02.gif" },
          { type: "gif", src: "assets/gifs/storybots/personal-03.gif" },
          { type: "gif", src: "assets/gifs/storybots/personal-04.gif" },
          { type: "gif", src: "assets/gifs/storybots/personal-05.gif" },
          { type: "gif", src: "assets/gifs/storybots/personal-06.gif" },
          { type: "gif", src: "assets/gifs/storybots/personal-07.gif" },
          { type: "gif", src: "assets/gifs/storybots/personal-08.gif" },
          { type: "gif", src: "assets/gifs/storybots/personal-09.gif" },
        ]},
      ],
      links: [],
    },
  },
];
