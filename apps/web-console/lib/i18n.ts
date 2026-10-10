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
  // --- Write screens (create, edit, install) ---
  'action.new_vertical': { en: 'New vertical', ar: 'قطاع جديد' },
  'action.install_towing': { en: 'Install towing template', ar: 'تثبيت قالب السطحة' },
  'action.add_field': { en: 'Add field', ar: 'إضافة حقل' },
  'action.add_category': { en: 'Add category', ar: 'إضافة فئة' },
  'action.save': { en: 'Save', ar: 'حفظ' },
  'action.saving': { en: 'Saving...', ar: 'جارٍ الحفظ...' },
  'action.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'action.installing': { en: 'Installing...', ar: 'جارٍ التثبيت...' },
  'action.saved': { en: 'Saved.', ar: 'تم الحفظ.' },
  'field.code': { en: 'Code (snake_case)', ar: 'الرمز (snake_case)' },
  'field.name_en': { en: 'Name (English)', ar: 'الاسم (إنجليزي)' },
  'field.name_ar': { en: 'Name (Arabic)', ar: 'الاسم (عربي)' },
  'field.label_en': { en: 'Label (English)', ar: 'التسمية (إنجليزي)' },
  'field.label_ar': { en: 'Label (Arabic)', ar: 'التسمية (عربي)' },
  'field.fulfillment': { en: 'Fulfillment mode', ar: 'نمط التنفيذ' },
  'field.tracking': { en: 'Tracking', ar: 'التتبع' },
  'field.key': { en: 'Key (snake_case)', ar: 'المفتاح (snake_case)' },
  'field.data_type': { en: 'Field type', ar: 'نوع الحقل' },
  'field.required': { en: 'Required', ar: 'إلزامي' },
  'field.scope': { en: 'Scope', ar: 'النطاق' },
  'field.sort_order': { en: 'Sort order', ar: 'ترتيب العرض' },
  'field.reference_source': { en: 'Reference source', ar: 'مصدر المرجع' },
  'field.options': { en: 'Options', ar: 'الخيارات' },
  'field.option_value': { en: 'Value', ar: 'القيمة' },
  'field.add_option': { en: 'Add option', ar: 'إضافة خيار' },
  'field.remove': { en: 'Remove', ar: 'إزالة' },
  'field.visibility': { en: 'Visibility rule (optional)', ar: 'قاعدة الظهور (اختياري)' },
  'field.visibility_key': { en: 'Depends on field key', ar: 'يعتمد على مفتاح حقل' },
  'field.visibility_op': { en: 'Operator', ar: 'العامل' },
  'field.visibility_value': { en: 'Value', ar: 'القيمة' },
  'field.parent': { en: 'Parent category (optional)', ar: 'الفئة الأم (اختياري)' },
  'vertical.new_title': { en: 'New service vertical', ar: 'قطاع خدمة جديد' },
  'vertical.new_intro': {
    en: 'A vertical is data: give it a code and bilingual name, then add categories and fields.',
    ar: 'القطاع بيانات: امنحه رمزاً واسماً بلغتين، ثم أضِف الفئات والحقول.',
  },
  'fieldeditor.title': { en: 'New field', ar: 'حقل جديد' },
  'fieldeditor.intro': {
    en: 'Dynamic order fields appear in the customer form with no release.',
    ar: 'تظهر حقول الطلب الديناميكية في نموذج العميل دون إصدار تطبيق.',
  },
  'category.new_title': { en: 'New category', ar: 'فئة جديدة' },
  'install.confirm': {
    en: 'Install the towing template into this tenant? It creates the vertical, categories, fields, workflow, tiers and plans.',
    ar: 'تثبيت قالب السطحة في هذا المستأجر؟ يُنشئ القطاع والفئات والحقول ومسار العمل والفئات السعرية والخطط.',
  },
  'install.done': { en: 'Template installed.', ar: 'تم تثبيت القالب.' },
  // --- Detail hub, edit and delete ---
  'action.edit': { en: 'Edit', ar: 'تعديل' },
  'action.delete': { en: 'Delete', ar: 'حذف' },
  'detail.categories': { en: 'Categories', ar: 'الفئات' },
  'detail.fields': { en: 'Order fields', ar: 'حقول الطلب' },
  'detail.vertical': { en: 'Vertical', ar: 'القطاع' },
  'detail.no_categories': { en: 'No categories yet.', ar: 'لا توجد فئات بعد.' },
  'detail.no_fields': { en: 'No order fields yet.', ar: 'لا توجد حقول طلب بعد.' },
  'detail.type': { en: 'Type', ar: 'النوع' },
  'vertical.edit_title': { en: 'Edit vertical', ar: 'تعديل القطاع' },
  'fieldeditor.edit_title': { en: 'Edit field', ar: 'تعديل الحقل' },
  'category.edit_title': { en: 'Edit category', ar: 'تعديل الفئة' },
  'delete.confirm_vertical': {
    en: 'Deactivate this vertical? Its storefront and ordering stop. You can recreate it later.',
    ar: 'تعطيل هذا القطاع؟ يتوقف عرضه والطلب عليه. يمكنك إعادة إنشائه لاحقاً.',
  },
  'delete.confirm_category': { en: 'Deactivate this category?', ar: 'تعطيل هذه الفئة؟' },
  'delete.confirm_field': { en: 'Remove this field from the order form?', ar: 'إزالة هذا الحقل من نموذج الطلب؟' },
  // --- Workflow and stages ---
  'nav.workflow': { en: 'Workflow', ar: 'مسار العمل' },
  'workflow.title': { en: 'Order workflow', ar: 'مسار عمل الطلب' },
  'workflow.intro': {
    en: 'The ordered stages an order moves through, each mapped to a core status, with tracking and payment actions.',
    ar: 'المراحل المرتبة التي يمر بها الطلب، كل مرحلة مرتبطة بحالة أساسية، مع التتبع وإجراءات الدفع.',
  },
  'workflow.none': { en: 'This vertical has no workflow yet. Create one to define its stages.', ar: 'لا يوجد مسار عمل لهذا القطاع بعد. أنشئ واحداً لتعريف مراحله.' },
  'workflow.create': { en: 'Create workflow', ar: 'إنشاء مسار العمل' },
  'workflow.name_en': { en: 'Workflow name (English)', ar: 'اسم المسار (إنجليزي)' },
  'workflow.name_ar': { en: 'Workflow name (Arabic)', ar: 'اسم المسار (عربي)' },
  'workflow.rename': { en: 'Rename', ar: 'إعادة تسمية' },
  'workflow.add_stage': { en: 'Add stage', ar: 'إضافة مرحلة' },
  'workflow.no_stages': { en: 'No stages yet.', ar: 'لا توجد مراحل بعد.' },
  'workflow.move_up': { en: 'Move up', ar: 'لأعلى' },
  'workflow.move_down': { en: 'Move down', ar: 'لأسفل' },
  'stage.new_title': { en: 'New stage', ar: 'مرحلة جديدة' },
  'stage.edit_title': { en: 'Edit stage', ar: 'تعديل المرحلة' },
  'stage.maps_to': { en: 'Core status', ar: 'الحالة الأساسية' },
  'stage.actor': { en: 'Actor', ar: 'المنفّذ' },
  'stage.tracking_active': { en: 'Live tracking active', ar: 'التتبع الحيّ مفعّل' },
  'stage.payment_action': { en: 'Payment action', ar: 'إجراء الدفع' },
  'stage.sla_minutes': { en: 'SLA minutes (optional)', ar: 'دقائق مستوى الخدمة (اختياري)' },
  'stage.requires': { en: 'Requirements (JSON, optional)', ar: 'المتطلبات (JSON، اختياري)' },
  'stage.requires_invalid': { en: 'Requirements must be valid JSON.', ar: 'يجب أن تكون المتطلبات JSON صالحاً.' },
  'delete.confirm_stage': { en: 'Delete this stage?', ar: 'حذف هذه المرحلة؟' },
  // --- Providers (admin review) ---
  'providers.title': { en: 'Providers', ar: 'المزودون' },
  'providers.intro': {
    en: 'Review provider onboarding: identity, merchant, documents and category offerings.',
    ar: 'راجع انضمام المزودين: الهوية والتاجر والوثائق وعروض الفئات.',
  },
  'providers.entity': { en: 'Type', ar: 'النوع' },
  'providers.merchant': { en: 'Merchant', ar: 'التاجر' },
  'providers.state': { en: 'Onboarding', ar: 'الانضمام' },
  'providers.eligible': { en: 'Eligible for dispatch', ar: 'مؤهّل للإسناد' },
  'providers.refresh_merchant': { en: 'Refresh merchant status', ar: 'تحديث حالة التاجر' },
  'providers.steps': { en: 'Onboarding steps', ar: 'خطوات الانضمام' },
  'providers.blockers': { en: 'Blockers', ar: 'العوائق' },
  'providers.offerings': { en: 'Offerings', ar: 'العروض' },
  'providers.documents': { en: 'Documents', ar: 'الوثائق' },
  'providers.no_offerings': { en: 'No offerings yet.', ar: 'لا توجد عروض بعد.' },
  'providers.no_documents': { en: 'No documents yet.', ar: 'لا توجد وثائق بعد.' },
  'providers.approve': { en: 'Approve', ar: 'اعتماد' },
  'providers.needs_info': { en: 'Needs info', ar: 'طلب معلومات' },
  'providers.reject': { en: 'Reject', ar: 'رفض' },
  'providers.verify': { en: 'Verify', ar: 'توثيق' },
  'providers.notes_ph': { en: 'Review notes (optional)', ar: 'ملاحظات المراجعة (اختياري)' },
  'providers.yes': { en: 'Yes', ar: 'نعم' },
  'providers.no': { en: 'No', ar: 'لا' },
  'groups.title': { en: 'Provider groups', ar: 'مجموعات المزودين' },
  'groups.intro': {
    en: 'Groups (VIP fleet, insurer-approved, night shift) used by dispatch policies.',
    ar: 'مجموعات (أسطول مميّز، معتمد من المؤمّن، وردية ليلية) تستخدمها سياسات الإسناد.',
  },
  'groups.new': { en: 'New group', ar: 'مجموعة جديدة' },
  'groups.add_member': { en: 'Add member', ar: 'إضافة عضو' },
  'groups.member_org': { en: 'Provider id (optional)', ar: 'معرّف المزود (اختياري)' },
  'groups.member_agent': { en: 'Agent id (optional)', ar: 'معرّف الوكيل (اختياري)' },
  // --- Pricing simulator ---
  'sim.title': { en: 'Fee and price simulator', ar: 'محاكي السعر والرسوم' },
  'sim.intro': {
    en: 'Compute a fare, the fees and VAT, the payment splits and the net settlement from inputs.',
    ar: 'احسب الأجرة والرسوم والضريبة وتقسيمات الدفع والتسوية الصافية من المدخلات.',
  },
  'sim.rate_card': { en: 'Rate card', ar: 'بطاقة السعر' },
  'sim.base_fare': { en: 'Base fare (SAR)', ar: 'الأجرة الأساسية (ر.س.)' },
  'sim.included_km': { en: 'Included km', ar: 'الكيلومترات المشمولة' },
  'sim.per_km': { en: 'Per km (SAR)', ar: 'لكل كم (ر.س.)' },
  'sim.per_min': { en: 'Per minute (SAR)', ar: 'لكل دقيقة (ر.س.)' },
  'sim.class_mult': { en: 'Class multiplier', ar: 'مُضاعِف الفئة' },
  'sim.min_fare': { en: 'Minimum fare (SAR)', ar: 'الحد الأدنى للأجرة (ر.س.)' },
  'sim.auth_buffer': { en: 'Auth buffer %', ar: 'هامش التفويض %' },
  'sim.trip': { en: 'Trip', ar: 'الرحلة' },
  'sim.distance_km': { en: 'Distance (km)', ar: 'المسافة (كم)' },
  'sim.duration_min': { en: 'Duration (min)', ar: 'المدة (دقيقة)' },
  'sim.surge': { en: 'Surge multiplier', ar: 'مُضاعِف الذروة' },
  'sim.fee': { en: 'Commission %', ar: 'نسبة العمولة %' },
  'sim.fee_bearer': { en: 'Fee borne by', ar: 'يتحمّل الرسوم' },
  'sim.gateway': { en: 'Gateway fee %', ar: 'نسبة رسوم البوابة %' },
  'sim.fee_source': { en: 'Gateway fee source', ar: 'مصدر رسوم البوابة' },
  'sim.compute': { en: 'Compute', ar: 'احسب' },
  'sim.service_fare': { en: 'Service fare', ar: 'أجرة الخدمة' },
  'sim.customer_total': { en: 'Customer total', ar: 'إجمالي العميل' },
  'sim.authorized': { en: 'Authorized', ar: 'المُفوَّض' },
  'sim.splits': { en: 'Splits', ar: 'التقسيمات' },
  'sim.settlement': { en: 'Settlement (net)', ar: 'التسوية (صافي)' },
  'sim.provider_net': { en: 'Provider net', ar: 'صافي المزود' },
  'sim.platform_net': { en: 'Platform net', ar: 'صافي المنصة' },
  'sim.gateway_fee': { en: 'Gateway fee', ar: 'رسوم البوابة' },

  // Pricing hub
  'pricing.hub.title': { en: 'Pricing', ar: 'التسعير' },
  'pricing.hub.intro': {
    en: 'Rate cards and fee schedules use maker-checker: one person drafts, another approves.',
    ar: 'تستخدم بطاقات الأسعار وجداول الرسوم مبدأ صانع-مدقّق: شخص يسوّد المسودة وآخر يعتمدها.',
  },
  'pricing.tool.simulator': { en: 'Fee and price simulator', ar: 'محاكي السعر والرسوم' },
  'pricing.tool.rate_cards': { en: 'Rate cards', ar: 'بطاقات الأسعار' },
  'pricing.tool.fee_schedules': { en: 'Fee schedules', ar: 'جداول الرسوم' },
  'pricing.tool.surge': { en: 'Surge schedules', ar: 'جداول الذروة' },

  // Shared lifecycle (maker-checker)
  'lc.status': { en: 'Status', ar: 'الحالة' },
  'lc.status.draft': { en: 'Draft', ar: 'مسودة' },
  'lc.status.pending_approval': { en: 'Pending approval', ar: 'بانتظار الاعتماد' },
  'lc.status.active': { en: 'Active', ar: 'نشطة' },
  'lc.status.archived': { en: 'Archived', ar: 'مؤرشفة' },
  'lc.version': { en: 'Version', ar: 'الإصدار' },
  'lc.created_by': { en: 'Created by', ar: 'أنشأها' },
  'lc.approved_by': { en: 'Approved by', ar: 'اعتمدها' },
  'lc.submit': { en: 'Submit for approval', ar: 'إرسال للاعتماد' },
  'lc.approve': { en: 'Approve', ar: 'اعتماد' },
  'lc.reject': { en: 'Reject', ar: 'رفض' },
  'lc.archive': { en: 'Archive', ar: 'أرشفة' },
  'lc.notes': { en: 'Notes (optional)', ar: 'ملاحظات (اختياري)' },
  'lc.four_eyes': {
    en: 'The approver cannot be the creator. Editing a submitted item returns it to draft.',
    ar: 'لا يمكن أن يكون المعتمِد هو المُنشئ. تعديل عنصر مُرسَل يعيده إلى مسودة.',
  },

  // Rate cards
  'rc.title': { en: 'Rate cards', ar: 'بطاقات الأسعار' },
  'rc.intro': {
    en: 'A rate card prices a service tier in a city. It goes live only after approval.',
    ar: 'تُسعّر بطاقة السعر فئة خدمة في مدينة. لا تصبح نشطة إلا بعد الاعتماد.',
  },
  'rc.new': { en: 'New rate card', ar: 'بطاقة سعر جديدة' },
  'rc.scope': { en: 'Scope', ar: 'النطاق' },
  'rc.tier_id': { en: 'Service tier id', ar: 'معرّف فئة الخدمة' },
  'rc.city_id': { en: 'City id', ar: 'معرّف المدينة' },
  'rc.zone_id': { en: 'Zone id (optional)', ar: 'معرّف المنطقة (اختياري)' },
  'rc.vehicle_class_id': { en: 'Vehicle class id (optional)', ar: 'معرّف فئة المركبة (اختياري)' },
  'rc.fare': { en: 'Fare', ar: 'الأجرة' },
  'rc.base_fare': { en: 'Base fare (SAR)', ar: 'الأجرة الأساسية (ر.س.)' },
  'rc.booking_fee': { en: 'Booking fee (SAR)', ar: 'رسوم الحجز (ر.س.)' },
  'rc.flat_fare': { en: 'Flat fare (SAR, optional)', ar: 'أجرة ثابتة (ر.س.، اختياري)' },
  'rc.included_km': { en: 'Included km', ar: 'الكيلومترات المشمولة' },
  'rc.per_km': { en: 'Per km (SAR)', ar: 'لكل كم (ر.س.)' },
  'rc.approach_per_km': { en: 'Approach per km (SAR)', ar: 'الوصول لكل كم (ر.س.)' },
  'rc.approach_free_km': { en: 'Approach free km', ar: 'كيلومترات وصول مجانية' },
  'rc.per_min': { en: 'Per minute (SAR)', ar: 'لكل دقيقة (ر.س.)' },
  'rc.free_wait_min': { en: 'Free wait minutes', ar: 'دقائق انتظار مجانية' },
  'rc.per_wait_min': { en: 'Per wait minute (SAR)', ar: 'لكل دقيقة انتظار (ر.س.)' },
  'rc.min_fare': { en: 'Minimum fare (SAR)', ar: 'الحد الأدنى للأجرة (ر.س.)' },
  'rc.max_fare': { en: 'Maximum fare (SAR, optional)', ar: 'الحد الأقصى للأجرة (ر.س.، اختياري)' },
  'rc.class_mult': { en: 'Class multiplier', ar: 'مُضاعِف الفئة' },
  'rc.extra_stop_fee': { en: 'Extra stop fee (SAR)', ar: 'رسوم المحطة الإضافية (ر.س.)' },
  'rc.auth_buffer': { en: 'Authorization buffer %', ar: 'هامش التفويض %' },
  'rc.reprice_threshold': { en: 'Reprice threshold %', ar: 'عتبة إعادة التسعير %' },
  'rc.rounding': { en: 'Fare rounding', ar: 'تقريب الأجرة' },
  'rc.cancellation_fee': { en: 'Cancellation fee (SAR)', ar: 'رسوم الإلغاء (ر.س.)' },
  'rc.cancellation_free_min': { en: 'Free cancellation minutes', ar: 'دقائق إلغاء مجانية' },
  'rc.controls': { en: 'Controls', ar: 'الضوابط' },

  // Fee schedules
  'fs.title': { en: 'Fee schedules', ar: 'جداول الرسوم' },
  'fs.intro': {
    en: 'A fee schedule is a set of fee components (commission, VAT) applied to a service.',
    ar: 'جدول الرسوم مجموعة مكوّنات رسوم (عمولة، ضريبة) تُطبَّق على الخدمة.',
  },
  'fs.new': { en: 'New fee schedule', ar: 'جدول رسوم جديد' },
  'fs.name': { en: 'Name', ar: 'الاسم' },
  'fs.gateway_bearer': { en: 'Gateway fee borne by', ar: 'يتحمّل رسوم البوابة' },
  'fs.priority': { en: 'Priority', ar: 'الأولوية' },
  'fs.components': { en: 'Fee components', ar: 'مكوّنات الرسوم' },
  'fs.add_component': { en: 'Add component', ar: 'إضافة مكوّن' },
  'fs.component_code': { en: 'Code', ar: 'الرمز' },
  'fs.component_label': { en: 'Label', ar: 'التسمية' },
  'fs.bearer': { en: 'Borne by', ar: 'يتحمّلها' },
  'fs.calc': { en: 'Calculation', ar: 'طريقة الحساب' },
  'fs.rate_pct': { en: 'Rate %', ar: 'النسبة %' },
  'fs.fixed_amount': { en: 'Fixed (SAR)', ar: 'مبلغ ثابت (ر.س.)' },
  'fs.base': { en: 'Base', ar: 'الأساس' },
  'fs.vat_mode': { en: 'VAT mode', ar: 'وضع الضريبة' },
  'fs.remove': { en: 'Remove', ar: 'إزالة' },
  'fs.show_to_customer': { en: 'Show to customer', ar: 'إظهار للعميل' },
  'fs.no_components': { en: 'No components yet.', ar: 'لا مكوّنات بعد.' },

  // Surge schedules
  'su.title': { en: 'Surge schedules', ar: 'جداول الذروة' },
  'su.intro': {
    en: 'Scheduled surge raises the fare in set windows. Towing uses low, acknowledged caps.',
    ar: 'ترفع ذروةُ الجدولة الأجرةَ في نوافذ محددة. تستخدم السطحة حدوداً منخفضة بإقرار العميل.',
  },
  'su.new': { en: 'New surge schedule', ar: 'جدول ذروة جديد' },
  'su.name': { en: 'Name', ar: 'الاسم' },
  'su.days': { en: 'Days of week (0=Sun..6=Sat, comma separated)', ar: 'أيام الأسبوع (0=الأحد..6=السبت، مفصولة بفواصل)' },
  'su.time_from': { en: 'From time (HH:MM)', ar: 'من وقت (س س:د د)' },
  'su.time_to': { en: 'To time (HH:MM)', ar: 'إلى وقت (س س:د د)' },
  'su.multiplier': { en: 'Multiplier (>= 1)', ar: 'المُضاعِف (>= 1)' },
  'su.active': { en: 'Active', ar: 'نشط' },
  'su.tier_id': { en: 'Service tier id (optional)', ar: 'معرّف فئة الخدمة (اختياري)' },
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
