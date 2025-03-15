import { Message, MessageType, VideoMoment } from '../types';
import { getAllData, saveMoment as saveNewMoment, deleteMoment as deleteStorageMoment } from '../utils/storageUtils';

// Log startup of background script
console.log('Background: Background script initialized');

// Extended Message interface to include our new message types
interface ExtendedMessage extends Message {
    type: MessageType;
    payload?: any;
}

// Function to check if a tab is ready for messaging
const isTabReady = async (tabId: number): Promise<boolean> => {
    try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        return response && response.pong === true;
    } catch (error) {
        console.log(`Background: Tab ${tabId} not ready:`, error);
        return false;
    }
};

// When extension is installed or updated
chrome.runtime.onInstalled.addListener(function (details: chrome.runtime.InstalledDetails) {
    console.log('Background: Extension installed or updated:', details.reason);
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message: ExtendedMessage, sender, sendResponse) => {
    console.log('Background: Received message:', message);

    // Always return true from this listener to indicate we will respond asynchronously
    // if needed

    const sendingTab = sender.tab?.id;

    try {
        // Check message type and handle accordingly
        if (message.type === 'PING') {
            console.log('Background: Received PING, sending PONG');
            sendResponse({ pong: true });
        }
        else if (message.type === 'GET_CURRENT_TIME') {
            console.log('Background: Received GET_CURRENT_TIME');

            // Make sure we have a tab to send to
            if (!sendingTab) {
                console.error('Background: No tab ID in sender');
                sendResponse({ success: false, error: 'No tab ID in sender' });
                return true;
            }

            // Forward the GET_CURRENT_TIME message to the content script
            chrome.tabs.sendMessage(sendingTab, { type: 'GET_CURRENT_TIME' }, (response) => {
                console.log('Background: Received response from content script:', response);
                sendResponse(response);
            });
        }
        else if (message.type === 'SAVE_MOMENT') {
            console.log('Background: Received SAVE_MOMENT with payload:', message.payload);

            if (!message.payload) {
                console.error('Background: No payload in SAVE_MOMENT message');
                sendResponse({ success: false, error: 'No payload in message' });
                return true;
            }

            const { videoId, videoTitle, timestamp, formattedTimestamp, note } = message.payload;

            if (!videoId || typeof timestamp !== 'number') {
                console.error('Background: Invalid SAVE_MOMENT payload, missing required fields');
                sendResponse({ success: false, error: 'Missing required fields in payload' });
                return true;
            }

            // Save the moment asynchronously
            (async () => {
                try {
                    // Attempt to save the moment
                    await saveNewMoment(
                        videoId,
                        videoTitle,
                        timestamp,
                        formattedTimestamp,
                        note
                    );

                    console.log('Background: Moment saved successfully');
                    sendResponse({ success: true });
                } catch (saveError) {
                    console.error('Background: Error saving moment:', saveError);
                    sendResponse({ success: false, error: saveError instanceof Error ? saveError.message : 'Error saving moment' });
                }
            })();
        }
        else if (message.type === 'GET_ALL_MOMENTS') {
            console.log('Background: Received GET_ALL_MOMENTS message');

            // Handle asynchronously
            (async () => {
                try {
                    const result = await chrome.storage.local.get('youtubeVideoMoments');
                    const data = result.youtubeVideoMoments || { videos: {} };

                    console.log('Background: Retrieved data from storage:', data);

                    // Convert to array format expected by popup
                    const formattedData = Object.entries(data.videos || {}).map(([videoId, videoData]: [string, any]) => {
                        return {
                            videoId,
                            videoTitle: videoData.videoTitle || 'Untitled Video',
                            moments: videoData.moments || []
                        };
                    });

                    console.log('Background: Formatted data for popup:', formattedData);
                    sendResponse({ success: true, data: formattedData });
                } catch (error) {
                    console.error('Background: Error getting all moments:', error);
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : 'Error retrieving moments'
                    });
                }
            })();
        }
        else if (message.type === 'DELETE_MOMENT') {
            console.log('Background: Received DELETE_MOMENT message with payload:', message.payload);

            const { videoId, momentId } = message.payload || {};

            if (!videoId || !momentId) {
                console.error('Background: Missing videoId or momentId in DELETE_MOMENT');
                sendResponse({ success: false, error: 'Missing videoId or momentId' });
                return true;
            }

            // Handle asynchronously
            (async () => {
                try {
                    const result = await chrome.storage.local.get('youtubeVideoMoments');
                    const data = result.youtubeVideoMoments || { videos: {} };

                    console.log('Background: Retrieved data for deletion:', data);

                    // Check if the video and moment exist
                    if (data.videos[videoId] &&
                        data.videos[videoId].moments &&
                        data.videos[videoId].moments.find((m: VideoMoment) => m.id === momentId)) {

                        // Remove the moment from the array
                        data.videos[videoId].moments = data.videos[videoId].moments.filter((m: VideoMoment) => m.id !== momentId);

                        // If no moments left for this video, remove the video entry
                        if (data.videos[videoId].moments.length === 0) {
                            delete data.videos[videoId];
                        }

                        // Save the updated data
                        await chrome.storage.local.set({ youtubeVideoMoments: data });
                        console.log('Background: Moment deleted successfully');
                        sendResponse({ success: true });
                    } else {
                        console.warn('Background: Moment not found, nothing to delete');
                        sendResponse({ success: true });  // Still return success as the end state is what was requested
                    }
                } catch (error) {
                    console.error('Background: Error deleting moment:', error);
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : 'Error deleting moment'
                    });
                }
            })();
        }
        else if (message.type === 'ADD_TAG_TO_MOMENT') {
            console.log('Background: Received ADD_TAG_TO_MOMENT message with payload:', message.payload);

            const { videoId, momentId, tag } = message.payload || {};

            if (!videoId || !momentId || !tag) {
                console.error('Background: Missing required fields in ADD_TAG_TO_MOMENT');
                sendResponse({ success: false, error: 'Missing required fields' });
                return true;
            }

            // Handle asynchronously
            (async () => {
                try {
                    const result = await chrome.storage.local.get('youtubeVideoMoments');
                    const data = result.youtubeVideoMoments || { videos: {} };

                    console.log('Background: Retrieved data for tag addition:', data);

                    // Find the moment
                    if (data.videos[videoId] && data.videos[videoId].moments) {
                        const momentIndex = data.videos[videoId].moments.findIndex((m: VideoMoment) => m.id === momentId);

                        if (momentIndex >= 0) {
                            const moment = data.videos[videoId].moments[momentIndex];

                            // Initialize tags array if it doesn't exist
                            if (!moment.tags) {
                                moment.tags = [];
                            }

                            // Add the tag if it doesn't already exist
                            if (!moment.tags.includes(tag)) {
                                moment.tags.push(tag);

                                // Save the updated data
                                await chrome.storage.local.set({ youtubeVideoMoments: data });
                                console.log('Background: Tag added successfully');
                            } else {
                                console.log('Background: Tag already exists, not adding again');
                            }
                        } else {
                            throw new Error('Moment not found');
                        }
                    } else {
                        throw new Error('Video not found');
                    }
                } catch (error) {
                    console.error('Background: Error adding tag to moment:', error);
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : 'Error adding tag'
                    });
                }
            })();
        }
        else if (message.type === 'REMOVE_TAG_FROM_MOMENT') {
            console.log('Background: Received REMOVE_TAG_FROM_MOMENT message with payload:', message.payload);

            const { videoId, momentId, tag } = message.payload || {};

            if (!videoId || !momentId || !tag) {
                console.error('Background: Missing required fields in REMOVE_TAG_FROM_MOMENT');
                sendResponse({ success: false, error: 'Missing required fields' });
                return true;
            }

            // Handle asynchronously
            (async () => {
                try {
                    const result = await chrome.storage.local.get('youtubeVideoMoments');
                    const data = result.youtubeVideoMoments || { videos: {} };

                    console.log('Background: Retrieved data for tag removal:', data);

                    // Find the moment
                    if (data.videos[videoId] && data.videos[videoId].moments) {
                        const momentIndex = data.videos[videoId].moments.findIndex((m: VideoMoment) => m.id === momentId);

                        if (momentIndex >= 0) {
                            const moment = data.videos[videoId].moments[momentIndex];

                            // If there are tags and the tag exists, remove it
                            if (moment.tags && moment.tags.includes(tag)) {
                                moment.tags = moment.tags.filter((t: string) => t !== tag);

                                // Save the updated data
                                await chrome.storage.local.set({ youtubeVideoMoments: data });
                                console.log('Background: Tag removed successfully');
                            } else {
                                console.log('Background: Tag not found, nothing to remove');
                            }
                        } else {
                            throw new Error('Moment not found');
                        }
                    } else {
                        throw new Error('Video not found');
                    }
                } catch (error) {
                    console.error('Background: Error removing tag from moment:', error);
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : 'Error removing tag'
                    });
                }
            })();
        }
        else {
            console.warn('Background: Unknown message type', message.type);
            sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
        }
    } catch (error) {
        console.error('Background: Error handling message:', error);
        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Error handling message'
        });
    }

    // Return true to indicate we will respond asynchronously if needed
    return true;
});

// Tab update listener to detect when YouTube is loaded
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
        console.log(`Background: YouTube video page loaded in tab ${tabId}`);

        // Wait a bit for the content script to initialize fully
        setTimeout(async () => {
            // Check if the tab is ready for communication
            const ready = await isTabReady(tabId);
            if (ready) {
                console.log(`Background: Tab ${tabId} is ready for communication`);
            } else {
                console.warn(`Background: Tab ${tabId} may not be ready for communication, content script might not be loaded correctly`);
            }
        }, 2000); // 2 second delay to wait for content script
    }
});

// Set up context menu for quick access
chrome.runtime.onInstalled.addListener(() => {
    console.log('Background: Extension installed/updated, setting up context menu');
    chrome.contextMenus.create({
        id: 'save-youtube-moment',
        title: 'Save this YouTube moment',
        contexts: ['page'],
        documentUrlPatterns: ['*://*.youtube.com/watch?*']
    });
});

chrome.contextMenus.onClicked.addListener((info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    console.log('Background: Context menu clicked', { info, tabId: tab?.id });
    if (info.menuItemId === 'save-youtube-moment' && tab && tab.id !== undefined) {
        const tabId = tab.id;  // Safe to use now

        // First check if the tab is ready
        isTabReady(tabId).then(ready => {
            if (ready) {
                // Send message to content script to get current time and open save dialog
                chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_TIME' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Background: Error sending GET_CURRENT_TIME message:', chrome.runtime.lastError);
                        return;
                    }
                    console.log('Background: Received response from GET_CURRENT_TIME:', response);
                });
            } else {
                console.error('Background: Tab not ready for communication');
                // Could show a notification here
            }
        });
    }
});

// Get all moments from storage
async function getAllMoments() {
    console.log('Background: Getting all moments from storage');

    try {
        const result = await chrome.storage.local.get('youtubeVideoMoments');
        const data = result.youtubeVideoMoments || { videos: {} };

        console.log('Background: Retrieved data from storage:', data);

        // Convert to array format expected by popup
        return Object.entries(data.videos || {}).map(([videoId, videoData]: [string, any]) => {
            return {
                videoId,
                videoTitle: videoData.videoTitle || 'Untitled Video',
                moments: videoData.moments || []
            };
        });
    } catch (error) {
        console.error('Background: Error getting all moments:', error);
        throw error;
    }
}

// Delete a specific moment
async function deleteMoment(videoId: string, momentId: string) {
    console.log(`Background: Deleting moment ${momentId} from video ${videoId}`);

    try {
        const result = await chrome.storage.local.get('youtubeVideoMoments');
        const data = result.youtubeVideoMoments || { videos: {} };

        console.log('Background: Retrieved data for deletion:', data);

        // Check if the video and moment exist
        if (data.videos[videoId] &&
            data.videos[videoId].moments) {

            // Remove the moment from the array
            data.videos[videoId].moments = data.videos[videoId].moments.filter((m: VideoMoment) => m.id !== momentId);

            // If no moments left for this video, remove the video entry
            if (data.videos[videoId].moments.length === 0) {
                delete data.videos[videoId];
            }

            // Save the updated data
            await chrome.storage.local.set({ youtubeVideoMoments: data });
            console.log('Background: Moment deleted successfully');
        } else {
            console.warn('Background: Moment not found, nothing to delete');
        }
    } catch (error) {
        console.error('Background: Error deleting moment:', error);
        throw error;
    }
}

// Add a tag to a moment
async function addTagToMoment(videoId: string, momentId: string, tag: string) {
    console.log(`Background: Adding tag "${tag}" to moment ${momentId} in video ${videoId}`);

    try {
        const result = await chrome.storage.local.get('youtubeVideoMoments');
        const data = result.youtubeVideoMoments || { videos: {} };

        console.log('Background: Retrieved data for tag addition:', data);

        // Find the moment
        if (data.videos[videoId] && data.videos[videoId].moments) {
            const momentIndex = data.videos[videoId].moments.findIndex((m: VideoMoment) => m.id === momentId);

            if (momentIndex >= 0) {
                const moment = data.videos[videoId].moments[momentIndex];

                // Initialize tags array if it doesn't exist
                if (!moment.tags) {
                    moment.tags = [];
                }

                // Add the tag if it doesn't already exist
                if (!moment.tags.includes(tag)) {
                    moment.tags.push(tag);

                    // Save the updated data
                    await chrome.storage.local.set({ youtubeVideoMoments: data });
                    console.log('Background: Tag added successfully');
                } else {
                    console.log('Background: Tag already exists, not adding again');
                }
            } else {
                throw new Error('Moment not found');
            }
        } else {
            throw new Error('Video not found');
        }
    } catch (error) {
        console.error('Background: Error adding tag to moment:', error);
        throw error;
    }
}

// Remove a tag from a moment
async function removeTagFromMoment(videoId: string, momentId: string, tag: string) {
    console.log(`Background: Removing tag "${tag}" from moment ${momentId} in video ${videoId}`);

    try {
        const result = await chrome.storage.local.get('youtubeVideoMoments');
        const data = result.youtubeVideoMoments || { videos: {} };

        console.log('Background: Retrieved data for tag removal:', data);

        // Find the moment
        if (data.videos[videoId] && data.videos[videoId].moments) {
            const momentIndex = data.videos[videoId].moments.findIndex((m: VideoMoment) => m.id === momentId);

            if (momentIndex >= 0) {
                const moment = data.videos[videoId].moments[momentIndex];

                // If there are tags and the tag exists, remove it
                if (moment.tags && moment.tags.includes(tag)) {
                    moment.tags = moment.tags.filter((t: string) => t !== tag);

                    // Save the updated data
                    await chrome.storage.local.set({ youtubeVideoMoments: data });
                    console.log('Background: Tag removed successfully');
                } else {
                    console.log('Background: Tag not found, nothing to remove');
                }
            } else {
                throw new Error('Moment not found');
            }
        } else {
            throw new Error('Video not found');
        }
    } catch (error) {
        console.error('Background: Error removing tag from moment:', error);
        throw error;
    }
} 