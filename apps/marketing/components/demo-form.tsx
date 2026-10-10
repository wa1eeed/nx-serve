'use client';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { SITE, type Locale } from '../lib/i18n';

const T = {
  ar: {
    name: 'الاسم',
    company: 'الشركة',
    email: 'البريد الإلكتروني',
    phone: 'رقم الجوال',
    interest: 'الخدمة التي تهمك',
    message: 'رسالتك (اختياري)',
    consent: 'أوافق على أن تتواصل معي NX Serve بخصوص طلبي.',
    submit: 'أرسل الطلب',
    sending: 'جارٍ الإرسال...',
    success: 'شكراً لك! استلمنا طلبك وسنتواصل معك قريباً.',
    error: `تعذّر الإرسال. حاول مرة أخرى أو راسلنا على ${SITE.email}.`,
    required: 'يرجى تعبئة الاسم والبريد والموافقة على التواصل.',
    optTowing: 'السطحات',
    optLogistics: 'اللوجستيات والتوصيل',
    optOther: 'خدمة أخرى',
  },
  en: {
    name: 'Name',
    company: 'Company',
    email: 'Email',
    phone: 'Phone',
    interest: 'Service you are interested in',
    message: 'Your message (optional)',
    consent: 'I agree that NX Serve may contact me about my request.',
    submit: 'Send request',
    sending: 'Sending...',
    success: 'Thank you. We received your request and will be in touch soon.',
    error: `Could not send. Please try again or email ${SITE.email}.`,
    required: 'Please fill in your name and email and agree to be contacted.',
    optTowing: 'Towing',
    optLogistics: 'Logistics and delivery',
    optOther: 'Another service',
  },
} as const;

const control: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 'var(--nx-radius-md)',
  border: '1px solid var(--nx-color-border)',
  background: 'var(--nx-color-card)',
  color: 'var(--nx-color-foreground)',
  font: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

type Status = 'idle' | 'sending' | 'success' | 'error' | 'invalid';

export function DemoForm({ locale }: { locale: Locale }): ReactNode {
  const t = T[locale];
  const [status, setStatus] = useState<Status>('idle');
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', interest: 'towing', message: '' });
  const [consent, setConsent] = useState(false);

  const set = (key: keyof typeof form, value: string): void => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (): Promise<void> => {
    if (!form.name.trim() || !form.email.trim() || !consent) {
      setStatus('invalid');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, locale }),
      });
      setStatus(res.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div
        role="status"
        style={{ ...control, width: 'auto', padding: 20, borderColor: 'var(--nx-color-primary)', fontSize: 16 }}
      >
        {t.success}
      </div>
    );
  }

  const label = (text: string): ReactNode => <span style={{ fontSize: 14 }}>{text}</span>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {label(t.name)}
        <input style={control} value={form.name} onChange={(e) => set('name', e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {label(t.company)}
        <input style={control} value={form.company} onChange={(e) => set('company', e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {label(t.email)}
        <input style={control} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {label(t.phone)}
        <input style={control} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {label(t.interest)}
        <select style={control} value={form.interest} onChange={(e) => set('interest', e.target.value)}>
          <option value="towing">{t.optTowing}</option>
          <option value="logistics">{t.optLogistics}</option>
          <option value="other">{t.optOther}</option>
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {label(t.message)}
        <textarea style={{ ...control, resize: 'vertical' }} rows={3} value={form.message} onChange={(e) => set('message', e.target.value)} />
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span>{t.consent}</span>
      </label>

      {status === 'invalid' ? <span style={{ color: 'var(--nx-color-destructive)', fontSize: 14 }}>{t.required}</span> : null}
      {status === 'error' ? <span style={{ color: 'var(--nx-color-destructive)', fontSize: 14 }}>{t.error}</span> : null}

      <button
        type="submit"
        disabled={status === 'sending'}
        style={{
          ...control,
          width: 'fit-content',
          cursor: 'pointer',
          fontWeight: 600,
          background: 'var(--nx-color-primary)',
          color: 'var(--nx-color-primary-foreground)',
          border: 'none',
          opacity: status === 'sending' ? 0.6 : 1,
        }}
      >
        {status === 'sending' ? t.sending : t.submit}
      </button>
    </form>
  );
}
