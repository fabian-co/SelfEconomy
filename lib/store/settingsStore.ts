
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  ignoreCreditCardInflows: boolean;
  ignoreDebitCardInflows: boolean;
  setIgnoreCreditCardInflows: (value: boolean) => void;
  setIgnoreDebitCardInflows: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ignoreCreditCardInflows: true, // Default: Ignore positive values in Credit Cards (payments)
      ignoreDebitCardInflows: false, // Default: Count positive values in Debit Cards (income)
      setIgnoreCreditCardInflows: (value) => set({ ignoreCreditCardInflows: value }),
      setIgnoreDebitCardInflows: (value) => set({ ignoreDebitCardInflows: value }),
    }),
    {
      name: 'self-economy-settings',
    }
  )
);
