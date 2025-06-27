import { Message } from '../types';
import { formatTimestamp } from '../utils/timeUtils';

// Add these type declarations at the top of the file to fix the TypeScript errors
interface YouTubePlayer {
  getCurrentTime: () => number;
  getDuration?: () => number;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  // Add other methods as needed
}

// Add global augmentation for window properties
declare global {
  interface Window {
    ytplayer?: {
      config?: any;
      getCurrentTime?: () => number;
    };
    yt?: {
      player?: {
        getPlayerByElement?: (element: Element) => YouTubePlayer;
      };
    };
  }
}

// To store the HTML for our custom UI components
let momentDialogHtml = '';
let savingOverlay: HTMLElement | null = null;
let momentDialog: HTMLElement | null = null;

// Get the YouTube player instance
const getYouTubePlayer = (): YouTubePlayer | null => {
  console.log('Content: Attempting to get YouTube player');

  try {
    // Method 1: Using window.document.getElementById
    const playerElement = document.getElementById('movie_player');
    if (playerElement) {
      console.log('Content: Found player via movie_player ID');

      // Verify it's the correct object by checking for expected methods
      if (playerElement && 'getCurrentTime' in playerElement) {
        console.log('Content: Verified player has getCurrentTime method');
        return playerElement as unknown as YouTubePlayer;
      }
    }

    // Method 2: Using window.document.querySelector
    const moviePlayerElement = document.querySelector('#movie_player');
    if (moviePlayerElement) {
      console.log('Content: Found player via querySelector #movie_player');

      // Verify it has the right methods
      if (moviePlayerElement && 'getCurrentTime' in moviePlayerElement) {
        console.log('Content: Verified querySelector player has getCurrentTime method');
        return moviePlayerElement as unknown as YouTubePlayer;
      }
    }

    // Method 3: Look for the HTML5 player directly
    const videoElement = document.querySelector('video.html5-main-video') as HTMLVideoElement;
    if (videoElement) {
      console.log('Content: Found HTML5 video element');

      // If we have the video element but not the API, create a wrapper
      return {
        getCurrentTime: () => {
          console.log('Content: Using direct video element currentTime');
          return videoElement.currentTime;
        },
        getDuration: () => {
          return videoElement.duration;
        }
      };
    }

    // Method 4: Using window.ytplayer object if available
    if (window.ytplayer && window.ytplayer.config) {
      console.log('Content: Found window.ytplayer');
      const ytPlayer = window.ytplayer as any;
      if (ytPlayer && ytPlayer.getCurrentTime && typeof ytPlayer.getCurrentTime === 'function') {
        return {
          getCurrentTime: () => ytPlayer.getCurrentTime()
        };
      }
    }

    // Method 5: Using window.yt object if available
    if (window.yt && window.yt.player) {
      try {
        console.log('Content: Attempting to use window.yt.player as fallback');
        // Just use this as a fallback object if it exists
        if (window.yt.player && typeof window.yt.player === 'object') {
          // Check if it has at least a getCurrentTime method
          const anyPlayer = window.yt.player as any;
          if (anyPlayer.getCurrentTime && typeof anyPlayer.getCurrentTime === 'function') {
            return anyPlayer as YouTubePlayer;
          }
        }
      } catch (err) {
        console.error('Content: Error using window.yt.player fallback:', err);
      }
    }

    // Method 6: Fallback to any video element on the page
    const anyVideo = document.querySelector('video') as HTMLVideoElement;
    if (anyVideo) {
      console.log('Content: Last resort - found generic video element');
      return {
        getCurrentTime: () => {
          return anyVideo.currentTime;
        }
      };
    }

    console.error('Content: Could not find YouTube player with any method');
    return null;
  } catch (error) {
    console.error('Content: Error getting YouTube player:', error);
    return null;
  }
};

// Get current video ID
const getVideoId = (): string => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v') || '';
};

// Get video title
const getVideoTitle = (): string => {
  const titleElement = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer');
  return titleElement ? titleElement.textContent?.trim() || '' : '';
};

// Add CSS styles for our UI components
const injectStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    /* Modern animations */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }

    /* YouTube save button styles */
    .yt-moment-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      width: 36px;
      padding: 0;
      background-color: transparent;
      border: none;
      border-radius: 50%;
      outline: none;
      cursor: pointer;
      transition: all 0.2s ease-in-out;
      opacity: 1;
    }

    .yt-moment-btn__icon {
      height: 100%;
      width: 100%;
      transform: translate(4px, -2px);
      fill: #FFFFFF;
    }

    /* Original styles for other components */
    /* YouTube-like styles for the save button */
    #yt-moment-saver-button {
      transition: transform 0.1s ease-in-out;
      
    }
    #yt-moment-saver-button > svg:hover {
      fill:rgb(182, 182, 182);
    }
    /* Main overlay */
    .yt-moment-saver-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.8);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: fadeIn 0.2s ease-out;
      backdrop-filter: blur(3px);
    }
    
    /* Dialog design */
    .yt-moment-saver-dialog-content {
      background-color: #212121;
      color: #fff;
      border-radius: 8px;
      width: 500px;
      max-width: 90%;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.3s ease-out;
      overflow: hidden;
      transform-origin: center;
    }
    
    /* Header section */
    .yt-moment-saver-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      background-color: #0f0f0f;
      color: white;
      border-bottom: 1px solid #383838;
    }
    
    .yt-moment-saver-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }
    
    .yt-moment-saver-close-button {
      background: none;
      border: none;
      color: #aaa;
      font-size: 22px;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
    }
    
    .yt-moment-saver-close-button:hover {
      color: white;
      background-color: rgba(255,255,255,0.1);
    }
    
    /* Body section */
    .yt-moment-saver-body {
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .yt-moment-saver-form-group {
      margin-bottom: 4px;
    }
    
    .yt-moment-saver-label {
      display: block;
      margin-bottom: 10px;
      color: #CCCCCC;
      font-size: 14px;
    }
    
    .yt-moment-saver-time {
      background-color: #0f0f0f;
      color: #FF0000;
      padding: 12px 16px;
      font-size: 18px;
      font-weight: 500;
      border-radius: 4px;
      display: inline-block;
      margin-top: 0;
      letter-spacing: 0.5px;
    }
    
    .yt-moment-saver-input, .yt-moment-saver-textarea {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #383838;
      background-color: #2a2a2a;
      border-radius: 4px;
      font-size: 15px;
      color: white;
      transition: all 0.2s;
      font-family: 'Roboto', Arial, sans-serif;
      box-sizing: border-box;
    }
    
    .yt-moment-saver-input:focus, .yt-moment-saver-textarea:focus {
      outline: none;
      border-color: #FF0000;
      box-shadow: 0 0 0 1px rgba(255, 0, 0, 0.2);
    }
    
    .yt-moment-saver-textarea {
      min-height: 100px;
      resize: vertical;
      line-height: 1.4;
      padding-right: 20px;
    }
    
    /* Footer section */
    .yt-moment-saver-footer {
      display: flex;
      justify-content: flex-end;
      padding: 20px;
      background-color: #0f0f0f;
      border-top: 1px solid #383838;
    }
    
    .yt-moment-saver-button {
      padding: 10px 20px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    
    .yt-moment-saver-button-secondary {
      background-color: transparent;
      color: #AAAAAA;
      margin-right: 12px;
    }
    
    .yt-moment-saver-button-secondary:hover {
      background-color: rgba(255,255,255,0.1);
      color: white;
    }
    
    .yt-moment-saver-button-primary {
      background-color: white;
      color: #0f0f0f;
      font-weight: 500;
    }
    
    .yt-moment-saver-button-primary:hover {
      background-color: #e0e0e0;
    }
    
    /* Success notification */
    .yt-moment-saver-success {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background-color: #323232;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 9999;
      animation: slideUp 0.3s ease-out;
    }
    
    .yt-moment-saver-success-icon {
      background-color: #FF0000;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .yt-moment-saver-success-message {
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);
  console.log('Content: Styles injected');
};

// Create modal dialog for saving moments
const createMomentDialog = () => {
  // Create dialog HTML
  momentDialogHtml = `
    <div class="yt-moment-saver-overlay" role="dialog" aria-labelledby="yt-moment-saver-title">
      <div class="yt-moment-saver-dialog-content">
        <div class="yt-moment-saver-header">
          <h2 id="yt-moment-saver-title">Save YouTube Moment</h2>
          <button class="yt-moment-saver-close-button" id="yt-moment-saver-close" aria-label="Close dialog">&times;</button>
        </div>
        <div class="yt-moment-saver-body">
          <div class="yt-moment-saver-form-group">
            <label class="yt-moment-saver-label" for="yt-moment-saver-time">Current Timestamp</label>
            <div id="yt-moment-saver-time" class="yt-moment-saver-time"></div>
          </div>
          <div class="yt-moment-saver-form-group">
            <label class="yt-moment-saver-label" for="yt-moment-saver-note">Add a note about this moment</label>
            <textarea id="yt-moment-saver-note" class="yt-moment-saver-textarea" placeholder="What's happening at this moment? (optional)"></textarea>
          </div>
        </div>
        <div class="yt-moment-saver-footer">
          <button id="yt-moment-saver-cancel" class="yt-moment-saver-button yt-moment-saver-button-secondary">Cancel</button>
          <button id="yt-moment-saver-save" class="yt-moment-saver-button yt-moment-saver-button-primary">Save Moment</button>
        </div>
      </div>
    </div>
  `;

  // Check if dialog already exists
  if (document.getElementById('yt-moment-dialog')) {
    return;
  }

  // Create dialog element
  momentDialog = document.createElement('div');
  momentDialog.id = 'yt-moment-dialog';
  momentDialog.style.display = 'none';
  momentDialog.innerHTML = momentDialogHtml;
  document.body.appendChild(momentDialog);

  // Add event listeners
  document.getElementById('yt-moment-saver-close')?.addEventListener('click', closeMomentDialog);
  document.getElementById('yt-moment-saver-cancel')?.addEventListener('click', closeMomentDialog);
  document.getElementById('yt-moment-saver-save')?.addEventListener('click', saveMoment);

  console.log('Content: Moment dialog created');
};

// Show the moment dialog with the current time
const showMomentDialog = (currentTime: number) => {
  if (!momentDialog) {
    createMomentDialog();
  }

  // Set the current timestamp in the dialog
  const timestampDisplay = document.getElementById('yt-moment-saver-time');
  if (timestampDisplay) {
    timestampDisplay.textContent = formatTimestamp(currentTime);
  }

  // Show the dialog
  if (momentDialog) {
    momentDialog.style.display = 'block';

    // Add keyboard event listener for Escape key
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMomentDialog();
        document.removeEventListener('keydown', handleEscapeKey);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
  }

  // Focus the note input
  setTimeout(() => {
    document.getElementById('yt-moment-saver-note')?.focus();
  }, 100);
};

// Close the moment dialog
const closeMomentDialog = () => {
  if (momentDialog) {
    // Hide the dialog
    momentDialog.style.display = 'none';

    // Clear note input
    const noteInput = document.getElementById('yt-moment-saver-note') as HTMLTextAreaElement;
    if (noteInput) {
      noteInput.value = '';
    }
  }
};

// Save the current moment
const saveMoment = () => {
  console.log('Content: saveMoment function called');

  const player = getYouTubePlayer();
  if (!player) {
    console.error('Cannot save moment: YouTube player not found');
    alert('Error: YouTube player not found. Please refresh the page and try again.');
    return;
  }

  const currentTime = player.getCurrentTime();
  const videoId = getVideoId();
  const videoTitle = getVideoTitle();

  console.log('Content: Video information', {
    videoId,
    videoTitle,
    currentTime,
    url: window.location.href
  });

  if (!videoId) {
    console.error('Cannot save moment: Video ID not found');
    alert('Error: Could not detect YouTube video ID. Make sure you\'re on a valid YouTube video page.');
    return;
  }

  if (!videoTitle) {
    console.warn('Saving moment with empty video title');
  }

  const noteInput = document.getElementById('yt-moment-saver-note') as HTMLTextAreaElement;
  const note = noteInput?.value || '';

  const formattedTimestamp = formatTimestamp(currentTime);

  // Create payload first for debugging
  const payload = {
    videoId,
    videoTitle,
    timestamp: currentTime,
    formattedTimestamp,
    note
  };

  console.log('Content: Preparing to send SAVE_MOMENT message to background', payload);

  // Send message to background script to save the moment
  try {
    // First, check if we can communicate with the background script
    chrome.runtime.sendMessage({ type: 'PING' as any }, (pingResponse) => {
      const pingError = chrome.runtime.lastError;
      if (pingError) {
        console.error('Content: Failed to ping background script:', pingError);
        alert('Error: Cannot communicate with the extension background process. Please try reloading the page or reinstalling the extension.');
        return;
      }

      console.log('Content: Background ping successful, proceeding with save');

      // Now send the actual save message
      chrome.runtime.sendMessage({
        type: 'SAVE_MOMENT',
        payload
      }, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          console.error('Content: Chrome runtime error when sending SAVE_MOMENT:', lastError);
          alert('Error communicating with the extension: ' + lastError.message);
          return;
        }

        console.log('Content: Received save response', response);
        if (response && response.success) {
          console.log('Content: Save was successful, showing success notification');
          closeMomentDialog();
          showSavingSuccess();
        } else {
          console.error('Content: Failed to save moment', response?.error || 'No response from background');
          // Show error message to user
          alert('Failed to save moment: ' + (response?.error || 'Unknown error - check the console for more details'));
        }
      });
      console.log('Content: SAVE_MOMENT message sent to background');
    });
  } catch (error) {
    console.error('Content: Exception when sending message to background', error);
    alert('Error: ' + (error instanceof Error ? error.message : String(error)));
  }
};

// Show a success notification
const showSavingSuccess = () => {
  if (savingOverlay) {
    document.body.removeChild(savingOverlay);
  }

  savingOverlay = document.createElement('div');
  savingOverlay.className = 'yt-moment-saver-success';
  savingOverlay.innerHTML = `
    <div class="yt-moment-saver-success-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    </div>
    <span class="yt-moment-saver-success-message">Moment saved successfully!</span>
  `;

  document.body.appendChild(savingOverlay);

  // Remove after 3 seconds
  setTimeout(() => {
    if (savingOverlay && savingOverlay.parentNode) {
      savingOverlay.style.opacity = '0';
      savingOverlay.style.transform = 'translateY(-20px)';
      savingOverlay.style.transition = 'opacity 0.3s, transform 0.3s';

      // Remove from DOM after transition completes
      setTimeout(() => {
        if (savingOverlay && savingOverlay.parentNode) {
          document.body.removeChild(savingOverlay);
          savingOverlay = null;
        }
      }, 300);
    }
  }, 3000);
};

// Handle jump to timestamp
const jumpToTimestamp = (timestamp: number) => {
  const player = getYouTubePlayer();
  if (player && player.seekTo) {
    console.log('Content: Jumping to timestamp', timestamp);
    player.seekTo(timestamp, true);
  } else if (player) {
    console.error('Content: Player found but seekTo method not available');
    // Try fallback method if the main player doesn't have seekTo
    try {
      const videoElement = document.querySelector('video') as HTMLVideoElement;
      if (videoElement) {
        console.log('Content: Using video element as fallback for seeking to', timestamp);
        videoElement.currentTime = timestamp;
      }
    } catch (err) {
      console.error('Content: Failed to seek with fallback method:', err);
    }
  } else {
    console.error('Content: Cannot jump to timestamp - YouTube player not found');
  }
};

// Handle messages from background script
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  console.log('Content: Received message from background script:', message);

  // Check if we're on a YouTube watch page for certain operations
  if (message.type === 'GET_CURRENT_TIME' && !window.location.pathname.includes('/watch')) {
    console.error('Content: Not on a YouTube watch page');
    sendResponse({
      success: false,
      error: 'Not on a YouTube watch page',
      url: window.location.href,
      pathname: window.location.pathname
    });
    return true;
  }

  if (message.type === 'PING') {
    // Respond to ping to verify the content script is running
    console.log('Content: Received PING, sending PONG');
    sendResponse({ pong: true });
    return true;
  }
  else if (message.type === 'GET_CURRENT_TIME') {
    console.log('Content: Processing GET_CURRENT_TIME message');
    try {
      const player = getYouTubePlayer();
      if (player) {
        const currentTime = player.getCurrentTime();
        const videoId = getVideoId();

        console.log('Content: Sending current time:', { videoId, currentTime });
        // Show the dialog to add a title
        showMomentDialog(currentTime);

        sendResponse({
          success: true,
          videoId,
          currentTime,
          playerFound: true
        });
      } else {
        console.error('Content: Could not find YouTube player for GET_CURRENT_TIME');

        // Debug information about the page
        const videoElement = document.querySelector('video') as HTMLVideoElement | null;
        const moviePlayerElement = document.getElementById('movie_player');
        const videoData = {
          hasVideoElement: !!videoElement,
          videoCurrentTime: videoElement ? videoElement.currentTime : null,
          hasMoviePlayer: !!moviePlayerElement,
          videoId: getVideoId(),
          url: window.location.href
        };

        console.log('Content: Debug video data:', videoData);
        sendResponse({
          success: false,
          error: 'Could not find YouTube player',
          playerFound: false,
          debugInfo: videoData
        });
      }
    } catch (err: any) {
      console.error('Content: Error processing GET_CURRENT_TIME message:', err);
      sendResponse({
        success: false,
        error: err.message || 'Unknown error',
        stack: err.stack
      });
    }

    return true;
  } else if (message.type === 'JUMP_TO_TIMESTAMP') {
    const { timestamp } = message.payload;
    jumpToTimestamp(timestamp);
    sendResponse({ success: true });
    return true;
  } else {
    console.warn('Content: Unknown message type', message.type);
    sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
  }

  return true;
});

// Create and add a custom save button to YouTube's player controls
const addSaveButtonToPlayerControls = () => {
  console.log('Content: Adding save button to player controls');

  // Try different control containers for various YouTube layouts
  const controlContainers = [
    '.ytp-right-controls', // Standard controls
    '.ytp-chrome-controls', // Alternative container
    '.html5-video-container' // Last resort container
  ];

  let controlsContainer = null;
  for (const selector of controlContainers) {
    const container = document.querySelector(selector);
    if (container) {
      console.log(`Content: Found controls container with selector: ${selector}`);
      controlsContainer = container;
      break;
    }
  }

  if (!controlsContainer) {
    console.error('Content: Could not find any YouTube player controls container');
    return false;
  }

  // Check if our button already exists
  if (document.getElementById('yt-moment-btn')) {
    console.log('Content: Save button already exists');
    return true;
  }

  // Create the button
  const saveButton = document.createElement('button');
  saveButton.id = 'yt-moment-btn';
  saveButton.className = 'ytp-button yt-moment-btn';
  saveButton.title = 'Save this moment';
  saveButton.setAttribute('aria-label', 'Save this YouTube moment');
  saveButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="yt-moment-btn__icon" viewBox="0 0 36 36">
      <path d="M15,10C8.373,10,3,15.373,3,22c0,6.627,5.373,12,12,12s12-5.373,12-12C27,15.373,21.627,10,15,10z M21,23h-5v5 c0,0.553-0.448,1-1,1s-1-0.447-1-1v-5H9c-0.552,0-1-0.447-1-1s0.448-1,1-1h5v-5c0-0.553,0.448-1,1-1s1,0.447,1,1v5h5 c0.552,0,1,0.447,1,1S21.552,23,21,23z"></path>
    </svg>
  `;

  // Add event listener to the button
  saveButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Content: Save button clicked');

    try {
      const player = getYouTubePlayer();
      if (player) {
        const currentTime = player.getCurrentTime();
        console.log('Content: Detected current time:', currentTime);
        showMomentDialog(currentTime);
      } else {
        console.error('Content: Could not find YouTube player when save button was clicked');

        // Attempt to get time from video element directly as a fallback
        const videoElement = document.querySelector('video');
        if (videoElement) {
          console.log('Content: Falling back to direct video element for time');
          const currentTime = videoElement.currentTime;
          showMomentDialog(currentTime);
        } else {
          alert('Could not find YouTube player. Please refresh the page and try again.');
        }
      }
    } catch (error) {
      console.error('Content: Error handling save button click:', error);
      alert('Error processing your request. Please refresh the page and try again.');
    }
  });

  try {
    // Insert the button at the beginning of the controls container
    if (controlsContainer.querySelector('.ytp-fullscreen-button')) {
      // Insert before fullscreen button if available
      controlsContainer.insertBefore(saveButton, controlsContainer.querySelector('.ytp-fullscreen-button'));
    } else {
      // Otherwise insert at the beginning
      controlsContainer.insertBefore(saveButton, controlsContainer.firstChild);
    }
    console.log('Content: Save button added to player controls');
    return true;
  } catch (error) {
    console.error('Content: Error adding save button to controls:', error);
    return false;
  }
};

// Initialize when the page loads
const initialize = () => {
  console.log('Content: Initializing YouTube Moments Saver extension on', window.location.href);

  // Add CSS styles immediately
  injectStyles();

  // Create dialog immediately
  createMomentDialog();

  // Try to add the button immediately
  addSaveButtonToPlayerControls();

  // Wait a shorter time for YouTube to fully load before checking
  setTimeout(() => {
    // Wait for YouTube player to be ready
    let retryCount = 0;
    const maxRetries = 10;
    const retryInterval = 500; // Reduced to 500ms for faster checking

    console.log('Content: Starting player detection with faster checks');

    const checkPlayerInterval = setInterval(() => {
      retryCount++;
      console.log(`Content: Checking for YouTube player (attempt ${retryCount}/${maxRetries})`);

      const player = getYouTubePlayer();
      if (player) {
        console.log('Content: YouTube player detected successfully');
        clearInterval(checkPlayerInterval);

        // Try adding the save button again if not already present
        if (!document.getElementById('yt-moment-btn')) {
          const buttonAdded = addSaveButtonToPlayerControls();
          console.log('Content: Second attempt to add save button result:', buttonAdded);
        }

        // Set up observer to ensure button stays on player controls
        const controlsObserver = new MutationObserver((mutations, observer) => {
          if (!document.getElementById('yt-moment-btn')) {
            const controls = document.querySelector('.ytp-right-controls') || document.querySelector('.ytp-chrome-controls');
            if (controls) {
              if (addSaveButtonToPlayerControls()) {
                console.log('Content: Save button re-added via mutation observer');
              }
            }
          }
        });

        controlsObserver.observe(document.body, {
          childList: true,
          subtree: true
        });

        // Set a timeout to stop the observer after 10 seconds
        setTimeout(() => {
          controlsObserver.disconnect();
          console.log('Content: Disconnected controls observer after timeout');
        }, 10000);

        // Send a ready notification to the background script
        chrome.runtime.sendMessage({
          type: 'CONTENT_SCRIPT_READY',
          payload: {
            url: window.location.href,
            videoId: getVideoId(),
            videoTitle: getVideoTitle()
          }
        });
      } else if (retryCount >= maxRetries) {
        clearInterval(checkPlayerInterval);
        console.error('Content: Timed out waiting for YouTube player after', maxRetries, 'attempts');

        // Notify background script that we couldn't find the player
        chrome.runtime.sendMessage({
          type: 'CONTENT_SCRIPT_READY',
          payload: {
            url: window.location.href,
            playerFound: false,
            error: 'Could not find YouTube player'
          }
        });
      }
    }, retryInterval);
  }, 3000); // Initial 3 second delay to let YouTube fully load
};

// Start initialization
console.log('Content: Script loaded on ' + window.location.href);
if (window.location.href.includes('youtube.com/watch')) {
  initialize();
} else {
  console.log('Content: Not a YouTube video page, skipping initialization');
} 