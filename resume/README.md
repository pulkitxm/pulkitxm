# Pulkit's Resume

This is my resume created using LaTeX. You can find my PDF version below.

## Download PDF

You can download my resume by clicking the link below:

[Download PDF](http://pulkitxm.com/resume)


## LaTeX Source

You can view the LaTeX source code for this resume in [`resume.tex`](./resume.tex).

## Building

The PDF is built inside a container, so no local TeX Live install is needed and the
output is identical on every machine. The [`Dockerfile`](./Dockerfile) pins Alpine
plus the TeX packages this resume uses, and `SOURCE_DATE_EPOCH` is derived from the
last commit that touched `resume.tex` so rebuilds are reproducible.

```sh
make          # build resume.pdf (builds the image first if missing)
make image    # build the container image
make shell    # drop into a shell in the build container
make clean    # remove pdflatex aux files
make distclean # also remove resume.pdf and the image
```

### ac

The `Makefile` drives containers with [`ac`](https://github.com/pulkitxm/ac), a
project runner for [Apple Container](https://github.com/apple/container) on macOS.
Apple Container has no `docker compose` equivalent, so `ac` fills that gap with
declarative JSON stacks, readiness gating, and strict daemon ownership: it never
touches a container daemon it did not start. The `Makefile` only uses its
Docker-shaped subset (`build`, `run`, `image ls`, `rmi`), so any Docker-compatible
CLI can be swapped in:

```sh
make AC=docker
```

