import { StorageData, VideoInfo, VideoMoment } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Default empty storage structure
const defaultStorage: StorageData = {
    videos: {}
};

// Log that storage utilities are loaded
console.log('Storage: Storage utilities loaded');

/**
 * Get all data from storage
 */
export const getAllData = async (): Promise<StorageData> => {
    console.log('Storage: getAllData called');
    return new Promise((resolve, reject) => {
        try {
            console.log('Storage: Getting all data from chrome.storage.local');
            chrome.storage.local.get('youtubeVideoMoments', (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Storage error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }

                if (result.youtubeVideoMoments) {
                    const data = result.youtubeVideoMoments as StorageData;
                    const videoCount = Object.keys(data.videos || {}).length;
                    console.log(`Storage: Retrieved data with ${videoCount} videos`);
                    // Log detailed info for debugging
                    if (videoCount > 0) {
                        console.log('Storage: Videos in storage:', Object.keys(data.videos));
                        // Log the first few videos for debugging
                        const videoSample = Object.values(data.videos).slice(0, 3);
                        console.log('Storage: Sample of stored videos:', videoSample);
                    }
                    resolve(data);
                } else {
                    console.log('Storage: No data found, using default empty structure');
                    resolve(defaultStorage);
                }
            });
        } catch (error) {
            console.error('Storage: Error getting data', error);
            reject(error);
        }
    });
};

/**
 * Save data to storage
 */
export const saveData = async (data: StorageData): Promise<void> => {
    const videoCount = Object.keys(data.videos || {}).length;
    console.log(`Storage: saveData called with ${videoCount} videos`);

    if (!data || !data.videos) {
        console.error('Storage: Invalid data structure', data);
        throw new Error('Invalid data structure for storage');
    }

    // Debug: log the data structure
    console.log('Storage: Data structure verification:', {
        hasVideosProperty: data && typeof data.videos === 'object',
        videosCount: data?.videos ? Object.keys(data.videos).length : 0
    });

    return new Promise((resolve, reject) => {
        try {
            console.log('Storage: Saving data to chrome.storage.local');

            // Debug log storage limit information
            try {
                chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Storage: Could not get bytes in use:', chrome.runtime.lastError);
                        return;
                    }

                    const maxBytes = 5242880; // 5MB Chrome extension storage limit
                    const usagePercentage = (bytesInUse / maxBytes * 100).toFixed(2);
                    console.log(`Storage: Current storage usage: ${bytesInUse} bytes / ${maxBytes} bytes (${usagePercentage}%)`);

                    // Warn if we're getting close to the limit
                    if (bytesInUse > maxBytes * 0.8) {
                        console.warn(`Storage: Warning - storage usage is at ${usagePercentage}% of limit`);
                    }
                });
            } catch (storageError) {
                console.warn('Storage: Error checking storage usage (non-critical):', storageError);
            }

            // Create a safe copy of the data to prevent any potential reference issues
            const safeData = JSON.parse(JSON.stringify(data));

            console.log('Storage: About to save data with key youtubeVideoMoments');
            chrome.storage.local.set({ youtubeVideoMoments: safeData }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Storage error when saving:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }
                console.log('Storage: Data saved successfully');

                // Verify the data was actually saved
                chrome.storage.local.get('youtubeVideoMoments', (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Storage: Verification check failed, but data might still be saved:', chrome.runtime.lastError);
                        resolve(); // Still resolve since the original save didn't fail
                        return;
                    }

                    if (result.youtubeVideoMoments) {
                        console.log('Storage: Verification successful, data is in storage');
                    } else {
                        console.warn('Storage: Verification failed, data might not have been saved correctly');
                    }
                    resolve();
                });
            });
        } catch (error) {
            console.error('Storage: Error saving data', error);
            reject(error);
        }
    });
};

/**
 * Get video info by ID
 */
export const getVideoInfo = async (videoId: string): Promise<VideoInfo | null> => {
    try {
        const data = await getAllData();
        return data.videos[videoId] || null;
    } catch (error) {
        console.error('Storage: Error getting video info', error);
        throw error;
    }
};

/**
 * Save a new moment
 */
export const saveMoment = async (
    videoId: string,
    videoTitle: string,
    timestamp: number,
    formattedTimestamp: string,
    note: string
): Promise<VideoMoment> => {
    try {
        console.log('Storage: saveMoment called', { videoId, videoTitle, timestamp });

        // Validate input parameters
        if (!videoId) {
            const error = new Error('Invalid videoId provided');
            console.error('Storage: ' + error.message);
            throw error;
        }

        if (isNaN(timestamp) || timestamp < 0) {
            const error = new Error('Invalid timestamp provided');
            console.error('Storage: ' + error.message, { timestamp });
            throw error;
        }

        // Get current data
        console.log('Storage: Fetching current data for save operation');
        const data = await getAllData();
        console.log('Storage: Current data retrieved, proceeding with save');

        // Create the moment object with a unique ID
        const momentId = uuidv4();
        console.log('Storage: Generated new moment ID:', momentId);

        const newMoment: VideoMoment = {
            id: momentId,
            videoId,
            videoTitle: videoTitle || 'Untitled Video', // Provide a default if missing
            timestamp,
            formattedTimestamp: formattedTimestamp || '00:00', // Provide a default if missing
            note: note || '',
            createdAt: Date.now()
        };

        console.log('Storage: Created new moment object:', newMoment);

        // Check if we already have this video and handle it appropriately
        if (data.videos[videoId]) {
            console.log(`Storage: Video ${videoId} exists, adding moment to existing entry`);
            // Make sure the moments array exists
            if (!Array.isArray(data.videos[videoId].moments)) {
                data.videos[videoId].moments = [];
                console.log(`Storage: Created moments array for video ${videoId}`);
            }
            data.videos[videoId].moments.push(newMoment);
        } else {
            // Create a new video entry
            console.log(`Storage: Creating new video entry for ${videoId}`);
            data.videos[videoId] = {
                videoId,
                videoTitle: videoTitle || 'Untitled Video',
                moments: [newMoment]
            };
        }

        // Save the updated data
        console.log('Storage: Saving updated data with new moment');
        await saveData(data);

        console.log('Storage: Moment saved successfully with ID:', momentId);
        return newMoment;
    } catch (error) {
        console.error('Storage: Error in saveMoment operation:', error);
        throw error; // Re-throw to allow upstream handling
    }
};

/**
 * Delete a moment
 */
export const deleteMoment = async (momentId: string): Promise<void> => {
    try {
        console.log('Storage: Deleting moment', momentId);
        const data = await getAllData();

        // Find the video containing this moment
        for (const videoId in data.videos) {
            const videoInfo = data.videos[videoId];
            const momentIndex = videoInfo.moments.findIndex(m => m.id === momentId);

            if (momentIndex !== -1) {
                // Remove the moment
                videoInfo.moments.splice(momentIndex, 1);

                // If no moments left, remove the video entry
                if (videoInfo.moments.length === 0) {
                    delete data.videos[videoId];
                }

                // Save the updated data
                await saveData(data);
                console.log('Storage: Moment deleted successfully');
                return;
            }
        }
        console.warn('Storage: Moment not found', momentId);
    } catch (error) {
        console.error('Storage: Error deleting moment', error);
        throw error;
    }
}; 