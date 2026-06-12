// ── Edit this array to populate your portfolio ──
//
// thumbnail  — image/gif shown in the grid card (can be different from page content)
// page.description — text on the project page
// page.media — array of { type, src } shown on the project page
//   types: "image", "gif", "video" (local file), "mux" (Mux iframe src URL)
// page.links — array of { label, url } shown as buttons

const projects = [
  {
    title: "Project One",
    slug: "project-one",
    thumbnail: "https://image.mux.com/vUhx00foLioYArf3rli01oDuPdaNNIaKcNYlwZa8cn93Y/animated.gif?width=320&start=5&end=15&height=320&fps=15",
    page: {
      description: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet consectetur adipisci velit.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.

Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus.`,
      media: [
        {
          type: "mux",
          src: "https://player.mux.com/vUhx00foLioYArf3rli01oDuPdaNNIaKcNYlwZa8cn93Y?metadata-video-title=Playdate+Intro+Sequence+-+Device&video-title=Playdate+Intro+Sequence+-+Device&autoplay&muted",
        },
      ],
      links: [],
    },
  },
  {
    title: "Project Two",
    slug: "project-two",
    thumbnail: "assets/images/thumb-project2.jpg",
    page: {
      description: "Description of this project.",
      media: [],
      links: [],
    },
  },
  {
    title: "Project Three",
    slug: "project-three",
    thumbnail: "assets/images/project3.jpg",
    page: {
      description: "Description of this project.",
      media: [],
      links: [],
    },
  },
  {
    title: "Project Four",
    slug: "project-four",
    thumbnail: "assets/images/thumb-project4.jpg",
    page: {
      description: "Description of this project.",
      media: [],
      links: [],
    },
  },
  {
    title: "Project Five",
    slug: "project-five",
    thumbnail: "assets/images/project5.jpg",
    page: {
      description: "Description of this project.",
      media: [],
      links: [],
    },
  },
  {
    title: "Project Six",
    slug: "project-six",
    thumbnail: "assets/gifs/project6.gif",
    page: {
      description: "Description of this project.",
      media: [],
      links: [],
    },
  },
];
