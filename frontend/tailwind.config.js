import { nextui } from '@nextui-org/react'

module.exports = {
    content: [
        './src/**/*.{js,jsx,ts,tsx}',
        './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        colors: {
            orange_crayola: '#FF6D30',
            eerie_black: '#191919',
            platinum: '#DEDEDE',
            white: '#FEFEFE',
            sunlight: '#FDFBD3',
        },
    },
    darkMode: 'class',
    plugins: [
        require('@tailwindcss/forms'),
        nextui({
            themes: {
                light: {
                    colors: {
                        primary: '#FF6D30',
                        secondary: '#DEDEDE',
                        background: '#FEFEFE',
                    },
                },
                dark: {
                    colors: {
                        primary: '#FF6D30',
                        secondary: '#DEDEDE',
                        background: '#191919',
                    },
                },
            },
        }),
    ],
}
