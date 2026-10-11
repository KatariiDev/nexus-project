import React, { createContext, useContext, useState } from 'react';

interface UICtx {
  openTaskId: string | null;
  openTask: (id: string | null) => void;
  quickCreateOpen: boolean;
  setQuickCreateOpen: (v: boolean) => void;
  quickCreateTab: string;
  setQuickCreateTab: (v: string) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}

const Ctx = createContext<UICtx | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateTab, setQuickCreateTab] = useState('task');
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <Ctx.Provider
      value={{
        openTaskId,
        openTask: setOpenTaskId,
        quickCreateOpen,
        setQuickCreateOpen,
        quickCreateTab,
        setQuickCreateTab,
        searchOpen,
        setSearchOpen,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
