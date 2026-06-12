// Vector art for the four dealership employees. Each avatar is two SVG
// textures — a body (chair, torso, clothing) and a head (face, hair,
// accessories) — rendered at 2x for crispness. Eyes, brows, and mouth are
// NOT in the art; the scene overlays them as separate objects so they can
// blink and react.
//
// Coordinate contract with TableScene:
//   head svg: 130x130 viewBox, face center at (65, 65) -> Phaser (0, 0)
//   body svg: 200x92 viewBox, drawn at Phaser y=4 with origin (0.5, 0)

const OUTLINE = '#241c2a';
const CHAIR = ['#243442', '#17222c'];

export const AVATAR_PALETTES = [
  {
    // Closer Chris: slick side-part, sharp green blazer, power tie.
    skin: ['#ffd9ae', '#edbd8a'],
    hair: ['#42301f', '#6b4f35'],
    top: ['#27604a', '#1b4233'],
    shirt: '#fdf6e8',
    accent: '#c23b2e',
    style: 'slick',
    outfit: 'blazer',
    tie: true,
    pocketSquare: true
  },
  {
    // Finance Fran: auburn bob, burgundy blazer, gold earrings.
    skin: ['#f8cda2', '#e2ab77'],
    hair: ['#9a5526', '#c0703a'],
    top: ['#9c443a', '#71302a'],
    shirt: '#f4e6dd',
    accent: '#d8b13c',
    style: 'bob',
    outfit: 'blazer',
    earrings: true
  },
  {
    // Desk Dana: tidy bun, BDC headset, navy blazer with lanyard.
    skin: ['#dd9f5b', '#c08443'],
    hair: ['#26262c', '#4a4a55'],
    top: ['#2f5b94', '#223f68'],
    shirt: '#eaf0f8',
    accent: '#d8b13c',
    style: 'bun',
    outfit: 'blazer',
    headset: true,
    lanyard: true
  },
  {
    // Lot Larry: bald with gray sides, purple polo.
    skin: ['#ffe3bf', '#edc391'],
    hair: ['#9c9c9c', '#c4c4c4'],
    top: ['#6a3f96', '#503073'],
    shirt: '#e9defa',
    accent: '#3a2a52',
    style: 'bald',
    outfit: 'polo'
  }
];

function defs(palette, prefix) {
  return `
    <defs>
      <radialGradient id="${prefix}-skin" cx="0.4" cy="0.32" r="0.95">
        <stop offset="0" stop-color="${palette.skin[0]}"/>
        <stop offset="1" stop-color="${palette.skin[1]}"/>
      </radialGradient>
      <linearGradient id="${prefix}-hair" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${palette.hair[1]}"/>
        <stop offset="0.45" stop-color="${palette.hair[0]}"/>
        <stop offset="1" stop-color="${palette.hair[0]}"/>
      </linearGradient>
      <linearGradient id="${prefix}-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${palette.top[0]}"/>
        <stop offset="1" stop-color="${palette.top[1]}"/>
      </linearGradient>
    </defs>`;
}

function hairBack(palette, prefix) {
  if (palette.style === 'bob') {
    return `
      <ellipse cx="65" cy="60" rx="36" ry="38" fill="url(#${prefix}-hair)" stroke="${OUTLINE}" stroke-width="3"/>
      <path d="M31 58 C28 76 31 88 38 95 C42 90 44 78 43 64 Z" fill="url(#${prefix}-hair)" stroke="${OUTLINE}" stroke-width="3"/>
      <path d="M99 58 C102 76 99 88 92 95 C88 90 86 78 87 64 Z" fill="url(#${prefix}-hair)" stroke="${OUTLINE}" stroke-width="3"/>`;
  }

  if (palette.style === 'bun') {
    return `
      <circle cx="65" cy="25" r="11" fill="url(#${prefix}-hair)" stroke="${OUTLINE}" stroke-width="3"/>
      <path d="M58 20 C61 16 69 16 72 20" stroke="${palette.hair[1]}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }

  return '';
}

function hairFront(palette, prefix) {
  if (palette.style === 'slick') {
    return `
      <path d="M36 61 C34 40 47 27 65 27 C83 27 96 40 94 61 C91 47 84 42 77 41 C70 38 57 38 50 43 C44 47 38 52 36 61 Z"
        fill="url(#${prefix}-hair)" stroke="${OUTLINE}" stroke-width="3"/>
      <path d="M47 40 C55 33 74 33 82 40" stroke="${palette.hair[1]}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M36 58 L36 70 C39 68 41 62 40 57 Z" fill="url(#${prefix}-hair)"/>
      <path d="M94 58 L94 70 C91 68 89 62 90 57 Z" fill="url(#${prefix}-hair)"/>`;
  }

  if (palette.style === 'bob') {
    return `
      <path d="M34 60 C33 38 46 27 65 27 C84 27 97 38 96 60 C90 46 82 43 75 43 L55 43 C47 43 39 49 34 60 Z"
        fill="url(#${prefix}-hair)" stroke="${OUTLINE}" stroke-width="3"/>
      <path d="M44 38 C52 31 70 30 80 36" stroke="${palette.hair[1]}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  }

  if (palette.style === 'bun') {
    return `
      <path d="M37 58 C36 39 48 29 65 29 C82 29 94 39 93 58 C87 46 78 43 65 43 C52 43 43 46 37 58 Z"
        fill="url(#${prefix}-hair)" stroke="${OUTLINE}" stroke-width="3"/>
      <path d="M48 37 C56 31 74 31 82 37" stroke="${palette.hair[1]}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }

  // bald: gray side patches and a dome shine
  return `
    <path d="M35 56 C33 65 34 74 38 79 C41 74 42 64 41 56 Z" fill="url(#${prefix}-hair)" stroke="${OUTLINE}" stroke-width="2.5"/>
    <path d="M95 56 C97 65 96 74 92 79 C89 74 88 64 89 56 Z" fill="url(#${prefix}-hair)" stroke="${OUTLINE}" stroke-width="2.5"/>
    <path d="M48 37 C54 31 66 29 74 32" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.4" stroke-linecap="round"/>`;
}

function accessories(palette) {
  let parts = '';

  if (palette.earrings) {
    parts += `
      <circle cx="35" cy="78" r="3" fill="${palette.accent}" stroke="${OUTLINE}" stroke-width="1.5"/>
      <circle cx="95" cy="78" r="3" fill="${palette.accent}" stroke="${OUTLINE}" stroke-width="1.5"/>`;
  }

  if (palette.headset) {
    parts += `
      <path d="M33 52 C36 31 50 22 65 22 C80 22 94 31 97 52" stroke="#38444f" stroke-width="5" fill="none" stroke-linecap="round"/>
      <rect x="27" y="56" width="11" height="18" rx="5" fill="#38444f" stroke="${OUTLINE}" stroke-width="2"/>
      <path d="M35 74 Q42 84 50 81" stroke="#38444f" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <circle cx="52" cy="80" r="4" fill="#38444f" stroke="${OUTLINE}" stroke-width="2"/>`;
  }

  return parts;
}

export function headSvg(palette, index) {
  const prefix = `a${index}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130" width="260" height="260">
    ${defs(palette, prefix)}
    ${hairBack(palette, prefix)}
    <circle cx="36" cy="68" r="7.5" fill="url(#${prefix}-skin)" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="94" cy="68" r="7.5" fill="url(#${prefix}-skin)" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M65 34 C84 34 94 48 94 66 C94 85 81 97 65 97 C49 97 36 85 36 66 C36 48 46 34 65 34 Z"
      fill="url(#${prefix}-skin)" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M63 66 Q61 73 65 74.5 Q69 73 67 66" fill="${palette.skin[1]}" stroke="${OUTLINE}" stroke-width="1.6" opacity="0.9"/>
    <ellipse cx="49" cy="75" rx="6" ry="3.5" fill="#e98f70" opacity="0.35"/>
    <ellipse cx="81" cy="75" rx="6" ry="3.5" fill="#e98f70" opacity="0.35"/>
    ${hairFront(palette, prefix)}
    ${accessories(palette)}
  </svg>`;
}

function outfit(palette, prefix) {
  if (palette.outfit === 'polo') {
    return `
      <path d="M86 16 L100 34 L114 16 L108 13 L100 22 L92 13 Z" fill="${palette.top[1]}" stroke="${OUTLINE}" stroke-width="2.5"/>
      <rect x="96" y="30" width="8" height="18" rx="2" fill="${palette.top[1]}" stroke="${OUTLINE}" stroke-width="2"/>
      <circle cx="100" cy="36" r="1.6" fill="${palette.shirt}"/>
      <circle cx="100" cy="43" r="1.6" fill="${palette.shirt}"/>`;
  }

  let parts = `
    <path d="M86 17 L114 17 L100 46 Z" fill="${palette.shirt}" stroke="${OUTLINE}" stroke-width="2"/>
    <path d="M86 16 L101 31 L84 42 C82 32 83 22 86 16 Z" fill="${palette.top[1]}" stroke="${OUTLINE}" stroke-width="2.5"/>
    <path d="M114 16 L99 31 L116 42 C118 32 117 22 114 16 Z" fill="${palette.top[1]}" stroke="${OUTLINE}" stroke-width="2.5"/>`;

  if (palette.tie) {
    parts += `
      <path d="M96 18 L104 18 L100 25 Z" fill="${palette.accent}" stroke="${OUTLINE}" stroke-width="1.8"/>
      <path d="M97 24 L103 24 L102 46 L100 50 L98 46 Z" fill="${palette.accent}" stroke="${OUTLINE}" stroke-width="1.8"/>`;
  }

  if (palette.lanyard) {
    parts += `
      <path d="M90 20 L96 50" stroke="${palette.accent}" stroke-width="2.6"/>
      <path d="M110 20 L104 50" stroke="${palette.accent}" stroke-width="2.6"/>
      <rect x="93" y="49" width="14" height="18" rx="2" fill="#ffffff" stroke="${OUTLINE}" stroke-width="2"/>
      <rect x="93" y="49" width="14" height="5" rx="2" fill="${palette.top[0]}"/>
      <circle cx="100" cy="60" r="2.6" fill="${palette.skin[1]}"/>`;
  }

  if (palette.pocketSquare) {
    parts += `<path d="M72 42 L80 42 L76 35 Z" fill="#ffffff" stroke="${OUTLINE}" stroke-width="1.6"/>`;
  }

  return parts;
}

export function bodySvg(palette, index) {
  const prefix = `b${index}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 92" width="400" height="184">
    ${defs(palette, prefix)}
    <rect x="46" y="0" width="108" height="88" rx="20" fill="${CHAIR[0]}" stroke="${CHAIR[1]}" stroke-width="3"/>
    <rect x="54" y="6" width="92" height="10" rx="5" fill="${CHAIR[1]}" opacity="0.7"/>
    <rect x="89" y="3" width="22" height="20" rx="7" fill="${palette.skin[1]}" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M60 86 L60 48 C60 28 76 16 100 16 C124 16 140 28 140 48 L140 86 Z"
      fill="url(#${prefix}-top)" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M66 38 C62 54 62 70 64 84" stroke="${OUTLINE}" stroke-width="2" fill="none" opacity="0.35"/>
    <path d="M134 38 C138 54 138 70 136 84" stroke="${OUTLINE}" stroke-width="2" fill="none" opacity="0.35"/>
    ${outfit(palette, prefix)}
  </svg>`;
}

function svgToTexture(scene, key, svg) {
  return new Promise((resolve) => {
    if (scene.textures.exists(key)) {
      resolve();
      return;
    }

    const image = new Image();
    image.onload = () => {
      // The scene may have been torn down (e.g. React StrictMode remounts)
      // while the image was still decoding.
      try {
        if (scene.sys?.game && scene.textures && !scene.textures.exists(key)) {
          scene.textures.addImage(key, image);
        }
      } catch {
        // A destroyed renderer is fine to ignore; the live instance has its own textures.
      }
      resolve();
    };
    image.onerror = () => resolve();
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  });
}

export function buildAvatarTextures(scene) {
  return Promise.all(
    AVATAR_PALETTES.flatMap((palette, index) => [
      svgToTexture(scene, `avatar-head-${index}`, headSvg(palette, index)),
      svgToTexture(scene, `avatar-body-${index}`, bodySvg(palette, index))
    ])
  );
}
