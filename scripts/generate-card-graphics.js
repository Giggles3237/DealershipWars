import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cards from "../cards.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "client", "assets", "cards");

const width = 744;
const height = 1038;

const themes = {
  Client: {
    label: "Client",
    primary: "#d66a3d",
    secondary: "#ffd6a6",
    dark: "#5f2718",
    icon: "person"
  },
  Vehicle: {
    label: "Vehicle",
    primary: "#456e9f",
    secondary: "#b9d8ff",
    dark: "#1d3554",
    icon: "car"
  },
  Employee: {
    label: "Employee",
    primary: "#2b8c67",
    secondary: "#b9efd8",
    dark: "#174833",
    icon: "badge"
  },
  Event: {
    label: "Event",
    primary: "#8d4aa8",
    secondary: "#ead1ff",
    dark: "#452054",
    icon: "burst"
  },
  Legendary: {
    label: "Legendary",
    primary: "#bc8a1f",
    secondary: "#ffe69a",
    dark: "#5a3b0c",
    icon: "crown"
  }
};

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const wrapText = (text, maxChars, maxLines = 4) => {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (words.join(" ").length > lines.join(" ").length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[,.!?;:]$/, "")}...`;
  }

  return lines;
};

const iconFor = (theme, card) => {
  const name = `${card.name} ${card.artwork}`.toLowerCase();

  if (name.includes("bmw") || name.includes("mini") || name.includes("sedan") || name.includes("suv") || name.includes("car")) {
    return carIcon(theme);
  }
  if (name.includes("audit") || name.includes("paperwork") || name.includes("contract") || name.includes("forms")) {
    return documentIcon(theme);
  }
  if (name.includes("factory") || name.includes("incentive") || name.includes("rebate") || name.includes("cash")) {
    return moneyIcon(theme);
  }
  if (name.includes("review") || name.includes("referral") || name.includes("social")) {
    return starIcon(theme);
  }

  if (theme.icon === "car") {
    return carIcon(theme);
  }
  if (theme.icon === "badge") {
    return badgeIcon(theme);
  }
  if (theme.icon === "burst") {
    return burstIcon(theme);
  }
  if (theme.icon === "crown") {
    return crownIcon(theme);
  }
  return personIcon(theme);
};

const carIcon = (theme) => `
  <g transform="translate(162 254)">
    <path d="M78 214h332c31 0 56-25 56-56v-44c0-27-19-50-45-55l-45-9-43-65c-12-18-32-29-54-29H181c-23 0-44 12-56 32L87 53l-56 13C7 72-10 93-10 118v40c0 31 25 56 56 56h32Z" fill="${theme.primary}" stroke="${theme.dark}" stroke-width="10"/>
    <path d="M161 46h127c10 0 20 5 25 14l35 53H120l32-53c2-4 5-8 9-14Z" fill="${theme.secondary}" opacity="0.92"/>
    <circle cx="105" cy="214" r="43" fill="#211811"/><circle cx="105" cy="214" r="18" fill="${theme.secondary}"/>
    <circle cx="374" cy="214" r="43" fill="#211811"/><circle cx="374" cy="214" r="18" fill="${theme.secondary}"/>
    <path d="M24 129h73M383 129h70" stroke="#fff6de" stroke-width="15" stroke-linecap="round"/>
  </g>`;

const personIcon = (theme) => `
  <g transform="translate(205 208)">
    <circle cx="168" cy="112" r="78" fill="${theme.secondary}" stroke="${theme.dark}" stroke-width="10"/>
    <path d="M59 357c18-91 73-139 109-139s91 48 109 139H59Z" fill="${theme.primary}" stroke="${theme.dark}" stroke-width="10"/>
    <path d="M81 357h174" stroke="#fff6de" stroke-width="16" stroke-linecap="round" opacity="0.82"/>
    <path d="M123 100c26-28 70-33 102-9" stroke="${theme.dark}" stroke-width="12" stroke-linecap="round" fill="none"/>
  </g>`;

const badgeIcon = (theme) => `
  <g transform="translate(203 204)">
    <path d="M169 24 292 94v142c0 83-48 151-123 185C94 387 46 319 46 236V94L169 24Z" fill="${theme.primary}" stroke="${theme.dark}" stroke-width="10"/>
    <circle cx="169" cy="169" r="65" fill="${theme.secondary}" opacity="0.94"/>
    <path d="M111 281h116M130 319h78" stroke="#fff6de" stroke-width="17" stroke-linecap="round"/>
    <path d="m169 104 18 37 41 6-30 29 7 41-36-19-36 19 7-41-30-29 41-6 18-37Z" fill="${theme.dark}"/>
  </g>`;

const burstIcon = (theme) => `
  <g transform="translate(184 200)">
    <path d="m188 18 43 96 99-34-33 100 96 43-96 44 33 100-99-34-43 96-44-96-99 34 33-100-96-44 96-43-33-100 99 34 44-96Z" fill="${theme.primary}" stroke="${theme.dark}" stroke-width="10"/>
    <circle cx="188" cy="223" r="92" fill="${theme.secondary}" opacity="0.9"/>
    <path d="M137 215h102M188 164v102" stroke="${theme.dark}" stroke-width="20" stroke-linecap="round"/>
  </g>`;

const crownIcon = (theme) => `
  <g transform="translate(176 223)">
    <path d="M39 274h330l34-186-105 78-95-124-96 124L5 88l34 186Z" fill="${theme.primary}" stroke="${theme.dark}" stroke-width="10" stroke-linejoin="round"/>
    <path d="M62 318h284" stroke="${theme.dark}" stroke-width="52" stroke-linecap="round"/>
    <circle cx="203" cy="44" r="25" fill="${theme.secondary}" stroke="${theme.dark}" stroke-width="9"/>
    <circle cx="5" cy="88" r="21" fill="${theme.secondary}" stroke="${theme.dark}" stroke-width="8"/>
    <circle cx="403" cy="88" r="21" fill="${theme.secondary}" stroke="${theme.dark}" stroke-width="8"/>
    <path d="M82 238h242" stroke="#fff6de" stroke-width="17" stroke-linecap="round" opacity="0.82"/>
  </g>`;

const documentIcon = (theme) => `
  <g transform="translate(229 199)">
    <path d="M53 19h189l80 82v288H53V19Z" fill="${theme.secondary}" stroke="${theme.dark}" stroke-width="10"/>
    <path d="M242 22v83h80" fill="${theme.primary}" stroke="${theme.dark}" stroke-width="10"/>
    <path d="M100 167h171M100 219h171M100 271h124" stroke="${theme.primary}" stroke-width="18" stroke-linecap="round"/>
  </g>`;

const moneyIcon = (theme) => `
  <g transform="translate(182 218)">
    <rect x="0" y="63" width="380" height="244" rx="36" fill="${theme.primary}" stroke="${theme.dark}" stroke-width="10"/>
    <rect x="52" y="109" width="276" height="152" rx="24" fill="${theme.secondary}" opacity="0.9"/>
    <text x="190" y="219" text-anchor="middle" font-family="Georgia, serif" font-size="104" font-weight="900" fill="${theme.dark}">$</text>
    <path d="M36 97c38 0 61-16 69-34M344 273c-38 0-61 16-69 34" stroke="${theme.dark}" stroke-width="13" stroke-linecap="round"/>
  </g>`;

const starIcon = (theme) => `
  <g transform="translate(177 203)">
    <path d="m195 18 50 108 117 15-86 82 22 116-103-58-103 58 22-116-86-82 117-15 50-108Z" fill="${theme.primary}" stroke="${theme.dark}" stroke-width="10" stroke-linejoin="round"/>
    <path d="M131 380h128M95 421h200" stroke="${theme.dark}" stroke-width="28" stroke-linecap="round"/>
    <path d="m195 97 28 61 66 8-49 46 13 65-58-33-58 33 13-65-49-46 66-8 28-61Z" fill="${theme.secondary}"/>
  </g>`;

const textLines = (lines, startY, lineHeight, fontSize, weight = 700, color = "#24160d") =>
  lines
    .map(
      (line, index) =>
        `<text x="372" y="${startY + index * lineHeight}" text-anchor="middle" font-family="Trebuchet MS, Aptos, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`
    )
    .join("\n");

const renderCard = (card) => {
  const theme = themes[card.type] ?? themes.Event;
  const nameLines = wrapText(card.name, 18, 2);
  const effectLines = wrapText(card.effect, 44, 4);
  const notesLines = wrapText(card.notes, 48, 2);
  const seed = card.id % 6;
  const plateY = 682 + (nameLines.length - 1) * 12;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(card.name)} Dealership Wars card</title>
  <desc id="desc">${escapeXml(card.artwork)}</desc>
  <defs>
    <linearGradient id="cardBg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#fff8e9"/>
      <stop offset="0.5" stop-color="#f1dfbd"/>
      <stop offset="1" stop-color="${theme.secondary}"/>
    </linearGradient>
    <radialGradient id="spotlight" cx="${30 + seed * 9}%" cy="24%" r="58%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#3b2512" flood-opacity="0.22"/>
    </filter>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M44 0H0v44" fill="none" stroke="#2c1b10" stroke-opacity="0.08" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" rx="42" fill="#22160f"/>
  <rect x="22" y="22" width="700" height="994" rx="34" fill="url(#cardBg)"/>
  <rect x="22" y="22" width="700" height="994" rx="34" fill="url(#grid)"/>
  <rect x="22" y="22" width="700" height="994" rx="34" fill="url(#spotlight)"/>
  <path d="M57 157h630v454H57z" fill="#fff4da" opacity="0.65"/>
  <path d="M57 157h630v454H57z" fill="${theme.primary}" opacity="0.1"/>
  <path d="M57 610h630" stroke="${theme.dark}" stroke-width="10"/>
  <path d="M67 158h610" stroke="${theme.primary}" stroke-width="18" stroke-linecap="round"/>
  <g filter="url(#shadow)">
    <ellipse cx="372" cy="546" rx="205" ry="36" fill="#24160d" opacity="0.18"/>
    ${iconFor(theme, card)}
  </g>
  <rect x="58" y="55" width="628" height="88" rx="22" fill="#fffaf0" stroke="${theme.dark}" stroke-width="6"/>
  <rect x="72" y="68" width="150" height="62" rx="16" fill="${theme.primary}"/>
  <text x="147" y="108" text-anchor="middle" font-family="Trebuchet MS, Aptos, sans-serif" font-size="25" font-weight="900" fill="#fffaf0" letter-spacing="1">${escapeXml(theme.label.toUpperCase())}</text>
  <text x="650" y="109" text-anchor="end" font-family="Georgia, serif" font-size="42" font-weight="900" fill="${theme.dark}">${escapeXml(card.value)}</text>
  ${textLines(nameLines, 690, 50, nameLines.length > 1 ? 43 : 50, 900, theme.dark)}
  <rect x="86" y="${plateY}" width="572" height="156" rx="24" fill="#fffaf0" stroke="${theme.dark}" stroke-opacity="0.28" stroke-width="4"/>
  ${textLines(effectLines, plateY + 44, 31, 24, 700, "#24160d")}
  <path d="M105 908h534" stroke="${theme.primary}" stroke-width="9" stroke-linecap="round"/>
  ${textLines(notesLines, 944, 26, 20, 700, "#5f4b3a")}
  <text x="76" y="990" font-family="Trebuchet MS, Aptos, sans-serif" font-size="20" font-weight="900" fill="${theme.dark}" opacity="0.74">#${String(card.id).padStart(2, "0")}</text>
  <text x="668" y="990" text-anchor="end" font-family="Trebuchet MS, Aptos, sans-serif" font-size="18" font-weight="900" fill="${theme.dark}" opacity="0.58">DEALERSHIP WARS</text>
</svg>
`;
};

fs.mkdirSync(outputDir, { recursive: true });

const manifest = cards.map((card) => {
  const filename = `${String(card.id).padStart(2, "0")}-${slugify(card.name)}.svg`;
  fs.writeFileSync(path.join(outputDir, filename), renderCard(card), "utf8");
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    file: `/client/assets/cards/${filename}`
  };
});

fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${manifest.length} card graphics in ${path.relative(rootDir, outputDir)}`);
