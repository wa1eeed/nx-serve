import type { L } from './i18n';

/**
 * Marketing copy, authored in both locales (never machine translated, CLAUDE.md 2.8).
 * Structured so pages stay thin and the same content feeds JSON-LD and sitemaps.
 */

export interface NavItem {
  href: string;
  label: L<string>;
}

export const NAV: NavItem[] = [
  { href: '/use-cases', label: { ar: 'حالات الاستخدام', en: 'Use cases' } },
  { href: '/features', label: { ar: 'المزايا', en: 'Features' } },
  { href: '/how-it-works', label: { ar: 'كيف يعمل', en: 'How it works' } },
  { href: '/pricing', label: { ar: 'الأسعار', en: 'Pricing' } },
];

/** One consistent entity definition, repeated everywhere (GEO, docs/22 section 6). */
export const ENTITY: L<string> = {
  ar: 'NX Serve منصة سعودية بعلامتك الخاصة لإطلاق أعمال الخدمات عند الطلب (سطحات، لوجستيات، خدمات منزلية) مع مدفوعات ميسر المقسّمة، وتتبع حيّ، وواجهة برمجية.',
  en: 'NX Serve is a Saudi white-label platform for launching on-demand service businesses (towing, logistics, home services) with Moyasar split payments, live tracking and an API.',
};

export const HERO = {
  badge: { ar: 'السطحات أولاً، وليست السطحات فقط', en: 'Towing first, not towing only' },
  title: { ar: 'أطلق منصة خدماتك الميدانية بعلامتك الخاصة', en: 'Launch your own field services platform' },
  subtitle: {
    ar: 'منصة قابلة للتهيئة ومتعددة المستأجرين تُدار بالكامل من لوحة تحكم: خدمات جديدة وأسعار ومراحل عمل دون إصدار تطبيق. مبنية على مدفوعات ميسر المقسّمة مع تتبع حيّ وواجهة برمجية.',
    en: 'A configurable, multi-tenant platform run entirely from a console: new services, prices and workflows with no app release. Built on Moyasar split payments with live tracking and a developer API.',
  },
  ctaPrimary: { ar: 'اطلب عرضاً توضيحياً', en: 'Book a demo' },
  ctaSecondary: { ar: 'استعرض حالات الاستخدام', en: 'See use cases' },
} as const;

export const TRUST: L<string[]> = {
  ar: ['شريك ميسر للمدفوعات', 'جاهز لفوترة ZATCA', 'متوافق مع نظام حماية البيانات', 'البيانات مستضافة في السعودية'],
  en: ['Moyasar payments partner', 'ZATCA e-invoicing ready', 'PDPL compliant', 'Data hosted in Saudi Arabia'],
};

export interface Feature {
  title: L<string>;
  body: L<string>;
}

export const FEATURES: Feature[] = [
  {
    title: { ar: 'محرّك التهيئة', en: 'Configuration engine' },
    body: {
      ar: 'الخدمات والفئات والحقول ومراحل العمل والأسعار بيانات تُحرَّر في اللوحة. أطلق خدمة جديدة دون كتابة سطر برمجي.',
      en: 'Services, categories, fields, workflows and prices are data edited in the console. Launch a new service without a line of code.',
    },
  },
  {
    title: { ar: 'تتبع حيّ', en: 'Live tracking' },
    body: {
      ar: 'يرى العميل مقدّم الخدمة على الخريطة لحظة بلحظة، وتتابع العمليات أسطولك على خريطة واحدة.',
      en: 'Customers see the provider move on the map in real time, and ops watch the whole fleet on one live map.',
    },
  },
  {
    title: { ar: 'توزيع ذكي', en: 'Smart dispatch' },
    body: {
      ar: 'جولات توزيع تراعي القرب والتوافر والتقييم والسعة، بسياسات قابلة للضبط لكل خدمة.',
      en: 'Dispatch rounds score proximity, availability, rating and capacity, with policies tunable per service.',
    },
  },
  {
    title: { ar: 'تسعير ديناميكي', en: 'Dynamic pricing' },
    body: {
      ar: 'بطاقات أسعار بالمسافة والزمن والمناطق ورسوم إضافية وتسعير بالذروة، مع تقدير مسبق للعميل.',
      en: 'Rate cards by distance, time, zones, surcharges and surge, with an upfront estimate for the customer.',
    },
  },
  {
    title: { ar: 'مدفوعات مقسّمة', en: 'Split payments' },
    body: {
      ar: 'يتدفق المال من ميسر مباشرة لكل مستحق عبر Split Payments. لا محافظ ولا أرصدة محتجزة، ولا تمسّ بيانات البطاقة خوادمنا.',
      en: 'Money flows from Moyasar straight to each recipient via Split Payments. No wallets, no held balances, and card data never touches our servers.',
    },
  },
  {
    title: { ar: 'ويب وتطبيقات بعلامتك', en: 'White-label web and apps' },
    body: {
      ar: 'متجرك على نطاقك الخاص، وبوابة مقدّمي الخدمة، وتطبيق ويب قابل للتثبيت. التطبيقات المتجرية ضمن الخطة المتقدمة.',
      en: 'Your storefront on your own domain, a provider portal, and an installable web app. Branded store apps on the Advanced plan.',
    },
  },
  {
    title: { ar: 'منصة واجهات برمجية', en: 'API platform' },
    body: {
      ar: 'واجهة ‎/v1‎ موثّقة بـ OpenAPI، ومفاتيح اختبار وإنتاج، وويب هوكس موقّعة، وحزمة SDK وبوابة مطورين.',
      en: 'A documented /v1 API with OpenAPI, test and live keys, signed webhooks, an SDK and a developer portal.',
    },
  },
  {
    title: { ar: 'جاهزية الامتثال', en: 'Compliance ready' },
    body: {
      ar: 'فوترة ZATCA، وحماية بيانات PDPL، والتحقق عبر نفاذ ومعرفة العميل التجاري، واتصال مُقنّع بين العميل ومقدّم الخدمة.',
      en: 'ZATCA e-invoicing, PDPL data protection, Nafath and KYB verification, and masked customer to provider contact.',
    },
  },
];

export interface Step {
  title: L<string>;
  body: L<string>;
}

export const STEPS: Step[] = [
  { title: { ar: 'سجّل', en: 'Sign up' }, body: { ar: 'أنشئ حسابك واختر النطاق الفرعي لعلامتك.', en: 'Create your account and pick your branded subdomain.' } },
  { title: { ar: 'اختر قالباً', en: 'Choose a template' }, body: { ar: 'ابدأ من قالب جاهز مثل السطحات أو اللوجستيات.', en: 'Start from a ready template such as towing or logistics.' } },
  { title: { ar: 'خصّص علامتك', en: 'Brand it' }, body: { ar: 'الشعار والألوان والنطاق والنصوص بالعربية والإنجليزية.', en: 'Logo, colors, domain and copy in Arabic and English.' } },
  { title: { ar: 'اربط المدفوعات', en: 'Connect payments' }, body: { ar: 'فعّل ميسر لتصل الأموال لكل مستحق مباشرة.', en: 'Enable Moyasar so money reaches each recipient directly.' } },
  { title: { ar: 'ضمّ مقدّمي الخدمة', en: 'Onboard providers' }, body: { ar: 'تسجيل ووثائق وتحقق واعتماد لكل فئة.', en: 'Registration, documents, verification and per-category approval.' } },
  { title: { ar: 'أطلق', en: 'Go live' }, body: { ar: 'افتح الطلبات على الويب، وفعّل التطبيقات لاحقاً.', en: 'Open ordering on the web, add branded apps later.' } },
];

export interface Plan {
  code: string;
  name: L<string>;
  priceTeaser: L<string>;
  blurb: L<string>;
  features: L<string[]>;
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    code: 'basic',
    name: { ar: 'الأساسية', en: 'Basic' },
    priceTeaser: { ar: 'للبداية على الويب', en: 'Start on the web' },
    blurb: { ar: 'متجر ويب وطلبات وتتبع وبوابة مقدّمي خدمة.', en: 'Web storefront, ordering, tracking and a provider portal.' },
    features: {
      ar: ['متجر على الويب', 'طلب ودفع وتتبع', 'بوابة مقدّمي الخدمة', 'قالب واحد'],
      en: ['Web storefront', 'Order, pay and track', 'Provider portal', 'One template'],
    },
  },
  {
    code: 'growth',
    name: { ar: 'النمو', en: 'Growth' },
    priceTeaser: { ar: 'للتوسّع', en: 'For scaling up' },
    blurb: { ar: 'مناطق وتسعير متقدم وتحليلات وعدة خدمات.', en: 'Zones, advanced pricing, analytics and multiple services.' },
    features: {
      ar: ['كل مزايا الأساسية', 'تسعير بالمناطق والذروة', 'تحليلات', 'عدة خدمات'],
      en: ['Everything in Basic', 'Zone and surge pricing', 'Analytics', 'Multiple services'],
    },
    highlighted: true,
  },
  {
    code: 'advanced',
    name: { ar: 'المتقدمة', en: 'Advanced' },
    priceTeaser: { ar: 'مع تطبيقات بعلامتك', en: 'With branded apps' },
    blurb: { ar: 'تطبيقات iOS وأندرويد بعلامتك ونطاق مخصص.', en: 'Branded iOS and Android apps and a custom domain.' },
    features: {
      ar: ['كل مزايا النمو', 'تطبيقات متجرية بعلامتك', 'نطاق مخصص', 'وصول كامل للواجهة البرمجية'],
      en: ['Everything in Growth', 'Branded store apps', 'Custom domain', 'Full API access'],
    },
  },
  {
    code: 'enterprise',
    name: { ar: 'المؤسسات', en: 'Enterprise' },
    priceTeaser: { ar: 'حسب الطلب', en: 'Custom' },
    blurb: { ar: 'اتفاقيات مستوى خدمة وتكاملات ودعم مخصص.', en: 'SLAs, integrations and dedicated support.' },
    features: {
      ar: ['كل مزايا المتقدمة', 'اتفاقية مستوى خدمة', 'تكاملات مخصصة', 'مدير حساب'],
      en: ['Everything in Advanced', 'SLA', 'Custom integrations', 'Account manager'],
    },
  },
];

export interface Faq {
  q: L<string>;
  a: L<string>;
}

export const HOME_FAQ: Faq[] = [
  {
    q: { ar: 'ما هي NX Serve؟', en: 'What is NX Serve?' },
    a: ENTITY,
  },
  {
    q: { ar: 'كم يستغرق الإطلاق؟', en: 'How long does it take to launch?' },
    a: {
      ar: 'يمكن إطلاق متجر ويب يعمل بالطلبات والدفع والتتبع خلال أيام باستخدام قالب جاهز. التطبيقات بعلامتك تضاف لاحقاً في الخطة المتقدمة.',
      en: 'A working web storefront with ordering, payment and tracking can launch within days using a ready template. Branded apps are added later on the Advanced plan.',
    },
  },
  {
    q: { ar: 'هل تحتفظون بأموال العملاء؟', en: 'Do you hold customer funds?' },
    a: {
      ar: 'لا. تتدفق الأموال من ميسر مباشرة لكل مستحق عبر المدفوعات المقسّمة، دون محافظ أو أرصدة محتجزة، وبيانات البطاقة لا تمسّ خوادمنا.',
      en: 'No. Money flows from Moyasar directly to each recipient via split payments, with no wallets or held balances, and card data never touches our servers.',
    },
  },
  {
    q: { ar: 'هل أحتاج إلى مبرمج لإطلاق خدمة جديدة؟', en: 'Do I need a developer to launch a new service?' },
    a: {
      ar: 'لا. الخدمات والحقول ومراحل العمل والأسعار تُحرَّر في لوحة التحكم كبيانات، فتظهر دون إصدار تطبيق جديد.',
      en: 'No. Services, fields, workflows and prices are edited in the console as data and appear with no new app release.',
    },
  },
  {
    q: { ar: 'هل الموقع والتطبيقات بالعربية والإنجليزية؟', en: 'Is the product bilingual?' },
    a: {
      ar: 'نعم، تُطلق المنتجات بالعربية والإنجليزية بتكافؤ كامل وتصميم يدعم الاتجاه من اليمين لليسار أصلاً.',
      en: 'Yes, products ship in Arabic and English at full parity with right to left layouts designed, not just mirrored.',
    },
  },
];

export interface UseCase {
  slug: string;
  name: L<string>;
  tagline: L<string>;
  pain: L<string>;
  how: L<string[]>;
  pricingExample: L<string>;
  launchTime: L<string>;
  faq: Faq[];
}

export const USE_CASES: UseCase[] = [
  {
    slug: 'towing',
    name: { ar: 'السطحات', en: 'Towing' },
    tagline: { ar: 'منصة سطحات بعلامتك خلال أيام', en: 'Your branded towing platform in days' },
    pain: {
      ar: 'طلبات السطحة تُدار عبر مكالمات ورسائل، بلا تسعير واضح ولا تتبع ولا تسوية مالية منظمة.',
      en: 'Towing requests are run over calls and messages, with no clear pricing, no tracking and no clean settlement.',
    },
    how: {
      ar: [
        'يطلب العميل ويحدد الموقعين ونوع المركبة ويرى التقدير قبل التأكيد.',
        'توزيع الطلب على أقرب سطحة متاحة بالسعة المناسبة.',
        'مراحل: قبول، في الطريق، وصل، تحميل، تسليم، مع تتبع حيّ وإثبات بالصور.',
        'تفويض المبلغ عند الإسناد وتحصيله عند التسليم مع تقسيم تلقائي للمستحقين.',
      ],
      en: [
        'The customer requests, sets both locations and vehicle type, and sees the estimate before confirming.',
        'The request is dispatched to the nearest available truck with the right capacity.',
        'Stages: accepted, en route, arrived, loading, delivered, with live tracking and photo proof.',
        'Amount authorized on assignment and captured on delivery, split automatically to recipients.',
      ],
    },
    pricingExample: {
      ar: 'مثال: رسوم انطلاق ثابتة + سعر لكل كيلومتر مطريق، مع رسوم إضافية للمواقف السفلية أو الليل.',
      en: 'Example: a fixed base fee plus a per-kilometre routed rate, with surcharges for basements or night work.',
    },
    launchTime: { ar: 'إطلاق على الويب خلال أيام', en: 'Live on the web within days' },
    faq: [
      {
        q: { ar: 'هل يدعم المواقف السفلية والمركبات الثقيلة؟', en: 'Does it handle basements and heavy vehicles?' },
        a: {
          ar: 'نعم، الحقول الديناميكية والفئات السعرية تُضبط لكل نوع مركبة وحالة، مثل ارتفاع القبو أو السطحة الهيدروليكية.',
          en: 'Yes, dynamic fields and pricing tiers are configured per vehicle type and condition, such as basement clearance or a hydraulic flatbed.',
        },
      },
      {
        q: { ar: 'هل تُرفع تراخيص مقدّمي الخدمة؟', en: 'Are provider licences collected?' },
        a: {
          ar: 'نعم، متطلبات الوثائق قابلة للضبط لكل فئة، وتشمل تراخيص الهيئة العامة للنقل حسب الحاجة.',
          en: 'Yes, document requirements are configurable per category, including TGA related licences where required.',
        },
      },
      {
        q: { ar: 'كيف يُدفع لمقدّم الخدمة؟', en: 'How is the provider paid?' },
        a: {
          ar: 'عبر المدفوعات المقسّمة من ميسر مباشرة عند التحصيل، دون أن تحتجز المنصة الأموال.',
          en: 'Through Moyasar split payments directly on capture, with no funds held by the platform.',
        },
      },
    ],
  },
  {
    slug: 'logistics',
    name: { ar: 'اللوجستيات والتوصيل', en: 'Logistics and delivery' },
    tagline: { ar: 'توصيل الطلبات والميل الأخير بعلامتك', en: 'Last-mile delivery under your brand' },
    pain: {
      ar: 'الاعتماد على تطبيقات توصيل عامة يعني عمولات مرتفعة وغياب العلاقة المباشرة مع العميل والبيانات.',
      en: 'Relying on generic delivery apps means high commissions and losing the direct customer relationship and data.',
    },
    how: {
      ar: [
        'طلب من نقطة إلى نقطة مع عناوين متعددة وتقدير فوري.',
        'توزيع على المناديب المتاحين حسب المنطقة والسعة.',
        'تتبع حيّ وإثبات تسليم ورمز تحقق عند الاستلام.',
        'تسعير بالمسافة والمناطق، وتحصيل مع تقسيم تلقائي.',
      ],
      en: [
        'Point to point requests with multiple stops and an instant estimate.',
        'Dispatch to available couriers by zone and capacity.',
        'Live tracking, proof of delivery and an OTP on handover.',
        'Distance and zone pricing, with capture and automatic split.',
      ],
    },
    pricingExample: {
      ar: 'مثال: سعر أساسي لكل رحلة + سعر لكل كيلومتر، مع تسعير بالذروة في أوقات الضغط.',
      en: 'Example: a base price per trip plus a per-kilometre rate, with surge pricing at peak times.',
    },
    launchTime: { ar: 'إطلاق على الويب خلال أيام', en: 'Live on the web within days' },
    faq: [
      {
        q: { ar: 'هل يدعم عدة وجهات في الطلب الواحد؟', en: 'Does it support multiple stops per order?' },
        a: {
          ar: 'نعم، كل طلب قائمة من المحطات، فيناسب التوصيل متعدد النقاط والمهام المجمّعة.',
          en: 'Yes, every order is a list of stops, so multi-drop delivery and batched tasks are supported.',
        },
      },
      {
        q: { ar: 'هل يمكن جدولة الطلبات؟', en: 'Can orders be scheduled?' },
        a: {
          ar: 'نعم، تدعم المنصة الطلب الفوري والمجدول بنوافذ زمنية قابلة للضبط.',
          en: 'Yes, the platform supports on-demand and scheduled orders with configurable time windows.',
        },
      },
      {
        q: { ar: 'هل أملك بيانات عملائي؟', en: 'Do I own my customer data?' },
        a: {
          ar: 'نعم، المنصة بعلامتك ومتعددة المستأجرين بعزل كامل، فبياناتك وعلاقتك بعملائك لك.',
          en: 'Yes, the platform is white-label and multi-tenant with full isolation, so your data and customer relationship are yours.',
        },
      },
    ],
  },
];

export function findUseCase(slug: string): UseCase | undefined {
  return USE_CASES.find((u) => u.slug === slug);
}

export const CTA = {
  title: { ar: 'جاهز لإطلاق منصتك؟', en: 'Ready to launch your platform?' },
  body: {
    ar: 'احجز عرضاً توضيحياً ونريك كيف تطلق خدمتك بعلامتك الخاصة في أيام.',
    en: 'Book a demo and we will show you how to launch your branded service in days.',
  },
  primary: { ar: 'اطلب عرضاً توضيحياً', en: 'Book a demo' },
  secondary: { ar: 'تحدث إلى المبيعات', en: 'Talk to sales' },
} as const;
