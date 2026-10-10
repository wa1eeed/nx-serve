import { NextResponse, type NextRequest } from 'next/server';

interface DemoLead {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  interest?: string;
  message?: string;
  locale?: string;
}

/**
 * Receives a demo request and forwards it to the configured CRM webhook (docs/22
 * section 3). Set DEMO_WEBHOOK_URL to the CRM endpoint. Without it the lead is
 * logged server side so the form still works in development, and nothing is lost
 * silently. Personal data stays in the POST body, never a URL (PDPL, docs/18).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let lead: DemoLead;
  try {
    lead = (await request.json()) as DemoLead;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!lead.name?.trim() || !lead.email?.trim()) {
    return NextResponse.json({ error: 'name_and_email_required' }, { status: 422 });
  }

  const payload = {
    source: 'marketing-demo-form',
    received_at: new Date().toISOString(),
    name: lead.name.trim(),
    company: lead.company?.trim() ?? '',
    email: lead.email.trim(),
    phone: lead.phone?.trim() ?? '',
    interest: lead.interest ?? '',
    message: lead.message?.trim() ?? '',
    locale: lead.locale ?? '',
  };

  const webhook = process.env.DEMO_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return NextResponse.json({ error: 'crm_rejected' }, { status: 502 });
      }
    } catch {
      return NextResponse.json({ error: 'crm_unreachable' }, { status: 502 });
    }
  } else {
    // No CRM configured yet: record the lead so it is not lost in development.
    console.info('[demo-lead]', JSON.stringify({ ...payload, email: '[redacted]' }));
  }

  return NextResponse.json({ status: 'ok' });
}
