import { GUIDES, findGuide } from '../../../../lib/guides';
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from '../../../../lib/og';

export const alt = 'NX Serve guide';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams(): { slug: string }[] {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const guide = findGuide(slug);
  return renderOg({ title: guide ? guide.title.en : 'Guides', kicker: 'Guide' });
}
