#!/bin/sh
# Installs the system theme watcher for macOS (launchd agent) or Linux (systemd user service,
# XDG autostart as a fallback). Nothing needs root.
#
#   ./install.sh [xpui-folder]    xpui-folder defaults to the one from "spicetify -c"
#   ./install.sh --uninstall [xpui-folder]

set -eu

INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/autolightswitch"
SCRIPT="$INSTALL_DIR/system-theme-watcher.sh"
LABEL=com.autolightswitch.watcher
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT="$UNIT_DIR/autolightswitch-watcher.service"
AUTOSTART="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/autolightswitch-watcher.desktop"

uninstall=0
if [ "${1:-}" = "--uninstall" ]; then
  uninstall=1
  shift
fi

find_xpui() {
  if [ -n "${1:-}" ]; then
    echo "$1"
    return
  fi
  config=$(spicetify -c 2>/dev/null) || return 0
  spotify_path=$(sed -n 's/^spotify_path[[:space:]]*=[[:space:]]*//p' "$config" | head -n 1 | tr -d '\r')
  [ -n "$spotify_path" ] && echo "$spotify_path/Apps/xpui"
  return 0
}

XPUI=$(find_xpui "${1:-}")
if [ -z "$XPUI" ]; then
  echo "Could not find Spotify's xpui folder. Run 'spicetify apply' first, or pass the folder as an argument." >&2
  exit 1
fi

case "$(uname -s)" in
  Darwin) os=macos ;;
  Linux) os=linux ;;
  *) echo "Unsupported system: $(uname -s)" >&2; exit 1 ;;
esac

if [ "$uninstall" = 1 ]; then
  if [ "$os" = macos ]; then
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
  else
    systemctl --user disable --now autolightswitch-watcher.service 2>/dev/null || true
    rm -f "$UNIT" "$AUTOSTART"
    systemctl --user daemon-reload 2>/dev/null || true
    pkill -f "$SCRIPT" 2>/dev/null || true
  fi
  rm -rf "$INSTALL_DIR"
  rm -f "$XPUI/system-theme.txt"
  echo "AutoLightSwitch watcher removed."
  exit 0
fi

mkdir -p "$INSTALL_DIR"
cp "$(dirname "$0")/system-theme-watcher.sh" "$SCRIPT"
chmod +x "$SCRIPT"

if [ "$os" = macos ]; then
  mkdir -p "$(dirname "$PLIST")"
  # WatchPaths reacts to theme changes at once; StartInterval re-creates the file after "spicetify apply".
  cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>$SCRIPT</string>
    <string>--once</string>
    <string>$XPUI</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>30</integer>
  <key>WatchPaths</key>
  <array>
    <string>$HOME/Library/Preferences/.GlobalPreferences.plist</string>
  </array>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
elif systemctl --user show-environment >/dev/null 2>&1; then
  mkdir -p "$UNIT_DIR"
  cat >"$UNIT" <<EOF
[Unit]
Description=AutoLightSwitch system theme watcher

[Service]
ExecStart=/bin/sh "$SCRIPT" "$XPUI"
Restart=on-failure

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable autolightswitch-watcher.service
  systemctl --user restart autolightswitch-watcher.service
else
  mkdir -p "$(dirname "$AUTOSTART")"
  cat >"$AUTOSTART" <<EOF
[Desktop Entry]
Type=Application
Name=AutoLightSwitch watcher
Exec=/bin/sh "$SCRIPT" "$XPUI"
EOF
  pkill -f "$SCRIPT" 2>/dev/null || true
  nohup /bin/sh "$SCRIPT" "$XPUI" >/dev/null 2>&1 &
fi

echo "AutoLightSwitch watcher installed. It writes the system theme to:"
echo "  $XPUI/system-theme.txt"
echo "It starts at login. Remove it with: ./install.sh --uninstall"
