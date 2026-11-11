#!/bin/sh
# Mirrors the OS light/dark setting into Spotify's xpui folder so theme.js can follow it.
# Spotify's embedded Chromium is launched with --force-dark-mode, so prefers-color-scheme
# can't be used. Installed and started by install.sh; not meant to be run by hand.
#
#   system-theme-watcher.sh --once <xpui-folder>   sync once and exit (macOS, run by launchd)
#   system-theme-watcher.sh <xpui-folder>          keep syncing (Linux, run by systemd or autostart)

RECHECK_SECONDS=30

read_theme() {
  case "$(uname -s)" in
    Darwin)
      if [ "$(defaults read -g AppleInterfaceStyle 2>/dev/null)" = "Dark" ]; then
        echo dark
      else
        echo light
      fi
      ;;
    *)
      # org.freedesktop.appearance color-scheme: 1 = prefer dark, 2 = prefer light, 0 = no preference.
      value=$(gdbus call --session --dest org.freedesktop.portal.Desktop \
        --object-path /org/freedesktop/portal/desktop \
        --method org.freedesktop.portal.Settings.ReadOne \
        org.freedesktop.appearance color-scheme 2>/dev/null | grep -o 'uint32 [0-9]' | grep -o '[0-9]')
      if [ -z "$value" ]; then
        case "$(gsettings get org.gnome.desktop.interface color-scheme 2>/dev/null)" in
          *prefer-dark*) value=1 ;;
          *) value=0 ;;
        esac
      fi
      if [ "$value" = "1" ]; then echo dark; else echo light; fi
      ;;
  esac
}

# The xpui folder is recreated by "spicetify apply", so the file is rewritten whenever it is missing or stale.
sync_theme() {
  [ -d "$XPUI" ] || return 0
  theme=$(read_theme)
  if [ "$(cat "$XPUI/system-theme.txt" 2>/dev/null)" != "$theme" ]; then
    echo "$theme" >"$XPUI/system-theme.txt" 2>/dev/null
  fi
}

once=0
if [ "$1" = "--once" ]; then
  once=1
  shift
fi
XPUI=$1
[ -n "$XPUI" ] || { echo "usage: $0 [--once] <xpui-folder>" >&2; exit 1; }

sync_theme
[ "$once" = 1 ] && exit 0

# Applies theme changes immediately when a watcher tool is available; the loop below covers everything else.
if command -v gdbus >/dev/null 2>&1; then
  gdbus monitor --session --dest org.freedesktop.portal.Desktop --object-path /org/freedesktop/portal/desktop 2>/dev/null |
    while read -r line; do
      case "$line" in *color-scheme*) sync_theme ;; esac
    done &
elif command -v gsettings >/dev/null 2>&1; then
  gsettings monitor org.gnome.desktop.interface color-scheme 2>/dev/null |
    while read -r _; do sync_theme; done &
fi

while sleep "$RECHECK_SECONDS"; do
  sync_theme
done
