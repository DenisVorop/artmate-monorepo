#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root'; exit 1; }
relay_public_key=${1:?Expected public key}
[[ $relay_public_key =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+\ artmate-telegram-tunnel$ ]] || exit 1
if ! id artmate-relay >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin artmate-relay
fi
[[ $(getent passwd artmate-relay | cut -d: -f6) == /home/artmate-relay ]] || exit 1
# No password authentication; '*' does not impose OpenSSH's locked-account check.
usermod --password '*' artmate-relay
install -d -m 755 -o root -g root /home/artmate-relay/.ssh
printf 'from="186.246.8.79",restrict,port-forwarding,permitopen="127.0.0.1:443" %s\n' "$relay_public_key" > /home/artmate-relay/.ssh/authorized_keys
chmod 644 /home/artmate-relay/.ssh/authorized_keys
install -d -m 755 /etc/ssh/sshd_config.d
grep -Eq '^Include[[:space:]]+/etc/ssh/sshd_config.d/\*\.conf' /etc/ssh/sshd_config || { echo 'sshd drop-in include missing'; exit 1; }
cat > /etc/ssh/sshd_config.d/90-artmate-relay.conf <<'CONFIG'
Match User artmate-relay
    AuthenticationMethods publickey
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    AllowTcpForwarding local
    AllowStreamLocalForwarding no
    PermitOpen 127.0.0.1:443
    PermitListen none
    AllowAgentForwarding no
    X11Forwarding no
    PermitTTY no
    ForceCommand /usr/sbin/nologin
Match all
CONFIG
sshd -t
systemctl reload ssh
echo 'Restricted relay account configured'
