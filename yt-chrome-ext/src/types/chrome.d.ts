// This file provides basic type definitions for Chrome extension API

declare namespace chrome {
    namespace runtime {
        export interface MessageSender {
            tab?: tabs.Tab;
            frameId?: number;
            id?: string;
            url?: string;
            tlsChannelId?: string;
            origin?: string;
        }

        export function sendMessage(
            message: any,
            responseCallback?: (response: any) => void
        ): void;

        export const onMessage: {
            addListener(
                callback: (
                    message: any,
                    sender: MessageSender,
                    sendResponse: (response?: any) => void
                ) => boolean | void
            ): void;
        };

        export interface InstalledDetails {
            reason: string;
            [key: string]: any;
        }

        export const onInstalled: {
            addListener(callback: (details: InstalledDetails) => void): void;
        };
    }

    namespace tabs {
        export interface Tab {
            id?: number;
            url?: string;
            title?: string;
            active: boolean;
            [key: string]: any;
        }

        export function query(
            queryInfo: {
                active?: boolean;
                currentWindow?: boolean;
            },
            callback: (result: Tab[]) => void
        ): void;

        export function sendMessage(
            tabId: number,
            message: any,
            responseCallback?: (response: any) => void
        ): void;

        export function update(
            tabId: number,
            updateProperties: {
                url?: string;
                active?: boolean;
            }
        ): void;
    }

    namespace storage {
        export interface StorageArea {
            get(
                keys: string | string[] | Object | null,
                callback: (items: { [key: string]: any }) => void
            ): void;

            set(
                items: Object,
                callback?: () => void
            ): void;
        }

        export const local: StorageArea;
        export const sync: StorageArea;
    }

    namespace contextMenus {
        export interface OnClickData {
            menuItemId: string | number;
            [key: string]: any;
        }

        export function create(
            createProperties: {
                id?: string;
                title?: string;
                contexts?: string[];
                documentUrlPatterns?: string[];
            },
            callback?: () => void
        ): void;

        export const onClicked: {
            addListener(
                callback: (info: OnClickData, tab?: tabs.Tab) => void
            ): void;
        };
    }
} 