// ------------------------------------------------------------------
//  First-run seed data.
//
//  The dashboard is driven entirely by Supabase rows. These templates
//  are only used to seed an *empty* table the first time, so the panels
//  show the familiar Operator layout instead of being blank. Once seeded,
//  everything you check / add / edit persists in the database.
// ------------------------------------------------------------------

// Daily habit groups. Seeded fresh for each day (habits are per-date),
// so checking a box saves and tomorrow starts with a clean slate.
export const DEFAULT_HABIT_GROUPS: { name: string; items: string[] }[] = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

// Monthly goals. Seeded once when the goals table is empty.
export const DEFAULT_GOALS: string[] = [
  "Ship the OS mobile PWA",
  "Publish 20 videos",
  "Gym every day",
  "Close 2 enterprise deals",
];

// Finance pulse. Seeded once when the finance table is empty.
// Labels are matched by name in the dashboard.
export const DEFAULT_FINANCE: { label: string; amount: number }[] = [
  { label: "net_worth", amount: 2481300 },
  { label: "month_change", amount: 184000 },
  { label: "day_change", amount: 56210 },
];

// Daily calorie target (not a stored table — a fixed personal target).
export const CALORIE_TARGET = 2040;
