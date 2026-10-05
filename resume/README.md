# Pulkit's Resume

This is my resume created using LaTeX. You can find my PDF version below.

## Download PDF

You can download my resume by clicking the link below:

[Download PDF](https://pulkit.page/assets/content/resume.pdf)


## LaTeX Source

You can view the LaTeX source code for this resume in [`resume.tex`](./resume.tex).

## Building

### Automatic publishing

Pushing resume source or build changes to `main` runs the
[`Publish Resume`](../.github/workflows/resume.yml) workflow. It rebuilds the PDF
even when a PDF is already checked in, validates it, and commits the same bytes
through Pukbot to both destinations:

- [`resume/resume.pdf`](./resume.pdf) in this repository.
- [`apps/page/assets/content/resume.pdf`](https://github.com/pulkitxm/pulkit.page/blob/main/apps/page/assets/content/resume.pdf)
  in `pulkitxm/pulkit.page`.

The website commit triggers its normal build and deployment. Pull requests build
and validate the resume without publishing. The workflow also supports manual
runs from the Actions tab on `main`.

Publishing uses the existing `pukbot-production` environment, its
`PUKBOT_PRIVATE_KEY` secret, and the `PUKBOT_CLIENT_ID` repository variable. The
Pukbot installation must include both repositories with Contents write access.
No personal access token is required.

Unchanged PDFs create no commits, and generated PDF commits do not trigger another
resume build. Publishing verifies both remote file hashes. Older builds skip
publication if newer source changes are pending. If one repository update fails,
rerunning the workflow repairs the missing copy.

### Local builds

The PDF is built inside a container, so no local TeX Live install is needed and the
output is identical on every machine. The [`Dockerfile`](./Dockerfile) pins Alpine
plus the TeX packages this resume uses, and `SOURCE_DATE_EPOCH` is derived from the
last commit that touched `resume.tex` so rebuilds are reproducible.

```sh
make
make image
make shell
make clean
make distclean
```

`make` builds the PDF, `make image` builds the container image, and `make shell`
opens a shell in the container. `make clean` removes auxiliary files, while
`make distclean` also removes the PDF and container image. Use `make -B` to force
a rebuild of an existing PDF, as the publishing workflow does.

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
