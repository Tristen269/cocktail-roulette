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

/* ---------- drag and drop (mouse and touch) ---------- */

let suppressClick = false; // stops a drag from also counting as a tap

function placeAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest(".place") : null;
}

function slotIndexOf(place) {
  const box = place ? place.querySelector(".drink") : null;
  return box ? parseInt(box.id.replace("drink-", ""), 10) : -1;
}

// Swap two slots. If the target is empty, the drink just moves there.
function swapSlots(from, to) {
  if (from === to || from < 0 || to < 0) return;
  const saves = getSaves();
  const temp = saves[from];
  saves[from] = saves[to];
  saves[to] = temp;
  setSaves(saves);
  renderSaves();
}

function enableDrag(img, fromIndex) {
  img.draggable = false;

  img.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let ghost = null;
    let hoverPlace = null;

    if (img.setPointerCapture) {
      try { img.setPointerCapture(e.pointerId); } catch (err) {}
    }

    function onMove(ev) {
      if (!ghost) {
        // ignore tiny wiggles so a normal tap still opens the details
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return;
        const rect = img.getBoundingClientRect();
        ghost = img.cloneNode();
        ghost.className = "drag-ghost";
        ghost.style.width = rect.width + "px";
        ghost.style.height = rect.height + "px";
        document.body.appendChild(ghost);
        img.classList.add("dragging");
      }

      ghost.style.left = ev.clientX + "px";
      ghost.style.top = ev.clientY + "px";

      const place = placeAt(ev.clientX, ev.clientY);
      if (place !== hoverPlace) {
        if (hoverPlace) hoverPlace.classList.remove("drag-over");
        if (place) place.classList.add("drag-over");
        hoverPlace = place;
      }
    }

    function finish(ev, cancelled) {
      img.removeEventListener("pointermove", onMove);
      img.removeEventListener("pointerup", onUp);
      img.removeEventListener("pointercancel", onCancel);

      if (!ghost) return; // never really moved: this was just a tap

      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);

      const target = cancelled ? null : placeAt(ev.clientX, ev.clientY);
      ghost.remove();
      img.classList.remove("dragging");
      if (hoverPlace) hoverPlace.classList.remove("drag-over");
      if (target) swapSlots(fromIndex, slotIndexOf(target));
    }

    function onUp(ev) { finish(ev, false); }
    function onCancel(ev) { finish(ev, true); }

    img.addEventListener("pointermove", onMove);
    img.addEventListener("pointerup", onUp);
    img.addEventListener("pointercancel", onCancel);
  });
}

/* ---------- podium ---------- */

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
    img.addEventListener("click", function () {
      if (suppressClick) return;
      showDrinkDetails(drink);
    });
    enableDrag(img, i);

    const name = document.createElement("p");
    name.className = "drink-name";
    name.textContent = drink.name;

    // "Are you sure?" - first tap arms the button, second tap removes
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "Remove";
    let confirmTimer = null;

    function disarm() {
      remove.classList.remove("confirm");
      remove.textContent = "Remove";
      confirmTimer = null;
    }

    remove.addEventListener("click", function () {
      if (!remove.classList.contains("confirm")) {
        remove.classList.add("confirm");
        remove.textContent = "Sure?";
        confirmTimer = setTimeout(disarm, 4000);
        return;
      }
      clearTimeout(confirmTimer);
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

/* ---------- saves tab ---------- */

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

/* ---------- "paid version coming soon" popup ---------- */

const paidBadge = document.getElementById("paid-badge");
const paidModal = document.getElementById("paid-modal");
const closeModalBtn = document.getElementById("close-modal");

function openModal() {
  paidModal.classList.remove("hidden");
  closeModalBtn.focus();
}

function closeModal() {
  paidModal.classList.add("hidden");
  paidBadge.focus();
}

paidBadge.addEventListener("click", function (e) {
  e.preventDefault();
  openModal();
});

closeModalBtn.addEventListener("click", closeModal);

paidModal.addEventListener("click", function (e) {
  if (e.target === paidModal) closeModal(); // click on the dark background
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !paidModal.classList.contains("hidden")) closeModal();
});


/* ---------- sharing ---------- */

// shows a short message, then clears it after 3 seconds
function flashMessage(el, text) {
  el.textContent = text;
  setTimeout(function () { el.textContent = ""; }, 3000);
}

// Opens the phone's share sheet when there is one, otherwise copies the link.
async function shareLink(title, text, path, messageEl) {
  const url = location.origin + path;

  if (navigator.share) {
    try {
      await navigator.share({ title: title, text: text, url: url });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return; // they closed the share sheet
      // anything else: fall through and copy the link instead
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    flashMessage(messageEl, "Link copied!");
  } catch (e) {
    window.prompt("Copy this link:", url);
  }
}

// "Share" on a drink card
const shareBtn = document.getElementById("share-btn");
if (shareBtn) {
  shareBtn.addEventListener("click", function () {
    const name = shareBtn.dataset.name;
    shareLink(
      name + " | Cocktail Roulette",
      "Try the " + name + " on Cocktail Roulette",
      "/drink/" + shareBtn.dataset.id,
      document.getElementById("save-message")
    );
  });
}

// share icon on the podium (only shown once at least one drink is saved)
const shareTopBtn = document.getElementById("share-top");

function updateShareTop() {
  const hasSaves = getSaves().some(function (d) { return d !== null; });
  shareTopBtn.classList.toggle("hidden", !hasSaves);
}

if (shareTopBtn) {
  updateShareTop();

  // the podium is redrawn on every save, remove and drag, so re-check each time
  new MutationObserver(updateShareTop).observe(
    document.getElementById("podium"),
    { childList: true, subtree: true }
  );

  shareTopBtn.addEventListener("click", function () {
    const message = document.getElementById("share-top-message");
    const saves = getSaves();
    const params = [];

    ["gold", "silver", "bronze"].forEach(function (slot, i) {
      if (saves[i] && /^\d+$/.test(String(saves[i].id))) {
        params.push(slot + "=" + saves[i].id);
      }
    });

    if (params.length === 0) return;

    shareLink(
      "My top cocktails | Cocktail Roulette",
      "Here's my cocktail podium. What's on yours?",
      "/top?" + params.join("&"),
      message
    );
  });
}