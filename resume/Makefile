AC      := ac
IMAGE   := resume-latex:local
DIR     := $(CURDIR)

LATEX   := pdflatex
FLAGS   := -interaction=nonstopmode -halt-on-error
SRC     := resume.tex
PDF     := resume.pdf

SOURCE_DATE_EPOCH := $(shell git -C "$(DIR)" log -1 --format=%ct -- "$(SRC)" 2>/dev/null)
ifeq ($(strip $(SOURCE_DATE_EPOCH)),)
SOURCE_DATE_EPOCH := 1735689600
endif

RUN     := $(AC) run --rm -e SOURCE_DATE_EPOCH=$(SOURCE_DATE_EPOCH) \
           -e FORCE_SOURCE_DATE=1 -v "$(DIR)":/resume $(IMAGE)

AUX     := $(SRC:.tex=.aux) $(SRC:.tex=.log) $(SRC:.tex=.out) \
           $(SRC:.tex=.fls) $(SRC:.tex=.fdb_latexmk) $(SRC:.tex=.synctex.gz)

.PHONY: all image image-check shell clean distclean

all: $(PDF)

image:
	$(AC) build -t $(IMAGE) "$(DIR)"

image-check:
	@$(AC) image ls -q 2>/dev/null | grep -qx '$(IMAGE)' || $(MAKE) image

$(PDF): $(SRC) | image-check
	$(RUN) $(LATEX) $(FLAGS) $(SRC)
	$(RUN) $(LATEX) $(FLAGS) $(SRC)
	$(RM) $(AUX)

shell:
	$(AC) run --rm -it -v "$(DIR)":/resume $(IMAGE) sh

clean:
	$(RM) $(AUX)

distclean: clean
	$(RM) $(PDF)
	-$(AC) rmi $(IMAGE)
