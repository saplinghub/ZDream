#!/bin/bash
# 梦金囊 · 开发环境清理脚本
# 用法: bash scripts/cleanup.sh [选项]
#   --all       清理所有（Rust + 构建产物 + 缓存）
#   --rust      仅卸载 Rust 工具链
#   --target    仅清理项目构建缓存
#   --cache     仅清理 Cargo/npm 缓存
#   --preview   仅预览，不实际删除

set -e

PREVIEW=false
MODE=""

for arg in "$@"; do
  case $arg in
    --all) MODE="all" ;;
    --rust) MODE="rust" ;;
    --target) MODE="target" ;;
    --cache) MODE="cache" ;;
    --preview) PREVIEW=true ;;
    *) echo "未知选项: $arg"; echo "用法: bash scripts/cleanup.sh [--all|--rust|--target|--cache] [--preview]"; exit 1 ;;
  esac
done

if [ -z "$MODE" ]; then
  echo "请选择一个模式:"
  echo "  --all      清理所有（Rust + 构建产物 + 缓存）"
  echo "  --rust     仅卸载 Rust 工具链"
  echo "  --target   仅清理项目构建缓存"
  echo "  --cache    仅清理 Cargo/npm 缓存"
  echo "  --preview  加到上面任意选项后面，仅预览不执行"
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLEANED=0

format_size() {
  if [ "$1" -gt 1048576 ]; then
    echo "$(echo "scale=1; $1/1048576" | bc)G"
  elif [ "$1" -gt 1024 ]; then
    echo "$(echo "scale=1; $1/1024" | bc)M"
  else
    echo "${1}K"
  fi
}

get_size() {
  if [ -e "$1" ]; then
    du -sk "$1" 2>/dev/null | cut -f1
  else
    echo 0
  fi
}

clean() {
  local path="$1"
  local desc="$2"
  local size
  size=$(get_size "$path")
  if [ "$size" -gt 0 ]; then
    echo "  $(format_size $size)  $desc  →  $path"
    if [ "$PREVIEW" = false ]; then
      rm -rf "$path"
    fi
    CLEANED=$((CLEANED + size))
  fi
}

echo "========================================"
echo "  梦金囊 开发环境清理"
if [ "$PREVIEW" = true ]; then
  echo "  [预览模式，不会实际删除]"
fi
echo "========================================"
echo ""

# ── Rust 工具链 ──
if [ "$MODE" = "all" ] || [ "$MODE" = "rust" ]; then
  echo "▶ Rust 工具链"
  clean ~/.rustup "Rust 编译器 + 标准库"
  clean ~/.cargo "Cargo 包管理器 + 缓存"
  if [ -f ~/.zshenv ]; then
    if grep -q '.cargo/env' ~/.zshenv 2>/dev/null; then
      echo "  → ~/.zshenv 中的 .cargo/env 引用（需手动清理）"
    fi
  fi
  echo ""
fi

# ── 项目构建缓存 ──
if [ "$MODE" = "all" ] || [ "$MODE" = "target" ]; then
  echo "▶ 项目构建缓存"
  clean "$PROJECT_DIR/src-tauri/target" "Tauri 编译产物"
  clean "$PROJECT_DIR/dist" "前端构建产物"
  clean "$PROJECT_DIR/node_modules" "npm 依赖（可 npm install 恢复）"
  echo ""
fi

# ── 缓存 ──
if [ "$MODE" = "all" ] || [ "$MODE" = "cache" ]; then
  echo "▶ 包管理器缓存"
  if [ "$PREVIEW" = false ]; then
    echo -n "  npm cache ... "
    npm cache clean --force 2>/dev/null && echo "✓" || echo "跳过"
    echo -n "  Cargo cache ... "
    cargo cache gc 2>/dev/null && echo "✓" || echo "跳过（cargo 未安装？）"
  else
    echo "  npm cache"
    echo "  Cargo cache (cargo cache gc)"
  fi
  clean ~/.npm "_npx" 2>/dev/null
  clean ~/Library/Caches/org.Rust "Rust 编译缓存"
  echo ""
fi

# ── 汇总 ──
echo "========================================"
if [ "$PREVIEW" = true ]; then
  echo "  预计释放: $(format_size $CLEANED)"
  echo "  运行 bash scripts/cleanup.sh --all 执行清理"
else
  echo "  已释放: $(format_size $CLEANED)"
fi
echo "========================================"

# ── 说明 ──
if [ "$MODE" = "all" ] || [ "$MODE" = "rust" ]; then
  echo ""
  echo "注：Xcode Command Line Tools (~2.2G) 未包含在本脚本中。"
  echo "如需清理：sudo rm -rf /Library/Developer/CommandLineTools"
fi
