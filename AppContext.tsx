import { createContext, useContext, useEffect } from 'react';
import { initializeTelegramSDK } from './teleSDK'; // Assume you have a file to handle Telegram SDK

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    useEffect(() => {
        const isTelegram = window.Telegram && window.Telegram.WebApp;
        if (isTelegram) {
            initUser(); // Call to initialize user on Telegram
        }
    }, []);

    const initUser = () => {
        // Implement your user initialization logic here.
    };

    return (
        <AppContext.Provider value={{ /* Your context values */ }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => useContext(AppContext);
