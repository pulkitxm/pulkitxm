FROM alpine:3.20

ENV TEXMFLOCAL=/usr/share/texmf-local

RUN apk add --no-cache \
      make \
      curl \
      unzip \
      texlive \
      texmf-dist-latexrecommended \
      texmf-dist-latexextra \
      texmf-dist-fontsrecommended \
      texmf-dist-langenglish

RUN mkdir -p "$TEXMFLOCAL" \
 && curl -fsSL https://mirrors.ctan.org/systems/texlive/tlnet/archive/fontawesome5.tar.xz \
    | tar -xJ -C "$TEXMFLOCAL" \
 && mktexlsr \
 && updmap-sys --enable Map=fontawesome5.map \
 && updmap-sys

WORKDIR /resume
