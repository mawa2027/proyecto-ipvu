import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const ToastContext = createContext(null);

let siguienteId = 0;

const ESTILOS = {
    success: {
        Icon: CheckCircleIcon,
        iconColor: 'text-green-600 dark:text-green-400',
        border: 'border-green-200 dark:border-green-500/30',
    },
    error: {
        Icon: ExclamationCircleIcon,
        iconColor: 'text-red-600 dark:text-red-400',
        border: 'border-red-200 dark:border-red-500/30',
    },
    info: {
        Icon: InformationCircleIcon,
        iconColor: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-500/30',
    },
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback((message, type) => {
        const id = ++siguienteId;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => dismissToast(id), 4000);
    }, [dismissToast]);

    const toast = {
        success: (message) => showToast(message, 'success'),
        error: (message) => showToast(message, 'error'),
        info: (message) => showToast(message, 'info'),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-full sm:max-w-sm">
                {toasts.map(({ id, message, type }) => {
                    const estilo = ESTILOS[type] || ESTILOS.success;
                    const Icon = estilo.Icon;
                    return (
                        <div
                            key={id}
                            className={`flex items-start gap-2 bg-white dark:bg-slate-900 border ${estilo.border} shadow-lg dark:shadow-black/30 rounded-xl px-4 py-3`}
                        >
                            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${estilo.iconColor}`} />
                            <span className="text-sm font-medium text-gray-800 dark:text-slate-100 whitespace-pre-line break-words">
                                {message}
                            </span>
                            <button
                                type="button"
                                onClick={() => dismissToast(id)}
                                className="ml-auto shrink-0 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast debe usarse dentro de un ToastProvider');
    }
    return ctx;
};
