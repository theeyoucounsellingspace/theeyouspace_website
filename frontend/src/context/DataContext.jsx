import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchSlots, fetchProfessionals } from '../utils/api';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
    // 1. Initial State: Try to pull from LocalStorage for instant render
    const [professionals, setProfessionals] = useState(() => {
        const saved = localStorage.getItem('tys_pros_cache');
        return saved ? JSON.parse(saved) : [];
    });
    
    const [slots, setSlots] = useState({ slots: [], grouped: {} });
    const [loading, setLoading] = useState(!professionals.length);
    const [error, setError] = useState(null);

    // Initial pre-fetch on App bootup
    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = async () => {
        try {
            const [slotResult, proResult] = await Promise.allSettled([
                fetchSlots(),
                fetchProfessionals()
            ]);

            if (slotResult.status === 'fulfilled') {
                setSlots(slotResult.value);
            } else {
                console.error('[DataContext] Slots fetch failed:', slotResult.reason);
                setError(slotResult.reason?.message || 'Failed to sync availability');
            }

            if (proResult.status === 'fulfilled') {
                setProfessionals(proResult.value);
                localStorage.setItem('tys_pros_cache', JSON.stringify(proResult.value));
            } else {
                console.error('[DataContext] Professionals fetch failed:', proResult.reason);
                // If we have cached pros, we're okay, otherwise we might show names without bios
            }
        } catch (err) {
            console.error('[DataContext] Global refresh error:', err);
            setError('Something went wrong connecting to the space. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const value = {
        professionals,
        slots,
        loading,
        error,
        refreshData
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) throw new Error('useData must be used within DataProvider');
    return context;
};
