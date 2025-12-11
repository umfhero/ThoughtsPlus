
// Helper to format ICS date string (YYYYMMDDTHHmmssZ) to readable format
export function formatICSDate(icsDate: string): string {
    if (!icsDate) return '';

    // Check if simple date (YYYYMMDD) or datetime (YYYYMMDDTHHmmssZ)
    const match = icsDate.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);

    if (match) {
        const [_, year, month, day, hour, minute, second] = match;
        const date = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            hour ? parseInt(hour) : 0,
            minute ? parseInt(minute) : 0,
            second ? parseInt(second) : 0
        );

        // Format: Dec 12, 2025, 9:00 AM
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: hour ? 'numeric' : undefined,
            minute: minute ? '2-digit' : undefined,
        });
    }

    return icsDate; // Fallback
}
