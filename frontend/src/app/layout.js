import '@/app/global.css'

import { Providers } from './providers'

const RootLayout = ({ children }) => {
    return (
        <html lang="en">
            <body className="antialiased font-sans">
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}

export const metadata = {
    title: 'FinApp - Controle de Custo',
}

export default RootLayout
