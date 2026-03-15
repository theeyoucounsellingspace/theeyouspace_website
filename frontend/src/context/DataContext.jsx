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
            // Fetch in parallel
            const [slotData, proData] = await Promise.all([
                fetchSlots(),
                fetchProfessionals()
            ]);

            setSlots(slotData);
            setProfessionals(proData);
            setLoading(false);

            // Cache professionals for next time (Slots change too fast to cache long-term, but bios are stable)
            localStorage.setItem('tys_pros_cache', JSON.stringify(proData));
        } catch (err) {
            console.error('[DataContext] Background fetch failed:', err);
            setError(err.message);
            // Don't set loading to false if we have no data at all
            if (!professionals.length) setLoading(false);
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
