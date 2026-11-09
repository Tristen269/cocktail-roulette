const KEY = "cocktailSaves";
const MAX_SAVES = 3;

// Saves are stored as 3 fixed slots: [gold, silver, bronze].
// An empty slot is null, so removing a drink never shifts the others.
// Old saves (a plain list with no nulls) are converted automatically.
function getSaves() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(KEY));
  } catch (e) {
    raw = null;
  }

  const slots = [];
  for (let i = 0; i < MAX_SAVES; i++) {
    const item = Array.isArray(raw) ? raw[i] : null;
    slots.push(item && typeof item === "object" ? item : null);
  }
  return slots;
}

function setSaves(saves) {
  localStorage.setItem(KEY, JSON.stringify(saves));
}

function celebrate() {
  if (typeof confetti !== "function") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
}

function showDrinkDetails(drink) {
  document.getElementById("details-name").textContent = drink.name;
  document.getElementById("details-meta").textContent =
    drink.category + " | " + drink.alcoholic + " | Serve in: " + drink.glass;
  document.getElementById("details-instructions").textContent = drink.instructions;

  const list = document.getElementById("details-ingredients");
  list.innerHTML = "";
  drink.ingredients.forEach(function (item) {
    const li = document.createElement("li");
    li.textContent = (item.measure + " " + item.name).trim();
    list.appendChild(li);
  });

  document.getElementById("drink-details").classList.remove("hidden");
}

function hideDrinkDetails() {
  document.getElementById("drink-details").classList.add("hidden");
}

function renderSaves() {
  const saves = getSaves();

  for (let i = 0; i < MAX_SAVES; i++) {
    const slot = document.getElementById("drink-" + i);
    slot.innerHTML = "";
    const drink = saves[i];

    if (!drink) {
      const empty = document.createElement("span");
      empty.className = "empty-text";
      empty.textContent = "Empty";
      slot.appendChild(empty);
      continue;
    }

    const img = document.createElement("img");
    img.src = drink.image;
    img.alt = drink.name;
    img.style.cursor = "pointer";
    img.addEventListener("click", function () {
      showDrinkDetails(drink);
    });

    const name = document.createElement("p");
    name.className = "drink-name";
    name.textContent = drink.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "Remove";
    remove.addEventListener("click", function () {
      const current = getSaves();
      current[i] = null; // empty just this slot, leave the others where they are
      setSaves(current);
      hideDrinkDetails();
      renderSaves();
    });

    slot.appendChild(img);
    slot.appendChild(name);
    slot.appendChild(remove);
  }
}

const saveBtn = document.getElementById("save-btn");
if (saveBtn) {
  saveBtn.addEventListener("click", function () {
    const message = document.getElementById("save-message");
    const drink = JSON.parse(saveBtn.dataset.cocktail);
    const saves = getSaves();
    const emptySlot = saves.indexOf(null);

    if (saves.some(function (d) { return d && d.id === drink.id; })) {
      message.textContent = "Already saved!";
    } else if (emptySlot === -1) {
      message.textContent = "You've got 3 saves. Remove one to add another.";
    } else {
      saves[emptySlot] = drink; // goes into the first open slot
      setSaves(saves);
      message.textContent = "Saved!";
      renderSaves();
      celebrate();
    }
  });
}

renderSaves();

document.getElementById("close-details").addEventListener("click", hideDrinkDetails);

const savesTab = document.getElementById("saves-tab");
const savesView = document.getElementById("saves");
const cardView = document.getElementById("card-view");

function showSaves(show) {
  savesView.classList.toggle("hidden", !show);
  if (cardView) cardView.classList.toggle("hidden", show);
  savesTab.classList.toggle("active", show);
}

savesTab.addEventListener("click", function () {
  if (!cardView) return;
  const savesShowing = !savesView.classList.contains("hidden");
  showSaves(!savesShowing);
});

showSaves(!cardView);