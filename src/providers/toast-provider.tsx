"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import styles from "./toast-provider.module.css";

export type ToastTone = "success" | "error" | "info" | "gold";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds on screen. Errors linger longer because they need reading. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastRecord extends Required<Pick<ToastOptions, "title" | "tone" | "duration">> {
  id: number;
  description?: string;
  action?: ToastOptions["action"];
  leaving?: boolean;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcon: Record<ToastTone, IconName> = {
  success: "checkCircle",
  error: "warning",
  info: "sparkle",
  gold: "trophy"
};

const toneClass: Record<ToastTone, string> = {
  success: styles.success,
  error: styles.error,
  info: styles.info,
  gold: styles.gold
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  // Play the exit animation before unmounting the node.
  const dismiss = useCallback(
    (id: number) => {
      setToasts((current) =>
        current.map((item) => (item.id === id ? { ...item, leaving: true } : item))
      );
      window.setTimeout(() => remove(id), 160);
    },
    [remove]
  );

  const toast = useCallback(
    ({ title, description, tone = "info", duration, action }: ToastOptions) => {
      const id = nextId.current++;
      const life = duration ?? (tone === "error" ? 7000 : 4500);

      setToasts((current) => [...current.slice(-3), { id, title, description, tone, duration: life, action }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), life));
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, tone: "success" }),
      error: (title, description) => toast({ title, description, tone: "error" }),
      info: (title, description) => toast({ title, description, tone: "info" })
    }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.viewport} role="region" aria-label="Notifications">
        {toasts.map((item) => (
          <output
            key={item.id}
            className={`${styles.toast} ${toneClass[item.tone]} ${item.leaving ? styles.leaving : ""}`}
            aria-live={item.tone === "error" ? "assertive" : "polite"}
          >
            <Icon name={toneIcon[item.tone]} size={18} className={styles.icon} />
            <span className={styles.body}>
              <span className={styles.title}>{item.title}</span>
              {item.description ? <span className={styles.description}>{item.description}</span> : null}
              {item.action ? (
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    item.action?.onClick();
                    dismiss(item.id);
                  }}
                >
                  {item.action.label}
                </button>
              ) : null}
            </span>
            <button
              type="button"
              className={styles.dismiss}
              aria-label="Dismiss notification"
              onClick={() => dismiss(item.id)}
            >
              <Icon name="close" size={14} strokeWidth={2.2} />
            </button>
            <span className={styles.timer} style={{ animationDuration: `${item.duration}ms` }} />
          </output>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
};
