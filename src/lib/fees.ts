// Stripe fee: 2.9% + $0.30
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.30;

export function calculateFee(price: number): {
  fee: number;
  total: number;
} {
  // Calculate total so that after Stripe takes their cut, we get exactly `price`
  const total = Math.ceil(((price + STRIPE_FIXED) / (1 - STRIPE_PERCENT)) * 100) / 100;
  const fee = Math.round((total - price) * 100) / 100;
  return { fee, total };
}
