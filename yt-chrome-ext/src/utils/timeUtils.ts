/**
 * Converts seconds to a formatted timestamp string (HH:MM:SS)
 */
export const formatTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hoursStr = hours > 0 ? `${hours}:` : '';
    const minutesStr = hours > 0 ? `${minutes.toString().padStart(2, '0')}:` : `${minutes}:`;
    const secsStr = secs.toString().padStart(2, '0');

    return `${hoursStr}${minutesStr}${secsStr}`;
};

/**
 * Converts a formatted timestamp string (HH:MM:SS) to seconds
 */
export const parseTimestamp = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number);

    if (parts.length === 3) {
        // HH:MM:SS format
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        // MM:SS format
        return parts[0] * 60 + parts[1];
    } else {
        // SS format or invalid
        return isNaN(parts[0]) ? 0 : parts[0];
    }
};

/**
 * Creates a YouTube URL with a specific timestamp
 */
export const createYouTubeUrl = (videoId: string, timestamp: number): string => {
    return `https://www.youtube.com/watch?v=${videoId}&t=${timestamp}s`;
}; 