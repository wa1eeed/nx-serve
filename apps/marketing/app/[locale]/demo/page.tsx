import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '../../../lib/i18n';
import { buildMetadata } from '../../../lib/seo';
import { SectionHeading } from '../../../components/sections';
import { Container } from '../../../components/site';
import { DemoForm } from '../../../components/demo-form';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ar = locale === 'ar';
  return buildMetadata({
    locale,
    path: '/demo',
    title: ar ? 'اطلب عرضاً توضيحياً | NX Serve' : 'Book a demo | NX Serve',
    description: ar
      ? 'احجز عرضاً توضيحياً ونريك كيف تطلق منصة خدماتك بعلامتك الخاصة في أيام.'
      : 'Book a demo and see how to launch your branded services platform in days.',
  });
}

export default async function DemoPage({ params }: { params: Promise<{ locale: string }> }): Promise<ReactNode> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l: Locale = locale;
  const ar = l === 'ar';
  return (
    <section style={{ padding: '48px 0' }}>
      <Container style={{ maxWidth: 720 }}>
        <SectionHeading
          title={ar ? 'اطلب عرضاً توضيحياً' : 'Book a demo'}
          intro={
            ar
              ? 'أخبرنا عن خدمتك ونريك المنصة وكيف تطلقها بعلامتك خلال أيام.'
              : 'Tell us about your service and we will show you the platform and how to launch it under your brand in days.'
          }
        />
        <DemoForm locale={l} />
        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--nx-color-muted-foreground)' }}>
          {ar
            ? 'نستخدم بياناتك للتواصل معك بخصوص طلبك فقط، وفق نظام حماية البيانات الشخصية.'
            : 'We use your details only to contact you about your request, in line with PDPL.'}
        </p>
      </Container>
    </section>
  );
}
