; Included by electron-builder's NSIS template (build/ is buildResources).

!macro customUnInstall
  ; Updates run the old uninstaller too; only clean up on a real uninstall.
  ${ifNot} ${isUpdated}
    ; "Start with Windows" (app.setLoginItemSettings names the value after the AppUserModelId).
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.sefiuzan.owltrack"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "com.sefiuzan.owltrack"
  ${endIf}
!macroend
