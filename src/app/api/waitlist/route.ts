import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!serviceEmail || !privateKey || !sheetId) {
      console.error('Missing Google Sheets env vars:', { serviceEmail: !!serviceEmail, privateKey: !!privateKey, sheetId: !!sheetId });
      return NextResponse.json({ error: 'Waitlist not configured' }, { status: 500 });
    }

    // Handle both literal newlines and escaped \n in the private key
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const auth = new JWT({
      email: serviceEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, auth);
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
