'use client';
import { createContext, useContext } from 'react';

export type Locale = 'ar' | 'en';

export const LOCALES: Locale[] = ['en', 'ar'];
export const DEFAULT_LOCALE: Locale = 'ar';

/**
 * Console UI strings. Source is English; Arabic is authored at parity (CLAUDE.md 2.8).
 * Tenant authored content (service names, field labels) is never here: it comes from
 * the API as translatable JSON and is resolved per locale by the form schema builder.
 */
type Dict = Record<string, { en: string; ar: string }>;

export const MESSAGES: Dict = {
  'app.title': { en: 'NX Serve Console', ar: 'لوحة تحكم NX Serve' },
  'app.subtitle': {
    en: 'Tenant admin and provider portal: branding, services, pricing, providers, settings.',
    ar: 'إدارة المستأجر وبوابة مزودي الخدمة: الهوية والخدمات والتسعير والمزودون والإعدادات.',
  },
  'nav.dashboard': { en: 'Dashboard', ar: 'الرئيسية' },
  'nav.catalog': { en: 'Service catalog', ar: 'دليل الخدمات' },
  'nav.verticals': { en: 'Verticals', ar: 'القطاعات' },
  'nav.settings': { en: 'Settings', ar: 'الإعدادات' },
  'nav.providers': { en: 'Providers', ar: 'المزودون' },
  'nav.pricing': { en: 'Pricing', ar: 'التسعير' },
  'common.loading': { en: 'Loading...', ar: 'جارٍ التحميل...' },
  'common.retry': { en: 'Retry', ar: 'إعادة المحاولة' },
  'common.empty': { en: 'Nothing here yet.', ar: 'لا يوجد شيء هنا بعد.' },
  'common.language': { en: 'العربية', ar: 'English' },
  'common.code': { en: 'Code', ar: 'الرمز' },
  'common.name': { en: 'Name', ar: 'الاسم' },
  'common.status': { en: 'Status', ar: 'الحالة' },
  'common.actions': { en: 'Actions', ar: 'إجراءات' },
  'error.api': {
    en: 'Could not reach the API. Start apps/api and set NEXT_PUBLIC_API_URL.',
    ar: 'تعذر الوصول إلى الـ API. شغّل apps/api واضبط NEXT_PUBLIC_API_URL.',
  },
  'error.auth': {
    en: 'Sign in required. This screen reads live tenant data once authenticated.',
    ar: 'يلزم تسجيل الدخول. تعرض هذه الشاشة بيانات المستأجر الحيّة بعد المصادقة.',
  },
  'verticals.title': { en: 'Service verticals', ar: 'قطاعات الخدمة' },
  'verticals.intro': {
    en: 'Verticals, categories, fields and workflows are data, edited here, with no release.',
    ar: 'القطاعات والفئات والحقول ومسارات العمل بيانات تُحرَّر هنا دون إصدار تطبيق.',
  },
  'verticals.preview': { en: 'Preview order form', ar: 'معاينة نموذج الطلب' },
  'form.title': { en: 'Order form preview', ar: 'معاينة نموذج الطلب' },
  'form.intro': {
    en: 'This is exactly what customers see. It is built from the server form schema.',
    ar: 'هذا ما يراه العملاء تماماً. يُبنى من مخطط النموذج القادم من الخادم.',
  },
  'form.sample': { en: 'Showing a bundled sample (API unreachable).', ar: 'عرض عينة مضمّنة (تعذّر الوصول إلى الـ API).' },
  'form.submit': { en: 'Request service', ar: 'اطلب الخدمة' },
  'settings.title': { en: 'Settings', ar: 'الإعدادات' },
  'settings.intro': {
    en: 'Settings resolve platform > plan > tenant, with locks and bounds from upper levels.',
    ar: 'تُحسم الإعدادات منصة > خطة > مستأجر، مع أقفال وحدود من المستويات الأعلى.',
  },
};

export function translate(locale: Locale, key: string): string {
  const entry = MESSAGES[key];
  if (!entry) return key;
  return entry[locale];
}

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): (key: string) => string {
  const locale = useLocale();
  return (key: string) => translate(locale, key);
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
