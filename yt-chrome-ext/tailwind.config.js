/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,html}',
    ],
    theme: {
        extend: {
            colors: {
                'youtube-red': '#FF0000',
                'youtube-black': '#282828',
            },
        },
    },
    plugins: [],
} 