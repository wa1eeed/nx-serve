import type { FormSchema, Locale } from '@nxserve/domain';

/**
 * A representative towing order form, used to demonstrate the renderer when the
 * API is unreachable (local dev without a running backend). It mirrors the shape
 * GET /v1/catalog/verticals/{id}/form returns, localized to the active locale.
 */
export function sampleForm(locale: Locale): FormSchema {
  const t = (en: string, ar: string): string => (locale === 'ar' ? ar : en);
  return {
    version: 'sample-1',
    locale,
    fulfillment: 'point_to_point',
    tracking: 'full_trip',
    sections: [
      {
        key: 'fulfillment',
        fields: [
          { key: 'origin', type: 'location', required: true, label: t('Pickup location', 'موقع الالتقاط') },
          { key: 'destination', type: 'location', required: true, label: t('Drop-off location', 'موقع التسليم') },
        ],
      },
      {
        key: 'service',
        fields: [
          {
            key: 'vehicle_tier',
            type: 'single_select',
            required: true,
            label: t('Vehicle tier', 'فئة المركبة'),
            options: [
              { value: 'light', label: t('Light vehicle', 'مركبة خفيفة') },
              { value: 'suv', label: t('SUV', 'دفع رباعي') },
              { value: 'heavy', label: t('Heavy vehicle', 'مركبة ثقيلة') },
            ],
          },
          { key: 'is_basement', type: 'boolean', required: false, label: t('Vehicle is in a basement', 'المركبة في قبو') },
          {
            key: 'basement_clearance_m',
            type: 'number',
            required: true,
            label: t('Basement clearance (m)', 'ارتفاع القبو (م)'),
            visibility: { key: 'is_basement', eq: true },
          },
          { key: 'notes', type: 'text', required: false, label: t('Notes for the driver', 'ملاحظات للسائق') },
        ],
      },
    ],
  };
}
