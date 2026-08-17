// Pricing plans + credit costs.
// Tune these to match your unit economics.
//
// Generation cost reference (assuming ~$0.40/hr 4090 cloud GPU):
//   SDXL t2i (5s)  ≈ $0.0006 → charge 1 credit
//   SDXL i2i (5s)  ≈ $0.0006 → charge 1 credit
//   Character (8s) ≈ $0.0009 → charge 3 credits
//   Wan I2V (60s)  ≈ $0.007  → charge 10 credits
//   Wan T2V (90s)  ≈ $0.010  → charge 12 credits
//
// Target margin: ~80%+ at scale (credits sold at ~$0.01-0.05 each).

// Priced off measured GPU seconds, not guessed. A credit is worth roughly
// $0.015 (top-up packs run $0.0125–$0.020, subscriptions $0.0125–$0.0198), and
// serverless 4090 time bills at about $0.00031/s. Aim for compute at a quarter
// to a third of revenue, leaving room for Paddle fees, R2, Vercel and the
// network volume's monthly charge.
//
// Measured this round, wall time as RunPod bills it:
//   SDXL Lightning t2i   2–13s   → ~$0.003
//   Qwen edit (i2i/tryon) 13–120s → ~$0.019 blended, weights are ~30GB
//   Wan 2.2 A14B video   ~300s   → ~$0.093
export const CREDIT_COSTS = {
  text2img: 1,
  // Was 1, from when this ran SDXL. It now runs Qwen-Image-Edit, which costs
  // us about six times as much per job — at 1 credit the feature lost money on
  // every call.
  img2img: 4,
  img2video: 10,  // ×2 again for the A14B graph, see heavyModelMul
  text2video: 12,
  character: 3,
  controlnet: 2,  // ~2x compute: preprocessor + controlnet forward pass
  inpaint: 1,     // still SDXL, and only the masked region is repainted
  tryon: 4,       // same Qwen graph as img2img, plus a second reference image
} as const;

export type GenerationMode = keyof typeof CREDIT_COSTS;

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceUsd: number;
  monthlyCredits: number;
  features: string[];
  recommended?: boolean;
  /** Paddle price id (pri_xxx). When unset → "Paddle 待上线". */
  paddlePriceId?: string;
}

// Paddle price IDs come from env: PADDLE_PRICE_<PLAN_ID_UPPER>
// e.g. PADDLE_PRICE_STARTER_MONTHLY=pri_01h...
function paddlePrice(planId: string): string | undefined {
  const key = `PADDLE_PRICE_${planId.toUpperCase()}`;
  return process.env[key];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: '免费体验',
    priceUsd: 0,
    monthlyCredits: 20, // signup bonus only
    features: ['20 个一次性积分（注册赠送）', '所有模型可用', '社区支持'],
  },
  {
    id: 'starter_monthly',
    name: 'Starter',
    priceUsd: 9.9,
    monthlyCredits: 500,
    features: ['每月 500 积分', '约 500 张图 / 50 段视频', 'Discord 优先支持', '7 天历史保留'],
    recommended: true,
    paddlePriceId: paddlePrice('starter_monthly'),
  },
  {
    id: 'pro_monthly',
    name: 'Pro',
    priceUsd: 29.9,
    monthlyCredits: 2000,
    features: ['每月 2000 积分', '约 2000 张图 / 200 段视频', '私聊客服', '30 天历史保留'],
    paddlePriceId: paddlePrice('pro_monthly'),
  },
  {
    id: 'studio_monthly',
    name: 'Studio',
    priceUsd: 99.9,
    monthlyCredits: 8000,
    features: ['每月 8000 积分', '商业授权', 'API 访问', '90 天历史保留', '专属客户经理'],
    paddlePriceId: paddlePrice('studio_monthly'),
  },
];

export interface TopupPack {
  id: string;
  credits: number;
  priceUsd: number;
  bonus?: string;
  /** Paddle one-time price id. */
  paddlePriceId?: string;
}

// One-time top-ups (no subscription). Better unit price as size goes up.
// IDs are bare (no "topup_" prefix) so checkout routes can construct
// orderRef = `topup_${t.id}` without doubling up.
export const TOPUP_PACKS: TopupPack[] = [
  { id: 'small', credits: 250, priceUsd: 5, paddlePriceId: process.env.PADDLE_PRICE_TOPUP_SMALL },           // $0.020/cr
  { id: 'medium', credits: 1200, priceUsd: 20, bonus: '送 200', paddlePriceId: process.env.PADDLE_PRICE_TOPUP_MEDIUM },  // $0.0167/cr eff
  { id: 'large', credits: 3500, priceUsd: 50, bonus: '送 1000', paddlePriceId: process.env.PADDLE_PRICE_TOPUP_LARGE }, // $0.0143/cr eff
  { id: 'xl', credits: 8000, priceUsd: 100, bonus: '送 3000', paddlePriceId: process.env.PADDLE_PRICE_TOPUP_XL },   // $0.0125/cr eff
];

export function getPlan(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

export function getTopup(id: string): TopupPack | undefined {
  return TOPUP_PACKS.find((p) => p.id === id);
}
