FLAGS    := -interaction=nonstopmode -halt-on-error
SRC      := resume.tex
PDF      := resume.pdf

TINYTEX  := $(wildcard $(HOME)/Library/TinyTeX/bin/*/pdflatex $(HOME)/.TinyTeX/bin/*/pdflatex)
LATEX    := $(firstword $(TINYTEX) pdflatex)

SOURCE_DATE_EPOCH ?= $(shell git log -1 --format=%ct -- "$(SRC)" 2>/dev/null)
ifeq ($(strip $(SOURCE_DATE_EPOCH)),)
SOURCE_DATE_EPOCH := 1735689600
endif
FORCE_SOURCE_DATE := 1
export SOURCE_DATE_EPOCH FORCE_SOURCE_DATE

AUX      := $(SRC:.tex=.aux) $(SRC:.tex=.log) $(SRC:.tex=.out) \
            $(SRC:.tex=.fls) $(SRC:.tex=.fdb_latexmk) $(SRC:.tex=.synctex.gz)

.PHONY: all deps clean distclean

all: $(PDF)

deps:
	./install-deps.sh

$(PDF): $(SRC)
	$(LATEX) $(FLAGS) $(SRC)
	$(LATEX) $(FLAGS) $(SRC)
	$(RM) $(AUX)

clean:
	$(RM) $(AUX)

distclean: clean
	$(RM) $(PDF)
