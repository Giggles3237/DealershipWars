export const WIN_TARGET = 100;
export const OPENING_HAND_SIZE = 5;
export const BASE_ACTIONS_PER_TURN = 2;
export const MAX_LOG = 18;

export const TEAM_CONFIG = [
  {
    name: "Team A",
    label: "North Showroom",
    slotLabels: ["A1", "A2", "A3"]
  },
  {
    name: "Team B",
    label: "South Showroom",
    slotLabels: ["B1", "B2", "B3"]
  }
];

export const SEAT_CONFIG = [
  { seatIndex: 0, key: "P1", name: "Player 1", title: "Sales Lead", teamIndex: 0 },
  { seatIndex: 1, key: "P2", name: "Player 2", title: "Closer", teamIndex: 1 },
  { seatIndex: 2, key: "P3", name: "Player 3", title: "Floor Manager", teamIndex: 0 },
  { seatIndex: 3, key: "P4", name: "Player 4", title: "BDC Ace", teamIndex: 1 }
];

export const AI_PERSONALITIES = [
  {
    id: "closer",
    name: "The Closer",
    title: "Sales Lead",
    tagline: "Pushes complete deals and immediate profit.",
    weights: { delivery: 52, ownProfit: 30, completion: 38, sabotage: 6 }
  },
  {
    id: "desk-shark",
    name: "Desk Shark",
    title: "Desk Manager",
    tagline: "Squeezes gross with incentives, add-ons, and delivery pressure.",
    weights: { delivery: 28, ownProfit: 22, attachment: 28, vehicle: 18, employee: 10 }
  },
  {
    id: "lot-hawk",
    name: "Lot Hawk",
    title: "Used Car Manager",
    tagline: "Builds inventory-heavy deals and digs for vehicles.",
    weights: { vehicle: 34, massiveTrade: 42, attachment: 12, sabotage: 8 }
  },
  {
    id: "bdc-hustler",
    name: "BDC Hustler",
    title: "BDC Ace",
    tagline: "Wants fresh clients and lead flow before anything else.",
    weights: { client: 34, searchClient: 48, completion: 18, ownProfit: 8 }
  },
  {
    id: "f-and-i-wizard",
    name: "F&I Wizard",
    title: "F&I Manager",
    tagline: "Likes finance staff, protection, and value attachments.",
    weights: { employee: 24, protection: 26, attachment: 24, ownProfit: 14 }
  },
  {
    id: "saboteur",
    name: "Back Lot Saboteur",
    title: "Recon Specialist",
    tagline: "Throws surveys, chargebacks, and chaos at the other showroom.",
    weights: { sabotage: 54, denyDelivery: 34, enemyProfit: 22 }
  },
  {
    id: "csi-saint",
    name: "CSI Saint",
    title: "Customer Experience Manager",
    tagline: "Protects deals, keeps clients happy, and plays the long game.",
    weights: { protection: 44, client: 16, employee: 18, ownProfit: 10, sabotage: -14 }
  }
];

export const getAiPersonality = (personalityId) =>
  AI_PERSONALITIES.find((personality) => personality.id === personalityId) ?? AI_PERSONALITIES[0];

export const TYPE_COLORS = {
  Client: "#d66a3d",
  Vehicle: "#456e9f",
  Employee: "#2b8c67",
  Event: "#8d4aa8",
  Legendary: "#bc8a1f"
};
