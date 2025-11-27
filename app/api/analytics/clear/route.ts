import { NextResponse } from 'next/server';
import db from '@/app/lib/db';

export async function POST() {
  try {
    // Delete all data from tables
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM conversations').run();
    db.prepare('DELETE FROM daily_metrics').run();

    return NextResponse.json({ success: true, message: 'Database cleared successfully' });
  } catch (error) {
    console.error('Error clearing database:', error);
    return NextResponse.json({ error: 'Failed to clear database' }, { status: 500 });
  }
}
