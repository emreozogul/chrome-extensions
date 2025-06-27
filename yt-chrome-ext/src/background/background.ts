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
        // It's common for this to fail if the content script isn't loaded yet,
        // so we'll log it as a warning instead of an error.
        console.warn(`Background: Tab ${tabId} not ready or content script not injected:`, error);
        return false;
    }
};

// When extension is installed or updated
chrome.runtime.onInstalled.addListener(function (details: chrome.runtime.InstalledDetails) {
    console.log('Background: Extension installed or updated:', details.reason);

    // Set up context menu for quick access
    // This is done here to ensure it's set up on first install and on updates.
    chrome.contextMenus.create({
        id: 'save-youtube-moment',
        title: 'Save this YouTube moment',
        contexts: ['page'],
        documentUrlPatterns: ['*://*.youtube.com/watch?*']
    }, () => {
        if (chrome.runtime.lastError) {
            console.error('Background: Error creating context menu:', chrome.runtime.lastError);
        } else {
            console.log('Background: Context menu created successfully.');
        }
    });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message: ExtendedMessage, sender, sendResponse) => {
    console.log('Background: Received message:', message);

    const sendingTabId = sender.tab?.id;

    // Helper to handle async operations and ensure sendResponse is called
    const handleAsyncOperation = async (operation: () => Promise<any>) => {
        try {
            const result = await operation();
            sendResponse({ success: true, data: result });
        } catch (error: any) {
            console.error(`Background: Error processing ${message.type}:`, error);
            sendResponse({ success: false, error: error.message || 'An unknown error occurred' });
        }
    };

    switch (message.type) {
        case 'PING':
            console.log('Background: Received PING, sending PONG');
            sendResponse({ pong: true });
            break;

        case 'GET_CURRENT_TIME':
            console.log('Background: Received GET_CURRENT_TIME');
            if (!sendingTabId) {
                console.error('Background: No tab ID in sender for GET_CURRENT_TIME');
                sendResponse({ success: false, error: 'No tab ID in sender' });
                return true; // Keep channel open for sendResponse
            }
            // Forward the GET_CURRENT_TIME message to the content script
            chrome.tabs.sendMessage(sendingTabId, { type: 'GET_CURRENT_TIME' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Background: Error sending GET_CURRENT_TIME to content script:', chrome.runtime.lastError.message);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    return;
                }
                console.log('Background: Received response from content script for GET_CURRENT_TIME:', response);
                sendResponse(response);
            });
            break;

        case 'SAVE_MOMENT':
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
            handleAsyncOperation(async () => {
                await saveNewMoment(videoId, videoTitle, timestamp, formattedTimestamp, note);
                console.log('Background: Moment saved successfully via saveNewMoment');
            });
            break;

        case 'GET_ALL_MOMENTS':
            console.log('Background: Received GET_ALL_MOMENTS message');
            handleAsyncOperation(async () => {
                const result = await chrome.storage.local.get('youtubeVideoMoments');
                const data = result.youtubeVideoMoments || { videos: {} };
                console.log('Background: Retrieved data from storage for GET_ALL_MOMENTS:', data);
                // Convert to array format expected by popup
                return Object.entries(data.videos || {}).map(([vid, videoData]: [string, any]) => ({
                    videoId: vid,
                    videoTitle: videoData.videoTitle || 'Untitled Video',
                    moments: videoData.moments || []
                }));
            });
            break;

        case 'DELETE_MOMENT':
            console.log('Background: Received DELETE_MOMENT message with payload:', message.payload);
            const { videoId: videoIdToDelete, momentId } = message.payload || {};
            if (!videoIdToDelete || !momentId) {
                console.error('Background: Missing videoId or momentId in DELETE_MOMENT');
                sendResponse({ success: false, error: 'Missing videoId or momentId' });
                return true;
            }
            handleAsyncOperation(async () => {
                const result = await chrome.storage.local.get('youtubeVideoMoments');
                let data = result.youtubeVideoMoments || { videos: {} };
                console.log('Background: Retrieved data for deletion:', data);

                if (data.videos[videoIdToDelete]?.moments) {
                    const initialMomentCount = data.videos[videoIdToDelete].moments.length;
                    data.videos[videoIdToDelete].moments = data.videos[videoIdToDelete].moments.filter((m: VideoMoment) => m.id !== momentId);

                    if (data.videos[videoIdToDelete].moments.length === 0) {
                        delete data.videos[videoIdToDelete];
                        console.log(`Background: Video entry ${videoIdToDelete} removed as it has no more moments.`);
                    } else if (data.videos[videoIdToDelete].moments.length === initialMomentCount) {
                         console.warn(`Background: Moment with ID ${momentId} not found in video ${videoIdToDelete}. No changes made.`);
                         // Still resolve successfully as the desired state (moment gone) is achieved or was already true
                         return;
                    }
                    await chrome.storage.local.set({ youtubeVideoMoments: data });
                    console.log('Background: Moment deleted successfully from storage.');
                } else {
                    console.warn(`Background: Video ${videoIdToDelete} not found or has no moments. Nothing to delete.`);
                    // Still resolve successfully
                }
            });
            break;

        case 'ADD_TAG_TO_MOMENT':
            console.log('Background: Received ADD_TAG_TO_MOMENT message with payload:', message.payload);
            const { videoId: videoIdForTagAdd, momentId: momentIdForTagAdd, tag } = message.payload || {};
            if (!videoIdForTagAdd || !momentIdForTagAdd || !tag) {
                console.error('Background: Missing required fields in ADD_TAG_TO_MOMENT');
                sendResponse({ success: false, error: 'Missing required fields' });
                return true;
            }
            handleAsyncOperation(async () => {
                const result = await chrome.storage.local.get('youtubeVideoMoments');
                let data = result.youtubeVideoMoments || { videos: {} };
                console.log('Background: Retrieved data for tag addition:', data);

                const video = data.videos[videoIdForTagAdd];
                if (video?.moments) {
                    const moment = video.moments.find((m: VideoMoment) => m.id === momentIdForTagAdd);
                    if (moment) {
                        if (!moment.tags) moment.tags = [];
                        if (!moment.tags.includes(tag)) {
                            moment.tags.push(tag);
                            await chrome.storage.local.set({ youtubeVideoMoments: data });
                            console.log('Background: Tag added successfully.');
                        } else {
                            console.log('Background: Tag already exists, not adding again.');
                        }
                    } else {
                        throw new Error(`Moment with ID ${momentIdForTagAdd} not found in video ${videoIdForTagAdd}`);
                    }
                } else {
                    throw new Error(`Video with ID ${videoIdForTagAdd} not found`);
                }
            });
            break;

        case 'REMOVE_TAG_FROM_MOMENT':
            console.log('Background: Received REMOVE_TAG_FROM_MOMENT message with payload:', message.payload);
            const { videoId: videoIdForTagRemove, momentId: momentIdForTagRemove, tag: tagToRemove } = message.payload || {};
            if (!videoIdForTagRemove || !momentIdForTagRemove || !tagToRemove) {
                console.error('Background: Missing required fields in REMOVE_TAG_FROM_MOMENT');
                sendResponse({ success: false, error: 'Missing required fields' });
                return true;
            }
            handleAsyncOperation(async () => {
                const result = await chrome.storage.local.get('youtubeVideoMoments');
                let data = result.youtubeVideoMoments || { videos: {} };
                console.log('Background: Retrieved data for tag removal:', data);

                const video = data.videos[videoIdForTagRemove];
                if (video?.moments) {
                    const moment = video.moments.find((m: VideoMoment) => m.id === momentIdForTagRemove);
                    if (moment?.tags) {
                        const initialTagCount = moment.tags.length;
                        moment.tags = moment.tags.filter((t: string) => t !== tagToRemove);
                        if (moment.tags.length < initialTagCount) {
                            await chrome.storage.local.set({ youtubeVideoMoments: data });
                            console.log('Background: Tag removed successfully.');
                        } else {
                            console.log('Background: Tag not found, nothing to remove.');
                        }
                    } else {
                         console.log('Background: Moment not found or has no tags.');
                    }
                } else {
                    throw new Error(`Video with ID ${videoIdForTagRemove} not found`);
                }
            });
            break;

        default:
            console.warn('Background: Unknown message type', message.type);
            sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
            break;
    }

    // Return true to indicate we will respond asynchronously if needed
    return true;
});

// Tab update listener to detect when YouTube is loaded
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
        console.log(`Background: YouTube video page loaded in tab ${tabId}: ${tab.url}`);

        // Wait a bit for the content script to initialize fully
        // This is a common pattern, but can be brittle.
        // A more robust solution might involve the content script sending a "ready" message.
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

        const ready = await isTabReady(tabId);
        if (ready) {
            console.log(`Background: Tab ${tabId} is ready for communication after page load.`);
        } else {
            console.warn(`Background: Tab ${tabId} may not be ready for communication after page load.`);
            // Attempt to inject content script programmatically if it seems to be missing.
            // This requires "scripting" permission in manifest.json.
            // For now, we'll assume manifest-defined injection is sufficient.
        }
    }
});


chrome.contextMenus.onClicked.addListener(async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    console.log('Background: Context menu clicked', { info, tabId: tab?.id });
    if (info.menuItemId === 'save-youtube-moment' && tab?.id) {
        const tabId = tab.id;

        const ready = await isTabReady(tabId);
        if (ready) {
            // Send message to content script to get current time and open save dialog
            chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_TIME' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Background: Error sending GET_CURRENT_TIME from context menu:', chrome.runtime.lastError.message);
                    // Optionally, notify the user here if the content script isn't responding
                    return;
                }
                console.log('Background: Context menu action - received response from GET_CURRENT_TIME:', response);
            });
        } else {
            console.error(`Background: Tab ${tabId} not ready for communication for context menu action. Content script might be missing or unresponsive.`);
            // Consider notifying the user or attempting to inject the script if permissions allow.
        }
    }
});

// No need for the standalone getAllMoments, deleteMoment, addTagToMoment, removeTagFromMoment functions
// as their logic is now integrated into the onMessage listener with better error handling
// and direct use of storage utilities if needed (though most logic is self-contained here).
// The `saveNewMoment` from `storageUtils` is used directly.