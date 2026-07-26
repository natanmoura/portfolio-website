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
    title: 'Smashed Falafel Tacos',
    dish: '#A06B36',
    time: '30 min',
    servings: { n: 4, unit: 'tacos' },
    tags: ['lunch', 'dinner'],
    keyIngredients: ['chickpeas', 'parsley', 'cilantro', 'cumin'],
    added: '2026-07-26',
    order: 7,
    components: [
      {
        name: 'Falafel Patties',
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
          { q: 1.5, u: 'tbsp', n: 'coconut oil', aisle: 'Oils & Vinegars', note: 'refined, for frying', buy: { q: 25, u: 'mL' } },
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
        name: 'Build the Tacos',
        ingredients: [
          { q: 4, u: null, n: 'flour tortillas', aisle: 'Bakery', note: 'small, taco sized', buyAs: 'tortillas' },
          { q: null, u: null, n: 'shredded lettuce', aisle: 'Produce', buyAs: 'lettuce', buy: { q: 0.25, u: 'head' } },
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
];

if (typeof window !== 'undefined') {
  window.RECIPES = RECIPES;
  window.AISLES = AISLES;
  window.DISCRETE_UNITS = DISCRETE_UNITS;
}
