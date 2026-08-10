/* ═══════════════════════════════════════════════════════════════
   Moura Boys Forever Recipes — recipe data
   ───────────────────────────────────────────────────────────────
   Source of truth for the site.

     servings   { n, unit }  the recipe as written. The page scales
                             every amount off this.
     time       rough hands-on estimate
     components one "thing being made" — an ingredient group and a
                block of steps
     ingredients
       q, u, n   the amount AS WRITTEN in the recipe
       note      prep detail for the cook ("drained and rinsed")
       aisle     where it lives in the shop
       buyAs     name to merge under on the grocery list, when it
                 differs from n ("lemon juice" -> "lemons")
       buy       { q, u } what you actually have to BUY for this
                 amount. Converted to purchase units: bunches, whole
                 lemons, g, mL. Omit when it equals the recipe amount.
       buyNote   only what changes the shopping ("zest — buy whole")

   Discrete buy units (null/bunch/can/block/head/jar/pack) round up
   to whole numbers, since you can't buy 1.3 lemons.

     tags           meal categories, for search/filtering — a recipe
                    can carry more than one. One of MEAL_TAGS below.
     keyIngredients curated list of the 3-4 ingredients that actually
                    define the dish's flavour (not oil/milk/salt unless
                    genuinely central) — shown under the title and fed
                    into search, so it's picked by hand, not derived.
   ═══════════════════════════════════════════════════════════════ */

const MEAL_TAGS = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'drinks', 'side'];

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

/* Units you buy as whole items — these round up. */
const DISCRETE_UNITS = [null, '', 'bunch', 'can', 'block', 'head', 'jar', 'pack'];

const RECIPES = [
  {
    slug: 'spinach-feta-muffins',
    title: 'Spinach Feta Muffins',
    dish: '#5C7A52',
    time: '40 min',
    servings: { n: 10, unit: 'muffins' },
    tags: ['breakfast', 'snack', 'side'],
    keyIngredients: ['fresh spinach', 'feta', 'scallions'],
    added: '2026-07-12',
    order: 1,
    components: [
      {
        name: 'Spinach',
        ingredients: [
          { q: 6, u: 'oz', n: 'fresh spinach', aisle: 'Produce', note: 'or 1 cup frozen, thawed and squeezed dry', buy: { q: 170, u: 'g' } },
          { q: 1, u: 'tsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 15, u: 'mL' } },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', note: 'a pinch' },
        ],
        steps: [
          'Heat 1 tsp olive oil in a medium skillet over medium heat.',
          'Add the spinach and a pinch of salt. Cook until wilted, 3–5 minutes.',
          'Set aside to cool slightly.',
        ],
      },
      {
        name: 'Muffin Batter',
        ingredients: [
          { q: 0.75, u: 'cup', n: 'milk', aisle: 'Dairy & Eggs', buy: { q: 180, u: 'mL' } },
          { q: 0.25, u: 'cup', n: 'yogurt', aisle: 'Dairy & Eggs', buy: { q: 65, u: 'g' } },
          { q: 0.25, u: 'cup', n: 'neutral oil', aisle: 'Oils & Vinegars', note: 'canola, avocado or vegetable', buy: { q: 60, u: 'mL' } },
          { q: 2, u: null, n: 'eggs', aisle: 'Dairy & Eggs' },
          { q: 2.5, u: 'cup', n: 'flour', aisle: 'Dry Goods & Grains', buy: { q: 315, u: 'g' } },
          { q: 3, u: 'tsp', n: 'baking powder', aisle: 'Dry Goods & Grains' },
          { q: 0.5, u: 'tsp', n: 'baking soda', aisle: 'Dry Goods & Grains' },
          { q: 1, u: 'tsp', n: 'kosher salt', aisle: 'Spices & Dried Herbs', note: 'half if using table salt', buyAs: 'salt', buy: { q: null, u: null } },
          { q: 2, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs' },
          { q: 2, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: 1, u: 'cup', n: 'feta', aisle: 'Dairy & Eggs', note: 'crumbled', buy: { q: 210, u: 'g' } },
          { q: 1, u: 'bunch', n: 'scallions', aisle: 'Produce', note: 'about 10, chopped', buyAs: 'green onions', buy: { q: 1, u: 'bunch' } },
        ],
        steps: [
          'Preheat the oven to 400°F. Spray a standard muffin tin or line it.',
          'Whisk the milk, yogurt, neutral oil and eggs together in a large bowl.',
          'Add the flour, baking powder, baking soda, salt, oregano and black pepper. Fold until just combined.',
          'Fold in the cooked spinach, the scallions and the feta.',
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
    time: '35 min',
    servings: { n: 4, unit: 'servings' },
    tags: ['side', 'lunch', 'dinner'],
    keyIngredients: ['sushi rice', 'cilantro', 'lime', 'edamame'],
    added: '2026-07-26',
    order: 2,
    components: [
      {
        name: 'The Rice',
        ingredients: [
          { q: 2, u: 'cup', n: 'sushi rice', aisle: 'Dry Goods & Grains', buy: { q: 370, u: 'g' }, buyNote: 'dry weight' },
          { q: 1, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs', note: 'for cooking the rice', buy: { q: null, u: null } },
          { q: 1, u: 'handful', n: 'edamame', aisle: 'Produce', buy: { q: 100, u: 'g' } },
          { q: 1, u: 'handful', n: 'cilantro', aisle: 'Produce', note: 'small handful, chopped', buy: { q: 0.3, u: 'bunch' } },
          { q: 2, u: null, n: 'green onions', aisle: 'Produce', note: 'chopped', buy: { q: 0.25, u: 'bunch' } },
          { q: 0.5, u: null, n: 'lime', aisle: 'Produce', note: 'juiced — lemon works too', buyAs: 'limes', buy: { q: 0.5, u: null } },
          { q: 2.5, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 38, u: 'mL' } },
        ],
        steps: [
          'Rinse the sushi rice in a sieve under cold water, stirring with your hand, until the water runs clear. This washes off the excess starch so the rice cooks up fluffy, not gummy.',
          'Combine the rinsed rice with 2¼ cups water and 1 tsp salt in a pot. Bring to a boil.',
          'Reduce to low, cover, and simmer for 15 minutes, until the water is absorbed.',
          'Take it off the heat and let it rest, still covered, for 10 minutes. Then fluff with a fork.',
          'While the rice is still hot, add the edamame, cilantro, green onions, lime juice and olive oil.',
          'Mix it all together and taste for salt.',
        ],
      },
    ],
  },

  {
    slug: 'lebanese-style-potato-salad',
    title: 'Lebanese Style Mashed Potatoes',
    dish: '#A5842A',
    time: '30 min',
    servings: { n: 4, unit: 'servings' },
    tags: ['side', 'lunch', 'dinner'],
    keyIngredients: ['potatoes', 'lemon', 'dried mint', 'garlic'],
    added: '2026-07-26',
    order: 3,
    // The source post listed no quantities at all. These are sensible
    // working amounts — adjust once you've made it.
    estimatedAmounts: true,
    components: [
      {
        name: 'Potatoes',
        ingredients: [
          { q: 6, u: null, n: 'potatoes', aisle: 'Produce' },
        ],
        steps: [
          'Peel the potatoes and cut into chunks.',
          'Boil until fork tender, then drain well.',
          'Lightly mash into small chunks.',
        ],
      },
      {
        name: 'Lemon Mint Dressing',
        ingredients: [
          { q: 0.25, u: 'cup', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 60, u: 'mL' } },
          { q: 3, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'grated', buyAs: 'garlic', buy: { q: 0.3, u: 'head' } },
          { q: 1, u: null, n: 'lemon', aisle: 'Produce', note: 'zest and juice', buyAs: 'lemons', buy: { q: 1, u: null }, buyNote: 'zest — buy whole' },
          { q: 1, u: 'tbsp', n: 'dried mint', aisle: 'Spices & Dried Herbs' },
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
    time: '1 hr',
    servings: { n: 4, unit: 'servings' },
    tags: ['side', 'dinner'],
    keyIngredients: ['potatoes', 'honey', 'lemon', 'feta'],
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
          { q: 1, u: null, n: 'lemon', aisle: 'Produce', note: 'zest and juice', buyAs: 'lemons', buy: { q: 1, u: null }, buyNote: 'zest — buy whole' },
          { q: 1, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs', note: 'dried or fresh' },
          { q: 3, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 45, u: 'mL' } },
          { q: 1, u: 'tsp', n: 'chili flakes', aisle: 'Spices & Dried Herbs' },
          { q: 2, u: 'tsp', n: 'honey', aisle: 'Sweeteners', note: 'raw', buy: { q: 15, u: 'g' } },
          { q: 2, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'optional', buyAs: 'garlic', buy: { q: 0.2, u: 'head' } },
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
          { q: 1, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', note: 'for the pan', buy: { q: 15, u: 'mL' } },
          { q: 0.5, u: 'cup', n: 'feta', aisle: 'Dairy & Eggs', note: 'crumbled, optional', buy: { q: 100, u: 'g' } },
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
    time: '35 min',
    servings: { n: 2, unit: 'wraps' },
    tags: ['lunch', 'dinner'],
    keyIngredients: ['smoked tofu', 'pickled jalapeños', 'nutritional yeast', 'lime'],
    added: '2026-07-26',
    order: 5,
    components: [
      {
        name: 'Marinade & Salsa',
        ingredients: [
          { q: 2, u: 'slices', n: 'pickled jalapeños', aisle: 'Canned & Jarred', note: 'adjust to taste', buy: { q: 1, u: 'jar' } },
          { q: 2, u: null, n: 'garlic cloves', aisle: 'Produce', buyAs: 'garlic', buy: { q: 0.2, u: 'head' } },
          { q: 1, u: null, n: 'lime', aisle: 'Produce', note: 'juice and zest', buyAs: 'limes', buy: { q: 1, u: null }, buyNote: 'zest — buy whole' },
          { q: 3, u: 'tbsp', n: 'nutritional yeast', aisle: 'Dry Goods & Grains', buy: { q: 15, u: 'g' } },
          { q: 0.25, u: 'tsp', n: 'cayenne pepper', aisle: 'Spices & Dried Herbs' },
          { q: 0.75, u: 'tsp', n: 'smoked paprika', aisle: 'Spices & Dried Herbs' },
          { q: 0.75, u: 'tsp', n: 'ground cumin', aisle: 'Spices & Dried Herbs' },
          { q: 0.75, u: 'tsp', n: 'onion powder', aisle: 'Spices & Dried Herbs' },
          { q: 8, u: 'tbsp', n: 'Greek yogurt', aisle: 'Dairy & Eggs', note: '6 tbsp for the marinade, 2 for the salsa', buy: { q: 120, u: 'g' } },
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
          { q: 200, u: 'g', n: 'smoked tofu', aisle: 'Tofu & Plant-Based', note: 'extra firm, drained and pressed', buy: { q: 1, u: 'block' } },
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
          { q: 0.25, u: null, n: 'red onion', aisle: 'Produce', note: 'diced', buy: { q: 0.25, u: null } },
          { q: 0.33, u: null, n: 'English cucumber', aisle: 'Produce', note: 'diced', buyAs: 'cucumbers', buy: { q: 0.33, u: null } },
          { q: 4, u: null, n: 'cherry tomatoes', aisle: 'Produce', note: 'quartered', buy: { q: 60, u: 'g' } },
          { q: 5, u: 'g', n: 'fresh mint', aisle: 'Produce', note: 'chopped', buy: { q: 0.2, u: 'bunch' } },
          { q: 5, u: 'g', n: 'fresh parsley', aisle: 'Produce', note: 'chopped', buy: { q: 0.2, u: 'bunch' } },
          { q: 0.5, u: null, n: 'lime', aisle: 'Produce', note: 'juiced', buyAs: 'limes', buy: { q: 0.5, u: null } },
          { q: 0.5, u: 'tbsp', n: 'maple syrup', aisle: 'Sweeteners', buy: { q: 8, u: 'mL' } },
          { q: null, u: null, n: 'extra virgin olive oil', aisle: 'Oils & Vinegars', buyAs: 'olive oil', buy: { q: 15, u: 'mL' } },
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
          { q: 2, u: null, n: 'wholewheat tortillas', aisle: 'Bakery', buyAs: 'tortillas' },
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
    title: 'Tofu Souvlaki Bowls',
    dish: '#66753C',
    time: '40 min',
    servings: { n: 3, unit: 'servings' },
    tags: ['lunch', 'dinner'],
    keyIngredients: ['tofu', 'tamari', 'dijon mustard', 'dill'],
    added: '2026-07-26',
    order: 6,
    components: [
      {
        name: 'Souvlaki Tofu',
        ingredients: [
          { q: 1, u: 'block', n: 'extra firm tofu', aisle: 'Tofu & Plant-Based', note: 'ripped or cubed', buy: { q: 1, u: 'block' } },
          { q: 2, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 30, u: 'mL' } },
          { q: 2, u: 'tbsp', n: 'lemon juice', aisle: 'Produce', buyAs: 'lemons', buy: { q: 0.7, u: null } },
          { q: 1, u: null, n: 'lemon', aisle: 'Produce', note: 'zested', buyAs: 'lemons', buy: { q: 1, u: null }, buyNote: 'zest — buy whole' },
          { q: 1.5, u: 'tbsp', n: 'tamari', aisle: 'Condiments & Sauces', note: 'or soy sauce', buy: { q: 25, u: 'mL' } },
          { q: 2, u: 'tsp', n: 'maple syrup', aisle: 'Sweeteners', buy: { q: 10, u: 'mL' } },
          { q: 2, u: 'tsp', n: 'Dijon mustard', aisle: 'Condiments & Sauces', buy: { q: 10, u: 'g' } },
          { q: 4, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'minced or grated', buyAs: 'garlic', buy: { q: 0.4, u: 'head' } },
          { q: 2, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs', note: 'dried' },
          { q: 1, u: 'tsp', n: 'dried thyme', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tsp', n: 'smoked paprika', aisle: 'Spices & Dried Herbs' },
          { q: 0.5, u: 'tsp', n: 'ground cumin', aisle: 'Spices & Dried Herbs' },
          { q: 0.5, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: 0.5, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
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
          { q: 1, u: 'cup', n: 'cherry tomatoes', aisle: 'Produce', note: 'chopped', buy: { q: 150, u: 'g' } },
          { q: 1, u: 'cup', n: 'cucumbers', aisle: 'Produce', note: 'chopped', buy: { q: 0.5, u: null } },
          { q: 1, u: 'tbsp', n: 'fresh parsley', aisle: 'Produce', note: 'chopped', buy: { q: 0.1, u: 'bunch' } },
          { q: 1, u: 'tbsp', n: 'red wine vinegar', aisle: 'Oils & Vinegars', buy: { q: 15, u: 'mL' } },
          { q: 0.5, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 8, u: 'mL' } },
          { q: 0.25, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: 0.25, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'Combine all the ingredients in a small bowl.',
          'Refrigerate until you are ready to serve.',
        ],
      },
      {
        name: 'Mint Tzatziki',
        ingredients: [
          { q: 0.5, u: 'cup', n: 'cucumbers', aisle: 'Produce', note: 'grated, squeezed of excess moisture', buy: { q: 0.3, u: null } },
          { q: 0.75, u: 'cup', n: 'Greek yogurt', aisle: 'Dairy & Eggs', note: 'plain', buy: { q: 190, u: 'g' } },
          { q: 2, u: null, n: 'garlic cloves', aisle: 'Produce', note: '1–2, to taste', buyAs: 'garlic', buy: { q: 0.2, u: 'head' } },
          { q: 1.5, u: 'tbsp', n: 'lemon juice', aisle: 'Produce', buyAs: 'lemons', buy: { q: 0.5, u: null } },
          { q: 1, u: 'tsp', n: 'red wine vinegar', aisle: 'Oils & Vinegars', buy: { q: 5, u: 'mL' } },
          { q: 2, u: 'tbsp', n: 'fresh mint', aisle: 'Produce', note: 'chopped — dill or parsley also work', buy: { q: 0.2, u: 'bunch' } },
          { q: 0.5, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 8, u: 'mL' } },
          { q: 0.25, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs', note: 'dried' },
          { q: 0.25, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: 0.25, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'Mix all the ingredients in a bowl.',
          'Refrigerate until serving.',
        ],
      },
      {
        name: 'Build the Bowls',
        ingredients: [
          { q: 1, u: 'cup', n: 'white rice', aisle: 'Dry Goods & Grains', buy: { q: 185, u: 'g' }, buyNote: 'dry weight' },
          { q: null, u: null, n: 'pickled onions', aisle: 'Canned & Jarred', buy: { q: 1, u: 'jar' } },
          { q: null, u: null, n: 'kalamata olives', aisle: 'Canned & Jarred', buy: { q: 1, u: 'jar' } },
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
    title: 'Falafel Wraps',
    dish: '#A06B36',
    time: '30 min',
    servings: { n: 4, unit: 'wraps' },
    tags: ['lunch', 'dinner'],
    keyIngredients: ['chickpeas', 'parsley', 'cilantro', 'cumin'],
    added: '2026-07-26',
    order: 7,
    components: [
      {
        name: 'Falafel',
        ingredients: [
          { q: 1, u: 'can', n: 'chickpeas', aisle: 'Canned & Jarred', note: 'drained, rinsed and dried', buy: { q: 1, u: 'can' } },
          { q: 0.5, u: 'cup', n: 'fresh parsley', aisle: 'Produce', note: 'packed', buy: { q: 0.5, u: 'bunch' } },
          { q: 0.5, u: 'cup', n: 'cilantro', aisle: 'Produce', note: 'packed', buy: { q: 0.5, u: 'bunch' } },
          { q: 3, u: null, n: 'garlic cloves', aisle: 'Produce', buyAs: 'garlic', buy: { q: 0.3, u: 'head' } },
          { q: 0.25, u: null, n: 'red onion', aisle: 'Produce', note: 'cut into chunks — white works too', buy: { q: 0.25, u: null } },
          { q: 1.5, u: 'tbsp', n: 'flour', aisle: 'Dry Goods & Grains', buy: { q: 12, u: 'g' } },
          { q: 1, u: 'tbsp', n: 'lemon juice', aisle: 'Produce', buyAs: 'lemons', buy: { q: 0.35, u: null } },
          { q: 1, u: 'tsp', n: 'ground cumin', aisle: 'Spices & Dried Herbs' },
          { q: 0.25, u: 'tsp', n: 'cayenne pepper', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs' },
          { q: 3, u: 'tbsp', n: 'coconut oil', aisle: 'Oils & Vinegars', note: 'refined, for frying', buy: { q: 45, u: 'mL' } },
        ],
        steps: [
          'Blitz the chickpeas, parsley, cilantro, garlic, onion, flour, lemon juice, cumin, cayenne, salt and pepper in a food processor until it forms a chunky paste.',
          'Heat the coconut oil in a skillet over medium heat — enough to come partway up the sides of the falafel, not just a thin film.',
          'Scoop the mixture into the hot oil in rounded mounds, about ⅓ cup each — a cookie scoop or two spoons makes quick work of this. Don\'t flatten them; a scooped shape holds together and browns much more evenly than a smashed patty.',
          'Fry for 3–4 minutes, turning occasionally, until deeply golden and crisp on all sides.',
        ],
      },
      {
        name: 'Tomato Cucumber Salad',
        ingredients: [
          { q: 1, u: 'cup', n: 'cucumbers', aisle: 'Produce', note: 'diced', buy: { q: 0.5, u: null } },
          { q: 0.5, u: 'cup', n: 'tomatoes', aisle: 'Produce', note: 'diced', buy: { q: 1, u: null } },
          { q: 0.25, u: 'cup', n: 'red onion', aisle: 'Produce', note: 'diced', buy: { q: 0.25, u: null } },
          { q: null, u: null, n: 'olive oil', aisle: 'Oils & Vinegars', note: 'a drizzle', buy: { q: 15, u: 'mL' } },
          { q: null, u: null, n: 'red wine vinegar', aisle: 'Oils & Vinegars', note: 'a drizzle', buy: { q: 15, u: 'mL' } },
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
          { q: 0.25, u: 'cup', n: 'cucumbers', aisle: 'Produce', note: 'grated, squeeze out the moisture', buy: { q: 0.15, u: null } },
          { q: 0.5, u: 'cup', n: 'Greek yogurt', aisle: 'Dairy & Eggs', buy: { q: 125, u: 'g' } },
          { q: 1, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'small, grated', buyAs: 'garlic', buy: { q: 0.1, u: 'head' } },
          { q: 3, u: 'tbsp', n: 'lemon juice', aisle: 'Produce', buyAs: 'lemons', buy: { q: 1, u: null } },
          { q: 1, u: 'tbsp', n: 'fresh dill', aisle: 'Produce', note: 'heaping — parsley works too', buy: { q: 0.15, u: 'bunch' } },
          { q: 2, u: 'tsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 10, u: 'mL' } },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Whisk together the grated cucumber, Greek yogurt, garlic, dill and olive oil.',
          'Season with salt and pepper.',
        ],
      },
      {
        name: 'Build the Wraps',
        ingredients: [
          { q: 4, u: null, n: 'flour tortillas', aisle: 'Bakery', note: 'small', buyAs: 'tortillas' },
          { q: null, u: null, n: 'shredded lettuce', aisle: 'Produce', buyAs: 'lettuce', buy: { q: 0.25, u: 'head' } },
        ],
        steps: [
          'Warm the tortillas.',
          'Add a falafel to each, then shredded lettuce.',
          'Top with the tomato cucumber salad and a spoon of tzatziki, then wrap it up.',
        ],
      },
    ],
  },

  {
    slug: 'tofu-gyros',
    title: 'Tofu Gyros',
    dish: '#7A5F33',
    time: '50 min',
    servings: { n: 4, unit: 'gyros' },
    tags: ['lunch', 'dinner'],
    keyIngredients: ['tofu', 'white miso', 'dill', 'oregano'],
    added: '2026-07-26',
    order: 8,
    components: [
      {
        name: 'Oregano Fries',
        ingredients: [
          { q: 2, u: null, n: 'potatoes', aisle: 'Produce' },
          { q: 1, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 30, u: 'mL' } },
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
          { q: 1, u: 'block', n: 'extra firm tofu', aisle: 'Tofu & Plant-Based', buy: { q: 1, u: 'block' } },
          { q: 0.66, u: 'cup', n: 'Greek yogurt', aisle: 'Dairy & Eggs', buy: { q: 165, u: 'g' } },
          { q: 1, u: null, n: 'lemon', aisle: 'Produce', buyAs: 'lemons', buy: { q: 1, u: null } },
          { q: 2, u: 'tbsp', n: 'white miso', aisle: 'Condiments & Sauces', buy: { q: 35, u: 'g' } },
          { q: 2, u: null, n: 'garlic cloves', aisle: 'Produce', buyAs: 'garlic', buy: { q: 0.2, u: 'head' } },
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
          { q: 0.5, u: null, n: 'cucumbers', aisle: 'Produce', buy: { q: 0.5, u: null } },
          { q: 1, u: 'cup', n: 'Greek yogurt', aisle: 'Dairy & Eggs', buy: { q: 250, u: 'g' } },
          { q: 1, u: null, n: 'garlic cloves', aisle: 'Produce', buyAs: 'garlic', buy: { q: 0.1, u: 'head' } },
          { q: 1, u: 'handful', n: 'fresh dill', aisle: 'Produce', note: 'large handful', buy: { q: 0.5, u: 'bunch' } },
          { q: 0.5, u: null, n: 'lemon', aisle: 'Produce', buyAs: 'lemons', buy: { q: 0.5, u: null } },
        ],
        steps: [
          'Grate the cucumber and squeeze out the moisture.',
          'Mix with the yogurt, garlic, dill and lemon.',
        ],
      },
      {
        name: 'Salad & Assembly',
        ingredients: [
          { q: 2, u: null, n: 'tomatoes', aisle: 'Produce' },
          { q: 0.5, u: null, n: 'red onion', aisle: 'Produce', buy: { q: 0.5, u: null } },
          { q: 0.5, u: null, n: 'cucumbers', aisle: 'Produce', buy: { q: 0.5, u: null } },
          { q: 1, u: 'handful', n: 'fresh parsley', aisle: 'Produce', buy: { q: 0.25, u: 'bunch' } },
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
    time: '35 min',
    servings: { n: 2, unit: 'servings' },
    tags: ['breakfast', 'lunch', 'dinner'],
    keyIngredients: ['Swiss chard', 'eggs', 'harissa paste', 'cilantro'],
    added: '2026-07-26',
    order: 9,
    components: [
      {
        name: 'Prep',
        ingredients: [
          { q: 300, u: 'g', n: 'Swiss chard', aisle: 'Produce', buy: { q: 1, u: 'bunch' } },
          { q: 25, u: 'g', n: 'cilantro', aisle: 'Produce', buy: { q: 0.5, u: 'bunch' } },
          { q: 1, u: null, n: 'lime', aisle: 'Produce', buyAs: 'limes', buy: { q: 1, u: null } },
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
          { q: 150, u: 'g', n: 'leeks', aisle: 'Produce', buy: { q: 1, u: null } },
          { q: 4, u: null, n: 'garlic cloves', aisle: 'Produce', buyAs: 'garlic', buy: { q: 0.4, u: 'head' } },
          { q: 1, u: 'tbsp', n: 'dried dill', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tsp', n: 'ground cumin', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tbsp', n: 'raw sugar', aisle: 'Sweeteners', buy: { q: 15, u: 'g' } },
          { q: 1, u: 'tsp', n: 'red pepper flakes', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: null, n: 'vegetable stock cube', aisle: 'Dry Goods & Grains' },
          { q: 2, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 30, u: 'mL' } },
        ],
        steps: [
          'Heat 2 tbsp olive oil in a large oven-proof skillet over medium-high.',
          'Add the leeks and chard stems. Cook 3–4 minutes, stirring, until tender and turning golden.',
          'Add the garlic, dill, cumin, sugar, three-quarters of the cilantro and red pepper flakes to taste. Cook 1–2 minutes until fragrant.',
          'Add the chard leaves, the crumbled stock cube and ⅔ cup water. Bring to a low boil.',
          'Cover and cook 4–5 minutes, stirring occasionally, until the liquid has almost evaporated.',
          'Season with lime juice, salt and pepper.',
        ],
      },
      {
        name: 'Harissa Oil',
        ingredients: [
          { q: 2, u: 'tsp', n: 'harissa paste', aisle: 'Condiments & Sauces', buy: { q: 30, u: 'g' } },
          { q: 2, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 30, u: 'mL' } },
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
          { q: 0.5, u: 'cup', n: 'Greek yogurt', aisle: 'Dairy & Eggs', buy: { q: 125, u: 'g' } },
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
    time: '15 min + chilling',
    servings: { n: 16, unit: 'bites' },
    tags: ['snack', 'dessert', 'breakfast'],
    keyIngredients: ['tahini', 'dried apricots', 'pistachios', 'coconut'],
    added: '2026-07-26',
    order: 10,
    components: [
      {
        name: 'The Dough',
        ingredients: [
          { q: 0.5, u: 'cup', n: 'tahini', aisle: 'Condiments & Sauces', buy: { q: 120, u: 'g' } },
          { q: 3, u: 'tbsp', n: 'honey', aisle: 'Sweeteners', buy: { q: 65, u: 'g' } },
          { q: 0.5, u: 'cup', n: 'large flake oats', aisle: 'Dry Goods & Grains', buy: { q: 45, u: 'g' } },
          { q: 56, u: 'g', n: 'dried apricots', aisle: 'Dry Goods & Grains', buy: { q: 60, u: 'g' } },
          { q: 1, u: 'tsp', n: 'cinnamon', aisle: 'Spices & Dried Herbs' },
          { q: 28, u: 'g', n: 'pistachios', aisle: 'Nuts & Seeds', buy: { q: 30, u: 'g' } },
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
          { q: 0.5, u: 'cup', n: 'unsweetened shredded coconut', aisle: 'Dry Goods & Grains', buy: { q: 40, u: 'g' } },
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

  {
    slug: 'carrot-cake-baked-oats',
    title: 'Carrot Cake Baked Oats',
    dish: '#C1793A',
    time: '45 min + overnight chill',
    servings: { n: 6, unit: 'servings' },
    tags: ['breakfast', 'snack', 'dessert'],
    keyIngredients: ['banana', 'carrot', 'rolled oats', 'cinnamon'],
    added: '2026-07-27',
    order: 11,
    components: [
      {
        name: 'Bake',
        ingredients: [
          { q: 2, u: null, n: 'ripe bananas', aisle: 'Produce', note: 'medium, mashed' },
          { q: 2, u: 'cup', n: 'rolled oats', aisle: 'Dry Goods & Grains', buy: { q: 180, u: 'g' } },
          { q: 30, u: 'g', n: 'vanilla protein powder', aisle: 'Dry Goods & Grains', note: 'or ¼ cup wholemeal flour, if you\'d rather skip the protein powder' },
          { q: 0.5, u: 'tsp', n: 'cinnamon', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tsp', n: 'baking powder', aisle: 'Dry Goods & Grains', note: 'flat' },
          { q: 1, u: null, n: 'carrot', aisle: 'Produce', note: 'medium, grated' },
          { q: 0.25, u: 'cup', n: 'pecans or walnuts', aisle: 'Nuts & Seeds', note: 'crushed', buy: { q: 30, u: 'g' } },
          { q: 1.5, u: 'tbsp', n: 'honey', aisle: 'Sweeteners', note: 'or maple syrup', buy: { q: 32, u: 'g' } },
          { q: 1.5, u: 'cup', n: 'milk', aisle: 'Dairy & Eggs', note: 'use closer to 2 cups if your bananas are on the larger side', buy: { q: 360, u: 'mL' } },
        ],
        steps: [
          'Heat the oven to 180°C (350°F).',
          'In a greased, oven-safe baking dish (about 15–20cm square), combine the mashed banana, oats, protein powder (or flour), cinnamon, baking powder, grated carrot, nuts, honey and milk. Mix until well combined.',
          'Bake for 35–40 minutes, until golden and firm to the touch.',
        ],
      },
      {
        name: 'Yogurt Topping',
        ingredients: [
          { q: 160, u: 'g', n: 'yogurt', aisle: 'Dairy & Eggs' },
          { q: 50, u: 'g', n: 'cream cheese', aisle: 'Dairy & Eggs', note: 'reduced fat' },
        ],
        steps: [
          'Let the baked oats cool in the dish, then loosen the edges with a knife.',
          'Mix the yogurt and cream cheese together, then spread over the top.',
          'Refrigerate and serve the next day.',
          'Cut into 4–6 servings. Serve cold, or reheat a slice in the microwave for about 1 minute if you\'d like it warm.',
        ],
        tip: 'Any leftover crushed nuts make a nice finish scattered over the yogurt topping.',
      },
    ],
  },

  {
    slug: 'vegetarian-feijoada',
    title: 'Vegetarian Feijoada',
    dish: '#8B4A3B',
    time: '2 hr 15 min + soaking overnight',
    servings: { n: 6, unit: 'servings' },
    tags: ['dinner', 'lunch'],
    keyIngredients: ['black beans', 'smoked paprika', 'liquid smoke', 'cassava flour'],
    added: '2026-08-07',
    order: 12,
    components: [
      {
        name: 'Black Beans',
        ingredients: [
          { q: 500, u: 'g', n: 'dried black beans', aisle: 'Dry Goods & Grains' },
          { q: 3, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 45, u: 'mL' } },
          { q: 2, u: null, n: 'onion', aisle: 'Produce', note: 'large, chopped', buyAs: 'onion', buy: { q: 2, u: null } },
          { q: 8, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'minced', buyAs: 'garlic', buy: { q: 0.8, u: 'head' } },
          { q: 1, u: 'tsp', n: 'cumin seeds', aisle: 'Spices & Dried Herbs' },
          { q: 2, u: 'tsp', n: 'smoked paprika', aisle: 'Spices & Dried Herbs' },
          { q: 2, u: 'tbsp', n: 'tomato paste', aisle: 'Canned & Jarred', buy: { q: 1, u: 'can' } },
          { q: 4, u: null, n: 'bay leaves', aisle: 'Spices & Dried Herbs' },
          { q: 1.5, u: 'tsp', n: 'liquid smoke', aisle: 'Condiments & Sauces', buy: { q: 1, u: 'jar' } },
          { q: 1.5, u: 'tbsp', n: 'red wine vinegar', aisle: 'Oils & Vinegars', buy: { q: 23, u: 'mL' } },
          { q: 2, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: 0.5, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'Cover the beans with several inches of cold water and soak overnight, then drain. Short on time? Boil for 2 minutes, cover, and rest for 1 hour instead.',
          'Soften the onion in the olive oil over medium heat for 10–12 minutes — push past translucent until the edges go golden. This refogado is the flavor base, so don\'t rush it.',
          'Add the garlic and cumin seeds, cook 1 minute until fragrant. Stir in the smoked paprika, then the tomato paste, and fry until it darkens to brick red and smells toasty, about 2 minutes.',
          'Add the beans, bay leaves and liquid smoke. Cover with water by two inches. Bring to a boil, then simmer partly covered until the beans are creamy and beginning to break down, 75–90 minutes. Top up with hot water if it gets tight.',
          'Remove the bay leaves. Scoop a ladle of beans into a bowl, mash to a paste, and stir it back in to thicken the pot. Simmer uncovered another 20 minutes to tighten.',
          'Stir in the vinegar, salt and pepper. Taste and adjust — it should be savory and smoky with a sharp edge. A splash of soy sauce at the end helps if it tastes thin.',
        ],
        tip: 'Without meat or mushrooms, the beans lean on the refogado for depth. Better on day two.',
      },
      {
        name: 'Farofa',
        ingredients: [
          { q: 1.5, u: 'cup', n: 'cassava flour (farinha de mandioca)', aisle: 'Dry Goods & Grains', buy: { q: 180, u: 'g' } },
          { q: 60, u: 'g', n: 'butter', aisle: 'Dairy & Eggs' },
          { q: 1, u: null, n: 'onion', aisle: 'Produce', note: 'small, finely diced', buyAs: 'onion', buy: { q: 1, u: null } },
          { q: 0.5, u: 'cup', n: 'black olives', aisle: 'Canned & Jarred', note: 'sliced', buy: { q: 1, u: 'jar' } },
          { q: 0.25, u: 'cup', n: 'raisins', aisle: 'Dry Goods & Grains', buy: { q: 40, u: 'g' } },
          { q: 1, u: 'tbsp', n: 'dried parsley', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'Melt the butter and cook the onion until deep golden, about 6 minutes.',
          'Add the olives, then the cassava flour in batches, stirring constantly over medium-low heat until sandy and toasted the color of wet sand, about 8 minutes.',
          'Off heat, stir in the parsley, raisins and salt.',
        ],
      },
      {
        name: 'Garlic Rice',
        ingredients: [
          { q: 3, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'minced', buyAs: 'garlic', buy: { q: 0.3, u: 'head' } },
          { q: 1, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', note: 'for the pan', buy: { q: 15, u: 'mL' } },
          { q: 2, u: 'cup', n: 'long-grain white rice', aisle: 'Dry Goods & Grains', buy: { q: 370, u: 'g' }, buyNote: 'dry weight' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', note: 'a big pinch', buy: { q: null, u: null } },
        ],
        steps: [
          'Sauté the garlic in the olive oil until pale gold, add the rice and toast 1 minute until the grains turn opaque.',
          'Add 3½ cups water and a big pinch of salt, bring to a boil, then cover and cook on low for 15 minutes.',
          'Rest 5 minutes off heat before fluffing.',
        ],
      },
      {
        name: 'Couve à Mineira',
        ingredients: [
          { q: 1, u: 'lb', n: 'collard greens', aisle: 'Produce', note: 'stems removed', buy: { q: 1, u: 'bunch' } },
          { q: 3, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'sliced', buyAs: 'garlic', buy: { q: 0.3, u: 'head' } },
          { q: 1, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', note: 'for frying', buy: { q: 15, u: 'mL' } },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'Stack the collard leaves, roll them tight like a cigar, and slice into hair-thin ribbons.',
          'Flash-fry with the garlic in the olive oil for 2 minutes — bright green, still with bite.',
          'Salt and serve immediately.',
        ],
      },
    ],
  },

  {
    slug: 'one-pan-dump-spanakopita',
    title: 'One Pan Dump Spanakopita',
    dish: '#6F7F38',
    time: '45 min',
    servings: { n: 4, unit: 'servings' },
    tags: ['dinner', 'lunch'],
    keyIngredients: ['baby spinach', 'feta', 'filo pastry', 'Greek yogurt'],
    added: '2026-08-09',
    order: 13,
    components: [
      {
        name: 'Spinach Filling',
        ingredients: [
          { q: 1, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', note: 'for frying', buy: { q: 15, u: 'mL' } },
          { q: 1, u: null, n: 'onion', aisle: 'Produce', note: 'finely diced', buy: { q: 1, u: null } },
          { q: 250, u: 'g', n: 'baby spinach', aisle: 'Produce', buyAs: 'fresh spinach', buy: { q: 250, u: 'g' } },
          { q: 200, u: 'g', n: 'feta', aisle: 'Dairy & Eggs', note: 'crumbled', buy: { q: 200, u: 'g' } },
          { q: 100, u: 'g', n: 'Greek yogurt', aisle: 'Dairy & Eggs', buy: { q: 100, u: 'g' } },
          { q: 2, u: null, n: 'eggs', aisle: 'Dairy & Eggs' },
          { q: 1, u: 'tsp', n: 'oregano', aisle: 'Spices & Dried Herbs', note: 'dried' },
          { q: 1, u: 'tsp', n: 'ground nutmeg', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', note: 'a big pinch', buy: { q: null, u: null } },
        ],
        steps: [
          'Fry the onion in the olive oil over medium-low heat for a few minutes.',
          'Add the spinach, press it down and put a lid on for 2 minutes until it starts to wilt. Stir until fully wilted, then keep simmering 3 minutes to drive off some moisture. Turn off the heat.',
          'Crumble over the feta, then add the Greek yogurt, oregano, black pepper, nutmeg and eggs. Stir until combined.',
        ],
      },
      {
        name: 'Assemble & Bake',
        ingredients: [
          { q: 8, u: null, n: 'filo pastry', aisle: 'Bakery', note: 'sheets', buy: { q: 1, u: 'pack' } },
          { q: null, u: null, n: 'butter', aisle: 'Dairy & Eggs', note: 'melted, for brushing', buy: { q: 50, u: 'g' } },
          { q: null, u: null, n: 'sesame seeds', aisle: 'Nuts & Seeds', note: 'for sprinkling', buy: { q: 30, u: 'g' } },
          { q: null, u: null, n: 'honey', aisle: 'Sweeteners', note: 'to drizzle', buy: { q: 15, u: 'g' } },
        ],
        steps: [
          'Crumple up the filo sheets and add them one by one, layering them up and brushing each individual layer with melted butter.',
          'Sprinkle over the sesame seeds.',
          'Bake at 180°C for 25–30 minutes, until golden and puffed up.',
          'Drizzle over a little honey and serve.',
        ],
      },
    ],
  },

  {
    slug: 'smoky-chipotle-tofu-sandwiches',
    title: 'Smoky Chipotle Tofu Sandwiches',
    dish: '#B0472A',
    time: '40 min',
    servings: { n: 4, unit: 'sandwiches' },
    tags: ['lunch', 'dinner'],
    keyIngredients: ['tofu', 'chipotle in adobo', 'cabbage', 'plantain chips'],
    added: '2026-08-09',
    order: 14,
    components: [
      {
        name: 'Deli Slices',
        ingredients: [
          { q: 1, u: 'block', n: 'extra firm tofu', aisle: 'Tofu & Plant-Based', note: '16 oz, drained', buy: { q: 1, u: 'block' } },
          { q: 3, u: 'tbsp', n: 'adobo sauce', aisle: 'Canned & Jarred', note: 'from a can of chipotle peppers', buyAs: 'chipotle peppers in adobo', buy: { q: 1, u: 'can' } },
          { q: 2, u: 'tbsp', n: 'agave syrup', aisle: 'Sweeteners', buy: { q: 30, u: 'mL' } },
          { q: 2, u: 'tbsp', n: 'apple cider vinegar', aisle: 'Oils & Vinegars', buy: { q: 30, u: 'mL' } },
          { q: 1, u: 'tbsp', n: 'tamari', aisle: 'Condiments & Sauces', note: 'or soy sauce', buy: { q: 15, u: 'mL' } },
          { q: 1, u: 'tbsp', n: 'avocado oil', aisle: 'Oils & Vinegars', buyAs: 'neutral oil', buy: { q: 15, u: 'mL' } },
          { q: 0.5, u: 'tsp', n: 'vegetable bouillon paste', aisle: 'Condiments & Sauces', note: 'or half a crushed bouillon cube', buy: { q: 1, u: 'jar' } },
          { q: 1, u: 'tsp', n: 'smoked paprika', aisle: 'Spices & Dried Herbs' },
          { q: 0.5, u: 'tsp', n: 'ground coriander', aisle: 'Spices & Dried Herbs' },
          { q: 0.25, u: 'tsp', n: 'allspice', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'white pepper', aisle: 'Spices & Dried Herbs', note: 'a pinch', buy: { q: null, u: null } },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'In a large shallow bowl, whisk the adobo sauce, bouillon paste, agave, tamari, vinegar, oil and spices together until completely smooth. Set aside.',
          'Slice the tofu crosswise into thin ⅛-inch slabs (1–2mm) using a sharp knife or mandoline.',
          'Dip each slice into the sauce on both sides so it\'s evenly coated, reserving the remaining dressing.',
          'Heat some oil in a large griddle or skillet over medium-low. Arrange the tofu in a single layer with a little space between each slice. Cook undisturbed 3 minutes, then flip and cook 2–3 minutes more, brushing a little more marinade on top as it finishes.',
          'They\'re done once nicely browned and lightly crisp at the edges on both sides. Sprinkle with salt, transfer to a container, and repeat with the remaining slices.',
        ],
      },
      {
        name: 'Quick Pickled Slaw',
        ingredients: [
          { q: 2, u: 'cup', n: 'green cabbage', aisle: 'Produce', note: 'shredded', buyAs: 'cabbage', buy: { q: 0.5, u: 'head' } },
          { q: 0.25, u: 'cup', n: 'cilantro', aisle: 'Produce', note: 'minced — parsley works too', buy: { q: 0.25, u: 'bunch' } },
          { q: 1, u: 'tbsp', n: 'apple cider vinegar', aisle: 'Oils & Vinegars', buy: { q: 15, u: 'mL' } },
          { q: 2, u: 'tsp', n: 'avocado oil', aisle: 'Oils & Vinegars', buyAs: 'neutral oil', buy: { q: 10, u: 'mL' } },
          { q: 2, u: 'tsp', n: 'agave syrup', aisle: 'Sweeteners', buy: { q: 10, u: 'mL' } },
        ],
        steps: [
          'Combine the cabbage, cilantro, vinegar, oil, agave and a generous pinch of salt in a medium bowl.',
          'Massage the cabbage with clean hands until it has softened.',
        ],
      },
      {
        name: 'Assembly',
        ingredients: [
          { q: 8, u: null, n: 'sourdough bread', aisle: 'Bakery', note: 'slices', buy: { q: 1, u: 'pack' } },
          { q: 4, u: 'oz', n: 'plantain chips', aisle: 'Dry Goods & Grains', note: 'or baked plantains', buy: { q: 115, u: 'g' } },
          { q: null, u: null, n: 'mayo', aisle: 'Condiments & Sauces', note: 'a bean spread or toum also work', buy: { q: 1, u: 'jar' } },
        ],
        steps: [
          'Spread mayo onto two slices of toasted bread.',
          'Layer a serving of tofu slices onto one slice, then some plantain pieces, then the slaw.',
          'Top with the remaining slice of bread.',
        ],
      },
    ],
  },

  {
    slug: 'cauliflower-chickpea-wraps',
    title: 'Cauliflower Chickpea Wraps',
    dish: '#8A7340',
    time: '45 min',
    servings: { n: 3, unit: 'wraps' },
    tags: ['lunch', 'dinner'],
    keyIngredients: ['cauliflower', 'chickpeas', 'tahini', 'avocado'],
    added: '2026-08-09',
    order: 15,
    components: [
      {
        name: 'Tahini Yogurt Sauce',
        ingredients: [
          { q: 0.75, u: 'cup', n: 'Greek yogurt', aisle: 'Dairy & Eggs', buy: { q: 190, u: 'g' } },
          { q: 1.5, u: 'tbsp', n: 'tahini', aisle: 'Condiments & Sauces', note: 'hulled', buy: { q: 25, u: 'g' } },
          { q: null, u: null, n: 'lemon juice', aisle: 'Produce', note: 'juice from half a lemon', buyAs: 'lemons', buy: { q: 0.5, u: null } },
          { q: 1, u: 'tsp', n: 'maple syrup', aisle: 'Sweeteners', buy: { q: 5, u: 'mL' } },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', note: 'a pinch', buy: { q: null, u: null } },
        ],
        steps: [
          'While the tray is in the oven, whisk the yogurt, tahini, lemon juice, maple syrup and salt together.',
        ],
      },
      {
        name: 'Cauliflower & Chickpeas',
        ingredients: [
          { q: 1, u: 'head', n: 'cauliflower', aisle: 'Produce', note: 'small, cut into small pieces', buy: { q: 1, u: 'head' } },
          { q: 1, u: 'can', n: 'chickpeas', aisle: 'Canned & Jarred', note: '420g, drained and rinsed', buy: { q: 1, u: 'can' } },
          { q: null, u: null, n: 'olive oil', aisle: 'Oils & Vinegars', note: 'a drizzle', buy: { q: 15, u: 'mL' } },
          { q: 1, u: 'tsp', n: 'garlic powder', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tsp', n: 'onion powder', aisle: 'Spices & Dried Herbs' },
          { q: 2, u: 'tsp', n: 'paprika', aisle: 'Spices & Dried Herbs' },
          { q: 2, u: 'tsp', n: 'dried parsley', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'Preheat the oven to 200°C (390°F).',
          'Add the cauliflower and chickpeas to a baking tray. Drizzle with olive oil, add the spices, and toss to coat.',
          'Bake for 35 minutes, then remove and cool for 5 minutes.',
        ],
      },
      {
        name: 'Assembly',
        ingredients: [
          { q: 3, u: null, n: 'flour tortillas', aisle: 'Bakery', note: 'large', buyAs: 'tortillas' },
          { q: 1, u: null, n: 'avocado', aisle: 'Produce', note: 'ripe, sliced', buy: { q: 1, u: null } },
          { q: 0.5, u: null, n: 'cucumbers', aisle: 'Produce', note: 'sliced', buy: { q: 0.5, u: null } },
          { q: null, u: null, n: 'pickled onions', aisle: 'Canned & Jarred', buy: { q: 1, u: 'jar' } },
          { q: null, u: null, n: 'fresh parsley', aisle: 'Produce', note: 'finely chopped', buy: { q: 0.2, u: 'bunch' } },
          { q: null, u: null, n: 'sesame seeds', aisle: 'Nuts & Seeds', buy: { q: 30, u: 'g' } },
        ],
        steps: [
          'Heat the tortillas in a pan over low heat, or microwave for 10 seconds, to soften.',
          'Add a bit of everything to each wrap and fold it up.',
          'If you like, press the wrap in a sandwich press or pan over high heat for 1 minute each side to lightly toast.',
        ],
      },
    ],
  },

  {
    slug: 'brazilian-carrot-cake',
    title: 'Brazilian Carrot Cake',
    dish: '#6F3B24',
    time: '1 hr + cooling',
    servings: { n: 12, unit: 'servings' },
    tags: ['dessert'],
    keyIngredients: ['carrot', 'dark chocolate', 'condensed milk'],
    added: '2026-08-09',
    order: 16,
    components: [
      {
        name: 'Cake',
        ingredients: [
          { q: 0.5, u: 'cup', n: 'neutral oil', aisle: 'Oils & Vinegars', buy: { q: 120, u: 'mL' } },
          { q: 2, u: null, n: 'carrot', aisle: 'Produce', note: 'medium, about 350g, roughly chopped', buy: { q: 2, u: null } },
          { q: 3, u: null, n: 'eggs', aisle: 'Dairy & Eggs' },
          { q: 2, u: 'cup', n: 'sugar', aisle: 'Sweeteners', buy: { q: 360, u: 'g' } },
          { q: 2, u: 'cup', n: 'flour', aisle: 'Dry Goods & Grains', note: 'all-purpose', buy: { q: 270, u: 'g' } },
          { q: 1, u: 'tbsp', n: 'baking powder', aisle: 'Dry Goods & Grains' },
          { q: 1, u: 'tsp', n: 'vanilla extract', aisle: 'Dry Goods & Grains', note: 'optional, not traditional' },
        ],
        steps: [
          'Preheat the oven to 180°C (350°F).',
          'Blend the oil, carrots, eggs and sugar until completely smooth.',
          'Pour into a large bowl. Gradually fold in the flour, then the baking powder.',
          'Pour into a greased 9x13 pan. Bake 25–30 minutes, until a toothpick comes out clean.',
          'Cool completely before making the brigadeiro.',
        ],
        tip: 'Weigh your carrots if you can — 350g gives you the right moisture every time.',
      },
      {
        name: 'Brigadeiro Icing',
        ingredients: [
          { q: 1, u: 'can', n: 'sweetened condensed milk', aisle: 'Canned & Jarred', note: '397g', buy: { q: 1, u: 'can' } },
          { q: 150, u: 'g', n: 'dark chocolate chips', aisle: 'Dry Goods & Grains', buy: { q: 150, u: 'g' } },
          { q: 0.66, u: 'cup', n: 'heavy cream', aisle: 'Dairy & Eggs', buy: { q: 150, u: 'mL' } },
          { q: 3.5, u: 'tbsp', n: 'butter', aisle: 'Dairy & Eggs', note: 'unsalted', buy: { q: 50, u: 'g' } },
          { q: 0.125, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'Combine all the brigadeiro ingredients in a saucepan over medium heat. Stir continuously until melted and thickened, 8–12 minutes. It should be thick but pourable.',
          'Flip the cooled cake onto a wire rack set over a tray. Pour the brigadeiro over the top and smooth it out.',
          'Let set 10 minutes, then transfer to a plate to slice.',
        ],
      },
    ],
  },

  {
    slug: 'kale-brussels-sweet-potato-salad',
    title: 'Kale Brussels Sweet Potato Salad',
    dish: '#497238',
    time: '40 min',
    servings: { n: 2, unit: 'servings' },
    tags: ['lunch', 'dinner'],
    keyIngredients: ['kale', 'Brussels sprouts', 'sweet potato', 'balsamic'],
    added: '2026-08-09',
    order: 17,
    components: [
      {
        name: 'Roasting Tray',
        ingredients: [
          { q: 1, u: 'cup', n: 'Brussels sprouts', aisle: 'Produce', note: 'halved', buy: { q: 250, u: 'g' } },
          { q: 1, u: 'cup', n: 'sweet potato', aisle: 'Produce', note: 'cubed', buy: { q: 1, u: null } },
          { q: 1, u: 'block', n: 'extra firm tofu', aisle: 'Tofu & Plant-Based', note: 'cubed', buy: { q: 1, u: 'block' } },
          { q: 0.5, u: 'cup', n: 'chickpeas', aisle: 'Canned & Jarred', note: 'drained and rinsed', buy: { q: 1, u: 'can' } },
          { q: 1, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 15, u: 'mL' } },
          { q: 1, u: 'tsp', n: 'garlic powder', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tsp', n: 'paprika', aisle: 'Spices & Dried Herbs' },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'Preheat the oven to 200°C (400°F).',
          'Toss the Brussels sprouts and sweet potato with the olive oil, salt, garlic powder and paprika. Roast 25–30 minutes, flipping halfway.',
          'Use the same bowl to season the tofu and chickpeas, then roast them alongside for 25–30 minutes, until the chickpeas are crisp and the tofu is golden.',
        ],
      },
      {
        name: 'Massaged Kale',
        ingredients: [
          { q: 4, u: 'cup', n: 'kale', aisle: 'Produce', note: 'stems removed', buy: { q: 1, u: 'bunch' } },
          { q: null, u: null, n: 'olive oil', aisle: 'Oils & Vinegars', note: 'a splash', buy: { q: 15, u: 'mL' } },
          { q: null, u: null, n: 'lemon juice', aisle: 'Produce', note: 'a squeeze', buyAs: 'lemons', buy: { q: 0.5, u: null } },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', note: 'a pinch', buy: { q: null, u: null } },
        ],
        steps: [
          'While everything roasts, massage the kale with a drizzle of olive oil, a squeeze of lemon and a pinch of salt until softened.',
        ],
      },
      {
        name: 'Balsamic Dijon Dressing',
        ingredients: [
          { q: 3, u: 'tbsp', n: 'balsamic vinegar', aisle: 'Oils & Vinegars', buy: { q: 45, u: 'mL' } },
          { q: 2, u: 'tbsp', n: 'olive oil', aisle: 'Oils & Vinegars', buy: { q: 30, u: 'mL' } },
          { q: 1, u: 'tsp', n: 'dijon mustard', aisle: 'Condiments & Sauces', buy: { q: 1, u: 'jar' } },
          { q: 0.5, u: 'tsp', n: 'honey', aisle: 'Sweeteners', buy: { q: 5, u: 'g' } },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'Whisk the balsamic, olive oil, Dijon, honey, salt and pepper together.',
        ],
      },
      {
        name: 'Assembly',
        ingredients: [
          { q: 0.25, u: 'cup', n: 'parmesan', aisle: 'Dairy & Eggs', note: 'shaved', buy: { q: 50, u: 'g' } },
        ],
        steps: [
          'Pile up the kale, roasted Brussels and sweet potato, tofu, chickpeas and parmesan.',
          'Toss with the dressing and serve warm or at room temperature.',
        ],
      },
    ],
  },

  {
    slug: 'one-pan-marry-me-tofu',
    title: 'One Pan Marry Me Tofu',
    dish: '#B8443B',
    time: '30 min',
    servings: { n: 4, unit: 'servings' },
    tags: ['dinner'],
    keyIngredients: ['tofu', 'sun-dried tomatoes', 'coconut milk', 'nutritional yeast'],
    added: '2026-08-09',
    order: 18,
    components: [
      {
        name: 'Tofu',
        ingredients: [
          { q: 12, u: 'oz', n: 'firm tofu', aisle: 'Tofu & Plant-Based', note: 'pressed 10 minutes, then cubed', buyAs: 'extra firm tofu', buy: { q: 1, u: 'block' } },
          { q: 0.5, u: 'cup', n: 'vegetable broth', aisle: 'Canned & Jarred', buy: { q: 120, u: 'mL' } },
          { q: 1, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: 0.5, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
        ],
        steps: [
          'Toss the cubed tofu in the vegetable broth, salt and pepper. Let it marinate while you prepare the sauce, or up to 1 day ahead.',
        ],
      },
      {
        name: 'Sauce',
        ingredients: [
          { q: 0.5, u: 'cup', n: 'sun-dried tomatoes', aisle: 'Canned & Jarred', note: 'in oil', buy: { q: 1, u: 'jar' } },
          { q: 4, u: null, n: 'garlic cloves', aisle: 'Produce', note: 'minced', buyAs: 'garlic', buy: { q: 0.4, u: 'head' } },
          { q: 1, u: 'cup', n: 'onion', aisle: 'Produce', note: 'yellow, finely diced', buy: { q: 1, u: null } },
          { q: 1, u: 'tbsp', n: 'Italian seasoning', aisle: 'Spices & Dried Herbs' },
          { q: 1.5, u: 'tbsp', n: 'tomato paste', aisle: 'Canned & Jarred', buy: { q: 1, u: 'can' } },
          { q: 1, u: 'tbsp', n: 'tamari', aisle: 'Condiments & Sauces', note: 'or soy sauce', buy: { q: 15, u: 'mL' } },
          { q: 1, u: 'can', n: 'coconut milk', aisle: 'Canned & Jarred', note: 'full-fat, 15 oz', buy: { q: 1, u: 'can' } },
          { q: 3, u: 'tbsp', n: 'nutritional yeast', aisle: 'Dry Goods & Grains', buy: { q: 15, u: 'g' } },
          { q: 1, u: 'tsp', n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: 0.5, u: 'tsp', n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: 2, u: 'cup', n: 'baby spinach', aisle: 'Produce', buyAs: 'fresh spinach', buy: { q: 60, u: 'g' } },
          { q: 1, u: 'tbsp', n: 'lemon juice', aisle: 'Produce', buyAs: 'lemons', buy: { q: 0.35, u: null } },
          { q: null, u: null, n: 'fresh parsley', aisle: 'Produce', note: 'for garnish', buy: { q: 0.15, u: 'bunch' } },
        ],
        steps: [
          'Heat a large skillet over medium heat and add the sun-dried tomatoes with their oil. Add the garlic and onion and sauté 2–3 minutes until fragrant.',
          'Add the Italian seasoning and tomato paste, and stir about 30 seconds to caramelize the paste.',
          'Add the tamari, coconut milk and nutritional yeast, and stir to combine. Bring to a boil, then reduce to a gentle simmer.',
          'Gently stir in the tofu and its marinade. Simmer uncovered over low heat until the tofu takes on the colour of the sauce, about 5 minutes. Stir occasionally but gently so the tofu doesn\'t break apart.',
          'Stir in the lemon juice and spinach. Cook just until the spinach wilts.',
          'Top with chopped parsley right before serving.',
        ],
      },
    ],
  },

  {
    slug: 'german-apple-cake',
    title: 'German Apple Cake',
    dish: '#9E5A5F',
    time: '45 min',
    servings: { n: 12, unit: 'pieces' },
    tags: ['dessert', 'snack'],
    keyIngredients: ['apples', 'milk', 'butter'],
    added: '2026-08-09',
    order: 19,
    components: [
      {
        name: 'Cake',
        ingredients: [
          { q: 1, u: 'cup', n: 'flour', aisle: 'Dry Goods & Grains', note: 'all-purpose, sifted', buy: { q: 135, u: 'g' } },
          { q: 0.5, u: 'cup', n: 'sugar', aisle: 'Sweeteners', buy: { q: 90, u: 'g' } },
          { q: 0.75, u: 'tbsp', n: 'baking powder', aisle: 'Dry Goods & Grains' },
          { q: 3, u: null, n: 'eggs', aisle: 'Dairy & Eggs', note: 'large, room temperature' },
          { q: 0.5, u: 'cup', n: 'avocado oil', aisle: 'Oils & Vinegars', note: 'or any neutral oil', buyAs: 'neutral oil', buy: { q: 120, u: 'mL' } },
          { q: 3, u: null, n: 'apples', aisle: 'Produce', note: 'medium, peeled and diced small — about 2–2½ cups', buy: { q: 3, u: null } },
        ],
        steps: [
          'Heat the oven to 375°F. Spray a 7-inch springform pan and line it with parchment.',
          'Combine the flour, sugar and baking powder in a bowl. Add the eggs and oil, stirring until smooth.',
          'Fold in the diced apples until coated.',
          'Pour into the pan and bake for 35–40 minutes, until a toothpick comes out clean.',
        ],
        tip: 'Pears, peaches or berries work in place of the apples.',
      },
      {
        name: 'Milk Topping',
        ingredients: [
          { q: 0.5, u: 'cup', n: 'milk', aisle: 'Dairy & Eggs', buy: { q: 120, u: 'mL' } },
          { q: 2, u: 'tbsp', n: 'butter', aisle: 'Dairy & Eggs', buy: { q: 30, u: 'g' } },
          { q: 2, u: 'tbsp', n: 'sugar', aisle: 'Sweeteners', buy: { q: 25, u: 'g' } },
          { q: null, u: null, n: 'powdered sugar', aisle: 'Sweeteners', note: 'for dusting', buy: { q: 1, u: 'pack' } },
        ],
        steps: [
          'About 5 minutes before the cake is done, heat the milk, butter and sugar in a small pot over medium, whisking until the butter and sugar dissolve.',
          'Take the cake out and poke 25–30 evenly spaced holes down through it with a skewer.',
          'Pour the warm milk mixture over the top and let it soak in as the cake cools.',
          'Release the springform, peel off the parchment and move the cake to a plate. Cool 10–15 minutes, then dust with powdered sugar.',
        ],
        tip: 'Keeps 2–3 days in the fridge.',
      },
    ],
  },

  {
    slug: 'basque-cheesecake',
    title: 'Basque Cheesecake',
    dish: '#A85C2E',
    time: '1 hr + overnight chill',
    servings: { n: 12, unit: 'slices' },
    tags: ['dessert'],
    keyIngredients: ['cream cheese', 'whipping cream', 'vanilla'],
    added: '2026-08-09',
    order: 20,
    components: [
      {
        name: 'Cheesecake',
        ingredients: [
          { q: 750, u: 'g', n: 'cream cheese', aisle: 'Dairy & Eggs', note: 'blocks, room temperature', buyNote: 'full fat blocks' },
          { q: 1, u: 'cup', n: 'caster sugar', aisle: 'Sweeteners', note: 'superfine — regular granulated works too', buyAs: 'sugar', buy: { q: 200, u: 'g' } },
          { q: 1.25, u: 'cup', n: 'whipping cream', aisle: 'Dairy & Eggs', note: 'out of the fridge 15 minutes ahead', buyAs: 'heavy cream', buy: { q: 300, u: 'mL' } },
          { q: 0.25, u: 'cup', n: 'flour', aisle: 'Dry Goods & Grains', note: 'all-purpose', buy: { q: 30, u: 'g' } },
          { q: 1, u: 'tsp', n: 'vanilla extract', aisle: 'Dry Goods & Grains', note: 'bean extract or paste' },
          { q: 200, u: 'g', n: 'eggs', aisle: 'Dairy & Eggs', note: 'lightly whisked, room temperature — about 4–5 large', buy: { q: 5, u: null } },
        ],
        steps: [
          'Scrunch up two 40cm (16") sheets of parchment and press them into a 20cm (8") springform pan, folding the edges down over the rim.',
          'Beat the cream cheese on medium for 2 minutes until smooth. Add the sugar and beat on low for 10 seconds.',
          'In a separate bowl, whisk ¼ cup of the cream with the flour until it forms a lump-free paste, then whisk in the rest of the cream and the vanilla.',
          'Pour the cream mixture into the cream cheese while beating on low.',
          'Slowly pour in the whisked eggs, still on low, and stop the moment they\'re incorporated.',
          'Pour into the pan. Bang the pan on the counter and pop the surface bubbles with a sharp knife. Repeat 3–5 times.',
          'Bake at 220°C/425°F (200°C fan-forced) for 45 minutes, until the surface is deep golden brown and the centre still wobbles. It can take up to 65 minutes depending on the oven, so go by colour rather than the clock.',
          'Cool on the counter for at least 2 hours, then refrigerate uncovered for at least 8 hours, preferably overnight.',
          'Release the springform, move the cheesecake to a plate and cut it like a cake. Serve plain.',
        ],
        tip: 'Use full-fat cream cheese and cream, not low-fat, or it won\'t set. Weighing the eggs matters more than counting them. Keeps 5 days in the fridge and doesn\'t freeze.',
      },
    ],
  },

  {
    slug: 'fiesta-potatoes',
    title: 'Fiesta Potatoes',
    dish: '#B5601F',
    time: '45 min',
    servings: { n: 2, unit: 'servings' },
    tags: ['dinner', 'lunch'],
    keyIngredients: ['potatoes', 'tofu', 'bell peppers', 'bbq sauce'],
    added: '2026-08-09',
    order: 21,
    components: [
      {
        name: 'Tray Bake',
        ingredients: [
          { q: 400, u: 'g', n: 'potatoes', aisle: 'Produce', note: 'cut into small chunks', buy: { q: 3, u: null } },
          { q: 1, u: 'block', n: 'extra firm tofu', aisle: 'Tofu & Plant-Based', note: '200g, shredded', buy: { q: 1, u: 'block' } },
          { q: 2, u: null, n: 'bell peppers', aisle: 'Produce', note: 'chopped', buy: { q: 2, u: null } },
          { q: 1, u: null, n: 'red onion', aisle: 'Produce', note: 'chopped — purple or red', buy: { q: 1, u: null } },
          { q: null, u: null, n: 'olive oil', aisle: 'Oils & Vinegars', note: 'a drizzle', buy: { q: 15, u: 'mL' } },
          { q: null, u: null, n: 'salt', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: null, u: null, n: 'black pepper', aisle: 'Spices & Dried Herbs', buy: { q: null, u: null } },
          { q: 1, u: 'tsp', n: 'ground cumin', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tsp', n: 'paprika', aisle: 'Spices & Dried Herbs' },
          { q: 1, u: 'tsp', n: 'ground coriander', aisle: 'Spices & Dried Herbs' },
        ],
        steps: [
          'Heat the oven to 200°C (400°F).',
          'Spread the potatoes, tofu, bell peppers and onion on a baking tray. Drizzle with oil and season with salt, pepper, cumin, paprika and coriander.',
          'Massage the seasoning in, then bake for 25–30 minutes.',
        ],
      },
      {
        name: 'Assemble',
        ingredients: [
          { q: null, u: null, n: 'cilantro', aisle: 'Produce', note: 'chopped', buy: { q: 0.25, u: 'bunch' } },
          { q: 1, u: null, n: 'lime', aisle: 'Produce', note: 'juiced', buyAs: 'limes', buy: { q: 1, u: null } },
          { q: 3, u: 'tbsp', n: 'bbq sauce', aisle: 'Condiments & Sauces', buy: { q: 1, u: 'jar' } },
          { q: 1, u: null, n: 'avocado', aisle: 'Produce', note: 'ripe, sliced', buy: { q: 1, u: null } },
          { q: null, u: null, n: 'mayo', aisle: 'Condiments & Sauces', note: 'spicy — stir in a little sriracha', buy: { q: 1, u: 'jar' } },
        ],
        steps: [
          'Pull the bell pepper off the tray and toss it with the cilantro and lime juice.',
          'Toss the tofu with the bbq sauce.',
          'Plate everything with sliced avocado and a drizzle of spicy mayo.',
        ],
      },
    ],
  },
];

if (typeof window !== 'undefined') {
  window.RECIPES = RECIPES;
  window.AISLES = AISLES;
  window.DISCRETE_UNITS = DISCRETE_UNITS;
}
