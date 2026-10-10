import type { ReactNode } from 'react';

/** Renders JSON-LD structured data (docs/22 sections 4 to 6). */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }): ReactNode {
  const list = Array.isArray(data) ? data : [data];
  return (
    <>
      {list.map((item, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }} />
      ))}
    </>
  );
}
