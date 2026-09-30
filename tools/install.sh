#!/usr/bin/env bash
# @gw/dsh-text-inject 安装器（Git Bash / WSL / macOS）。
# 按本机 dsh 版本挑出适配的插件 git tag，装进指定 profile 的 node_modules/@gw/。
#
# 用法：
#   bash tools/install.sh            # 默认装进 web profile
#   bash tools/install.sh desktop    # 装进 desktop profile
#
# 在仓库目录内运行 → 装的是你当前 git checkout 的版本（请先 git checkout 到对应 tag）；
# 在仓库外运行 → 从 GitHub 拉对应 tag。

set -euo pipefail

PROFILE="${1:-web}"
REPO="https://github.com/1497105876/dsh-text-inject.git"
PKG="@gw/dsh-text-inject"

# 1) 探测 dsh 版本
dsh_version() {
  local v=""
  if command -v dsh >/dev/null 2>&1; then
    v="$(dsh --version 2>/dev/null | tr -d '\r' | head -1)"
  fi
  if [ -z "$v" ]; then
    v="$(npm ls -g @deepseek-ai/dsh 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+(-(rc|alpha)\.[0-9]+)?' | head -1)"
  fi
  echo "$v"
}

# 2) dsh 版本 → 插件 tag
pick_tag() {
  case "$1" in
    0.2.0-*|0.2.*)   echo "dsh-0.2.0-rc.2" ;;
    0.1.*|"")        echo "dsh-0.1.x" ;;
    *)               echo "dsh-0.2.0-rc.2" ;;   # 未知版本：取最新锁定的
  esac
}

V="$(dsh_version)"
TAG="$(pick_tag "$V")"
echo "检测到 dsh 版本: ${V:-未知}  →  选用插件 tag: $TAG"

# 3) 取源码
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ -f package.json ] && grep -q "\"@gw/dsh-text-inject\"" package.json 2>/dev/null; then
  echo "当前位于仓库内，将安装你已 checkout 的版本（=$TAG 请自行确认）。"
  SRC="$(pwd)"
else
  echo "克隆 $TAG ..."
  if ! git clone --depth 1 --branch "$TAG" "$REPO" "$WORK/repo" >/dev/null 2>&1; then
    git clone --branch "$TAG" "$REPO" "$WORK/repo" >/dev/null 2>&1
  fi
  SRC="$WORK/repo"
fi

# 4) 复制到 profile
TARGET="$HOME/.dsh/profiles/$PROFILE/node_modules/@gw/dsh-text-inject"
mkdir -p "$(dirname "$TARGET")"
rm -rf "$TARGET"
cp -r "$SRC" "$TARGET"
rm -rf "$TARGET/.git" "$TARGET/node_modules"
echo "已安装到: $TARGET"

# 5) 确保 cordis.patch.yml 有 insert 入口
PATCH="$HOME/.dsh/profiles/$PROFILE/cordis.patch.yml"
if [ ! -f "$PATCH" ] || ! grep -q "gw-text-inject" "$PATCH"; then
  echo
  echo "请在 $PATCH 追加以下入口（重启 dsh 生效）："
  echo "  - insert:"
  echo "      - id: gw-text-inject"
  echo "        name: '@gw/dsh-text-inject'"
else
  echo "cordis.patch.yml 已含 gw-text-inject 入口。"
fi

echo
echo "完成。重启 dsh（$PROFILE），打开设置页 → 左侧栏「文字注入」。"
