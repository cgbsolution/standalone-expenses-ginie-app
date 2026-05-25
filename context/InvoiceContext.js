// context/InvoiceContext.js

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create the context
const InvoiceContext = createContext();

// Custom hook to use the InvoiceContext
export const useInvoiceContext = () => useContext(InvoiceContext);

// Provider component
export const InvoiceProvider = ({ children }) => {
  const [invoices, setInvoices] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load invoices from AsyncStorage on app start
  useEffect(() => {
    loadInvoicesFromStorage();
  }, []);

  // Save invoices to AsyncStorage whenever invoices change
  useEffect(() => {
    if (isLoaded) {
      saveInvoicesToStorage(invoices);
    }
  }, [invoices, isLoaded]);

  const loadInvoicesFromStorage = async () => {
    try {
      const storedInvoices = await AsyncStorage.getItem('expense_invoices');
      if (storedInvoices) {
        const parsedInvoices = JSON.parse(storedInvoices);
        setInvoices(parsedInvoices);
        console.log('Invoices loaded from AsyncStorage:', parsedInvoices);
      }
    } catch (error) {
      console.error('Error loading invoices from AsyncStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveInvoicesToStorage = async (invoicesData) => {
    try {
      await AsyncStorage.setItem('expense_invoices', JSON.stringify(invoicesData));
      console.log('Invoices saved to AsyncStorage');
    } catch (error) {
      console.error('Error saving invoices to AsyncStorage:', error);
    }
  };

  const addInvoice = (invoice) => {
    setInvoices((prevInvoices) => [...prevInvoices, invoice]);
  };

  const deleteInvoice = (index) => {
    setInvoices((prevInvoices) => prevInvoices.filter((_, i) => i !== index));
  };

  const updateInvoice = (index, updatedInvoice) => {
    setInvoices((prevInvoices) => 
      prevInvoices.map((invoice, i) => 
        i === index ? { ...invoice, ...updatedInvoice } : invoice
      )
    );
  };

  const clearInvoices = async () => {
    setInvoices([]);
    await AsyncStorage.removeItem('expense_invoices');
  };

  return (
    <InvoiceContext.Provider
      value={{
        invoices,
        setInvoices,
        addInvoice,
        deleteInvoice,
        updateInvoice,
        clearInvoices,
      }}
    >
      {children}
    </InvoiceContext.Provider>
  );
};
