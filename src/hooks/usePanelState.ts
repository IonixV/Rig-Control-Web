import { useState, useEffect, useLayoutEffect } from "react";

export function usePanelState(callsign = "") {
  const ns = (key: string) =>
    callsign ? `${callsign.toUpperCase()}:${key}` : key;
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [phoneMeterTab, setPhoneMeterTab] = useState<'signal' | 'swr' | 'alc'>('signal');
  const [activeMeter, setActiveMeter] = useState<'signal' | 'swr' | 'alc' | 'vdd'>('signal');

  const [isPhoneVFOCollapsed, setIsPhoneVFOCollapsed] = useState(() => localStorage.getItem(ns("vfo-collapsed")) !== "false");
  const [isPhoneMeterCollapsed, setIsPhoneMeterCollapsed] = useState(true);
  const [isPhoneQuickControlsCollapsed, setIsPhoneQuickControlsCollapsed] = useState(true);

  const [isCompactSMeterCollapsed, setIsCompactSMeterCollapsed] = useState(() => localStorage.getItem(ns("is-compact-smeter-collapsed")) === "true");
  const [isCompactControlsCollapsed, setIsCompactControlsCollapsed] = useState(() => localStorage.getItem(ns("is-compact-controls-collapsed")) === "true");
  const [isCompactRFPowerCollapsed, setIsCompactRFPowerCollapsed] = useState(() => localStorage.getItem(ns("is-compact-rfpower-collapsed")) === "true");

  const [isAudioFeedCollapsed, setIsAudioFeedCollapsed] = useState(() => localStorage.getItem(ns("audio-feed-collapsed")) !== "false");
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(() => localStorage.getItem(ns("console-collapsed")) === "true");
  const [isSolarCollapsed, setIsSolarCollapsed] = useState(() => localStorage.getItem(ns("solar-collapsed")) === "true");
  const [isMufMapCollapsed, setIsMufMapCollapsed] = useState(() => localStorage.getItem(ns("mufmap-collapsed")) === "true");
  const [isCwDecodeCollapsed, setIsCwDecodeCollapsed] = useState(() => localStorage.getItem(ns("cwdecode-collapsed")) === "true");
  const [isComboSpotsCollapsed, setIsComboSpotsCollapsed] = useState(() => localStorage.getItem(ns("combospots-collapsed")) === "true");
  const [isSpectrumHamlibCollapsed, setIsSpectrumHamlibCollapsed] = useState(() => localStorage.getItem(ns("spectrum-hamlib-collapsed")) === "true");
  const [isSpectrumAudioCollapsed, setIsSpectrumAudioCollapsed] = useState(() => localStorage.getItem(ns("spectrum-audio-collapsed")) === "true");

  useEffect(() => {
    localStorage.setItem(ns("audio-feed-collapsed"), isAudioFeedCollapsed.toString());
  }, [isAudioFeedCollapsed]);

  useEffect(() => {
    localStorage.setItem(ns("console-collapsed"), isConsoleCollapsed.toString());
  }, [isConsoleCollapsed]);

  useEffect(() => {
    localStorage.setItem(ns("vfo-collapsed"), isPhoneVFOCollapsed.toString());
  }, [isPhoneVFOCollapsed]);

  useEffect(() => {
    localStorage.setItem(ns("solar-collapsed"), isSolarCollapsed.toString());
    localStorage.setItem(ns("mufmap-collapsed"), isMufMapCollapsed.toString());
    localStorage.setItem(ns("cwdecode-collapsed"), isCwDecodeCollapsed.toString());
    localStorage.setItem(ns("combospots-collapsed"), isComboSpotsCollapsed.toString());
    localStorage.setItem(ns("spectrum-hamlib-collapsed"), isSpectrumHamlibCollapsed.toString());
    localStorage.setItem(ns("spectrum-audio-collapsed"), isSpectrumAudioCollapsed.toString());
  }, [isSolarCollapsed, isMufMapCollapsed, isCwDecodeCollapsed, isComboSpotsCollapsed, isSpectrumHamlibCollapsed, isSpectrumAudioCollapsed]);

  useEffect(() => {
    localStorage.setItem(ns("is-compact-smeter-collapsed"), isCompactSMeterCollapsed.toString());
    localStorage.setItem(ns("is-compact-controls-collapsed"), isCompactControlsCollapsed.toString());
    localStorage.setItem(ns("is-compact-rfpower-collapsed"), isCompactRFPowerCollapsed.toString());
  }, [isCompactSMeterCollapsed, isCompactControlsCollapsed, isCompactRFPowerCollapsed]);

  // The initial useState reads above ran before login resolved (callsign === "").
  // Once callsign becomes known, re-read these two keys from their correctly
  // prefixed locations so values saved under a previous session are honored.
  useLayoutEffect(() => {
    if (!callsign) return;
    const prefix = callsign.toUpperCase();
    const storedVfo = localStorage.getItem(`${prefix}:vfo-collapsed`);
    if (storedVfo !== null) setIsPhoneVFOCollapsed(storedVfo !== "false");
    const storedCombo = localStorage.getItem(`${prefix}:combospots-collapsed`);
    if (storedCombo !== null) setIsComboSpotsCollapsed(storedCombo === "true");
  }, [callsign]);

  return {
    showSetupModal, setShowSetupModal,
    phoneMeterTab, setPhoneMeterTab,
    activeMeter, setActiveMeter,
    isPhoneVFOCollapsed, setIsPhoneVFOCollapsed,
    isPhoneMeterCollapsed, setIsPhoneMeterCollapsed,
    isPhoneQuickControlsCollapsed, setIsPhoneQuickControlsCollapsed,
    isCompactSMeterCollapsed, setIsCompactSMeterCollapsed,
    isCompactControlsCollapsed, setIsCompactControlsCollapsed,
    isCompactRFPowerCollapsed, setIsCompactRFPowerCollapsed,
    isAudioFeedCollapsed, setIsAudioFeedCollapsed,
    isConsoleCollapsed, setIsConsoleCollapsed,
    isSolarCollapsed, setIsSolarCollapsed,
    isMufMapCollapsed, setIsMufMapCollapsed,
    isCwDecodeCollapsed, setIsCwDecodeCollapsed,
    isComboSpotsCollapsed, setIsComboSpotsCollapsed,
    isSpectrumHamlibCollapsed, setIsSpectrumHamlibCollapsed,
    isSpectrumAudioCollapsed, setIsSpectrumAudioCollapsed,
  };
}
