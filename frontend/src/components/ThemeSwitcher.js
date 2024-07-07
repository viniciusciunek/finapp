'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import { Switch, cn } from '@nextui-org/react'
import { MoonIcon } from './MoonIcon'
import { SunIcon } from './SunIcon'

export function ThemeSwitcher() {
    const [mounted, setMounted] = useState(false)
    const { theme, setTheme } = useTheme()

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light')
    }

    return (
        <div className="flex items-center gap-2  flex-row">
            <Switch
                onChange={toggleTheme}
                isSelected={theme === 'dark'}
                color="warning"
                startContent={<SunIcon />}
                endContent={<MoonIcon />}
            />
            {theme}
        </div>
    )
}
