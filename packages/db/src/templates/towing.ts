import { type TemplatePayload, TemplatePayloadSchema } from '@nxserve/contracts';

/**
 * The towing template blueprint (docs/25). Parsed through the schema so defaults
 * apply and it is validated at module load. Stored in service_templates.payload
 * and installed into a tenant by applyTemplate.
 */
export const TOWING_TEMPLATE: TemplatePayload = TemplatePayloadSchema.parse({
  vertical: {
    code: 'towing',
    name: { en: 'Towing', ar: 'سطحات' },
    default_fulfillment: 'point_to_point',
    default_tracking: 'full_trip',
    config: { completion_otp: true, photos_required: true },
  },
  categories: [{ code: 'light_vehicles', name: { en: 'Light vehicles', ar: 'مركبات خفيفة' } }],
  payment_plans: [{ code: 'authorize_capture', kind: 'authorize_capture' }],
  workflow: {
    name: { en: 'Towing workflow', ar: 'سير عمل السطحة' },
    stages: [
      { code: 'accepted', label: { en: 'Accepted', ar: 'تم القبول' }, maps_to: 'assigned', sort_order: 1, payment_action: 'authorize' },
      { code: 'heading_to_pickup', label: { en: 'Heading to pickup', ar: 'في الطريق للاستلام' }, maps_to: 'en_route', sort_order: 2, tracking_active: true },
      { code: 'arrived_pickup', label: { en: 'Arrived at pickup', ar: 'وصل نقطة الاستلام' }, maps_to: 'arrived', sort_order: 3, requires: { photos_min: 2 } },
      { code: 'loading', label: { en: 'Loading', ar: 'جارٍ التحميل' }, maps_to: 'in_progress', sort_order: 4 },
      { code: 'heading_to_dropoff', label: { en: 'Heading to drop-off', ar: 'في الطريق للتسليم' }, maps_to: 'in_progress', sort_order: 5, tracking_active: true },
      { code: 'delivered', label: { en: 'Delivered', ar: 'تم التسليم' }, maps_to: 'completed', sort_order: 6, requires: { photos_min: 2, otp: true }, payment_action: 'capture' },
    ],
  },
  fields: [
    { key: 'vehicle', data_type: 'reference', label: { en: 'Vehicle', ar: 'المركبة' }, required: true, reference_source: 'customer_vehicle', sort_order: 1 },
    { key: 'condition', data_type: 'single_select', label: { en: 'Condition', ar: 'الحالة' }, required: true, sort_order: 2, options: [
      { value: 'runs', label: { en: 'Runs', ar: 'يعمل' } },
      { value: 'no_run', label: { en: 'Does not run', ar: 'لا يعمل' } },
      { value: 'accident', label: { en: 'Accident', ar: 'حادث' } },
    ] },
    { key: 'wheels_locked', data_type: 'boolean', label: { en: 'Wheels locked', ar: 'العجلات مقفلة' }, sort_order: 3 },
    { key: 'location_type', data_type: 'single_select', label: { en: 'Pickup location type', ar: 'نوع موقع الاستلام' }, sort_order: 4, options: [
      { value: 'ground', label: { en: 'Ground level', ar: 'مستوى الأرض' } },
      { value: 'basement', label: { en: 'Basement', ar: 'قبو' } },
    ] },
    { key: 'basement_clearance_m', data_type: 'number', label: { en: 'Basement clearance (m)', ar: 'ارتفاع القبو (م)' }, sort_order: 5, validation: { min: 1, max: 5 }, visibility_rule: { show_if: { key: 'location_type', eq: 'basement' } } },
    { key: 'plate', data_type: 'text', label: { en: 'Plate', ar: 'اللوحة' }, sort_order: 6 },
    { key: 'photos', data_type: 'media', label: { en: 'Photos', ar: 'الصور' }, sort_order: 7 },
  ],
  tiers: [
    { code: 'flatbed_std', name: { en: 'Standard flatbed', ar: 'سطحة عادية' }, category_code: 'light_vehicles', payment_plan_code: 'authorize_capture', required_capabilities: { asset_type: ['flatbed'] }, sort_order: 1 },
    { code: 'flatbed_hydraulic', name: { en: 'Hydraulic flatbed', ar: 'سطحة هيدروليك' }, category_code: 'light_vehicles', payment_plan_code: 'authorize_capture', required_capabilities: { asset_type: ['flatbed'], hydraulic: true }, sort_order: 2 },
    { code: 'enclosed', name: { en: 'Enclosed', ar: 'مغلقة' }, category_code: 'light_vehicles', payment_plan_code: 'authorize_capture', required_capabilities: { enclosed: true }, sort_order: 3 },
  ],
  requirements: [
    { category_code: 'light_vehicles', doc_type: 'vehicle_registration', label: { en: 'Vehicle registration', ar: 'استمارة المركبة' } },
    { category_code: 'light_vehicles', doc_type: 'operating_permit', label: { en: 'Operating permit', ar: 'تصريح التشغيل' }, expires: true },
  ],
});
