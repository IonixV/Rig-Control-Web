import { useState, useEffect, useRef, type Dispatch, type SetStateAction, type MutableRefObject } from "react";
import type { CwSettings, RigctldSettings } from "../types";

interface UsePttHotkeyOptions {
  connected: boolean;
  rigctldSettings: RigctldSettings;
  setRigctldSettings: Dispatch<SetStateAction<RigctldSettings>>;
  handleSetPTT: (state: boolean) => void;
  cwSettingsRef: MutableRefObject<CwSettings>;
}

const CW_BINDING_LABELS: Record<'ditKey' | 'dahKey' | 'straightKey', string> = {
  ditKey: "CW Dit",
  dahKey: "CW Dah",
  straightKey: "CW Straight Key",
};

export function usePttHotkey({
  connected,
  rigctldSettings,
  setRigctldSettings,
  handleSetPTT,
  cwSettingsRef,
}: UsePttHotkeyOptions) {
  const [pttRebindActive, setPttRebindActive] = useState(false);
  const [pttRebindError, setPttRebindError] = useState<string | null>(null);
  const pttRebindErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pttPressedRef = useRef(false);

  useEffect(() => {
    const isTypingTarget = (el: Element | null) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
    };

    const release = () => {
      if (pttPressedRef.current) {
        pttPressedRef.current = false;
        handleSetPTT(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (pttRebindActive) {
        if (isTypingTarget(document.activeElement as Element)) return;
        e.preventDefault();
        const cw = cwSettingsRef.current;
        const collision = (['ditKey', 'dahKey', 'straightKey'] as const).find(k => cw[k] === e.code);
        if (collision) {
          if (pttRebindErrorTimerRef.current) clearTimeout(pttRebindErrorTimerRef.current);
          setPttRebindError(`Already bound to ${CW_BINDING_LABELS[collision]}`);
          pttRebindErrorTimerRef.current = setTimeout(() => setPttRebindError(null), 1600);
          return;
        }
        setRigctldSettings(prev => ({ ...prev, pttKey: e.code }));
        setPttRebindActive(false);
        setPttRebindError(null);
        return;
      }

      if (!connected || !rigctldSettings.pttKey) return;
      if (isTypingTarget(document.activeElement as Element)) return;
      if (e.code !== rigctldSettings.pttKey || e.repeat || pttPressedRef.current) return;
      e.preventDefault();
      pttPressedRef.current = true;
      handleSetPTT(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === rigctldSettings.pttKey) release();
    };

    const onBlur = () => release();

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', onBlur);
      release();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rigctldSettings.pttKey, connected, pttRebindActive]);

  return {
    pttRebindActive, setPttRebindActive,
    pttRebindError,
  };
}
