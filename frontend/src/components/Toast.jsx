import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
};

const colors = {
    success: 'border-green-500/30 bg-green-500/10',
    error: 'border-red-500/30 bg-red-500/10',
    info: 'border-blue-500/30 bg-blue-500/10',
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const toast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++toastId;
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
    }, []);

    const dismiss = (id) => setToasts(t => t.filter(x => x.id !== id));

    return (
        <ToastContext.Provider value={toast}>
            {children}
            {/* Toast Container — top-right corner on desktop, top-center on mobile */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 z-[9999] flex flex-col gap-2 w-[calc(100vw-2rem)] sm:w-80 pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md pointer-events-auto animate-fade-in ${colors[t.type]}`}
                        style={{ animation: 'slideDown 0.25s ease-out' }}
                    >
                        {icons[t.type]}
                        <p className="flex-1 text-sm text-white leading-snug">{t.message}</p>
                        <button onClick={() => dismiss(t.id)} className="text-zinc-400 hover:text-white transition-colors flex-shrink-0 mt-0.5">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </ToastContext.Provider>
    );
}

export function useToast() {
    return useContext(ToastContext);
}
