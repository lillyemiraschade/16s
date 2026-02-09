import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextRequest, NextResponse } from 'next/server';

function getCredentials() {
  // Option 1: Base64-encoded service account JSON (most reliable on Vercel)
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  if (base64) {
    try {
      const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
      return {
        email: json.client_email,
        key: json.private_key,
        sheetId: process.env.GOOGLE_SHEET_ID,
      };
    } catch (e) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_BASE64:', e);
    }
  }

  // Option 2: Individual env vars (fallback)
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (key) {
    // Strip surrounding quotes if present
    key = key.replace(/^["']|["']$/g, '');
    // Replace escaped newlines with real ones
    key = key.replace(/\\n/g, '\n');
  }

  return { email, key, sheetId };
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const creds = getCredentials();

    if (!creds.email || !creds.key || !creds.sheetId) {
      console.error('Missing Google Sheets config:', {
        hasEmail: !!creds.email,
        hasKey: !!creds.key,
        hasSheetId: !!creds.sheetId,
      });
      return NextResponse.json({ error: 'Waitlist not configured' }, { status: 500 });
    }

    const auth = new JWT({
      email: creds.email,
      key: creds.key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(creds.sheetId, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
      email: email.toLowerCase().trim(),
      date: new Date().toISOString(),
      source: 'try16s.app',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Waitlist error:', message);
    return NextResponse.json({ error: 'Failed to join' }, { status: 500 });
  }
}
