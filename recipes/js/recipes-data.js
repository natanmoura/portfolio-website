/* ═══════════════════════════════════════════════════════════════
   The Moura Boy Forever Recipes — recipe data
   ───────────────────────────────────────────────────────────────
   Source of truth for the site. Mirrors the markdown in the
   forever-recipes repo, with extra structure the page needs:

     components[]  one "thing being made" — becomes one cook-mode
                   step box and one ingredient group
     ingredients[] { q, u, n, aisle, note }
                   q = quantity (number or null)
                   u = unit ("cup", "tbsp", "g", null for counts)
                   n = name, used to merge across recipes
     steps[]       plain sentences, one action each
     dish          the recipe's colour, drawn from what it tastes of

   Adding a recipe: append an object, keep `added` + `order` honest,
   and give every ingredient an aisle from AISLES below.
   ═══════════════════════════════════════════════════════════════ */

const AISLES = [
  'Produce',
  'Tofu & Plant-Based',
  'Dairy & Eggs',
  'Bakery',
  'Dry Goods & Grains',
  'Canned & Jarred',
  'Nuts & Seeds',
  'Oils & Vinegars',
  'Condiments & Sauces',
  'Spices & Dried Herbs',
  'Sweeteners',
];

const RECIPES = [
  {
    slug: 'spinach-feta-muffins',
    title: 'Spinach Feta Muffins',
    dish: '#5C7A52',
    meta: 'Makes 10 muffins · 15 min prep · 25 min bake',
    added: '2026-07-12',
    order: 1,
    components: [
      {
        name: 'Spinach & Peppers',
        ingredients: [
          { q: 6, u: 'oz', n: 'fresh spinach', aisle: 'Produce', note: 'or 1 cup frozen, thawed and squeezed dry' },
          { q: 1, u: null, n: 'bell pepper', aisle: 'Produce', note: 'diced, or ½ cup sun-dried tomato' },
          { q: 1, u: 'tsp', n: 'olive oil', aisle: 'Oils & Vinegars' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', note: 'a pinch' },
        ],
        steps: [
          'Heat 1 tsp olive oil in a medium skillet over medium heat.',
          'Add the diced peppers and cook 2–3 minutes.',
          'Add the spinach and a pinch of salt. Cook until wilted, another 3–5 minutes.',
          'Set aside to cool slightly.',
        ],
      },
      {
        name: 'Muffin Batter',
        ingredients: [
          { q: 0.75, u: 'cup', n: 'milk', aisle: 'Dairy & Eggs', note: '178g' },
          { q: 0.25, u: 'cup', n: 'yogurt', aisle: 'Dairy & Eggs', note: '63g' },
          { q: 0.25, u: 'cup', n: 'neutral oil', aisle: 'Oils & Vinegars', note: 'canola, avocado or vegetable' },
          { q: 2, u: null, n: 'eggs', aisle: 'Dairy & Eggs' },
          { q: 2.5, u: 'cup', n: 'flour', aisle: 'Dry Goods & Grains', note: '312g' },
          { q: 3, u: 'tsp', n: 'baking powder', aisle: 'Dry Goods & Grains' },
          { q: 0.5, u: 'tsp', n: 'baking soda', aisle: 'Dry Goods & Grains' },
          { q: 1, u: 'tsp', n: 'kosher salt', aisle: 'Spices & Dried Herbs', note: 'half if using table salt' },
          { q: 2, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs' },
          { q: 2, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'cup', n: 'feta', aisle: 'Dairy & Eggs', note: 'crumbled, 208g' },
          { q: 1, u: 'bunch', n: 'scallions', aisle: 'Produce', note: 'about 10, chopped' },
        ],
        steps: [
          'Preheat the oven to 400°F. Spray a standard muffin tin or line it.',
          'Whisk the milk, yogurt, neutral oil and eggs together in a large bowl.',
          'Add the flour, baking powder, baking soda, salt, oregano and black pepper. Fold until just combined.',
          'Fold in the cooked spinach and peppers, the scallions and the feta.',
          'Fill each cavity to the top. Grind extra black pepper over them.',
          'Bake 20–25 minutes on the centre rack, until golden and a skewer comes out clean.',
          'Rest 3–4 minutes, then move to a wire rack — or tilt them in the tin to keep the bottoms crisp.',
        ],
      },
    ],
  },

  {
    slug: 'cilantro-lime-rice',
    title: 'Cilantro Lime Rice',
    dish: '#6E8C3F',
    meta: 'Serves 3–5',
    added: '2026-07-26',
    order: 2,
    components: [
      {
        name: 'The Rice',
        ingredients: [
          { q: 2, u: 'cup', n: 'cooked rice', aisle: 'Dry Goods & Grains', note: 'about 2 rice-cooker cups' },
          { q: null, u: 'handful', n: 'edamame', aisle: 'Produce' },
          { q: null, u: 'handful', n: 'cilantro', aisle: 'Produce', note: 'small handful, chopped' },
          { q: 2, u: null, n: 'green onions', aisle: 'Produce', note: 'chopped' },
          { q: 0.5, u: null, n: 'lime', aisle: 'Produce', note: 'juiced — lemon works too' },
          { q: 2.5, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', note: 'to taste' },
        ],
        steps: [
          'Cook the rice.',
          'While it is still hot, add the edamame, cilantro, green onions, lime juice, olive oil and salt.',
          'Mix it all together and taste for salt.',
        ],
      },
    ],
  },

  {
    slug: 'lebanese-style-potato-salad',
    title: 'Lebanese-Style Potato Salad',
    dish: '#A5842A',
    meta: 'Serve hot, or chilled as a side',
    added: '2026-07-26',
    order: 3,
    components: [
      {
        name: 'Potatoes',
        ingredients: [
          { q: null, u: null, n: 'potatoes', aisle: 'Produce' },
        ],
        steps: [
          'Peel the potatoes.',
          'Boil until fork tender, then drain well.',
          'Lightly mash into small chunks.',
        ],
      },
      {
        name: 'Lemon Mint Dressing',
        ingredients: [
          { q: null, u: null, n: 'olive oil', aisle: 'Oils & Vinegars' },
          { q: null, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'grated' },
          { q: null, u: null, n: 'lemons', aisle: 'Produce', note: 'zest and juice' },
          { q: null, u: null, n: 'dried mint', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Combine the olive oil, freshly grated garlic, and the zest and juice of a lemon.',
          'Add the dried mint, salt and a dash of pepper. Stir.',
        ],
      },
      {
        name: 'Bring It Together',
        ingredients: [],
        steps: [
          'Add the dressing to the warm potatoes.',
          'Toss until well combined.',
          'Serve immediately while hot, or chill and serve cold.',
        ],
      },
    ],
  },

  {
    slug: 'greek-honey-lemon-potatoes',
    title: 'Greek Honey Lemon Potatoes',
    dish: '#B07C2A',
    meta: 'A side, with a protein',
    added: '2026-07-26',
    order: 4,
    components: [
      {
        name: 'Potatoes',
        ingredients: [
          { q: 4, u: null, n: 'potatoes', aisle: 'Produce', note: 'large, cut into chunky bite-size pieces' },
        ],
        steps: [
          'Boil the potatoes until firm but cooked, about 15 minutes.',
          'Drain well and let them steam dry.',
        ],
      },
      {
        name: 'Honey Lemon Dressing',
        ingredients: [
          { q: 1, u: null, n: 'lemon', aisle: 'Produce', note: 'zest and juice' },
          { q: 1, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs', note: 'dried or fresh' },
          { q: 3, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars' },
          { q: 1, u: 'tsp', n: 'chili flakes', aisle: 'Spices & Dried Herbs' },
          { q: 2, u: 'tsp', n: 'honey', aisle: 'Sweeteners', note: 'raw' },
          { q: null, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'optional' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Combine the lemon zest and juice, oregano, olive oil, chili flakes and honey.',
          'Add garlic if you are using it. Season with salt and pepper.',
        ],
      },
      {
        name: 'Roast',
        ingredients: [
          { q: 1, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', note: 'for the pan' },
          { q: null, u: null, n: 'feta', aisle: 'Dairy & Eggs', note: 'crumbled, optional' },
        ],
        steps: [
          'Preheat a baking pan with 1 tbsp olive oil.',
          'Add the potatoes and half the dressing.',
          'Roast until crispy, flipping every 20 minutes so they crisp evenly.',
          'In the last 10 minutes, add the remaining dressing.',
          'Top with crumbled feta if you want it.',
        ],
      },
    ],
  },

  {
    slug: 'smoky-jalapeno-tofu-wraps',
    title: 'Smoky Jalapeño Tofu Wraps',
    dish: '#A34A32',
    meta: 'Makes 2 wraps',
    added: '2026-07-26',
    order: 5,
    components: [
      {
        name: 'Marinade & Salsa',
        ingredients: [
          { q: 2, u: 'slices', n: 'pickled jalapeños', aisle: 'Canned & Jarred', note: 'adjust to taste' },
          { q: 2, u: null, n: 'garlic cloves', aisle: 'Produce' },
          { q: 1, u: null, n: 'lime', aisle: 'Produce', note: 'juice and zest' },
          { q: 3, u: 'tbsp', n: 'nutritional yeast', aisle: 'Dry Goods & Grains' },
          { q: 0.25, u: 'tsp', n: 'cayenne pepper', aisle: 'Spices & Dried Herbs' },
          { q: 0.75, u: 'tsp', n: 'smoked paprika', aisle: 'Spices & Dried Herbs' },
          { q: 0.75, u: 'tsp', n: 'ground cumin', aisle: 'Spices & Dried Herbs' },
          { q: 0.75, u: 'tsp', n: 'onion powder', aisle: 'Spices & Dried Herbs' },
          { q: 8, u: 'tbsp', n: 'Greek-style yogurt', aisle: 'Dairy & Eggs', note: '6 tbsp for the marinade, 2 for the salsa' },
        ],
        steps: [
          'Blend the jalapeños, garlic, lime juice and zest, nutritional yeast, 6 tbsp yogurt, cayenne, smoked paprika, cumin and onion powder until smooth.',
          'Season to taste.',
          'Reserve three-quarters of the blend to marinate the tofu.',
          'Mix the remaining quarter with 2 tbsp yogurt — that is the salsa.',
        ],
      },
      {
        name: 'Tofu Ribbons',
        ingredients: [
          { q: 200, u: 'g', n: 'smoked tofu', aisle: 'Tofu & Plant-Based', note: 'extra firm, drained and pressed' },
        ],
        steps: [
          'Preheat the oven to 180°C fan (355°F / Gas 4) and line a tray with baking paper.',
          'Using a vegetable peeler, slice the tofu into thin ribbons.',
          'Toss the ribbons in the reserved marinade and leave to sit while you prep the salad.',
          'Spread them on the tray in a single layer, spaced out — crowding makes them steam instead of crisp.',
          'Bake 15–20 minutes until golden and crispy.',
        ],
      },
      {
        name: 'Crunchy Salad',
        ingredients: [
          { q: 0.25, u: null, n: 'red onion', aisle: 'Produce', note: 'diced' },
          { q: 0.33, u: null, n: 'English cucumber', aisle: 'Produce', note: 'diced' },
          { q: 4, u: null, n: 'cherry tomatoes', aisle: 'Produce', note: 'quartered' },
          { q: 5, u: 'g', n: 'fresh mint', aisle: 'Produce', note: 'chopped' },
          { q: 5, u: 'g', n: 'fresh parsley', aisle: 'Produce', note: 'chopped' },
          { q: 0.5, u: null, n: 'lime', aisle: 'Produce', note: 'juiced' },
          { q: 0.5, u: 'tbsp', n: 'maple syrup', aisle: 'Sweeteners' },
          { q: null, u: null, n: 'extra virgin olive oil', aisle: 'Oils & Vinegars' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Combine the red onion, cucumber, cherry tomatoes, mint and parsley in a bowl.',
          'Dress with a drizzle of olive oil, the lime juice and the maple syrup.',
          'Season to taste.',
        ],
      },
      {
        name: 'Build the Wraps',
        ingredients: [
          { q: 2, u: null, n: 'wholewheat tortillas', aisle: 'Bakery' },
        ],
        steps: [
          'Spread the salsa over each tortilla.',
          'Top with the crunchy salad and the tofu ribbons.',
          'Fold in the bottom and sides, leaving the top open.',
          'Toast to preference and serve immediately.',
        ],
      },
    ],
  },

  {
    slug: 'high-protein-tofu-souvlaki-bowls',
    title: 'High Protein Tofu Souvlaki Bowls',
    dish: '#66753C',
    meta: 'Serves 2–3',
    added: '2026-07-26',
    order: 6,
    components: [
      {
        name: 'Souvlaki Tofu',
        ingredients: [
          { q: 1, u: 'block', n: 'extra firm tofu', aisle: 'Tofu & Plant-Based', note: 'ripped or cubed' },
          { q: 2, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars' },
          { q: 2, u: 'tbsp', n: 'lemon juice', aisle: 'Produce' },
          { q: 1, u: null, n: 'lemon', aisle: 'Produce', note: 'zested' },
          { q: 1.5, u: 'tbsp', n: 'tamari', aisle: 'Condiments & Sauces', note: 'or soy sauce' },
          { q: 2, u: 'tsp', n: 'maple syrup', aisle: 'Sweeteners' },
          { q: 2, u: 'tsp', n: 'Dijon mustard', aisle: 'Condiments & Sauces' },
          { q: 4, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'minced or grated' },
          { q: 2, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs', note: 'dried' },
          { q: 1, u: 'tsp', n: 'dried thyme', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tsp', n: 'smoked paprika', aisle: 'Spices & Dried Herbs' },
          { q: 0.5, u: 'tsp', n: 'ground cumin', aisle: 'Spices & Dried Herbs' },
          { q: 0.5, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs' },
          { q: 0.5, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Bring a small pot of generously salted water to a boil.',
          'Carefully add the tofu pieces and gently boil for 5 minutes. Drain and pat dry.',
          'Whisk together all the marinade ingredients.',
          'Toss the tofu in the marinade and let it sit for 10–15 minutes, or longer.',
          'Heat a thin layer of oil in a pan over medium heat.',
          'Cook the tofu 3–4 minutes each side, until browned and crispy.',
        ],
      },
      {
        name: 'Cucumber Tomato Salad',
        ingredients: [
          { q: 1, u: 'cup', n: 'cherry tomatoes', aisle: 'Produce', note: 'chopped' },
          { q: 1, u: 'cup', n: 'cucumbers', aisle: 'Produce', note: 'chopped' },
          { q: 1, u: 'tbsp', n: 'fresh parsley', aisle: 'Produce', note: 'chopped' },
          { q: 1, u: 'tbsp', n: 'red wine vinegar', aisle: 'Oils & Vinegars' },
          { q: 0.5, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars' },
          { q: 0.25, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs' },
          { q: 0.25, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Combine all the ingredients in a small bowl.',
          'Refrigerate until you are ready to serve.',
        ],
      },
      {
        name: 'Mint Tzatziki',
        ingredients: [
          { q: 0.5, u: 'cup', n: 'cucumbers', aisle: 'Produce', note: 'grated, squeezed of excess moisture' },
          { q: 0.75, u: 'cup', n: 'Greek yogurt', aisle: 'Dairy & Eggs', note: 'plain, vegan works' },
          { q: 2, u: null, n: 'garlic cloves', aisle: 'Produce', note: '1–2, to taste' },
          { q: 1.5, u: 'tbsp', n: 'lemon juice', aisle: 'Produce' },
          { q: 1, u: 'tsp', n: 'red wine vinegar', aisle: 'Oils & Vinegars' },
          { q: 2, u: 'tbsp', n: 'fresh mint', aisle: 'Produce', note: 'chopped — dill or parsley also work' },
          { q: 0.5, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars' },
          { q: 0.25, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs', note: 'dried' },
          { q: 0.25, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs' },
          { q: 0.25, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Mix all the ingredients in a bowl.',
          'Refrigerate until serving.',
        ],
      },
      {
        name: 'Build the Bowls',
        ingredients: [
          { q: null, u: null, n: 'white rice', aisle: 'Dry Goods & Grains' },
          { q: null, u: null, n: 'pickled onions', aisle: 'Canned & Jarred' },
          { q: null, u: null, n: 'kalamata olives', aisle: 'Canned & Jarred' },
        ],
        steps: [
          'Cook the rice and divide it between bowls.',
          'Add the crispy tofu, the tomato cucumber salad, pickled onions and kalamata olives.',
          'Finish each bowl with a big scoop of tzatziki.',
        ],
      },
    ],
  },

  {
    slug: 'smashed-falafel-tacos',
    title: 'Smashed Falafel Tacos',
    dish: '#A06B36',
    meta: 'Makes 4 tacos',
    added: '2026-07-26',
    order: 7,
    components: [
      {
        name: 'Falafel Patties',
        ingredients: [
          { q: 1, u: 'can', n: 'chickpeas', aisle: 'Canned & Jarred', note: 'drained, rinsed and dried' },
          { q: 0.5, u: 'cup', n: 'fresh parsley', aisle: 'Produce', note: 'packed' },
          { q: 0.5, u: 'cup', n: 'cilantro', aisle: 'Produce', note: 'packed' },
          { q: 3, u: null, n: 'garlic cloves', aisle: 'Produce' },
          { q: 0.25, u: null, n: 'red onion', aisle: 'Produce', note: 'cut into chunks — white works too' },
          { q: 1.5, u: 'tbsp', n: 'flour', aisle: 'Dry Goods & Grains' },
          { q: 1, u: 'tbsp', n: 'lemon juice', aisle: 'Produce' },
          { q: 1, u: 'tsp', n: 'ground cumin', aisle: 'Spices & Dried Herbs' },
          { q: 0.25, u: 'tsp', n: 'cayenne pepper', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs' },
          { q: 1.5, u: 'tbsp', n: 'coconut oil', aisle: 'Oils & Vinegars', note: 'refined, for frying' },
        ],
        steps: [
          'Blitz the chickpeas, parsley, cilantro, garlic, onion, flour, lemon juice, cumin, cayenne, salt and pepper in a food processor until it forms a chunky paste.',
          'Divide into 4 patties, about ⅓ cup each.',
          'Heat the coconut oil in a skillet over medium heat so it forms a shallow layer.',
          'Cook each patty like a pancake, flattening slightly with a spatula. 3–4 minutes on the first side.',
          'Flip and cook the other side about 30 seconds.',
        ],
      },
      {
        name: 'Tomato Cucumber Salad',
        ingredients: [
          { q: 1, u: 'cup', n: 'cucumbers', aisle: 'Produce', note: 'diced' },
          { q: 0.5, u: 'cup', n: 'tomatoes', aisle: 'Produce', note: 'diced' },
          { q: 0.25, u: 'cup', n: 'red onion', aisle: 'Produce', note: 'diced' },
          { q: null, u: null, n: 'olive oil', aisle: 'Oils & Vinegars', note: 'a drizzle' },
          { q: null, u: null, n: 'red wine vinegar', aisle: 'Oils & Vinegars', note: 'a drizzle' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Combine the cucumber, tomatoes and red onion.',
          'Dress with olive oil, red wine vinegar and salt.',
        ],
      },
      {
        name: 'Tzatziki',
        ingredients: [
          { q: 0.25, u: 'cup', n: 'cucumbers', aisle: 'Produce', note: 'grated, squeeze out the moisture' },
          { q: 0.5, u: 'cup', n: 'Greek yogurt', aisle: 'Dairy & Eggs' },
          { q: 1, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'small, grated' },
          { q: 3, u: 'tbsp', n: 'lemon juice', aisle: 'Produce' },
          { q: 1, u: 'tbsp', n: 'fresh dill', aisle: 'Produce', note: 'heaping — parsley works too' },
          { q: 2, u: 'tsp', n: 'olive oil', aisle: 'Oils & Vinegars' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Whisk together the grated cucumber, Greek yogurt, garlic, dill and olive oil.',
          'Season with salt and pepper.',
        ],
      },
      {
        name: 'Build the Tacos',
        ingredients: [
          { q: 4, u: null, n: 'flour tortillas', aisle: 'Bakery', note: 'small, taco sized' },
          { q: null, u: null, n: 'shredded lettuce', aisle: 'Produce' },
        ],
        steps: [
          'Warm the tortillas.',
          'Add a falafel patty to each, then shredded lettuce.',
          'Top with the tomato cucumber salad and a spoon of tzatziki.',
        ],
      },
    ],
  },

  {
    slug: 'tofu-gyros',
    title: 'Tofu Gyros',
    dish: '#7A5F33',
    meta: 'Makes 4 gyros',
    added: '2026-07-26',
    order: 8,
    components: [
      {
        name: 'Oregano Fries',
        ingredients: [
          { q: 2, u: null, n: 'potatoes', aisle: 'Produce' },
          { q: 1, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'olive oil', aisle: 'Oils & Vinegars' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Cut the potatoes into fries and soak them.',
          'Drain, toss with oil and salt.',
          'Bake until golden and crispy.',
          'Toss the cooked fries with the oregano.',
          'Return them to the oven with the flatbreads to heat through.',
        ],
      },
      {
        name: 'Miso Tofu Skewers',
        ingredients: [
          { q: 1, u: 'block', n: 'extra firm tofu', aisle: 'Tofu & Plant-Based' },
          { q: 0.66, u: 'cup', n: 'plant-based yogurt', aisle: 'Dairy & Eggs' },
          { q: 1, u: null, n: 'lemon', aisle: 'Produce' },
          { q: 2, u: 'tbsp', n: 'white miso', aisle: 'Condiments & Sauces' },
          { q: 2, u: null, n: 'garlic cloves', aisle: 'Produce' },
          { q: 2, u: 'tsp', n: 'smoked paprika', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tbsp', n: 'oregano', aisle: 'Spices & Dried Herbs' },
          { q: 2, u: 'tsp', n: 'ground cumin', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Mix the yogurt, lemon, miso, garlic, smoked paprika, oregano and cumin into a marinade.',
          'Tear in the tofu and coat it well.',
          'Thread the tofu onto skewers.',
          'Grill until charred.',
        ],
      },
      {
        name: 'Tzatziki',
        ingredients: [
          { q: 0.5, u: null, n: 'cucumbers', aisle: 'Produce' },
          { q: 1, u: 'cup', n: 'plant-based yogurt', aisle: 'Dairy & Eggs' },
          { q: 1, u: null, n: 'garlic cloves', aisle: 'Produce' },
          { q: null, u: 'handful', n: 'fresh dill', aisle: 'Produce', note: 'large handful' },
          { q: 0.5, u: null, n: 'lemon', aisle: 'Produce' },
        ],
        steps: [
          'Grate the cucumber and squeeze out the moisture.',
          'Mix with the yogurt, garlic, dill and lemon.',
        ],
      },
      {
        name: 'Salad & Assembly',
        ingredients: [
          { q: null, u: null, n: 'tomatoes', aisle: 'Produce' },
          { q: null, u: null, n: 'red onion', aisle: 'Produce' },
          { q: null, u: null, n: 'cucumbers', aisle: 'Produce' },
          { q: null, u: null, n: 'fresh parsley', aisle: 'Produce' },
          { q: 4, u: null, n: 'flatbreads', aisle: 'Bakery' },
        ],
        steps: [
          'Chop the tomatoes, red onion and cucumber into a salad while the fries cook.',
          'Warm the flatbreads with the fries.',
          'Build each gyro with tzatziki, salad, tofu, fries and parsley.',
        ],
      },
    ],
  },

  {
    slug: 'green-shakshuka',
    title: 'Green Shakshuka',
    dish: '#3F6B45',
    meta: 'Serves 2 · double everything for 4',
    added: '2026-07-26',
    order: 9,
    components: [
      {
        name: 'Prep',
        ingredients: [
          { q: 300, u: 'g', n: 'Swiss chard', aisle: 'Produce' },
          { q: 25, u: 'g', n: 'cilantro', aisle: 'Produce' },
          { q: 1, u: null, n: 'lime', aisle: 'Produce' },
          { q: 2, u: null, n: 'pitas', aisle: 'Bakery' },
        ],
        steps: [
          'Wash the cilantro and Swiss chard.',
          'Pick and chop the cilantro leaves.',
          'Remove the stems from the chard and dice into ½-inch pieces.',
          'Chop the chard leaves into ¼-inch strips.',
          'Cut the lime in half.',
          'Brush the pitas with 1 tbsp olive oil and set aside.',
        ],
      },
      {
        name: 'Shakshuka Base',
        ingredients: [
          { q: 150, u: 'g', n: 'leeks', aisle: 'Produce' },
          { q: 4, u: 'tsp', n: 'garlic cloves', aisle: 'Produce' },
          { q: 4, u: 'tsp', n: 'spice blend', aisle: 'Spices & Dried Herbs', note: '1 tbsp dried dill + 1 tsp cumin' },
          { q: 2, u: 'pkg', n: 'raw sugar', aisle: 'Sweeteners' },
          { q: 1, u: 'tsp', n: 'red pepper flakes', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: null, n: 'vegetable stock cube', aisle: 'Dry Goods & Grains' },
          { q: 2, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars' },
        ],
        steps: [
          'Heat 2 tbsp olive oil in a large oven-proof skillet over medium-high.',
          'Add the leeks and chard stems. Cook 3–4 minutes, stirring, until tender and turning golden.',
          'Add the garlic, spice blend, sugar, three-quarters of the cilantro and red pepper flakes to taste. Cook 1–2 minutes until fragrant.',
          'Add the chard leaves, the crumbled stock cube and ⅔ cup water. Bring to a low boil.',
          'Cover and cook 4–5 minutes, stirring occasionally, until the liquid has almost evaporated.',
          'Season with lime juice, salt and pepper.',
        ],
      },
      {
        name: 'Harissa Oil',
        ingredients: [
          { q: 2, u: 'tsp', n: 'harissa paste', aisle: 'Condiments & Sauces' },
          { q: 2, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars' },
        ],
        steps: [
          'Combine 2 tbsp olive oil with harissa to taste in a small bowl.',
          'Season with salt.',
        ],
      },
      {
        name: 'Eggs & Serve',
        ingredients: [
          { q: 4, u: null, n: 'eggs', aisle: 'Dairy & Eggs', note: 'free range' },
          { q: 0.5, u: 'cup', n: 'Greek yogurt', aisle: 'Dairy & Eggs' },
        ],
        steps: [
          'Turn the broiler to 550°F, one rack in the centre and another 6 inches from the top.',
          'Make 4 small wells in the shakshuka.',
          'Crack an egg into each well and season with salt and pepper.',
          'Drizzle the harissa oil over the top.',
          'Broil on the top rack 3–4 minutes.',
          'Toast the pita on the centre rack, watching closely so it does not burn.',
          'Slice the pita into 6 wedges. Divide the shakshuka between bowls.',
          'Garnish with the remaining cilantro. Serve with pita and Greek yogurt.',
        ],
        tip: 'Crack the eggs into a small bowl first — it is much easier to fish out a bit of shell before it hits the pan.',
      },
    ],
  },

  {
    slug: 'tahini-oat-bites',
    title: 'Tahini Oat Bites',
    dish: '#8E6244',
    meta: 'Makes 16 bites',
    added: '2026-07-26',
    order: 10,
    components: [
      {
        name: 'The Dough',
        ingredients: [
          { q: 0.5, u: 'cup', n: 'tahini', aisle: 'Condiments & Sauces' },
          { q: 3, u: 'tbsp', n: 'honey', aisle: 'Sweeteners' },
          { q: 0.5, u: 'cup', n: 'large flake oats', aisle: 'Dry Goods & Grains' },
          { q: 56, u: 'g', n: 'dried apricots', aisle: 'Dry Goods & Grains' },
          { q: 1, u: 'tsp', n: 'cinnamon', aisle: 'Spices & Dried Herbs' },
          { q: 28, u: 'g', n: 'pistachios', aisle: 'Nuts & Seeds' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', note: 'a pinch' },
        ],
        steps: [
          'Cut the apricots into ¼-inch pieces.',
          'In a large bowl, stir the tahini and honey together with a wooden spoon until well combined, about 1 minute.',
          'Add the oats, apricots, cinnamon, pistachios and a pinch of salt.',
          'Stir until well combined and the mixture makes a sticky dough, about 1 minute.',
          'Roll into 16 equal, 1 tbsp-sized bites and set them on a parchment-lined baking sheet.',
        ],
      },
      {
        name: 'Coat & Chill',
        ingredients: [
          { q: 0.5, u: 'cup', n: 'unsweetened shredded coconut', aisle: 'Dry Goods & Grains' },
        ],
        steps: [
          'Add the coconut to a shallow dish.',
          'Working with one bite at a time, roll it in the coconut, pressing gently until coated.',
          'Return each one to the baking sheet and repeat until all are covered.',
          'Chill in the fridge until firm, 30 minutes to 1 hour.',
        ],
        tip: 'They keep in an airtight container for a week in the fridge, or a month in the freezer.',
      },
    ],
  },
];

if (typeof window !== 'undefined') {
  window.RECIPES = RECIPES;
  window.AISLES = AISLES;
}
