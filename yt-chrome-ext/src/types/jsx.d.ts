// This file ensures TypeScript properly handles React JSX elements

import React from 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            [elemName: string]: any;
        }
    }
} 