'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/auth'

import { ThemeSwitcher } from '@/components/ThemeSwitcher'

const LoginLinks = () => {
    const { user } = useAuth({ middleware: 'guest' })

    return (
        <div className="hidden fixed top-0 right-0 px-6 py-4 sm:block bg-primary w-full">
            <div className="flex justify-between items-center flex-row font-bold text-background">
                <ThemeSwitcher />

                <Link href="/" className="text-xl">
                    finapp
                </Link>
                <div className="flex gap-2 uppercase">
                    {user ? (
                        <Link
                            href="/dashboard"
                            className="text-sm hover:text-platinum">
                            Página Inicial
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="text-sm hover:text-platinum">
                                Entrar
                            </Link>

                            <Link
                                href="/register"
                                className="text-sm hover:text-platinum">
                                Cadastre-se
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default LoginLinks
