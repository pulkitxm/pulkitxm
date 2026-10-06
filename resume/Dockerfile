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
 && curl --proto '=https' --tlsv1.2 -fsSL --retry 3 --max-time 60 \
      https://ctan.math.illinois.edu/systems/texlive/tlnet/archive/fontawesome5.tar.xz \
      -o /tmp/fontawesome5.tar.xz \
 && echo 'dc0df9192cdb088eb7bca42753128b0c464e61836f02b1fe5dc994c528a51ea4  /tmp/fontawesome5.tar.xz' | sha256sum -c - \
 && tar -xJf /tmp/fontawesome5.tar.xz -C "$TEXMFLOCAL" \
 && rm /tmp/fontawesome5.tar.xz \
 && mktexlsr \
 && updmap-sys --enable Map=fontawesome5.map \
 && updmap-sys

WORKDIR /resume
