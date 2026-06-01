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

export const CREDIT_COSTS = {
  text2img: 1,
  img2img: 1,
  img2video: 10,
  text2video: 12,
  character: 3,
} as const;

export type GenerationMode = keyof typeof CREDIT_COSTS;

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceUsd: number;
  monthlyCredits: number;
  features: string[];
  recommended?: boolean;
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
  },
  {
    id: 'pro_monthly',
    name: 'Pro',
    priceUsd: 29.9,
    monthlyCredits: 2000,
    features: ['每月 2000 积分', '约 2000 张图 / 200 段视频', '私聊客服', '30 天历史保留'],
  },
  {
    id: 'studio_monthly',
    name: 'Studio',
    priceUsd: 99.9,
    monthlyCredits: 8000,
    features: ['每月 8000 积分', '商业授权', 'API 访问', '90 天历史保留', '专属客户经理'],
  },
];

export interface TopupPack {
  id: string;
  credits: number;
  priceUsd: number;
  bonus?: string;
}

// One-time top-ups (no subscription). Better unit price as size goes up.
export const TOPUP_PACKS: TopupPack[] = [
  { id: 'topup_small', credits: 250, priceUsd: 5 },           // $0.020/cr
  { id: 'topup_medium', credits: 1200, priceUsd: 20, bonus: '送 200' },  // $0.0167/cr eff
  { id: 'topup_large', credits: 3500, priceUsd: 50, bonus: '送 1000' }, // $0.0143/cr eff
  { id: 'topup_xl', credits: 8000, priceUsd: 100, bonus: '送 3000' },   // $0.0125/cr eff
];

export function getPlan(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

export function getTopup(id: string): TopupPack | undefined {
  return TOPUP_PACKS.find((p) => p.id === id);
}
