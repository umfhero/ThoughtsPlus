/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                accent: {
                    primary: 'var(--accent-primary)',
                    secondary: 'var(--accent-secondary)',
                    light: 'var(--accent-light)',
                },
            },
            fontFamily: {
                // Primary app font - uses CSS variable for dynamic switching
                sans: ['var(--app-font)', 'Outfit', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                // Specific font families for direct use
                outfit: ['Outfit', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                inter: ['Inter', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                poppins: ['Poppins', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                playfair: ['"Playfair Display"', 'Georgia', '"Times New Roman"', 'serif'],
                handwriting: ['"Architects Daughter"', '"Comic Sans MS"', 'cursive'],
            },
        },
    },
    plugins: [],
}
