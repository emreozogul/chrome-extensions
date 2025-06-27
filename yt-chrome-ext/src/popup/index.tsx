import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

interface Moment {
    id: string;
    timestamp: number;
    formattedTimestamp: string;
    note: string;
    createdAt: number;
    tags?: string[];
}

interface VideoMoments {
    videoId: string;
    videoTitle: string;
    moments: Moment[];
}

// Debounce hook for search term to avoid excessive re-renders
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

const App: React.FC = () => {
    const [moments, setMoments] = useState<VideoMoments[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<string>('newest');
    const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
    const [currentEditingMoment, setCurrentEditingMoment] = useState<{ videoId: string, momentId: string } | null>(null);
    const [newTag, setNewTag] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Load moments from storage
    useEffect(() => {
        const loadMoments = async () => {
            setLoading(true);
            try {
                // Ask the background script for all stored moments
                chrome.runtime.sendMessage({ type: 'GET_ALL_MOMENTS' }, (response) => {
                    if (chrome.runtime.lastError) {
                        setError(`Error: ${chrome.runtime.lastError.message}`);
                        setLoading(false);
                        return;
                    }

                    if (response && response.success) {
                        setMoments(response.data || []);
                    } else {
                        const errorMessage = response?.error || 'Failed to load moments';
                        console.error('Error loading moments:', errorMessage);
                        setError(errorMessage);
                    }
                    setLoading(false);
                });
            } catch (err) {
                const errorMessage = `Error loading moments: ${err instanceof Error ? err.message : String(err)}`;
                console.error(errorMessage, err);
                setError(errorMessage);
                setLoading(false);
            }
        };

        loadMoments();
    }, []);

    // Filter and sort moments based on search term, active filter, and sort order
    const filteredMoments = useMemo(() => {
        if (!moments.length) return [];

        let result = [...moments];

        // Apply search filter
        if (debouncedSearchTerm.trim()) {
            const search = debouncedSearchTerm.toLowerCase();
            result = result.filter(video => {
                // Search in video title
                if (video.videoTitle.toLowerCase().includes(search)) return true;

                // Search in moment notes
                const hasMomentMatch = video.moments.some(moment =>
                    moment.note?.toLowerCase().includes(search) ||
                    moment.formattedTimestamp.includes(search) ||
                    moment.tags?.some(tag => tag.toLowerCase().includes(search))
                );

                return hasMomentMatch;
            });
        }

        // Apply time filter
        if (activeFilter !== 'all') {
            const now = Date.now();
            const dayInMs = 24 * 60 * 60 * 1000;
            const weekInMs = 7 * dayInMs;
            const monthInMs = 30 * dayInMs;

            // Calculate the cutoff timestamps for each filter
            const todayCutoff = new Date();
            todayCutoff.setHours(0, 0, 0, 0);
            const todayTimestamp = todayCutoff.getTime();

            const weekCutoff = new Date();
            weekCutoff.setDate(weekCutoff.getDate() - 7);
            weekCutoff.setHours(0, 0, 0, 0);
            const weekTimestamp = weekCutoff.getTime();

            const monthCutoff = new Date();
            monthCutoff.setMonth(monthCutoff.getMonth() - 1);
            monthCutoff.setHours(0, 0, 0, 0);
            const monthTimestamp = monthCutoff.getTime();

            result = result.map(video => {
                let filteredMoments = [...video.moments];

                switch (activeFilter) {
                    case 'today':
                        filteredMoments = filteredMoments.filter(m => m.createdAt >= todayTimestamp);
                        break;
                    case 'week':
                        filteredMoments = filteredMoments.filter(m => m.createdAt >= weekTimestamp);
                        break;
                    case 'month':
                        filteredMoments = filteredMoments.filter(m => m.createdAt >= monthTimestamp);
                        break;
                }

                return { ...video, moments: filteredMoments };
            }).filter(video => video.moments.length > 0);
        }

        // Apply sorting
        result = result.map(video => {
            const sortedMoments = [...video.moments].sort((a, b) => {
                if (sortOrder === 'newest') {
                    return b.createdAt - a.createdAt;
                } else if (sortOrder === 'oldest') {
                    return a.createdAt - b.createdAt;
                } else if (sortOrder === 'timestamp') {
                    return a.timestamp - b.timestamp;
                }
                return 0;
            });

            return { ...video, moments: sortedMoments };
        });

        return result;
    }, [moments, debouncedSearchTerm, activeFilter, sortOrder]);

    // Handle deleting a moment
    const handleDeleteMoment = useCallback((videoId: string, momentId: string) => {
        chrome.runtime.sendMessage({
            type: 'DELETE_MOMENT',
            payload: { videoId, momentId }
        }, (response) => {
            if (chrome.runtime.lastError) {
                setError(`Error: ${chrome.runtime.lastError.message}`);
                return;
            }

            if (response && response.success) {
                // Update local state
                setMoments(prevMoments => {
                    return prevMoments.map(video => {
                        if (video.videoId === videoId) {
                            return {
                                ...video,
                                moments: video.moments.filter(m => m.id !== momentId)
                            };
                        }
                        return video;
                    }).filter(video => video.moments.length > 0);
                });
            } else {
                setError(response?.error || 'Failed to delete moment');
            }
        });
    }, []);

    // Handle opening YouTube at a specific moment
    const handleOpenMoment = useCallback((videoId: string, timestamp: number) => {
        const url = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestamp)}s`;
        chrome.tabs.create({ url });
    }, []);

    // Tag management functions
    const openTagModal = (videoId: string, momentId: string) => {
        setCurrentEditingMoment({ videoId, momentId });
        setIsTagModalOpen(true);
    };

    const closeTagModal = () => {
        setIsTagModalOpen(false);
        setCurrentEditingMoment(null);
        setNewTag('');
    };

    const addTag = () => {
        if (!newTag.trim() || !currentEditingMoment) return;

        const { videoId, momentId } = currentEditingMoment;

        chrome.runtime.sendMessage({
            type: 'ADD_TAG_TO_MOMENT',
            payload: { videoId, momentId, tag: newTag.trim() }
        }, (response) => {
            if (chrome.runtime.lastError) {
                setError(`Error: ${chrome.runtime.lastError.message}`);
                return;
            }

            if (response && response.success) {
                // Update local state
                setMoments(prevMoments => {
                    return prevMoments.map(video => {
                        if (video.videoId === videoId) {
                            return {
                                ...video,
                                moments: video.moments.map(moment => {
                                    if (moment.id === momentId) {
                                        const updatedTags = moment.tags ? [...moment.tags, newTag.trim()] : [newTag.trim()];
                                        return { ...moment, tags: updatedTags };
                                    }
                                    return moment;
                                })
                            };
                        }
                        return video;
                    });
                });
                setNewTag('');
            } else {
                setError(response?.error || 'Failed to add tag');
            }
        });
    };

    const removeTag = (videoId: string, momentId: string, tag: string) => {
        chrome.runtime.sendMessage({
            type: 'REMOVE_TAG_FROM_MOMENT',
            payload: { videoId, momentId, tag }
        }, (response) => {
            if (chrome.runtime.lastError) {
                setError(`Error: ${chrome.runtime.lastError.message}`);
                return;
            }

            if (response && response.success) {
                // Update local state
                setMoments(prevMoments => {
                    return prevMoments.map(video => {
                        if (video.videoId === videoId) {
                            return {
                                ...video,
                                moments: video.moments.map(moment => {
                                    if (moment.id === momentId) {
                                        return { ...moment, tags: moment.tags?.filter(t => t !== tag) };
                                    }
                                    return moment;
                                })
                            };
                        }
                        return video;
                    });
                });
            } else {
                setError(response?.error || 'Failed to remove tag');
            }
        });
    };

    const getCurrentMoment = () => {
        if (!currentEditingMoment) return null;

        const { videoId, momentId } = currentEditingMoment;
        const video = moments.find(v => v.videoId === videoId);
        if (!video) return null;

        return video.moments.find(m => m.id === momentId);
    };

    // Render tag modal
    const renderTagModal = () => {
        const moment = getCurrentMoment();
        if (!isTagModalOpen || !moment) return null;

        return (
            <div className="tag-modal-overlay">
                <div className="tag-modal">
                    <h2>Manage Tags</h2>
                    <div className="tag-input-container">
                        <input
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            placeholder="Enter a new tag"
                            onKeyDown={(e) => e.key === 'Enter' && addTag()}
                        />
                        <button onClick={addTag}>Add</button>
                    </div>

                    <div className="current-tags">
                        {moment.tags?.length ? (
                            <div className="tag-list">
                                {moment.tags.map((tag, index) => (
                                    <div key={index} className="tag-item">
                                        <span>{tag}</span>
                                        <button onClick={() => removeTag(currentEditingMoment!.videoId, currentEditingMoment!.momentId, tag)}>×</button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-tags">No tags added yet</p>
                        )}
                    </div>

                    <div className="tag-modal-actions">
                        <button onClick={closeTagModal}>Close</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="app">
            <header className="header">
                <h1>YouTube Moments</h1>

                <div className="search-container">
                    <input
                        type="text"
                        placeholder="Search moments..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filters">
                    <div className="filter-group">
                        <label>Filter:</label>
                        <div className="filter-buttons">
                            <button
                                title='All'
                                className={activeFilter === 'all' ? 'active' : ''}
                                onClick={() => setActiveFilter('all')}
                            >
                                All
                            </button>
                            <button
                                title='Today'
                                className={activeFilter === 'today' ? 'active' : ''}
                                onClick={() => setActiveFilter('today')}
                            >
                                Today
                            </button>
                            <button
                                title='This Week'
                                className={activeFilter === 'week' ? 'active' : ''}
                                onClick={() => setActiveFilter('week')}
                            >
                                This Week
                            </button>
                            <button
                                title='This Month'
                                className={activeFilter === 'month' ? 'active' : ''}
                                onClick={() => setActiveFilter('month')}
                            >
                                This Month
                            </button>
                        </div>
                    </div>

                    <div className="sort-group">
                        <label>Sort by:</label>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="sort-select"
                            aria-label="Sort moments by"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="timestamp">Video Timeline</option>
                        </select>
                    </div>
                </div>
            </header>

            <main className="content">
                {loading ? (
                    <div className="loading">Loading your moments...</div>
                ) : error ? (
                    <div className="error">{error}</div>
                ) : filteredMoments.length === 0 ? (
                    searchTerm ? (
                        <div className="empty-state">
                            <p>No moments match your search criteria.</p>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <h2>No moments saved yet</h2>
                            <p>Watch a YouTube video and click the "Save Moment" button to save interesting timestamps.</p>
                        </div>
                    )
                ) : (
                    <div className="moments-list">
                        {filteredMoments.map((video) => (
                            <div key={video.videoId} className="video-group">
                                <div className="video-header">
                                    <h2 className="video-title" title={video.videoTitle}>
                                        {video.videoTitle}
                                    </h2>
                                    <a
                                        href={`https://www.youtube.com/watch?v=${video.videoId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="video-link"
                                    >
                                        Open Video
                                    </a>
                                </div>

                                <div className="moments-container">
                                    {video.moments.map((moment) => (
                                        <div key={moment.id} className="moment-card">
                                            <div className="moment-header">
                                                <div
                                                    className="timestamp"
                                                    onClick={() => handleOpenMoment(video.videoId, moment.timestamp)}
                                                    title="Click to open video at this timestamp"
                                                >
                                                    <span className="timestamp-icon">⏱</span>
                                                    <span className="timestamp-value">{moment.formattedTimestamp}</span>
                                                </div>
                                                <div className="moment-actions">
                                                    <button
                                                        className="tag-button"
                                                        onClick={() => openTagModal(video.videoId, moment.id)}
                                                        title={moment.tags?.length ? "Manage tags" : "Add tags"}
                                                    >
                                                        {moment.tags?.length ? `Tags (${moment.tags.length})` : 'Add Tags'}
                                                    </button>
                                                    <button
                                                        className="delete-button"
                                                        onClick={() => handleDeleteMoment(video.videoId, moment.id)}
                                                        title="Delete this moment"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>

                                            {moment.note && (
                                                <div className="moment-note">
                                                    <div className="note-label">Note:</div>
                                                    <div className="note-content">{moment.note}</div>
                                                </div>
                                            )}

                                            {moment.tags && moment.tags.length > 0 && (
                                                <div className="moment-tags">
                                                    {moment.tags.map((tag, index) => (
                                                        <span key={index} className="tag">{tag}</span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="moment-meta">
                                                {moment.createdAt && (
                                                    <div className="moment-date">
                                                        Saved on {new Date(moment.createdAt).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {renderTagModal()}
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root')); 