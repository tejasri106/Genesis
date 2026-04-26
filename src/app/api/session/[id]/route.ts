import { NextResponse } from 'next/server';
import { getSession } from '@/lib/memory/session-store';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = getSession(id);

  return NextResponse.json({
    ok: true,
    session,
  });
}