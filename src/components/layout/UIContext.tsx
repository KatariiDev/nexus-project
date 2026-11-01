import React, { createContext, useContext, useState } from 'react';

interface UICtx {
  openTaskId: string | null;
  openTask: (id: string | null) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}

const Ctx = createContext<UICtx | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <Ctx.Provider
      value={{
        openTaskId,
        openTask: setOpenTaskId,
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
