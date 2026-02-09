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
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!serviceEmail || !privateKey || !sheetId) {
      console.error('Missing Google Sheets env vars');
      return NextResponse.json({ error: 'Waitlist not configured' }, { status: 500 });
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
    console.error('Waitlist error:', err);
    return NextResponse.json({ error: 'Failed to join' }, { status: 500 });
  }
}
