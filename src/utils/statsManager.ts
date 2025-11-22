import Papa from 'papaparse';
// @ts-ignore
import activePlayersCsv from '../EpicGamesCSV/my_total_active_players-22_11_2025.csv?raw';

// Baseline constants provided by the user
export const BASELINE_STATS = {
  totalUniquePlayers: 100250,
  totalLifetimePlays: 125574,
  totalFavorites: 109,
  totalMinutesPlayed: 2000000,
  monthlyPlayers: 1388,
  weeklyPlayers: 426,
};

export interface DailyStat {
  date: string; // ISO format YYYY-MM-DD
  displayDate: string; // DD/MM/YY
  totalActive: number;
}

export interface StatsData {
  trendData: DailyStat[];
  weeklyGrowth: number; // Percentage
  currentWeeklyActive: number;
}

export const processStatsData = (): StatsData => {
  const parsed = Papa.parse<string[]>(activePlayersCsv, {
    header: false,
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  if (rows.length < 3) {
    return { trendData: [], weeklyGrowth: 0, currentWeeklyActive: 0 };
  }

  // Row 0: Codes, Row 1: Names, Row 2+: Data
  // Column 0 is Date
  const dataRows = rows.slice(2);
  
  const trendData: DailyStat[] = dataRows.map(row => {
    const dateStr = row[0]; // DD/MM/YY
    const [day, month, year] = dateStr.split('/');
    // Assuming 20xx for year
    const isoDate = `20${year}-${month}-${day}`;
    
    // Sum all columns from index 1 onwards
    let dailyTotal = 0;
    for (let i = 1; i < row.length; i++) {
      const val = parseInt(row[i] || '0', 10);
      if (!isNaN(val)) {
        dailyTotal += val;
      }
    }

    return {
      date: isoDate,
      displayDate: dateStr,
      totalActive: dailyTotal,
    };
  }).filter(d => !isNaN(new Date(d.date).getTime())); // Filter invalid dates

  // Sort by date ascending
  trendData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate Week-over-Week growth
  // Get last 7 days sum vs previous 7 days sum
  const last7Days = trendData.slice(-7);
  const prev7Days = trendData.slice(-14, -7);

  const last7Total = last7Days.reduce((sum, day) => sum + day.totalActive, 0);
  const prev7Total = prev7Days.reduce((sum, day) => sum + day.totalActive, 0);

  let weeklyGrowth = 0;
  if (prev7Total > 0) {
    weeklyGrowth = ((last7Total - prev7Total) / prev7Total) * 100;
  }

  return {
    trendData,
    weeklyGrowth,
    currentWeeklyActive: last7Total,
  };
};
