type Glicko2Player = {
  rating: number;
  ratingDeviation: number;
  volatility: number;
};

type Glicko2Match = {
  opponentRating: number;
  opponentRatingDeviation: number;
  score: 0 | 1;
};

type Glicko2Config = {
  tau?: number;
  epsilon?: number;
};

const RATING_SCALE = 173.7178;
const DEFAULT_TAU = 0.5;
const DEFAULT_EPSILON = 0.000001;
const DEFAULT_RATING = 1500;

function toMu(rating: number) {
  return (rating - DEFAULT_RATING) / RATING_SCALE;
}

function toPhi(ratingDeviation: number) {
  return ratingDeviation / RATING_SCALE;
}

function fromMu(mu: number) {
  return mu * RATING_SCALE + DEFAULT_RATING;
}

function fromPhi(phi: number) {
  return phi * RATING_SCALE;
}

function g(phi: number) {
  return 1 / Math.sqrt(1 + (3 * phi ** 2) / Math.PI ** 2);
}

function expectedScore(mu: number, opponentMu: number, opponentPhi: number) {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function volatilityRootFunction(
  x: number,
  delta: number,
  phi: number,
  variance: number,
  a: number,
  tau: number,
) {
  const expX = Math.exp(x);
  const numerator = expX * (delta ** 2 - phi ** 2 - variance - expX);
  const denominator = 2 * (phi ** 2 + variance + expX) ** 2;

  return numerator / denominator - (x - a) / tau ** 2;
}

function solveUpdatedVolatility(
  delta: number,
  phi: number,
  variance: number,
  volatility: number,
  tau: number,
  epsilon: number,
) {
  const a = Math.log(volatility ** 2);
  let lowerBound = a;
  let upperBound: number;

  if (delta ** 2 > phi ** 2 + variance) {
    upperBound = Math.log(delta ** 2 - phi ** 2 - variance);
  } else {
    let step = 1;
    upperBound = a - step * tau;

    while (
      volatilityRootFunction(
        upperBound,
        delta,
        phi,
        variance,
        a,
        tau,
      ) < 0
    ) {
      step += 1;
      upperBound = a - step * tau;
    }
  }

  let fLower = volatilityRootFunction(
    lowerBound,
    delta,
    phi,
    variance,
    a,
    tau,
  );
  let fUpper = volatilityRootFunction(
    upperBound,
    delta,
    phi,
    variance,
    a,
    tau,
  );

  while (Math.abs(upperBound - lowerBound) > epsilon) {
    const next =
      lowerBound +
      ((lowerBound - upperBound) * fLower) / (fUpper - fLower);
    const fNext = volatilityRootFunction(
      next,
      delta,
      phi,
      variance,
      a,
      tau,
    );

    if (fNext * fUpper < 0) {
      lowerBound = upperBound;
      fLower = fUpper;
    } else {
      fLower /= 2;
    }

    upperBound = next;
    fUpper = fNext;
  }

  return Math.exp(lowerBound / 2);
}

function roundRatingValue(value: number) {
  return Number(value.toFixed(6));
}

export function applyGlicko2Match(
  player: Glicko2Player,
  match: Glicko2Match,
  config?: Glicko2Config,
) {
  const tau = config?.tau ?? DEFAULT_TAU;
  const epsilon = config?.epsilon ?? DEFAULT_EPSILON;
  const mu = toMu(player.rating);
  const phi = toPhi(player.ratingDeviation);
  const opponentMu = toMu(match.opponentRating);
  const opponentPhi = toPhi(match.opponentRatingDeviation);
  const impact = g(opponentPhi);
  const expected = expectedScore(mu, opponentMu, opponentPhi);
  const variance = 1 / (impact ** 2 * expected * (1 - expected));
  const delta = variance * impact * (match.score - expected);
  const updatedVolatility = solveUpdatedVolatility(
    delta,
    phi,
    variance,
    player.volatility,
    tau,
    epsilon,
  );
  const phiStar = Math.sqrt(phi ** 2 + updatedVolatility ** 2);
  const updatedPhi = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / variance);
  const updatedMu = mu + updatedPhi ** 2 * impact * (match.score - expected);

  return {
    rating: roundRatingValue(fromMu(updatedMu)),
    ratingDeviation: roundRatingValue(fromPhi(updatedPhi)),
    volatility: roundRatingValue(updatedVolatility),
  } satisfies Glicko2Player;
}
