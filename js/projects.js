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
        { type: "text", html: `I animated and composited the intro sequence for the Playdate handheld — a quirky little device from <a href="https://panic.com">Panic</a>, made with <a href="http://chromosphere-la.com">Chromosphere</a>. The sequence runs in two versions: a full-colour promotional cut and a black &amp; white version designed for the Playdate's 1-bit screen.` },
        { type: "mux", src: "https://player.mux.com/000013pfy1vF5mvkXA9VKck2Se4G2tNGPHOE32RjWjxdQ?autoplay&muted" },
        { type: "caption", html: `Colour promotional version — 800×480 pixels` },
        { type: "mux", src: "https://player.mux.com/z3KERXS100cJcyzQnSeQjHM8WZY02TFxPjZDo2nDhzzNU?autoplay&muted" },
        { type: "caption", html: `Interactive version as seen on the Playdate — 400×240 pixels` },
        { type: "text", html: `I also animated some UI elements and transitions for the Playdate's menu and lock screen.` },
        { type: "gif", src: "assets/gifs/playdate-present.gif" },
        { type: "gif", src: "assets/gifs/playdate-catalog.gif" },
        { type: "gif", src: "assets/gifs/playdate-outro.gif" },
        { type: "gif", src: "assets/gifs/playdate-lockscreen.gif" },
        { type: "gif", src: "assets/gifs/playdate-ui.gif" },
      ],
      links: [],
    },
  },
  {
    title: "Yuki 7",
    slug: "yuki-7",
    thumbnail: "assets/images/yuki-7.jpg",
    page: {
      content: [
        { type: "text", html: `After completing animation on the first two episodes of the Yuki 7 micro-series, <a href="http://chromosphere-la.com">Chromosphere</a> was awarded an Epic Mega-Grant to explore the power of Unreal Engine for production of the third episode.` },
        { type: "heading", text: "Layout." },
        { type: "text", html: `I worked in Unreal using Sequencer to layout cameras and characters for many of the episode's scenes.` },
        { type: "heading", text: "Animation." },
        { type: "text", html: `I helped create character animations in Maya and then import them into Unreal for the final film.` },
        { type: "text", html: `Here's a sequence where I was responsible for all character and prop animations!` },
        { type: "bracket", label: "video: character and prop animation sequence" },
        { type: "heading", text: "Behind the scenes." },
        { type: "text", html: `Have a closer look at what went into this project at <a href="http://chromosphere-la.com">Chromosphere</a>!` },
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
        { type: "text", html: `Mall Stories is a slice-of-life short film directed by Elizabeth Ito about staff at a mall eatery. Produced at <a href="http://chromosphere-la.com">Chromosphere</a> with an Epic MegaGrant, exploring animation production in Unreal Engine.` },
        { type: "text", html: `I created character animations in Maya that were brought into Unreal Engine for the final render.` },
        { type: "bracket", label: "video: film" },
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
        { type: "text", html: `I joined <a href="http://chromosphere-la.com">Chromosphere</a> to work on the Netflix series City of Ghosts to animate flashback sequences in which wooden toys are used to tell the story. I animated the characters and camera to capture the charm and feel of home-videos made by kids.` },
        { type: "bracket", label: "video: flashback sequence" },
        { type: "heading", text: "Water FX." },
        { type: "text", html: `I also animated the water fx in the fourth episode using After Effects.` },
        { type: "bracket", label: "gif: water effects 1" },
        { type: "bracket", label: "gif: water effects 2" },
        { type: "bracket", label: "gif: water effects 3" },
        { type: "bracket", label: "gif: water effects 4" },
        { type: "bracket", label: "gif: water effects 5" },
      ],
      links: [],
    },
  },
  {
    title: "My Moon",
    slug: "my-moon",
    thumbnail: "assets/images/my-moon.jpg",
    page: {
      content: [
        { type: "text", html: `<em>My Moon</em> is an 8-minute short film directed by <a href="https://www.eusong.com">Eusong Lee</a> and co-produced by <a href="http://chromosphere-la.com">Chromosphere</a>. I joined this project as an animation director in its early stages, giving Eusong feedback and helping further develop the story. We then created a trailer and Eusong launched a successful Kickstarter campaign to help fund the full production with Chromosphere.` },
        { type: "bracket", label: "video: trailer" },
        { type: "heading", text: "Behind the scenes." },
        { type: "text", html: `Here are some examples of my process of bringing a scene to life from animation through to compositing using After Effects.` },
        { type: "bracket", label: "images: behind the scenes compositing process" },
      ],
      links: [],
    },
  },
  {
    title: "Namoo 2D",
    slug: "namoo-2d",
    thumbnailScale: 1.05,
    thumbnail: "assets/gifs/namoo-2d.gif",
    page: {
      content: [
        { type: "text", html: `Namoo is a 12-minute award-winning VR short film directed by <a href="https://erickoh.com">Erick Oh</a> and produced by <a href="https://www.baobabstudios.com">Baobab Studios</a>. Once the handcrafted VR experience was near completion, the team decided to create a 2D cinematic version to reach a wider audience. I joined the project to do all the compositing and help enhance the look of the film.` },
        { type: "bracket", label: "video: trailer — full film available on HBO Max" },
        { type: "heading", text: "Compositing a cinematic look." },
        { type: "text", html: `Using tools created by the developers at Baobab Studios, I rendered cameras from the Unity game engine to hundreds of image sequences for compositing in After Effects. Working closely with the art director, we transformed the colors and developed a subtle watercolor treatment for the final 2D version.` },
        { type: "text", html: `Hover or tap on the images below to see what they looked like before compositing!` },
        { type: "bracket", label: "images: before/after compositing comparisons" },
      ],
      links: [],
    },
  },
  {
    title: "Airbnb Japan",
    slug: "airbnb-japan",
    thumbnail: "assets/images/airbnb-japan.jpg",
    page: {
      content: [
        { type: "text", html: `Collaborating alongside the team of animators and compositors at <a href="http://chromosphere-la.com">Chromosphere</a>, I helped create many of the paper-folding animations for this Airbnb public service campaign for the 2020 Olympics in Japan.` },
        { type: "text", html: `Here you can see some examples of the paper-folding animations I made!` },
        { type: "bracket", label: "gif: paper-folding animation 1" },
        { type: "bracket", label: "gif: paper-folding animation 2" },
        { type: "bracket", label: "gif: paper-folding animation 3" },
        { type: "bracket", label: "gif: paper-folding animation 4" },
        { type: "bracket", label: "gif: paper-folding animation 5" },
        { type: "bracket", label: "gif: paper-folding animation 6" },
      ],
      links: [],
    },
  },
  {
    title: "Storybots",
    slug: "storybots",
    thumbnail: "assets/images/storybots.jpg",
    page: {
      content: [
        { type: "text", html: `I joined the StoryBots team as a production artist in the early days and worked through multiple Netflix seasons, helping with animation, design, compositing, storyboarding and directing — contributing to the series, educational song videos, children's apps, and animated iPad books.` },
        { type: "heading", text: "Song Videos." },
        { type: "text", html: `I created designs, animations, and compositing for a number of educational song videos.` },
        { type: "bracket", label: "video: The Number 8" },
        { type: "bracket", label: "video: Baby Teeth" },
        { type: "bracket", label: "video: Sand" },
        { type: "bracket", label: "video: The Internet" },
        { type: "heading", text: "Series Episodes." },
        { type: "text", html: `I animated 2D characters for the Ask The StoryBots series, rigging and animating in After Effects. I was responsible for all the birds in this sequence!` },
        { type: "bracket", label: "video: series episode clip" },
        { type: "heading", text: "Learning App." },
        { type: "text", html: `Working with the app developers, I rigged and animated characters using Spine for an in-class learning application.` },
        { type: "text", html: `Black props replaced by many different 2D assets.` },
        { type: "bracket", label: "gif: character with ball" },
        { type: "bracket", label: "gif: character eating food" },
        { type: "bracket", label: "gif: character showering" },
        { type: "bracket", label: "gif: character drinking" },
        { type: "bracket", label: "gif: character playing guitar" },
        { type: "text", html: `Accessories follow animations by attaching to the character's rig.` },
        { type: "bracket", label: "gifs: character animations with accessories" },
        { type: "text", html: `Children's characters were personalized in-class with pictures provided by their parents.` },
        { type: "bracket", label: "gifs: character personalization animations" },
      ],
      links: [],
    },
  },
  {
    title: "Steven Universe: The Movie - Opening Titles",
    slug: "steven-universe-movie-titles",
    thumbnail: "assets/images/steven-universe-movie-titles.jpg",
    page: {
      content: [
        { type: "text", html: `Steven Universe: The Movie - Opening Titles was a <a href="http://chromosphere-la.com">Chromosphere</a> project for <a href="https://www.cartoonnetwork.com">Cartoon Network</a> in which I worked as an After Effects animator and compositor. The credit sequence was designed to evoke the classic Disney storybook-style openings from their early films.` },
        { type: "heading", text: "Behind the curtain." },
        { type: "text", html: `Here you can see a breakdown of some of the scenes I helped animate and composite, including the construction of a 3D storybook in After Effects!` },
        { type: "bracket", label: "video: scene breakdown" },
        { type: "heading", text: "Teaser." },
        { type: "text", html: `I also helped create this small movie teaser using Blender for the Comic-Con announcement of the film in 2018!` },
        { type: "bracket", label: "video: Comic-Con teaser" },
      ],
      links: [],
    },
  },
  {
    title: "Eden and the Army of Paradise",
    slug: "eden-army-of-paradise",
    thumbnail: "assets/images/eden-army-of-paradise.jpg",
    page: {
      content: [
        { type: "text", html: `Eden and the Army of Paradise directed by <a href="https://www.instagram.com/eastwoodwong/">Eastwood Wong</a> in collaboration with <a href="http://chromosphere-la.com">Chromosphere</a> is a concept trailer to accompany Eastwood's <a href="https://eastwoodwong.storenvy.com/products/25726521-eden-and-the-army-of-paradise">book</a>. I helped create character animations in After Effects for some shots.` },
        { type: "text", html: `Here are some animations I made for this project!` },
        { type: "bracket", label: "gif: character animation 1" },
        { type: "bracket", label: "gif: character animation 2" },
        { type: "bracket", label: "gif: character animation 3" },
        { type: "bracket", label: "gif: character animation 4" },
        { type: "bracket", label: "gif: character animation 5" },
        { type: "bracket", label: "gif: character animation 6" },
      ],
      links: [],
    },
  },
  {
    title: "Sinclair Snake",
    slug: "sinclair-snake",
    thumbnail: "assets/images/sinclair-snake.jpg",
    page: {
      content: [
        { type: "text", html: `This project for the <a href="https://wonderscope.com">Wonderscope</a> iOS app is an augmented reality experience for kids in which they explore a museum in search of a snake while learning about history along the way. I worked with <a href="http://chromosphere-la.com">Chromosphere</a> creating looping 3D animations in Maya for the snake character which were then brought into the Unity game engine. In Unity I worked on moving all the characters through the scenes, connecting the animated loops to create the final performances.` },
        { type: "bracket", label: "video: AR experience footage" },
      ],
      links: [],
    },
  },
];
