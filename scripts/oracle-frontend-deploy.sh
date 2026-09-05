#!/usr/bin/env bash
# Run on Oracle with sudo. Uses the existing Ubuntu GitHub SSH connection.
# Does not switch branches, touch backend files, or change Nginx configuration.
set -euo pipefail

repo=/home/ubuntu/apps/azmaio-staging
webroot=/var/www/azmaio
releases=/var/www/azmaio-frontend-releases

[[ $EUID -eq 0 ]] || { echo 'Run this script with sudo.' >&2; exit 1; }
[[ -d "$repo/.git" && -d "$webroot" ]] || {
  echo 'Expected Oracle repository or web root is missing; no files changed.' >&2
  exit 1
}

if [[ ${1:-} == --install ]]; then
  install -m 0755 "$0" /usr/local/sbin/azmaio-frontend-deploy
  cat > /etc/systemd/system/azmaio-frontend-deploy.service <<'UNIT'
[Unit]
Description=Publish AZM frontend from GitHub deploy branch
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/azmaio-frontend-deploy
TimeoutStartSec=180
UNIT
  cat > /etc/systemd/system/azmaio-frontend-deploy.timer <<'UNIT'
[Unit]
Description=Check for AZM frontend updates every minute

[Timer]
OnBootSec=30s
OnUnitInactiveSec=60s
Unit=azmaio-frontend-deploy.service

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl start azmaio-frontend-deploy.service
  systemctl enable --now azmaio-frontend-deploy.timer
  echo 'Frontend published. Automatic updates are enabled every minute.'
  exit 0
fi

exec 9>/run/lock/azmaio-frontend-deploy.lock
flock -n 9 || exit 0
git_as_ubuntu() { runuser -u ubuntu -- git -C "$repo" "$@"; }
git_as_ubuntu fetch origin refs/heads/deploy:refs/remotes/origin/deploy
commit=$(git_as_ubuntu rev-parse refs/remotes/origin/deploy)
[[ $commit =~ ^[0-9a-f]{40}$ ]] || exit 1
if [[ -f "$webroot/.frontend-deploy-commit" ]] && [[ $(<"$webroot/.frontend-deploy-commit") == "$commit" ]]; then
  echo "Already serving deploy $commit"
  exit 0
fi

# Export built files independently of the Oracle backend/source checkout.
install -d -m 0755 "$releases"
release=$(mktemp -d "$releases/$commit.XXXXXX")
git_as_ubuntu archive refs/remotes/origin/deploy | tar -x -C "$release"
[[ -s "$release/index.html" && -d "$release/assets" && -s "$release/deployment-version.txt" ]] || {
  echo 'Incomplete deploy build; live site was not changed.' >&2
  exit 1
}
if grep -R -q 'https://azmnew.onrender.com' "$release/assets"; then
  echo 'Build still references Render; refusing to publish over the Oracle site.' >&2
  exit 1
fi

# Preserve the previous entry page. Old hashed assets remain available for
# visitors who still have that page open.
if [[ -f "$webroot/index.html" ]]; then
  cp -p "$webroot/index.html" "$release/previous-index.html"
fi
shopt -s dotglob nullglob
for item in "$release"/*; do
  name=${item##*/}
  case "$name" in index.html|previous-index.html|deployment-version.txt) continue ;; esac
  cp -a "$item" "$webroot/"
done
install -m 0644 "$release/index.html" "$webroot/.index.html.next"
mv -f "$webroot/.index.html.next" "$webroot/index.html"
install -m 0644 "$release/deployment-version.txt" "$webroot/deployment-version.txt"
printf '%s\n' "$commit" > "$webroot/.frontend-deploy-commit"
echo "Published deploy $commit; previous index saved in $release/previous-index.html"
