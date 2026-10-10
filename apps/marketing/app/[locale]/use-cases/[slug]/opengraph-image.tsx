import { USE_CASES, findUseCase } from '../../../../lib/content';
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from '../../../../lib/og';

export const alt = 'NX Serve use case';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams(): { slug: string }[] {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const uc = findUseCase(slug);
  return renderOg({ title: uc ? uc.name.en : 'Use cases', kicker: 'Use case' });
}
