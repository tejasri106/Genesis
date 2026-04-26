import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PatientProfileSchema } from '@/lib/schemas/patient';
import { setProfile } from '@/lib/memory/session-store';

const BodySchema = z.object({
  sessionId: z.string(),
  profile: PatientProfileSchema,
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = BodySchema.parse(json);

    setProfile(body.sessionId, body.profile);

    return NextResponse.json({
      ok: true,
      patientId: body.profile.patientId,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: 'Invalid profile payload' },
      { status: 400 }
    );
  }
}