# YouTube Moments Saver - Chrome Extension

A Chrome extension that allows you to save timestamps and notes while watching YouTube videos.

## Features

- Save the current timestamp of a YouTube video with a note
- View all saved moments organized by video
- Jump directly to any saved moment
- Delete saved moments when no longer needed
- Context menu support for quick access
- Modern, clean UI with Tailwind CSS
- Fully responsive popup design

## How to Use

1. Install the extension from the Chrome Web Store (link coming soon)
2. Navigate to any YouTube video
3. Click the extension icon in your browser toolbar
4. Click "Save Moment" to save the current timestamp
5. Add your note and save
6. Access your saved moments anytime by clicking on the extension icon

## Development Setup

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

1. Clone this repository
2. Navigate to the project directory:
   ```
   cd youtube-moments-saver
   ```
3. Install dependencies:
   ```
   npm run setup
   ```
   or
   ```
   npm install
   ```

### Building the Extension

To build the extension for production:
```
npm run build
```

The built extension will be in the `dist` directory.

### Development

For development with hot reloading:
```
npm run dev
```

This will watch for changes and rebuild automatically.

### Packaging the Extension

To create a ZIP file for submission to the Chrome Web Store:
```
npm run package
```

This will create a `youtube-moments-saver.zip` file containing the contents of the `dist` directory.

### Loading the extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `dist` folder from this project
4. The extension should now be installed and ready to use

## Project Structure

- `src/background`: Background service worker script
- `src/content`: Content script that runs on YouTube pages
- `src/popup`: Popup UI components
- `src/types`: TypeScript type definitions
- `src/utils`: Utility functions
- `assets`: SVG icon files
- `scripts`: Build scripts for the extension
- `dist`: Generated distribution files (not checked into git)

## Technologies Used

- TypeScript
- React
- Tailwind CSS
- Chrome Extension API
- Webpack for bundling

## Troubleshooting

If you encounter issues during development:

1. Check console logs in the extension's background page and popup
2. Verify that content scripts are loading correctly on YouTube pages
3. Make sure all permissions are correctly set in the manifest.json
4. Remember to rebuild the extension after making changes

## License

MIT License 