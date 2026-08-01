export type PredictionSide = "yes" | "no";

export type Prediction = {
  id: string;
  question: string;
  createdAt: number;
  endsAt: number;
  /** KICKs wagered per side. */
  pools: Record<PredictionSide, number>;
  wagers: { user: string; side: PredictionSide; amount: number }[];
  status: "open" | "settled";
  outcome?: PredictionSide;
};

export type BetStatus =
  | "open"
  | "accepted"
  | "declined"
  | "watching"
  | "validated"
  | "paid"
  | "expired";

/** Hype-engine verdict on what a streamer action did to the room. */
export type BetImpact = {
  delta: number;
  verdict: "up" | "flat" | "down";
  preHype: number;
  postHype: number;
};

/** A viewer's wager that the streamer performs a real-world action. */
export type ActionBet = {
  id: string;
  user: string;
  wager: number;
  condition: string;
  createdAt: number;
  deadline: number;
  status: BetStatus;
  /** Measured by the hype engine ~15s after the streamer accepts. */
  impact?: BetImpact;
};

export type HypeSource = { label: string; points: number; at: number };
