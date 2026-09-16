import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type MachineViewMode = 'table' | 'grid';

interface UiState {
  sidebarCollapsed: boolean;
  machineViewMode: MachineViewMode;
  mobileNavOpen: boolean;
  toggleSidebar(): void;
  setMachineViewMode(mode: MachineViewMode): void;
  setMobileNavOpen(open: boolean): void;
}

/** Client-only UI preferences. Layout choices persist per browser; transient state does not. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      machineViewMode: 'table',
      mobileNavOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setMachineViewMode: (machineViewMode) => set({ machineViewMode }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
    }),
    {
      name: 'maintenance-monitor-ui',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, machineViewMode: state.machineViewMode }),
    },
  ),
);
