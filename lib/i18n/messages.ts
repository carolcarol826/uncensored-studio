// Single source of truth for translated strings.
//
// Add a key once under `zh`, then add the matching `en`. Missing English
// falls back to the Chinese text (visible reminder we missed a translation).
//
// Keys are flat dotted paths ("login.password.placeholder"). Lookup helper:
//   t('login.password.placeholder', 'en')
//
// When a string needs interpolation use {placeholder} markers:
//   "remaining": "{n} credits left"

export const Locales = ['zh', 'en'] as const;
export type Locale = (typeof Locales)[number];
export const DEFAULT_LOCALE: Locale = 'zh';

type Dict = { [k: string]: string | Dict };

const zh: Dict = {
  brand: { name: 'MyHim Studio' },
  common: {
    loading: '加载中…',
    cancel: '取消',
    save: '保存',
    submit: '提交',
    confirm: '确认',
    back: '返回',
    backHome: '← 返回首页',
    or: '或',
    optional: '可选',
    requiredField: '必填',
    sending: '发送中…',
    saving: '保存中…',
    submitting: '提交中…',
    loggingIn: '登录中…',
    registering: '注册中…',
    pleaseLogin: '请先登录',
    forbidden: '无权访问',
    invalidJson: '请求格式有误',
    serverError: '服务器内部错误',
  },
  age: {
    title: '成人内容警告',
    titleEn: 'Adult Content Warning · 18+ Only',
    bodyLead: '本站为',
    bodyLeadAccent: '无审查 AI 创作工具',
    bodyLeadRest: ',可能生成包含艺术裸体、暗示成人题材的内容。',
    bullets: '点击"我已年满 18 周岁"即表示',
    bullet1: '你已年满 18 周岁（或所在地的法定成年年龄）',
    bullet2: '查看本站内容在你所在地区是合法的',
    bullet3: '你将自负对生成内容的法律责任',
    bullet4: '不会用本站生成 CSAM、深度伪造名人、非自愿亲密图像或任何违法内容',
    fullTerms: '完整条款见',
    accept: '我已年满 18 周岁',
    leave: '未满 18 岁 / 离开',
  },
  nav: {
    home: '首页',
    gallery: '图库',
    dashboard: '个人面板',
    settings: '设置',
    login: '登录',
    register: '注册',
    logout: '退出',
    admin: 'Admin',
    language: '语言',
  },
  login: {
    title: '登录',
    subtitleNote: '',
    email: '邮箱',
    emailPlaceholder: 'you@example.com',
    password: '密码',
    passwordPlaceholder: '••••••••',
    phone: '手机号（仅限 +86）',
    phonePlaceholder: '13800138000',
    code: '验证码',
    codePlaceholder: '6 位验证码',
    sendCode: '发送验证码',
    sendLink: '发送登录链接',
    loginButton: '登录',
    loginRegister: '登录 / 注册',
    useGoogle: '使用 Google 登录',
    usePassword: '用邮箱密码登录',
    usePhone: '手机号登录',
    useMagic: '← 用登录链接',
    otherWays: '← 其他登录方式',
    needAccount: '还没有账号？',
    registerLink: '注册',
    invalidPhone: '请输入有效的 +86 手机号（11 位）',
    sendCodeFailed: '验证码发送失败',
    badPassword: '邮箱或密码不正确',
    badCode: '验证码不正确或已过期',
    loginFailed: '登录失败',
    sendFailed: '发送失败',
    sentTitle: '✓ 登录链接已发送',
    sentBody: '请检查邮箱 {email},点击邮件中的"登录"按钮完成登录。',
    sentHintTitle: '第一次登录提示',
    sentHintSpam: '· 邮件可能在垃圾邮件夹(来自 login@myhim.love)',
    sentHintNotSpam: '· 收到后请右键 "非垃圾邮件",下次会进收件箱',
    sentHintWait: '· 等 1-2 分钟,如还没有可',
    resend: '重新发送',
    agree: '登录即表示同意',
    terms: '服务条款',
    and: '和',
    privacy: '隐私政策',
    period: '。',
  },
  register: {
    title: '注册',
    subtitle: '创建账户,赠送 20 积分',
    useGoogle: '使用 Google 注册',
    emailPlaceholder: 'you@example.com',
    passwordPlaceholder: '至少 8 位',
    submit: '注册并登录',
    haveAccount: '已有账号？',
    loginLink: '登录',
    agree: '注册即表示同意',
    failed: '注册失败',
    autoLoginFailed: '注册成功,但自动登录失败,请前往登录页',
  },
  legal: {
    dmcaTitle: 'DMCA / NCII 内容下架',
    lastUpdated: '最后更新',
  },
  takedown: {
    sectionTitle: '在线提交（推荐）',
    sectionLead: '所有下架请求请通过下方表单提交。系统会自动通知值班管理员并启动 SLA 倒计时。',
    category: '类别',
    typeDMCA: 'DMCA · 版权侵权',
    typeNCII: 'NCII · 非自愿亲密图像（图中为你本人/未成年子女）',
    typeCSAM: 'CSAM · 儿童性虐待材料（最高优先级）',
    typeOTHER: '其他 / 反通知',
    yourEmail: '你的邮箱 *',
    yourName: '你的姓名',
    contentUrl: '侵权内容 URL',
    reason: '下架原因 *（至少 20 字）',
    evidence: '补充证据（链接 / 文字说明）',
    submit: '提交下架请求',
    submitting: '提交中…',
    success: '✓ 已收到下架请求',
    successCsam: '我们将在 1 小时内响应。',
    successNcii: '我们将在 48 小时内临时下架并启动调查。',
    successOther: '我们将在 48 小时内回复。',
    truthful: '提交即声明上述信息真实有效。虚假申报可能承担法律责任。',
    invalid: '提交格式有误:请填写邮箱和至少 20 字的下架原因',
    failed: '提交失败',
    placeholderDMCA: '描述被侵权的作品;声明:本人善意认为该内容未经版权人/代理人/法律授权。',
    placeholderNCII: '声明:图中为本人 / 我的未成年子女。我未授权该图的生成与传播。',
    placeholderCSAM: '简短描述。无需身份证明。',
    placeholderOther: '请详细说明。',
  },
};

const en: Dict = {
  brand: { name: 'MyHim Studio' },
  common: {
    loading: 'Loading…',
    cancel: 'Cancel',
    save: 'Save',
    submit: 'Submit',
    confirm: 'Confirm',
    back: 'Back',
    backHome: '← Back to home',
    or: 'or',
    optional: 'optional',
    requiredField: 'required',
    sending: 'Sending…',
    saving: 'Saving…',
    submitting: 'Submitting…',
    loggingIn: 'Signing in…',
    registering: 'Creating account…',
    pleaseLogin: 'Please sign in first',
    forbidden: 'Forbidden',
    invalidJson: 'Invalid request',
    serverError: 'Server error',
  },
  age: {
    title: 'Adult Content Warning',
    titleEn: '18+ Only',
    bodyLead: 'This is an',
    bodyLeadAccent: 'uncensored AI creative tool',
    bodyLeadRest: ' that may generate artistic nudity or suggestive adult material.',
    bullets: 'By clicking "I am 18 or older" you confirm:',
    bullet1: 'You are at least 18 years old (or the legal age of majority in your jurisdiction)',
    bullet2: 'Viewing this content is legal where you are',
    bullet3: 'You take full legal responsibility for what you generate',
    bullet4: 'You will not generate CSAM, celebrity deepfakes, non-consensual intimate imagery, or anything illegal',
    fullTerms: 'Full terms:',
    accept: 'I am 18 or older',
    leave: 'I am under 18 / leave',
  },
  nav: {
    home: 'Home',
    gallery: 'Gallery',
    dashboard: 'Dashboard',
    settings: 'Settings',
    login: 'Sign in',
    register: 'Sign up',
    logout: 'Sign out',
    admin: 'Admin',
    language: 'Language',
  },
  login: {
    title: 'Sign in',
    subtitleNote: '',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    password: 'Password',
    passwordPlaceholder: '••••••••',
    phone: 'Phone (+86 only)',
    phonePlaceholder: '13800138000',
    code: 'Verification code',
    codePlaceholder: '6-digit code',
    sendCode: 'Send code',
    sendLink: 'Send magic link',
    loginButton: 'Sign in',
    loginRegister: 'Sign in / Sign up',
    useGoogle: 'Continue with Google',
    usePassword: 'Use email + password',
    usePhone: 'Use phone',
    useMagic: '← Use magic link',
    otherWays: '← Other sign-in options',
    needAccount: "Don't have an account?",
    registerLink: 'Sign up',
    invalidPhone: 'Enter a valid +86 phone number (11 digits)',
    sendCodeFailed: 'Could not send code',
    badPassword: 'Email or password is incorrect',
    badCode: 'Code is incorrect or expired',
    loginFailed: 'Sign-in failed',
    sendFailed: 'Send failed',
    sentTitle: '✓ Magic link sent',
    sentBody: 'Check your inbox at {email} and click the sign-in button.',
    sentHintTitle: 'First-time tips',
    sentHintSpam: '· The email may be in your spam folder (from login@myhim.love)',
    sentHintNotSpam: '· Mark it "Not spam" so future emails land in your inbox',
    sentHintWait: "· Wait 1–2 min. If it doesn't arrive,",
    resend: 'resend',
    agree: 'By signing in you agree to our',
    terms: 'Terms of Service',
    and: 'and',
    privacy: 'Privacy Policy',
    period: '.',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Get 20 free credits on sign-up',
    useGoogle: 'Continue with Google',
    emailPlaceholder: 'you@example.com',
    passwordPlaceholder: 'At least 8 characters',
    submit: 'Create account',
    haveAccount: 'Already have an account?',
    loginLink: 'Sign in',
    agree: 'By signing up you agree to our',
    failed: 'Sign-up failed',
    autoLoginFailed: 'Account created, but auto sign-in failed. Please sign in manually.',
  },
  legal: {
    dmcaTitle: 'DMCA / NCII Takedown',
    lastUpdated: 'Last updated',
  },
  takedown: {
    sectionTitle: 'Submit online (recommended)',
    sectionLead: 'All takedown requests should be submitted via the form below. Our admin team is notified automatically and the SLA timer starts.',
    category: 'Category',
    typeDMCA: 'DMCA · Copyright infringement',
    typeNCII: 'NCII · Non-consensual intimate imagery (depicting you / your minor)',
    typeCSAM: 'CSAM · Child sexual abuse material (highest priority)',
    typeOTHER: 'Other / counter-notice',
    yourEmail: 'Your email *',
    yourName: 'Your name',
    contentUrl: 'URL of infringing content',
    reason: 'Reason for takedown * (at least 20 characters)',
    evidence: 'Supporting evidence (links / notes)',
    submit: 'Submit takedown request',
    submitting: 'Submitting…',
    success: '✓ Takedown request received',
    successCsam: "We'll respond within 1 hour.",
    successNcii: "We'll temporarily remove the content within 48 hours and open an investigation.",
    successOther: "We'll reply within 48 hours.",
    truthful: 'By submitting you declare the above is true and accurate. False reports may carry legal liability.',
    invalid: 'Bad request: please provide an email and at least a 20-character reason.',
    failed: 'Submit failed',
    placeholderDMCA: 'Describe the infringed work; state: I have a good-faith belief the use is not authorized by the copyright owner, agent, or law.',
    placeholderNCII: 'State: the person depicted is me / my minor child. I did not consent to this image being generated or shared.',
    placeholderCSAM: 'Brief description. No ID required.',
    placeholderOther: 'Please describe in detail.',
  },
};

const DICTS: Record<Locale, Dict> = { zh, en };

function lookup(dict: Dict, path: string[]): string | null {
  let cur: any = dict;
  for (const seg of path) {
    if (cur && typeof cur === 'object' && seg in cur) cur = cur[seg];
    else return null;
  }
  return typeof cur === 'string' ? cur : null;
}

/** Translate a dotted key. Falls back to Chinese, then the raw key. */
export function t(
  key: string,
  locale: Locale = DEFAULT_LOCALE,
  vars?: Record<string, string | number>
): string {
  const path = key.split('.');
  const found = lookup(DICTS[locale] ?? DICTS[DEFAULT_LOCALE], path)
    ?? lookup(DICTS[DEFAULT_LOCALE], path);
  if (!found) return key;
  if (!vars) return found;
  return found.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function isLocale(s: string | null | undefined): s is Locale {
  return !!s && (Locales as readonly string[]).includes(s);
}
