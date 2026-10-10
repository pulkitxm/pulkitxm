#!/bin/sh
set -eu

case "$(uname -s)" in
  Darwin) root="$HOME/Library/TinyTeX" ;;
  *) root="$HOME/.TinyTeX" ;;
esac

if ! ls "$root"/bin/*/tlmgr >/dev/null 2>&1; then
  curl -fsSL https://yihui.org/tinytex/install-bin-unix.sh | sh
fi

tlmgr=$(ls "$root"/bin/*/tlmgr | head -n 1)
"$tlmgr" install \
  accsupp \
  babel-english \
  enumitem \
  fontawesome5 \
  geometry \
  lm \
  titlesec
