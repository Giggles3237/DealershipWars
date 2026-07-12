const storageKey = "dealership-wars-art-studio";

const typeColors = {
  Customer: "#d66a3d",
  Vehicle: "#456e9f",
  Salesperson: "#2b8c67",
  Action: "#8d4aa8",
  Sabotage: "#b3342e"
};

const cardList = document.querySelector("#card-list");
const typeFilters = document.querySelector("#type-filters");
const searchInput = document.querySelector("#search-input");
const progressLabel = document.querySelector("#progress-label");
const styleSelect = document.querySelector("#style-select");
const negativeInput = document.querySelector("#negative-input");
const formatSelect = document.querySelector("#format-select");
const exportButton = document.querySelector("#export-button");

const selectedType = document.querySelector("#selected-type");
const selectedName = document.querySelector("#selected-name");
const selectedValue = document.querySelector("#selected-value");
const selectedId = document.querySelector("#selected-id");
const selectedEffect = document.querySelector("#selected-effect");
const selectedNotes = document.querySelector("#selected-notes");
const statusSelect = document.querySelector("#status-select");
const artNoteInput = document.querySelector("#art-note-input");
const promptOutput = document.querySelector("#prompt-output");
const copyButton = document.querySelector("#copy-button");
const resetNoteButton = document.querySelector("#reset-note-button");
const assetInput = document.querySelector("#asset-input");
const productionNotesInput = document.querySelector("#production-notes-input");
const previewImage = document.querySelector("#preview-image");
const previewEmpty = document.querySelector("#preview-empty");
const artPreview = document.querySelector(".art-preview");

let cards = [];
let selectedCardId = null;
let activeType = "All";
let studioState = loadState();

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved
      ? JSON.parse(saved)
      : {
          cards: {},
          style: null,
          negative: null,
          format: null
        };
  } catch {
    return { cards: {}, style: null, negative: null, format: null };
  }
}

const saveState = () => {
  localStorage.setItem(storageKey, JSON.stringify(studioState));
};

const getCardState = (card) => {
  if (!studioState.cards[card.id]) {
    studioState.cards[card.id] = {
      status: "brief",
      artNote: card.artwork,
      productionNotes: "",
      assetDataUrl: ""
    };
  }

  return studioState.cards[card.id];
};

const buildPrompt = (card) => {
  const cardState = getCardState(card);
  const typeDirection = {
    Customer: "Make the customer personality instantly readable through pose, wardrobe, and expression.",
    Vehicle: "Make the vehicle the hero subject with a showroom or road setting that supports its value.",
    Salesperson: "Make the dealership role clear through tools, body language, and workplace details.",
    Action: "Show the play as an energetic dealership moment with one clear focal point, in vintage comic-book style.",
    Sabotage: "Make the mischief against a rival dealership obvious and fun, with villainous comic-book energy."
  };

  return [
    `${styleSelect.value}.`,
    `${formatSelect.value}.`,
    `Card: "${card.name}" (${card.type}, value ${card.value}).`,
    `Scene: ${cardState.artNote || card.artwork}.`,
    `Gameplay idea: ${card.effect}`,
    card.notes ? `Extra context: ${card.notes}` : "",
    typeDirection[card.type] ?? "",
    "Keep the composition readable at small card size, with a single strong subject, playful dealership energy, and no embedded title or rules text.",
    `Negative prompt: ${negativeInput.value}`
  ]
    .filter(Boolean)
    .join("\n");
};

const statusLabel = (status) =>
  ({
    brief: "Brief",
    generating: "Generating",
    review: "Review",
    approved: "Approved"
  })[status] ?? "Brief";

const renderTypeFilters = () => {
  const types = ["All", ...new Set(cards.map((card) => card.type))];
  typeFilters.innerHTML = "";

  types.forEach((type) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-button${type === activeType ? " is-active" : ""}`;
    button.textContent = type;
    button.addEventListener("click", () => {
      activeType = type;
      render();
    });
    typeFilters.append(button);
  });
};

const getFilteredCards = () => {
  const query = searchInput.value.trim().toLowerCase();
  return cards.filter((card) => {
    const typeMatch = activeType === "All" || card.type === activeType;
    const haystack = [card.name, card.type, card.effect, card.notes, card.artwork, card.value].join(" ").toLowerCase();
    return typeMatch && (!query || haystack.includes(query));
  });
};

const renderCardList = () => {
  const filteredCards = getFilteredCards();
  cardList.innerHTML = "";

  filteredCards.forEach((card) => {
    const cardState = getCardState(card);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `queue-card${card.id === selectedCardId ? " is-selected" : ""}`;
    button.innerHTML = `
      <div class="queue-meta">
        <span class="status-pill is-${cardState.status}">${statusLabel(cardState.status)}</span>
        <span style="color:${typeColors[card.type] ?? "#555"}">#${String(card.id).padStart(2, "0")} ${card.type}</span>
      </div>
      <strong>${card.name}</strong>
      <p class="card-summary">${card.artwork}</p>
    `;
    button.addEventListener("click", () => {
      selectedCardId = card.id;
      render();
    });
    cardList.append(button);
  });

  if (!filteredCards.length) {
    const empty = document.createElement("p");
    empty.className = "card-summary";
    empty.textContent = "No cards match that filter.";
    cardList.append(empty);
  }
};

const renderSelectedCard = () => {
  const card = cards.find((entry) => entry.id === selectedCardId) ?? cards[0];
  if (!card) {
    return;
  }

  selectedCardId = card.id;
  const cardState = getCardState(card);
  selectedType.textContent = card.type;
  selectedType.style.color = typeColors[card.type] ?? "#b45127";
  selectedName.textContent = card.name;
  selectedValue.textContent = `Value ${card.value}`;
  selectedId.textContent = `#${String(card.id).padStart(2, "0")}`;
  selectedEffect.textContent = card.effect;
  selectedNotes.textContent = card.notes;
  statusSelect.value = cardState.status;
  artNoteInput.value = cardState.artNote || card.artwork;
  productionNotesInput.value = cardState.productionNotes ?? "";
  promptOutput.value = buildPrompt(card);

  if (cardState.assetDataUrl) {
    previewImage.src = cardState.assetDataUrl;
    previewImage.alt = `${card.name} generated art`;
    artPreview.classList.add("has-image");
  } else {
    previewImage.removeAttribute("src");
    previewImage.alt = "";
    previewEmpty.hidden = false;
    artPreview.classList.remove("has-image");
  }
};

const renderProgress = () => {
  const approved = cards.filter((card) => getCardState(card).status === "approved").length;
  progressLabel.textContent = `${approved} / ${cards.length} approved`;
};

const render = () => {
  renderTypeFilters();
  renderCardList();
  renderSelectedCard();
  renderProgress();
};

const updateSelectedCard = (updater) => {
  const card = cards.find((entry) => entry.id === selectedCardId);
  if (!card) {
    return;
  }

  updater(getCardState(card), card);
  promptOutput.value = buildPrompt(card);
  saveState();
  renderCardList();
  renderProgress();
};

const exportArtBrief = () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    style: styleSelect.value,
    format: formatSelect.value,
    negativePrompt: negativeInput.value,
    cards: cards.map((card) => {
      const cardState = getCardState(card);
      return {
        id: card.id,
        name: card.name,
        type: card.type,
        value: card.value,
        status: cardState.status,
        prompt: buildPrompt(card),
        productionNotes: cardState.productionNotes,
        hasImportedAsset: Boolean(cardState.assetDataUrl)
      };
    })
  };

  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dealership-wars-art-brief.json";
  link.click();
  URL.revokeObjectURL(url);
};

const initialize = async () => {
  const response = await fetch("/api/cards");
  cards = await response.json();
  selectedCardId = cards[0]?.id ?? null;

  if (studioState.style) {
    styleSelect.value = studioState.style;
  }
  if (studioState.negative) {
    negativeInput.value = studioState.negative;
  }
  if (studioState.format) {
    formatSelect.value = studioState.format;
  }

  render();
};

searchInput.addEventListener("input", render);

styleSelect.addEventListener("change", () => {
  studioState.style = styleSelect.value;
  saveState();
  renderSelectedCard();
});

negativeInput.addEventListener("input", () => {
  studioState.negative = negativeInput.value;
  saveState();
  renderSelectedCard();
});

formatSelect.addEventListener("change", () => {
  studioState.format = formatSelect.value;
  saveState();
  renderSelectedCard();
});

statusSelect.addEventListener("change", () => {
  updateSelectedCard((cardState) => {
    cardState.status = statusSelect.value;
  });
});

artNoteInput.addEventListener("input", () => {
  updateSelectedCard((cardState) => {
    cardState.artNote = artNoteInput.value;
  });
});

productionNotesInput.addEventListener("input", () => {
  updateSelectedCard((cardState) => {
    cardState.productionNotes = productionNotesInput.value;
  });
});

resetNoteButton.addEventListener("click", () => {
  updateSelectedCard((cardState, card) => {
    cardState.artNote = card.artwork;
  });
  renderSelectedCard();
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(promptOutput.value);
  copyButton.textContent = "Copied";
  window.setTimeout(() => {
    copyButton.textContent = "Copy Prompt";
  }, 1200);
});

assetInput.addEventListener("change", () => {
  const file = assetInput.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    updateSelectedCard((cardState) => {
      cardState.assetDataUrl = String(reader.result);
      cardState.status = "review";
    });
    renderSelectedCard();
    assetInput.value = "";
  });
  reader.readAsDataURL(file);
});

exportButton.addEventListener("click", exportArtBrief);

initialize();
