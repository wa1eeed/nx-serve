'use client';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { track } from '../lib/analytics';
import type { Locale } from '../lib/i18n';
import { Container } from './site';
import { SectionHeading } from './sections';

const T = {
  ar: {
    title: 'قدّر إيرادك الشهري',
    intro: 'حرّك المدخلات لترى تقديراً لإجمالي المبيعات وإيرادك من عمولتك. أرقام تقريبية لأغراض التوضيح.',
    ordersPerDay: 'عدد الطلبات يومياً',
    avgOrderValue: 'متوسط قيمة الطلب',
    takeRate: 'نسبة عمولتك',
    gmvMonthly: 'إجمالي المبيعات الشهرية',
    revenueMonthly: 'إيرادك الشهري',
    revenueAnnual: 'إيرادك السنوي',
    disclaimer: 'هذه الأرقام تقديرية ولا تمثل التزاماً أو ضماناً.',
    cta: 'اطلب عرضاً توضيحياً',
    perMonthOrders: 'طلب شهرياً',
  },
  en: {
    title: 'Estimate your monthly revenue',
    intro: 'Move the inputs to see an estimate of total sales and your revenue from your fee. Figures are approximate, for illustration.',
    ordersPerDay: 'Orders per day',
    avgOrderValue: 'Average order value',
    takeRate: 'Your fee',
    gmvMonthly: 'Monthly sales (GMV)',
    revenueMonthly: 'Your monthly revenue',
    revenueAnnual: 'Your annual revenue',
    disclaimer: 'These figures are estimates and are not a commitment or guarantee.',
    cta: 'Book a demo',
    perMonthOrders: 'orders per month',
  },
} as const;

const card = {
  border: '1px solid var(--nx-color-border)',
  borderRadius: 'var(--nx-radius-lg)',
  background: 'var(--nx-color-card)',
  padding: 22,
} as const;

/** The calculator wrapped as a page section with its heading. */
export function CalculatorSection({ locale }: { locale: Locale }): ReactNode {
  const t = T[locale];
  return (
    <section style={{ padding: '32px 0' }}>
      <Container>
        <SectionHeading title={t.title} intro={t.intro} />
        <RevenueCalculator locale={locale} />
      </Container>
    </section>
  );
}

export function RevenueCalculator({ locale }: { locale: Locale }): ReactNode {
  const t = T[locale];
  const [ordersPerDay, setOrdersPerDay] = useState(20);
  const [avgOrderValue, setAvgOrderValue] = useState(150);
  const [takeRate, setTakeRate] = useState(15);
  const tracked = useRef(false);

  const money = useMemo(
    () => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }),
    [locale],
  );
  const number = useMemo(() => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US'), [locale]);

  const ordersPerMonth = ordersPerDay * 30;
  const gmvMonthly = ordersPerMonth * avgOrderValue;
  const revenueMonthly = Math.round((gmvMonthly * takeRate) / 100);
  const revenueAnnual = revenueMonthly * 12;

  const onInteract = (): void => {
    if (!tracked.current) {
      tracked.current = true;
      track('calculator_used');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, alignItems: 'start' }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Slider
          label={t.ordersPerDay}
          value={ordersPerDay}
          display={`${number.format(ordersPerDay)} · ${number.format(ordersPerMonth)} ${t.perMonthOrders}`}
          min={1}
          max={500}
          step={1}
          onChange={(v) => {
            setOrdersPerDay(v);
            onInteract();
          }}
        />
        <Slider
          label={t.avgOrderValue}
          value={avgOrderValue}
          display={money.format(avgOrderValue)}
          min={20}
          max={2000}
          step={10}
          onChange={(v) => {
            setAvgOrderValue(v);
            onInteract();
          }}
        />
        <Slider
          label={t.takeRate}
          value={takeRate}
          display={`${number.format(takeRate)}%`}
          min={1}
          max={30}
          step={1}
          onChange={(v) => {
            setTakeRate(v);
            onInteract();
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Result label={t.gmvMonthly} value={money.format(gmvMonthly)} />
        <Result label={t.revenueMonthly} value={money.format(revenueMonthly)} emphasis />
        <Result label={t.revenueAnnual} value={money.format(revenueAnnual)} />
        <p style={{ fontSize: 12, color: 'var(--nx-color-muted-foreground)', margin: 0 }}>{t.disclaimer}</p>
        <Link
          href={`/${locale}/demo`}
          style={{
            display: 'inline-block',
            width: 'fit-content',
            padding: '11px 20px',
            borderRadius: 'var(--nx-radius-md)',
            fontWeight: 600,
            textDecoration: 'none',
            background: 'var(--nx-color-primary)',
            color: 'var(--nx-color-primary-foreground)',
          }}
        >
          {t.cta}
        </Link>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}): ReactNode {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--nx-color-primary)' }}
      />
    </label>
  );
}

function Result({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }): ReactNode {
  return (
    <div
      style={{
        ...card,
        padding: 18,
        borderColor: emphasis ? 'var(--nx-color-primary)' : 'var(--nx-color-border)',
        borderWidth: emphasis ? 2 : 1,
      }}
    >
      <div style={{ fontSize: 14, color: 'var(--nx-color-muted-foreground)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: emphasis ? 34 : 26, fontWeight: 800, color: emphasis ? 'var(--nx-color-primary)' : 'var(--nx-color-foreground)' }}>
        {value}
      </div>
    </div>
  );
}
