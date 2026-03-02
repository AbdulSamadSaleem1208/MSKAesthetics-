import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type NotifContextValue = {
  notify: (msg: string) => void;
  message: string;
  show: boolean;
};

const NotifContext = createContext<NotifContextValue | null>(null);

export function NotifProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  const timerRef = useRef<number | null>(null);

  const notify = useCallback((msg: string) => {
    setMessage(msg);
    setShow(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setShow(false);
    }, 2600);
  }, []);

  const value = useMemo(() => ({ notify, message, show }), [notify, message, show]);

  return <NotifContext.Provider value={value}>{children}</NotifContext.Provider>;
}

export function useNotif(): (msg: string) => void {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error('NotifContext missing');
  return ctx.notify;
}

export function Notif() {
  const ctx = useContext(NotifContext);
  if (!ctx) return null;
  return (
    <div className={ctx.show ? 'notif show' : 'notif'} id="notif">
      {ctx.message}
    </div>
  );
}
