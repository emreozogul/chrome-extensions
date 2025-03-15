export interface VideoMoment {
    id: string;
    videoId: string;
    videoTitle: string;
    timestamp: number; // in seconds
    formattedTimestamp: string; // HH:MM:SS format
    note: string;
    createdAt: number; // timestamp in milliseconds
    tags?: string[]; // Array of tags associated with this moment
}

export interface VideoInfo {
    videoId: string;
    videoTitle: string;
    moments: VideoMoment[];
}

export interface StorageData {
    videos: Record<string, VideoInfo>; // videoId -> VideoInfo
}

export type MessageType =
    | 'GET_CURRENT_TIME'
    | 'CURRENT_TIME'
    | 'SAVE_MOMENT'
    | 'MOMENT_SAVED'
    | 'JUMP_TO_TIMESTAMP'
    | 'FETCH_MOMENTS'
    | 'MOMENTS_FETCHED'
    | 'DELETE_MOMENT'
    | 'PING'
    | 'PONG'
    | 'CONTENT_SCRIPT_READY'
    | 'GET_ALL_MOMENTS'
    | 'ADD_TAG_TO_MOMENT'
    | 'REMOVE_TAG_FROM_MOMENT';

export interface Message {
    type: MessageType;
    payload?: any;
} 