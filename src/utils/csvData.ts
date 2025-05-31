import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';

export async function getPersonalSponsors() {
  try {
    // Read CSV file from public directory
    const csvPath = path.join(process.cwd(), 'public', 'techramen-24-conf-all-20240727-212901.csv');
    let csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Remove BOM if present
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }
    
    // Parse CSV
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true
    });
    
    const sponsors = parsed.data as any[];
    
    // Filter for personal sponsors who agreed to display
    const personalSponsors = sponsors.filter((row: any) => 
      row['Ticket type'] === 'ラーメンを応援します' &&
      row['応援団の Web サイト表示について'] === '表示してもよい(fortee の設定についても理解した)'
    );
    
    return personalSponsors.map((row: any) => ({
      userName: row['User name'] || 'Anonymous',
      displayName: row['Name'] || row['User name'] || 'Anonymous',
      twitterUrl: row['Twitter'] ? (row['Twitter'].startsWith('http') ? row['Twitter'] : `https://x.com/${row['Twitter'].replace('@', '')}`) : null,
      avatarUrl: row['Avatar filename'] === 'default-avatar.png' ? '/avatar_default.jpg' : `/avatars/${row['Avatar filename']}`,
      comment: row['その他コメント欄'] || ''
    }));
  } catch (error) {
    console.error('Error fetching personal sponsors:', error);
    return [];
  }
}
