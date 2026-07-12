export const CASH_TARGET = 30;
export const OPENING_HAND_SIZE = 5;
export const CARDS_DRAWN_PER_TURN = 2;
export const BASE_PLAYS_PER_TURN = 2;
export const BASE_HAND_LIMIT = 7;
export const BASE_CUSTOMER_CAP = 2;
export const SALES_TEAM_CAP = 2;
export const MAX_TURNS = 160;
export const MAX_LOG = 18;

export const SEAT_CONFIG = [
  { seatIndex: 0, key: "P1", name: "Player 1", title: "Dealer Principal", dealership: "North Point Motors" },
  { seatIndex: 1, key: "P2", name: "Player 2", title: "Dealer Principal", dealership: "Southside Auto" },
  { seatIndex: 2, key: "P3", name: "Player 3", title: "Dealer Principal", dealership: "East End Imports" },
  { seatIndex: 3, key: "P4", name: "Player 4", title: "Dealer Principal", dealership: "West Gate Motors" }
];

export const AI_PERSONALITIES = [
  {
    id: "closer",
    name: "The Closer",
    title: "Sales Lead",
    tagline: "Sells whatever is on the lot, right now, for whatever it brings.",
    weights: { closeSale: 55, cash: 25, vehicle: 12, customer: 8 }
  },
  {
    id: "desk-shark",
    name: "Desk Shark",
    title: "Desk Manager",
    tagline: "Squeezes every sale with inventory upgrades and delivery pressure.",
    weights: { closeSale: 32, cash: 22, carBonus: 30, vehicle: 16 }
  },
  {
    id: "lot-hawk",
    name: "Lot Hawk",
    title: "Used Car Manager",
    tagline: "Packs the lot first and asks questions later.",
    weights: { vehicle: 40, carBonus: 24, closeSale: 18, draw: 8 }
  },
  {
    id: "bdc-hustler",
    name: "BDC Hustler",
    title: "BDC Ace",
    tagline: "Fills the showroom with customers before anyone else wakes up.",
    weights: { customer: 45, engine: 22, draw: 18, closeSale: 10 }
  },
  {
    id: "f-and-i-wizard",
    name: "F&I Wizard",
    title: "F&I Manager",
    tagline: "Builds a sales team that prints money on every deal.",
    weights: { salesperson: 42, closeSale: 22, cash: 15, rep: 8 }
  },
  {
    id: "saboteur",
    name: "Back Lot Saboteur",
    title: "Recon Specialist",
    tagline: "Throws surveys, chargebacks, and chaos at every rival lot.",
    weights: { sabotage: 55, steal: 35, cash: 12 }
  },
  {
    id: "csi-saint",
    name: "CSI Saint",
    title: "Customer Experience Manager",
    tagline: "Builds reputation, keeps customers happy, plays the long game.",
    weights: { rep: 45, customer: 22, salesperson: 15, closeSale: 12, sabotage: -20 }
  }
];

export const getAiPersonality = (personalityId) =>
  AI_PERSONALITIES.find((personality) => personality.id === personalityId) ?? AI_PERSONALITIES[0];

export const TYPE_COLORS = {
  Customer: "#d66a3d",
  Vehicle: "#456e9f",
  Salesperson: "#2b8c67",
  Action: "#8d4aa8",
  Sabotage: "#b3342e"
};
