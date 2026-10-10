import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, SITE, type Locale } from '../../../lib/i18n';
import { buildMetadata, faqLd, plansLd } from '../../../lib/seo';
import type { Faq } from '../../../lib/content';
import { CtaBand, FaqList, PricingCards, SectionHeading } from '../../../components/sections';
import { CalculatorSection } from '../../../components/revenue-calculator';
import { Container } from '../../../components/site';
import { JsonLd } from '../../../components/jsonld';

const PRICING_FAQ: Faq[] = [
  {
    q: { ar: 'كيف تُحتسب العمولة؟', en: 'How is the fee calculated?' },
    a: {
      ar: 'تضبط رسومك لكل خدمة في اللوحة، وتُحصَّل عبر المدفوعات المقسّمة من ميسر. الرسوم التي يتحملها العميل متطابقة بين وسائل الدفع.',
      en: 'You set your fees per service in the console, collected via Moyasar split payments. Customer-borne fees are identical across payment methods.',
    },
  },
  {
    q: { ar: 'متى تتوفر التطبيقات بعلامتي؟', en: 'When are branded apps available?' },
    a: {
      ar: 'التطبيقات المتجرية بعلامتك ضمن الخطة المتقدمة. تعمل كل الخطط على الويب من اليوم الأول.',
      en: 'Branded store apps are an Advanced plan feature. Every plan runs on the web from day one.',
    },
  },
  {
    q: { ar: 'هل هناك عقد طويل؟', en: 'Is there a long contract?' },
    a: {
      ar: 'نبدأ بعرض توضيحي ونتفق على ما يناسب حجمك. تواصل معنا لمناقشة التفاصيل.',
      en: 'We start with a demo and agree on what fits your scale. Contact us to discuss the details.',
    },
  },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ar = locale === 'ar';
  return buildMetadata({
    locale,
    path: '/pricing',
    title: ar ? 'الأسعار | NX Serve' : 'Pricing | NX Serve',
    description: ar
      ? 'خطط أساسية ونمو ومتقدمة ومؤسسات. كل الخطط تعمل على الويب، والتطبيقات بعلامتك في المتقدمة.'
      : 'Basic, Growth, Advanced and Enterprise plans. Every plan runs on the web; branded apps on Advanced.',
  });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }): Promise<ReactNode> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l: Locale = locale;
  return (
    <>
      <JsonLd data={[plansLd(l), faqLd(PRICING_FAQ, l)]} />
      <section style={{ padding: '48px 0 16px' }}>
        <Container>
          <SectionHeading
            title={l === 'ar' ? 'الأسعار' : 'Pricing'}
            intro={
              l === 'ar'
                ? 'ابدأ على الويب، وترقّ إلى التطبيقات بعلامتك عند النمو. تواصل معنا لعرض توضيحي.'
                : 'Start on the web, upgrade to branded apps as you grow. Contact us for a demo.'
            }
          />
          <PricingCards locale={l} />
          <p style={{ marginTop: 20, fontSize: 14, color: 'var(--nx-color-muted-foreground)' }}>
            {l === 'ar' ? 'للتسعير التفصيلي والعروض: ' : 'For detailed pricing and quotes: '}
            <a href={`mailto:${SITE.email}`} style={{ color: 'var(--nx-color-primary)' }}>
              {SITE.email}
            </a>
          </p>
        </Container>
      </section>
      <CalculatorSection locale={l} />
      <FaqList faqs={PRICING_FAQ} locale={l} heading={l === 'ar' ? 'أسئلة الفوترة' : 'Billing questions'} />
      <CtaBand locale={l} />
    </>
  );
}
