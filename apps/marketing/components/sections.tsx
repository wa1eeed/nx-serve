import type { ReactNode } from 'react';
import { CTA, FEATURES, HERO, PLANS, STEPS, TRUST, USE_CASES, type Faq } from '../lib/content';
import { pick, type Locale } from '../lib/i18n';
import { Btn, Container } from './site';
import Link from 'next/link';

const card = {
  border: '1px solid var(--nx-color-border)',
  borderRadius: 'var(--nx-radius-lg)',
  background: 'var(--nx-color-card)',
  padding: 22,
} as const;

export function Hero({ locale }: { locale: Locale }): ReactNode {
  return (
    <section style={{ padding: '72px 0 40px' }}>
      <Container>
        <span
          style={{
            display: 'inline-block',
            padding: '5px 12px',
            borderRadius: 'var(--nx-radius-md)',
            background: 'var(--nx-color-accent)',
            color: 'var(--nx-color-accent-foreground)',
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {pick(HERO.badge, locale)}
        </span>
        <h1 style={{ fontSize: 46, lineHeight: 1.12, margin: '0 0 18px', maxWidth: 760 }}>{pick(HERO.title, locale)}</h1>
        <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--nx-color-muted-foreground)', maxWidth: 680, margin: '0 0 28px' }}>
          {pick(HERO.subtitle, locale)}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Btn href={`/${locale}/demo`}>{pick(HERO.ctaPrimary, locale)}</Btn>
          <Btn href={`/${locale}/use-cases`} variant="ghost">
            {pick(HERO.ctaSecondary, locale)}
          </Btn>
        </div>
      </Container>
    </section>
  );
}

export function TrustBar({ locale }: { locale: Locale }): ReactNode {
  return (
    <Container>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 0 32px' }}>
        {pick(TRUST, locale).map((t) => (
          <span
            key={t}
            style={{
              fontSize: 13,
              color: 'var(--nx-color-muted-foreground)',
              border: '1px solid var(--nx-color-border)',
              borderRadius: 'var(--nx-radius-md)',
              padding: '6px 12px',
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </Container>
  );
}

export function SectionHeading({ title, intro }: { title: string; intro?: string }): ReactNode {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 30, margin: '0 0 8px' }}>{title}</h2>
      {intro ? <p style={{ color: 'var(--nx-color-muted-foreground)', margin: 0, maxWidth: 640 }}>{intro}</p> : null}
    </div>
  );
}

export function FeatureGrid({ locale }: { locale: Locale }): ReactNode {
  return (
    <section style={{ padding: '32px 0' }}>
      <Container>
        <SectionHeading
          title={locale === 'ar' ? 'كل ما تحتاجه لتشغيل خدمة عند الطلب' : 'Everything to run an on-demand service'}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={pick(f.title, 'en')} style={card}>
              <h3 style={{ fontSize: 17, margin: '0 0 8px' }}>{pick(f.title, locale)}</h3>
              <p style={{ fontSize: 14, color: 'var(--nx-color-muted-foreground)', margin: 0, lineHeight: 1.6 }}>{pick(f.body, locale)}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function Steps({ locale }: { locale: Locale }): ReactNode {
  return (
    <section style={{ padding: '32px 0' }}>
      <Container>
        <SectionHeading title={locale === 'ar' ? 'كيف يعمل' : 'How it works'} />
        <ol style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, listStyle: 'none', padding: 0, margin: 0 }}>
          {STEPS.map((s, i) => (
            <li key={pick(s.title, 'en')} style={card}>
              <div style={{ fontSize: 13, color: 'var(--nx-color-primary)', fontWeight: 700, marginBottom: 6 }}>{i + 1}</div>
              <h3 style={{ fontSize: 16, margin: '0 0 6px' }}>{pick(s.title, locale)}</h3>
              <p style={{ fontSize: 14, color: 'var(--nx-color-muted-foreground)', margin: 0 }}>{pick(s.body, locale)}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

export function PricingCards({ locale }: { locale: Locale }): ReactNode {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
      {PLANS.map((p) => (
        <div
          key={p.code}
          style={{
            ...card,
            borderColor: p.highlighted ? 'var(--nx-color-primary)' : 'var(--nx-color-border)',
            borderWidth: p.highlighted ? 2 : 1,
          }}
        >
          <h3 style={{ fontSize: 18, margin: '0 0 4px' }}>{pick(p.name, locale)}</h3>
          <div style={{ fontSize: 13, color: 'var(--nx-color-primary)', marginBottom: 10 }}>{pick(p.priceTeaser, locale)}</div>
          <p style={{ fontSize: 14, color: 'var(--nx-color-muted-foreground)', margin: '0 0 12px', lineHeight: 1.6 }}>{pick(p.blurb, locale)}</p>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pick(p.features, locale).map((feat) => (
              <li key={feat} style={{ fontSize: 14 }}>
                <span style={{ color: 'var(--nx-color-primary)', marginInlineEnd: 6 }}>✓</span>
                {feat}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** AEO friendly FAQ: a question heading with a direct answer immediately below (docs/22 section 5). */
export function FaqList({ faqs, locale, heading }: { faqs: Faq[]; locale: Locale; heading?: string }): ReactNode {
  return (
    <section style={{ padding: '32px 0' }}>
      <Container>
        <SectionHeading title={heading ?? (locale === 'ar' ? 'أسئلة شائعة' : 'Frequently asked questions')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
          {faqs.map((f) => (
            <div key={pick(f.q, 'en')}>
              <h3 style={{ fontSize: 17, margin: '0 0 6px' }}>{pick(f.q, locale)}</h3>
              <p style={{ fontSize: 15, color: 'var(--nx-color-muted-foreground)', margin: 0, lineHeight: 1.65 }}>{pick(f.a, locale)}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function UseCaseTeaser({ locale }: { locale: Locale }): ReactNode {
  return (
    <section style={{ padding: '32px 0' }}>
      <Container>
        <SectionHeading
          title={locale === 'ar' ? 'قالب لكل خدمة' : 'A template for every service'}
          intro={locale === 'ar' ? 'ابدأ من قالب جاهز ثم خصّصه بالكامل.' : 'Start from a ready template, then configure it fully.'}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {USE_CASES.map((u) => (
            <Link key={u.slug} href={`/${locale}/use-cases/${u.slug}`} style={{ ...card, textDecoration: 'none', color: 'var(--nx-color-foreground)', display: 'block' }}>
              <h3 style={{ fontSize: 18, margin: '0 0 6px' }}>{pick(u.name, locale)}</h3>
              <p style={{ fontSize: 14, color: 'var(--nx-color-muted-foreground)', margin: 0 }}>{pick(u.tagline, locale)}</p>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function CtaBand({ locale }: { locale: Locale }): ReactNode {
  return (
    <section style={{ padding: '48px 0' }}>
      <Container>
        <div style={{ ...card, padding: 36, textAlign: 'center' }}>
          <h2 style={{ fontSize: 26, margin: '0 0 8px' }}>{pick(CTA.title, locale)}</h2>
          <p style={{ color: 'var(--nx-color-muted-foreground)', margin: '0 auto 20px', maxWidth: 520 }}>{pick(CTA.body, locale)}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn href={`/${locale}/demo`}>{pick(CTA.primary, locale)}</Btn>
            <Btn href={`/${locale}/use-cases`} variant="ghost">
              {pick(CTA.secondary, locale)}
            </Btn>
          </div>
        </div>
      </Container>
    </section>
  );
}
