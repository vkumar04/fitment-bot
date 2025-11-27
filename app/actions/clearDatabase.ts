'use server';

import db from '@/lib/db';

export async function clearDatabase() {
  try {
    db.exec('DELETE FROM messages');
    db.exec('DELETE FROM sessions');
    return { success: true };
  } catch (error) {
    console.error('Error clearing database:', error);
    return { success: false, error: String(error) };
  }
}
