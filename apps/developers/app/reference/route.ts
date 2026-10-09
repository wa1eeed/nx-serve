import { ApiReference } from '@scalar/nextjs-api-reference';

// Renders the interactive API reference from the generated OpenAPI spec.
const config = {
  spec: { url: '/openapi.json' },
  metaData: { title: 'NX Serve API reference' },
};

export const GET = ApiReference(config);
