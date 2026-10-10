import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { SITE, isLocale, type Locale } from '../../../lib/i18n';
import { buildMetadata } from '../../../lib/seo';
import { Container } from '../../../components/site';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ar = locale === 'ar';
  return buildMetadata({
    locale,
    path: '/privacy',
    title: ar ? 'سياسة الخصوصية | NX Serve' : 'Privacy policy | NX Serve',
    description: ar
      ? 'كيف نجمع بياناتك ونستخدمها ونحميها وفق نظام حماية البيانات الشخصية في السعودية.'
      : 'How we collect, use and protect your data in line with Saudi PDPL.',
  });
}

interface Clause {
  h: string;
  p: string;
}

const CONTENT: Record<Locale, { title: string; updated: string; intro: string; clauses: Clause[] }> = {
  ar: {
    title: 'سياسة الخصوصية',
    updated: 'آخر تحديث: 1 فبراير 2026',
    intro:
      'تصف هذه السياسة كيف تجمع NX Serve (منتج من NX Solutions) بياناتك الشخصية وتستخدمها وتحميها، وفق نظام حماية البيانات الشخصية في المملكة العربية السعودية.',
    clauses: [
      { h: 'البيانات التي نجمعها', p: 'بيانات تقدّمها عند طلب عرض توضيحي (الاسم، الشركة، البريد، الجوال، رسالتك)، وبيانات استخدام مجهّلة عبر التحليلات بعد موافقتك فقط.' },
      { h: 'لماذا نجمعها', p: 'للتواصل معك بخصوص طلبك، ولتحسين الموقع والخدمة. لا نبيع بياناتك ولا نشاركها لأغراض غير ذلك.' },
      { h: 'ملفات الارتباط والموافقة', p: 'نستخدم ملفات أساسية لتشغيل الموقع، وملفات تحليلات اختيارية لا تُفعّل إلا بعد موافقتك الصريحة، ويمكنك سحب الموافقة بمسح بيانات المتصفح.' },
      { h: 'الاحتفاظ', p: 'نحتفظ ببيانات التواصل للمدة اللازمة للرد على طلبك وإدارة علاقتنا، ثم نحذفها أو نجعلها مجهّلة.' },
      { h: 'حقوقك', p: 'لك حق الوصول إلى بياناتك وتصحيحها وحذفها والاعتراض على معالجتها. للممارسة، راسلنا.' },
      { h: 'التواصل', p: `لأي استفسار عن الخصوصية: ${SITE.email}.` },
    ],
  },
  en: {
    title: 'Privacy policy',
    updated: 'Last updated: 1 February 2026',
    intro:
      'This policy describes how NX Serve (a product of NX Solutions) collects, uses and protects your personal data, in line with the Personal Data Protection Law (PDPL) of Saudi Arabia.',
    clauses: [
      { h: 'Data we collect', p: 'Data you provide when booking a demo (name, company, email, phone, your message), and anonymised usage data through analytics only after you consent.' },
      { h: 'Why we collect it', p: 'To contact you about your request and to improve the site and service. We do not sell your data or share it for unrelated purposes.' },
      { h: 'Cookies and consent', p: 'We use essential cookies to run the site, and optional analytics cookies that load only after your explicit consent; you can withdraw consent by clearing your browser data.' },
      { h: 'Retention', p: 'We keep contact data for as long as needed to respond to your request and manage our relationship, then delete or anonymise it.' },
      { h: 'Your rights', p: 'You have the right to access, correct and delete your data and to object to its processing. To exercise these, contact us.' },
      { h: 'Contact', p: `For any privacy question: ${SITE.email}.` },
    ],
  },
};

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }): Promise<ReactNode> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = CONTENT[locale];
  return (
    <section style={{ padding: '56px 0' }}>
      <Container style={{ maxWidth: 760 }}>
        <h1 style={{ fontSize: 34, margin: '0 0 8px' }}>{c.title}</h1>
        <div style={{ fontSize: 13, color: 'var(--nx-color-muted-foreground)', marginBottom: 24 }}>{c.updated}</div>
        <p style={{ fontSize: 16, lineHeight: 1.7, margin: '0 0 24px' }}>{c.intro}</p>
        {c.clauses.map((clause) => (
          <div key={clause.h} style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 19, margin: '0 0 6px' }}>{clause.h}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--nx-color-muted-foreground)', margin: 0 }}>{clause.p}</p>
          </div>
        ))}
      </Container>
    </section>
  );
}
