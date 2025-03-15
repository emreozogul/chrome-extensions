import React, { useEffect, useState } from 'react';
import { getAllData } from '../utils/storageUtils';
import { VideoInfo, VideoMoment } from '../types';
import { formatTimestamp } from '../utils/timeUtils';

const Popup: React.FC = () => {
    const [videos, setVideos] = useState<Record<string, VideoInfo>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [currentVideoId, setCurrentVideoId] = useState<string>('');
    const [activeVideoId, setActiveVideoId] = useState<string>('');

    // Fetch all saved moments
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get current tab to check if we're on YouTube
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const currentTab = tabs[0];

                // Check if we're on a YouTube video page
                if (currentTab.url && currentTab.url.includes('youtube.com/watch')) {
                    const url = new URL(currentTab.url);
                    const videoId = url.searchParams.get('v');
                    if (videoId) {
                        setCurrentVideoId(videoId);
                        setActiveVideoId(videoId);
                    }
                }

                // Get all saved moments
                const data = await getAllData();
                setVideos(data.videos);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Jump to a specific timestamp
    const handleJumpToTimestamp = (videoId: string, timestamp: number) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab.id) {
                // If we're already on the correct video, just seek to timestamp
                if (currentVideoId === videoId) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'JUMP_TO_TIMESTAMP',
                        payload: { timestamp }
                    });
                } else {
                    // Otherwise, navigate to video at timestamp
                    const url = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestamp)}s`;
                    chrome.tabs.update(tab.id, { url });
                }
            }
        });
    };

    // Delete a moment
    const handleDeleteMoment = async (momentId: string) => {
        try {
            await chrome.runtime.sendMessage({
                type: 'DELETE_MOMENT',
                payload: { momentId }
            });

            // Update state after deletion
            const updatedVideos = { ...videos };
            for (const videoId in updatedVideos) {
                const videoInfo = updatedVideos[videoId];
                const momentIndex = videoInfo.moments.findIndex(m => m.id === momentId);

                if (momentIndex !== -1) {
                    videoInfo.moments.splice(momentIndex, 1);

                    // If no moments left, remove the video entry
                    if (videoInfo.moments.length === 0) {
                        delete updatedVideos[videoId];
                    }

                    setVideos(updatedVideos);
                    return;
                }
            }
        } catch (error) {
            console.error('Error deleting moment:', error);
        }
    };

    // Create a new moment for the current video
    const handleCreateMoment = () => {
        if (!currentVideoId) return;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_TIME' });
                window.close(); // Close the popup
            }
        });
    };

    // Format time for display
    const formatTime = (timestamp: number): string => {
        return formatTimestamp(timestamp);
    };

    // Render a moment item
    const renderMomentItem = (moment: VideoMoment) => (
        <div key={moment.id} className="bg-white rounded-lg shadow-sm p-3 mb-2 border border-gray-200">
            <div className="flex justify-between items-start">
                <button
                    onClick={() => handleJumpToTimestamp(moment.videoId, moment.timestamp)}
                    className="bg-youtube-red text-white px-2 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                >
                    {moment.formattedTimestamp}
                </button>
                <button
                    onClick={() => handleDeleteMoment(moment.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Delete moment"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
            <p className="mt-2 text-gray-700 whitespace-pre-wrap">{moment.note}</p>
            <p className="mt-1 text-xs text-gray-500">
                {new Date(moment.createdAt).toLocaleString()}
            </p>
        </div>
    );

    // Render video section
    const renderVideoSection = (videoId: string, videoInfo: VideoInfo) => (
        <div key={videoId} className="mb-6">
            <h3 className="text-lg font-medium mb-2 truncate">
                {videoInfo.videoTitle}
            </h3>
            <div>
                {videoInfo.moments
                    .slice()
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map(renderMomentItem)}
            </div>
        </div>
    );

    // Get videos array for rendering
    const getVideosArray = () => {
        return Object.entries(videos).map(([videoId, videoInfo]) => ({
            videoId,
            videoInfo: videoInfo as VideoInfo,
        }));
    };

    return (
        <div className="p-4 bg-gray-50 min-h-screen">
            <header className="mb-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-youtube-black">YouTube Moments</h1>
                {currentVideoId && (
                    <button
                        onClick={handleCreateMoment}
                        className="bg-youtube-red text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-700 transition-colors flex items-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Save Moment
                    </button>
                )}
            </header>

            {loading ? (
                <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-youtube-red"></div>
                </div>
            ) : Object.keys(videos).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-gray-300">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>No moments saved yet.</p>
                    {currentVideoId && (
                        <p className="mt-2">
                            Click "Save Moment" to save a timestamp from the current video.
                        </p>
                    )}
                </div>
            ) : (
                <div className="overflow-y-auto max-h-[350px] scrollbar-hide">
                    {/* Show current video first if it has moments */}
                    {currentVideoId && videos[currentVideoId] && (
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold mb-3 pb-1 border-b border-gray-200">
                                Current Video
                            </h2>
                            {renderVideoSection(currentVideoId, videos[currentVideoId])}
                        </div>
                    )}

                    {/* Other videos */}
                    {getVideosArray()
                        .filter(({ videoId }) => videoId !== currentVideoId)
                        .sort((a, b) => {
                            const latestA = Math.max(...a.videoInfo.moments.map(m => m.createdAt));
                            const latestB = Math.max(...b.videoInfo.moments.map(m => m.createdAt));
                            return latestB - latestA;
                        })
                        .length > 0 && (
                            <div>
                                <h2 className="text-lg font-semibold mb-3 pb-1 border-b border-gray-200">
                                    Other Videos
                                </h2>
                                {getVideosArray()
                                    .filter(({ videoId }) => videoId !== currentVideoId)
                                    .sort((a, b) => {
                                        const latestA = Math.max(...a.videoInfo.moments.map(m => m.createdAt));
                                        const latestB = Math.max(...b.videoInfo.moments.map(m => m.createdAt));
                                        return latestB - latestA;
                                    })
                                    .map(({ videoId, videoInfo }) => renderVideoSection(videoId, videoInfo))}
                            </div>
                        )}
                </div>
            )}
        </div>
    );
};

export default Popup; 