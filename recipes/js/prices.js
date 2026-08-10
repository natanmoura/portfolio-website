/* ═══════════════════════════════════════════════════════════════
   Moura Boys Forever Recipes — ingredient prices
   ───────────────────────────────────────────────────────────────
   GENERATED FILE — do not edit by hand.
   Rebuild with: node recipes/tools/build-prices.mjs

   Prices are per-unit rates (per g, per mL, or per whole item),
   keyed by the same grocery merge name the recipes use — so an
   ingredient's buyAs, or its n when there's no buyAs.

   Kept per store. Changing shops means pointing ACTIVE_STORE at a
   different key; the old store's prices stay put and still work if
   you go back.
   ═══════════════════════════════════════════════════════════════ */

const PRICE_STORES = {
  "saveonfoods": {
    "name": "Save-On-Foods",
    "currency": "CAD",
    "updated": "2026-08-10",
    "items": {
      "cilantro": {
        "v": 2.69,
        "u": "each"
      },
      "cucumbers": {
        "v": 2.99,
        "u": "each"
      },
      "dill": {
        "v": 3.99,
        "u": "each"
      },
      "parsley": {
        "v": 2.99,
        "u": "each"
      },
      "spinach": {
        "v": 0.0247,
        "u": "g"
      },
      "green onions": {
        "v": 2.99,
        "u": "each"
      },
      "leeks": {
        "v": 1.91,
        "u": "each"
      },
      "lettuce": {
        "v": 2.99,
        "u": "each"
      },
      "red onion": {
        "v": 2.21,
        "u": "each"
      },
      "swiss chard": {
        "v": 4.99,
        "u": "each"
      },
      "tomatoes": {
        "v": 0.89,
        "u": "each"
      },
      "feta": {
        "v": 0.02397,
        "u": "g"
      },
      "greek yogurt": {
        "v": 0.01122,
        "u": "g"
      },
      "milk": {
        "v": 0.00305,
        "u": "mL"
      },
      "yogurt": {
        "v": 0.01122,
        "u": "g"
      },
      "pitas": {
        "v": 4.49,
        "u": "pack"
      },
      "vegetable stock cube": {
        "v": 0.8317,
        "u": "each"
      },
      "chickpeas": {
        "v": 1.67,
        "u": "can"
      },
      "red wine vinegar": {
        "v": 0.00898,
        "u": "mL"
      },
      "avocado": {
        "v": 2,
        "u": "each"
      },
      "bell peppers": {
        "v": 2.11,
        "u": "each"
      },
      "fresh basil": {
        "v": 2.99,
        "u": "each"
      },
      "fresh mint": {
        "v": 2.99,
        "u": "each"
      },
      "jalapeno": {
        "v": 0.39,
        "u": "each"
      },
      "onion": {
        "v": 0.94,
        "u": "each"
      },
      "peaches": {
        "v": 1.63,
        "u": "each"
      },
      "potatoes": {
        "v": 1.93,
        "u": "each"
      },
      "extra firm tofu": {
        "v": 3.99,
        "u": "block"
      },
      "cream cheese": {
        "v": 0.01978,
        "u": "g"
      },
      "dried black beans": {
        "v": 0.00931,
        "u": "g"
      },
      "rolled oats": {
        "v": 0.0049,
        "u": "g"
      },
      "tomato paste": {
        "v": 1.5,
        "u": "can"
      },
      "walnuts": {
        "v": 0.0369,
        "u": "g"
      },
      "bbq sauce": {
        "v": 4.69,
        "u": "jar"
      },
      "collard greens": {
        "v": 4.99,
        "u": "each"
      }
    }
  }
};

const ACTIVE_STORE = "saveonfoods";

if (typeof window !== 'undefined') {
  window.PRICE_STORES = PRICE_STORES;
  window.ACTIVE_STORE = ACTIVE_STORE;
}
