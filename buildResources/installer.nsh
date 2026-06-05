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

; ── Windows Defender Firewall rule ───────────────────────────────────────────
; Adds an inbound UDP 4531 allow rule on all profiles (required for the CI-V
; spectrum scope multicast stream from rigctld).  Skipped silently if the rule
; already exists.  If the installer is running without admin rights (per-user
; install), a targeted UAC prompt is shown just for this step.

!macro customInstall
  nsExec::ExecToStack `"$SYSDIR\netsh.exe" advfirewall firewall show rule name="RigControl Web - UDP 4531"`
  Pop $0  ; exit code: 0 = rule already exists
  Pop $1  ; stdout (discard)

  ${If} $0 != 0
    ${If} ${UAC_IsAdmin}
      ; Already elevated (per-machine install) — add the rule directly.
      nsExec::Exec `"$SYSDIR\netsh.exe" advfirewall firewall add rule name="RigControl Web - UDP 4531" description="RigControl Web CI-V spectrum scope" protocol=UDP dir=in localport=4531 action=allow profile=any`
    ${Else}
      ; Per-user install — request admin only for this one command.
      MessageBox MB_ICONINFORMATION|MB_OK "A Windows UAC prompt will appear to add a firewall rule that allows the CI-V spectrum scope to receive UDP multicast on port 4531. Please approve it."
      ExecShell "runas" "$SYSDIR\netsh.exe" `advfirewall firewall add rule name="RigControl Web - UDP 4531" description="RigControl Web CI-V spectrum scope" protocol=UDP dir=in localport=4531 action=allow profile=any`
    ${EndIf}
  ${EndIf}
!macroend

; ── Firewall cleanup on uninstall ────────────────────────────────────────────
; Removes the rule when the uninstaller has admin rights.  For per-user
; uninstalls without elevation the rule is left in place; users can remove it
; manually via Windows Defender Firewall.

!macro customUnInstall
  ${If} ${UAC_IsAdmin}
    nsExec::Exec `"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="RigControl Web - UDP 4531"`
  ${EndIf}
!macroend
