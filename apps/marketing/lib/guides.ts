import type { Faq } from './content';
import type { L } from './i18n';

/**
 * Guides (docs/22 sections 2, 5, 8): pillar and supporting content targeting Saudi
 * search intent, authored in both locales with E-E-A-T bylines and dated updates.
 * Content is structured as blocks so the same source feeds the page, Article and
 * HowTo JSON-LD, and the sitemap.
 */

export type Block =
  | { kind: 'p'; text: L<string> }
  | { kind: 'h2'; text: L<string> }
  | { kind: 'ul'; items: L<string[]> }
  | { kind: 'steps'; items: L<string[]> };

export interface Guide {
  slug: string;
  type: 'article' | 'howto';
  title: L<string>;
  description: L<string>;
  dek: L<string>;
  author: L<string>;
  datePublished: string; // ISO date
  dateModified: string;
  blocks: Block[];
  faq: Faq[];
}

const AUTHOR: L<string> = { ar: 'فريق NX Serve', en: 'NX Serve Team' };
const DATE = '2026-02-01';

export const GUIDES: Guide[] = [
  {
    slug: 'start-a-towing-business-saudi',
    type: 'howto',
    title: { ar: 'كيف تبدأ مشروع سطحات في السعودية', en: 'How to start a towing business in Saudi Arabia' },
    description: {
      ar: 'دليل عملي لإطلاق خدمة سطحات بعلامتك: المتطلبات، مقدمو الخدمة، التسعير، المدفوعات، والإطلاق.',
      en: 'A practical guide to launching a branded towing service: requirements, providers, pricing, payments and launch.',
    },
    dek: {
      ar: 'ابدأ بخدمة سطحات منظّمة بتسعير واضح وتتبع حيّ وتسوية مالية سليمة خلال أيام.',
      en: 'Start an organised towing service with clear pricing, live tracking and clean settlement in days.',
    },
    author: AUTHOR,
    datePublished: DATE,
    dateModified: DATE,
    blocks: [
      { kind: 'p', text: { ar: 'سوق السطحات في السعودية مجزّأ ويعتمد على المكالمات، ما يفتح فرصة لخدمة منظّمة بعلامة تجارية واضحة.', en: 'Saudi towing is fragmented and call-driven, which opens an opportunity for an organised, clearly branded service.' } },
      { kind: 'h2', text: { ar: 'ما الذي تحتاجه قبل البدء', en: 'What you need before you start' } },
      {
        kind: 'ul',
        items: {
          ar: ['سجل تجاري وتراخيص النقل ذات العلاقة', 'مقدمو خدمة بسطحات مناسبة', 'نموذج تسعير واضح', 'بوابة دفع (ميسر) لتقسيم المستحقات'],
          en: ['A commercial registration and relevant transport licences', 'Providers with suitable trucks', 'A clear pricing model', 'A payment gateway (Moyasar) to split funds'],
        },
      },
      { kind: 'h2', text: { ar: 'خطوات الإطلاق', en: 'Steps to launch' } },
      {
        kind: 'steps',
        items: {
          ar: [
            'اختر قالب السطحات في المنصة وخصّص علامتك ونطاقك.',
            'اضبط الفئات والحقول (نوع المركبة، القبو) والتسعير بالمسافة.',
            'اربط ميسر لتقسيم المدفوعات على المستحقين.',
            'ضمّ مقدمي الخدمة وارفع تراخيصهم واعتمدهم لكل فئة.',
            'افتح الطلبات على الويب وفعّل التتبع الحيّ، وأضف التطبيقات لاحقاً.',
          ],
          en: [
            'Choose the towing template, brand it and set your domain.',
            'Configure categories and fields (vehicle type, basement) and distance pricing.',
            'Connect Moyasar to split payments to recipients.',
            'Onboard providers, upload licences and approve per category.',
            'Open ordering on the web with live tracking, add apps later.',
          ],
        },
      },
      { kind: 'p', text: { ar: 'لا تحتاج إلى فريق برمجي: كل ما سبق يُضبط في لوحة التحكم كبيانات.', en: 'You do not need a development team: all of the above is configured in the console as data.' } },
    ],
    faq: [
      { q: { ar: 'كم رأس المال المطلوب؟', en: 'How much capital is needed?' }, a: { ar: 'يعتمد على عدد السطحات والتغطية. المنصة نفسها تُقلّل تكلفة التقنية إلى اشتراك بدل بناء من الصفر.', en: 'It depends on fleet size and coverage. The platform itself reduces the technology cost to a subscription instead of building from scratch.' } },
      { q: { ar: 'هل يمكن البدء بمقدم خدمة واحد؟', en: 'Can I start with one provider?' }, a: { ar: 'نعم، ابدأ صغيراً ووسّع شبكة مقدمي الخدمة لاحقاً دون تغيير في التقنية.', en: 'Yes, start small and grow your provider network later with no technology change.' } },
    ],
  },
  {
    slug: 'white-label-vs-build-from-scratch',
    type: 'article',
    title: { ar: 'منصة جاهزة بعلامتك مقابل البناء من الصفر', en: 'White-label platform vs building from scratch' },
    description: {
      ar: 'مقارنة بين شراء منصة بعلامتك وبناء تطبيق خدمات من الصفر: التكلفة، الوقت، المخاطر، والصيانة.',
      en: 'Comparing a white-label platform with building a services app from scratch: cost, time, risk and maintenance.',
    },
    dek: { ar: 'متى تبني ومتى تشتري منصة جاهزة؟ الفروق الجوهرية في التكلفة والوقت والمخاطر.', en: 'When to build and when to buy a ready platform: the core differences in cost, time and risk.' },
    author: AUTHOR,
    datePublished: DATE,
    dateModified: DATE,
    blocks: [
      { kind: 'p', text: { ar: 'إطلاق خدمة عند الطلب يتطلب تطبيق عميل، تطبيق مقدم خدمة، لوحات تحكم، مدفوعات، تتبع، وتوزيع. بناء ذلك من الصفر مكلف وبطيء.', en: 'Launching an on-demand service needs a customer app, a provider app, consoles, payments, tracking and dispatch. Building that from scratch is costly and slow.' } },
      { kind: 'h2', text: { ar: 'البناء من الصفر', en: 'Building from scratch' } },
      { kind: 'ul', items: { ar: ['أشهر إلى سنوات من التطوير', 'فريق هندسي ومنتج وتشغيل', 'صيانة وأمان وامتثال مستمر على عاتقك', 'مرونة كاملة، لكن بتكلفة ومخاطر عالية'], en: ['Months to years of development', 'An engineering, product and ops team', 'Ongoing maintenance, security and compliance on you', 'Full flexibility, but at high cost and risk'] } },
      { kind: 'h2', text: { ar: 'منصة جاهزة بعلامتك', en: 'A white-label platform' } },
      { kind: 'ul', items: { ar: ['إطلاق خلال أيام', 'اشتراك بدل فريق كامل', 'تحديثات وأمان وامتثال مُدارة', 'تهيئة بدل برمجة: خدمات وأسعار ومراحل كبيانات'], en: ['Launch in days', 'A subscription instead of a full team', 'Managed updates, security and compliance', 'Configuration over code: services, prices and stages as data'] } },
      { kind: 'h2', text: { ar: 'متى تختار كلاً منهما', en: 'When to choose which' } },
      { kind: 'p', text: { ar: 'اختر البناء إذا كان نموذجك فريداً جداً ولديك فريق تقني كبير. اختر منصة جاهزة إذا كان هدفك الوصول للسوق بسرعة وبتكلفة محسوبة مع تحكم في علامتك وبياناتك.', en: 'Build if your model is highly unique and you have a large technical team. Choose a ready platform to reach the market fast at a measured cost while keeping control of your brand and data.' } },
    ],
    faq: [
      { q: { ar: 'هل أملك بياناتي وعلامتي على منصة جاهزة؟', en: 'Do I own my data and brand on a white-label platform?' }, a: { ar: 'نعم، المنصة متعددة المستأجرين بعزل كامل؛ علامتك ونطاقك وبياناتك لك.', en: 'Yes, the platform is multi-tenant with full isolation; your brand, domain and data are yours.' } },
      { q: { ar: 'هل يمكن تخصيصها لنموذجي؟', en: 'Can it be customised to my model?' }, a: { ar: 'نعم عبر التهيئة: الخدمات والحقول ومراحل العمل والأسعار قابلة للضبط دون كود.', en: 'Yes through configuration: services, fields, workflows and prices are tunable without code.' } },
    ],
  },
  {
    slug: 'launch-your-own-delivery-platform',
    type: 'howto',
    title: { ar: 'كيف تطلق منصة توصيل طلبات خاصة بك', en: 'How to launch your own delivery platform' },
    description: {
      ar: 'خطوات إطلاق منصة توصيل بعلامتك: المناطق، المناديب، التسعير، التتبع، والدفع، دون عمولات تطبيقات عامة.',
      en: 'Steps to launch a branded delivery platform: zones, couriers, pricing, tracking and payment, without generic app commissions.',
    },
    dek: { ar: 'امتلك علاقتك بعملائك وبياناتك بدل الاعتماد على تطبيقات التوصيل العامة.', en: 'Own your customer relationship and data instead of relying on generic delivery apps.' },
    author: AUTHOR,
    datePublished: DATE,
    dateModified: DATE,
    blocks: [
      { kind: 'p', text: { ar: 'التطبيقات العامة تأخذ عمولات مرتفعة وتحجب علاقتك بالعميل. منصة بعلامتك تعيد لك التحكم.', en: 'Generic apps take high commissions and hide your customer relationship. A branded platform gives you control back.' } },
      { kind: 'h2', text: { ar: 'خطوات الإطلاق', en: 'Steps to launch' } },
      {
        kind: 'steps',
        items: {
          ar: ['اختر قالب اللوجستيات وخصّص علامتك.', 'عرّف المناطق ونوافذ التوصيل.', 'اضبط التسعير بالمسافة والذروة.', 'ضمّ المناديب وفعّل التتبع وإثبات التسليم.', 'افتح الطلبات الفورية والمجدولة على الويب.'],
          en: ['Choose the logistics template and brand it.', 'Define zones and delivery windows.', 'Set distance and surge pricing.', 'Onboard couriers, enable tracking and proof of delivery.', 'Open on-demand and scheduled orders on the web.'],
        },
      },
      { kind: 'p', text: { ar: 'كل طلب قائمة محطات، فيناسب التوصيل متعدد النقاط والمهام المجمّعة.', en: 'Every order is a list of stops, so multi-drop delivery and batched tasks are supported.' } },
    ],
    faq: [
      { q: { ar: 'هل يدعم الطلبات المجدولة؟', en: 'Does it support scheduled orders?' }, a: { ar: 'نعم، فوري ومجدول بنوافذ زمنية قابلة للضبط.', en: 'Yes, on-demand and scheduled with configurable time windows.' } },
      { q: { ar: 'كيف يُدفع للمناديب؟', en: 'How are couriers paid?' }, a: { ar: 'عبر المدفوعات المقسّمة من ميسر مباشرة عند التحصيل.', en: 'Through Moyasar split payments directly on capture.' } },
    ],
  },
  {
    slug: 'how-split-payments-work',
    type: 'article',
    title: { ar: 'كيف تعمل المدفوعات المقسّمة مع ميسر', en: 'How split payments work with Moyasar' },
    description: {
      ar: 'شرح المدفوعات المقسّمة ولماذا تمنع الحاجة لترخيص المحافظ، وكيف تستخدمها NX Serve.',
      en: 'How split payments work, why they avoid needing a wallet licence, and how NX Serve uses them.',
    },
    dek: { ar: 'تدفّق الأموال لكل مستحق مباشرة دون أن تحتجز المنصة أموال الغير.', en: 'Money flows to each recipient directly, with the platform never holding third-party funds.' },
    author: AUTHOR,
    datePublished: DATE,
    dateModified: DATE,
    blocks: [
      { kind: 'h2', text: { ar: 'ما هي المدفوعات المقسّمة', en: 'What are split payments' } },
      { kind: 'p', text: { ar: 'عند الدفع، يُقسّم المبلغ تلقائياً بين المستحقين (مقدم الخدمة، المنصة، المستأجر) ويصل كل جزء مباشرة لصاحبه عبر ميسر.', en: 'On payment, the amount is split automatically between recipients (provider, platform, tenant) and each share reaches its owner directly through Moyasar.' } },
      { kind: 'h2', text: { ar: 'لماذا هذا مهم', en: 'Why it matters' } },
      { kind: 'p', text: { ar: 'الاحتفاظ بأموال الغير في محفظة يتطلب ترخيصاً من البنك المركزي. المدفوعات المقسّمة تتجنّب ذلك لأن المنصة لا تحتجز الأموال إطلاقاً.', en: 'Holding third-party funds in a wallet requires a central bank licence. Split payments avoid this because the platform never holds funds.' } },
      { kind: 'h2', text: { ar: 'كيف تستخدمها NX Serve', en: 'How NX Serve uses them' } },
      { kind: 'ul', items: { ar: ['تفويض المبلغ عند إسناد الطلب', 'تحصيل عند مرحلة الإكمال مع تقسيم متوازن', 'استرداد ورسوم إلغاء عبر تحصيل جزئي', 'بيانات البطاقة لا تمسّ خوادمنا'], en: ['Authorize on assignment', 'Capture at completion with a balanced split', 'Refunds and cancellation fees via partial capture', 'Card data never touches our servers'] } },
    ],
    faq: [
      { q: { ar: 'هل تحتفظون بأرصدة العملاء؟', en: 'Do you hold customer balances?' }, a: { ar: 'لا، لا محافظ ولا أرصدة محتجزة على الإطلاق.', en: 'No, there are no wallets or held balances at all.' } },
      { q: { ar: 'هل يجب أن تتوازن التقسيمات؟', en: 'Must splits balance?' }, a: { ar: 'نعم، مجموع التقسيمات يساوي المبلغ تماماً، ومُختبر بخصائص رياضية.', en: 'Yes, splits always sum exactly to the amount, verified with property-based tests.' } },
    ],
  },
  {
    slug: 'how-to-price-on-demand-services',
    type: 'article',
    title: { ar: 'كيف تسعّر خدماتك عند الطلب', en: 'How to price on-demand services' },
    description: {
      ar: 'أساسيات تسعير الخدمات عند الطلب: التكلفة مقابل السوق، المسافة والمناطق، والتسعير بالذروة.',
      en: 'The basics of pricing on-demand services: cost vs market, distance and zones, and surge pricing.',
    },
    dek: { ar: 'سعّر بوضوح وشفافية مع تقدير مسبق للعميل يبني الثقة.', en: 'Price clearly and transparently with an upfront estimate that builds trust.' },
    author: AUTHOR,
    datePublished: DATE,
    dateModified: DATE,
    blocks: [
      { kind: 'h2', text: { ar: 'التكلفة مقابل السوق', en: 'Cost vs market' } },
      { kind: 'p', text: { ar: 'ابدأ من تكلفتك الفعلية ثم عايرها بأسعار السوق والقيمة المقدّمة، لا بالتكلفة وحدها.', en: 'Start from your real cost, then calibrate against market rates and the value delivered, not cost alone.' } },
      { kind: 'h2', text: { ar: 'المسافة والمناطق', en: 'Distance and zones' } },
      { kind: 'p', text: { ar: 'استخدم المسافة والزمن المطريقين لا الخط المستقيم، وفعّل أسعاراً مختلفة للمناطق حسب الطلب والتكلفة.', en: 'Use routed distance and time, not straight-line, and set different zone prices by demand and cost.' } },
      { kind: 'h2', text: { ar: 'التسعير بالذروة', en: 'Surge pricing' } },
      { kind: 'p', text: { ar: 'ارفع الأسعار بذكاء وقت الضغط لموازنة العرض والطلب، مع إبقائها شفافة ومعلنة للعميل.', en: 'Raise prices smartly at peak to balance supply and demand, while keeping them transparent to the customer.' } },
      { kind: 'ul', items: { ar: ['أظهر التقدير قبل التأكيد', 'اجعل الرسوم متطابقة بين وسائل الدفع', 'راجع الأسعار دورياً بالبيانات'], en: ['Show the estimate before confirmation', 'Keep fees identical across payment methods', 'Review prices regularly with data'] } },
    ],
    faq: [
      { q: { ar: 'هل أستطيع تغيير الأسعار دون إصدار تطبيق؟', en: 'Can I change prices without an app release?' }, a: { ar: 'نعم، بطاقات الأسعار بيانات تُحرَّر في اللوحة وتسري فوراً.', en: 'Yes, rate cards are data edited in the console and take effect immediately.' } },
      { q: { ar: 'هل يُسمح بإضافة رسوم على البطاقة؟', en: 'Is card surcharging allowed?' }, a: { ar: 'لا، الرسوم التي يتحملها العميل متطابقة بين وسائل الدفع.', en: 'No, customer-borne fees are identical across payment methods.' } },
    ],
  },
];

export function findGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
