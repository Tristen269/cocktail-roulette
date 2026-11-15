const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Used in the link previews when someone shares a drink.
// If you get a custom domain later, change this line (or set SITE_URL on Render).
const SITE_URL =
  process.env.SITE_URL || "https://cocktail-roulette-mqjd.onrender.com";

const MAX_SPINS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const api = axios.create({
  baseURL: "https://www.thecocktaildb.com/api/json/v1/1",
  timeout: 8000,
});

app.set("view engine", "ejs");
app.use(express.static("public"));

// reads the spin counter from the browser's cookie
function readSpins(req) {
  const match = (req.headers.cookie || "").match(/(?:^|;\s*)spins=([^;]*)/);
  if (match) {
    try {
      const data = JSON.parse(decodeURIComponent(match[1]));
      if (Number.isInteger(data.count) && Date.now() - data.start < DAY_MS) {
        return data;
      }
    } catch (e) {}
  }
  return { start: Date.now(), count: 0 };
}

// turns the API's drink into the simpler object the pages use
function formatDrink(drink) {
  // ingredients come as strIngredient1..15, so collect the ones that exist
  const ingredients = [];
  for (let i = 1; i <= 15; i++) {
    const ingredient = drink[`strIngredient${i}`];
    const measure = drink[`strMeasure${i}`];
    if (ingredient) {
      ingredients.push({
        name: ingredient,
        measure: measure ? measure.trim() : "",
      });
    }
  }

  return {
    id: drink.idDrink,
    name: drink.strDrink,
    image: drink.strDrinkThumb,
    category: drink.strCategory,
    glass: drink.strGlass,
    alcoholic: drink.strAlcoholic,
    instructions: drink.strInstructions,
    ingredients: ingredients,
  };
}

// look up one drink by id (used by shared links). Returns null if the id
// isn't a plain number or the drink doesn't exist.
const drinkCache = new Map();

async function fetchDrinkById(id) {
  const clean = String(id);
  if (!/^\d{1,8}$/.test(clean)) return null;
  if (drinkCache.has(clean)) return drinkCache.get(clean);

  const response = await api.get("/lookup.php", { params: { i: clean } });
  const drinks = response.data && response.data.drinks;
  if (!Array.isArray(drinks) || !drinks[0]) return null;

  const cocktail = formatDrink(drinks[0]);
  if (drinkCache.size >= 500) {
    drinkCache.delete(drinkCache.keys().next().value); // drop the oldest
  }
  drinkCache.set(clean, cocktail);
  return cocktail;
}

// link preview info for a single shared drink
function shareInfoForDrink(cocktail) {
  const names = cocktail.ingredients.map(function (item) {
    return item.name;
  });
  let madeWith = names.slice(0, 5).join(", ");
  if (names.length > 5) madeWith += " and more";

  return {
    title: `${cocktail.name} | Cocktail Roulette`,
    description: `Made with ${madeWith}. Tap for the full recipe, then spin for your own.`,
    image: cocktail.image,
    url: `${SITE_URL}/drink/${cocktail.id}`,
  };
}

// home page with the "Surprise Me" button
app.get("/", (req, res) => {
  res.render("index", { cocktail: null, error: null });
});

// fetch a random cocktail and display it
app.get("/random", async (req, res) => {
  const spins = readSpins(req);

  if (spins.count >= MAX_SPINS) {
    return res.render("index", {
      cocktail: null,
      error: null,
      limitReached: true,
    });
  }

  try {
    const response = await api.get("/random.php");
    const cocktail = formatDrink(response.data.drinks[0]);

    // only count the spin once the drink actually loaded
    spins.count++;
    res.cookie("spins", JSON.stringify(spins), {
      maxAge: DAY_MS,
      httpOnly: true,
      sameSite: "lax",
    });

    res.render("index", { cocktail: cocktail, error: null });
  } catch (err) {
    console.error("API error:", err.message);
    res.render("index", {
      cocktail: null,
      error: "Couldn't get a cocktail right now. Try again!",
    });
  }
});

// a shared link to one drink. Opening it does NOT use up a spin.
app.get("/drink/:id", async (req, res) => {
  try {
    const cocktail = await fetchDrinkById(req.params.id);
    if (!cocktail) {
      return res.status(404).render("index", {
        cocktail: null,
        error: "We couldn't find that drink. Try spinning for a new one!",
      });
    }
    res.render("index", {
      cocktail: cocktail,
      error: null,
      share: shareInfoForDrink(cocktail),
    });
  } catch (err) {
    console.error("API error:", err.message);
    res.render("index", {
      cocktail: null,
      error: "Couldn't load that drink right now. Try again!",
    });
  }
});

// a shared top 3 podium, e.g. /top?gold=11007&silver=11000&bronze=178365
app.get("/top", async (req, res) => {
  try {
    const found = await Promise.all(
      ["gold", "silver", "bronze"].map(function (slot) {
        return fetchDrinkById(req.query[slot]);
      })
    );
    const top = { gold: found[0], silver: found[1], bronze: found[2] };

    if (!top.gold && !top.silver && !top.bronze) {
      return res.redirect("/");
    }

    const picks = [];
    if (top.gold) picks.push("1. " + top.gold.name);
    if (top.silver) picks.push("2. " + top.silver.name);
    if (top.bronze) picks.push("3. " + top.bronze.name);
    const first = top.gold || top.silver || top.bronze;

    const query = ["gold", "silver", "bronze"]
      .filter(function (slot) {
        return top[slot];
      })
      .map(function (slot) {
        return slot + "=" + top[slot].id;
      })
      .join("&");

    res.render("top", {
      top: top,
      share: {
        title: "My top cocktails | Cocktail Roulette",
        description: picks.join(", ") + ". What's on your podium?",
        image: first.image,
        url: `${SITE_URL}/top?${query}`,
      },
    });
  } catch (err) {
    console.error("API error:", err.message);
    res.redirect("/");
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});