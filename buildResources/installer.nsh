; RigControl Web — custom NSIS installer macros
;
; Hooks consumed by the electron-builder template:
;   customFinishPage  — replaces the default finish page
;   customInstall     — runs after files are copied, adds firewall rule
;   customUnInstall   — runs during uninstall, removes firewall rule

; ── Finish page ──────────────────────────────────────────────────────────────
; Replaces the default finish page so we can show both a "Launch" checkbox
; and an "Open documentation" checkbox.

!macro customFinishPage
  Function LaunchApp
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
  FunctionEnd

  Function OpenDocumentation
    ExecShell "open" "https://github.com/jbdubbs/Rig-Control-Web/wiki"
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"

  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Open documentation (GitHub Wiki)"
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "OpenDocumentation"

  !insertmacro MUI_PAGE_FINISH
!macroend

; ── Migrate FT4222 DLLs to %APPDATA%\RigControl Web ─────────────────────────
; On upgrade, electron-builder wipes $INSTDIR before extracting new files.
; If the user previously placed ftd2xx.dll / LibFT4222-64.dll in the install
; directory (the old documented location), copy them to %APPDATA%\RigControl Web
; (Electron's userData directory) so they survive the upgrade.
; customInit runs before the old directory is removed.

!macro customInit
  ${If} ${FileExists} "$INSTDIR\ftd2xx.dll"
  ${OrIf} ${FileExists} "$INSTDIR\LibFT4222-64.dll"
    CreateDirectory "$APPDATA\RigControl Web"
    ${If} ${FileExists} "$INSTDIR\ftd2xx.dll"
    ${AndIfNot} ${FileExists} "$APPDATA\RigControl Web\ftd2xx.dll"
      CopyFiles /SILENT "$INSTDIR\ftd2xx.dll" "$APPDATA\RigControl Web\"
    ${EndIf}
    ${If} ${FileExists} "$INSTDIR\LibFT4222-64.dll"
    ${AndIfNot} ${FileExists} "$APPDATA\RigControl Web\LibFT4222-64.dll"
      CopyFiles /SILENT "$INSTDIR\LibFT4222-64.dll" "$APPDATA\RigControl Web\"
    ${EndIf}
  ${EndIf}
!macroend

; ── Windows Defender Firewall rules ──────────────────────────────────────────
; Two inbound allow rules are added post-install:
;   TCP 3000 — HTTPS web server, scoped to the app executable only
;   UDP 4531 — CI-V spectrum scope multicast from rigctld (not app-scoped;
;              the multicast receiver runs inside the app process but netsh
;              program= filtering is unreliable for multicast UDP).  4531 is
;              the default multicast_data_port; advanced users who change the
;              port in Spectrum settings must adjust the rule manually.
; Each rule is skipped silently if it already exists.  If the installer is
; running without admin rights (per-user install), a single targeted UAC
; prompt is shown to cover both rules.

!macro customInstall
  ; Check whether the TCP 3000 rule already exists.
  nsExec::ExecToStack `"$SYSDIR\netsh.exe" advfirewall firewall show rule name="RigControl Web - TCP 3000"`
  Pop $0  ; 0 = exists
  Pop $1  ; stdout (discard)
  StrCpy $2 $0  ; save result for TCP rule

  ; Check whether the UDP 4531 rule already exists.
  nsExec::ExecToStack `"$SYSDIR\netsh.exe" advfirewall firewall show rule name="RigControl Web - UDP 4531"`
  Pop $0  ; 0 = exists
  Pop $1  ; stdout (discard)
  StrCpy $3 $0  ; save result for UDP rule

  ${If} $2 != 0
  ${OrIf} $3 != 0
    ${If} ${UAC_IsAdmin}
      ; Already elevated — add whichever rules are missing directly.
      ${If} $2 != 0
        nsExec::Exec `"$SYSDIR\netsh.exe" advfirewall firewall add rule name="RigControl Web - TCP 3000" description="RigControl Web HTTPS server" program="$INSTDIR\RIGCONTROL WEB.exe" protocol=TCP dir=in localport=3000 action=allow profile=any`
      ${EndIf}
      ${If} $3 != 0
        nsExec::Exec `"$SYSDIR\netsh.exe" advfirewall firewall add rule name="RigControl Web - UDP 4531" description="RigControl Web CI-V spectrum scope" protocol=UDP dir=in localport=4531 action=allow profile=any`
      ${EndIf}
    ${Else}
      ; Per-user install — one UAC prompt covers both missing rules.
      MessageBox MB_ICONINFORMATION|MB_OK "A Windows UAC prompt will appear to add firewall rules for RigControl Web (inbound TCP 3000 for the web interface and/or UDP 4531 for the CI-V spectrum scope). Please approve it."
      ${If} $2 != 0
        ExecShell "runas" "$SYSDIR\netsh.exe" `advfirewall firewall add rule name="RigControl Web - TCP 3000" description="RigControl Web HTTPS server" program="$INSTDIR\RIGCONTROL WEB.exe" protocol=TCP dir=in localport=3000 action=allow profile=any`
      ${EndIf}
      ${If} $3 != 0
        ExecShell "runas" "$SYSDIR\netsh.exe" `advfirewall firewall add rule name="RigControl Web - UDP 4531" description="RigControl Web CI-V spectrum scope" protocol=UDP dir=in localport=4531 action=allow profile=any`
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

; ── Optional firewall cleanup on uninstall ───────────────────────────────────
; Offers to remove the inbound firewall rules added at install time (TCP 3000
; and UDP 4531).  Defaults to "Yes" since the rules are only useful while the
; app is installed.  Skipped during a silent uninstall (left in place).  If the
; uninstaller is not elevated, a UAC prompt is shown to perform the deletion.

!macro customUnInstall
  ${IfNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON1 \
      "Remove the Windows firewall rules that were added for RigControl Web (inbound TCP 3000 and UDP 4531)?" \
      IDYES uninstallFirewall IDNO skipFirewall
    uninstallFirewall:
      ${If} ${UAC_IsAdmin}
        nsExec::Exec `"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="RigControl Web - TCP 3000"`
        nsExec::Exec `"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="RigControl Web - UDP 4531"`
      ${Else}
        ExecShell "runas" "$SYSDIR\netsh.exe" `advfirewall firewall delete rule name="RigControl Web - TCP 3000"`
        ExecShell "runas" "$SYSDIR\netsh.exe" `advfirewall firewall delete rule name="RigControl Web - UDP 4531"`
      ${EndIf}
    skipFirewall:
  ${EndIf}

  ; ── Optional user-data removal ─────────────────────────────────────────────
  ; The app stores its settings and login accounts (settings.json, users.json,
  ; auth.json, audit.json) under $APPDATA\RigControl Web — Electron's userData
  ; directory (app.setName('RigControl Web')).  These survive a normal
  ; uninstall/reinstall, which is why old logins persist.  Offer to delete them.
  ; Defaults to "No" (MB_DEFBUTTON2) so a silent uninstall or an accidental
  ; keypress preserves the data; only an explicit "Yes" removes it.
  ${IfNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
      "Also delete RigControl Web user data (saved settings and login accounts)?$\n$\nChoose No to keep them for a future reinstall." \
      IDYES uninstallUserData IDNO skipUserData
    uninstallUserData:
      RMDir /r "$APPDATA\RigControl Web"
    skipUserData:
  ${EndIf}
!macroend
