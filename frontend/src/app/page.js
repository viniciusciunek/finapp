import LoginLinks from '@/app/LoginLinks'
import ApplicationLogo from '@/components/ApplicationLogo'

import { Button } from '@nextui-org/button'

import CustomButton from '@/components/CustomButton'

export const metadata = {
    title: 'FinApp - Controle de Custo',
}

const Home = () => {
    return (
        <>
            <div className="relative flex items-top justify-center min-h-screen bg-background sm:items-center sm:pt-0">
                <LoginLinks />

                <div className="max-w-6xl mx-auto sm:px-6 lg:px-8 ">
                    <ApplicationLogo className="w-20 h-20 fill-current text-gray-500" />

                    <CustomButton />

                    <div className="bg-warning p-2">
                        <p className="bg-primary p-2">primaryy</p>
                        <p className="bg-secondary p-2">secondary</p>
                        <p className="bg-background p-2">background</p>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Home
