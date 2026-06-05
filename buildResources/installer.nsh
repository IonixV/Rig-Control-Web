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

; ── Windows Defender Firewall rules ──────────────────────────────────────────
; Two inbound allow rules are added post-install:
;   TCP 3000 — HTTPS web server, scoped to the app executable only
;   UDP 4531 — CI-V spectrum scope multicast from rigctld (not app-scoped;
;              the multicast receiver runs inside the app process but netsh
;              program= filtering is unreliable for multicast UDP)
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

; ── Firewall cleanup on uninstall ────────────────────────────────────────────
; Removes both rules when the uninstaller has admin rights.  For per-user
; uninstalls without elevation the rules are left in place; users can remove
; them manually via Windows Defender Firewall.

!macro customUnInstall
  ${If} ${UAC_IsAdmin}
    nsExec::Exec `"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="RigControl Web - TCP 3000"`
    nsExec::Exec `"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="RigControl Web - UDP 4531"`
  ${EndIf}
!macroend
