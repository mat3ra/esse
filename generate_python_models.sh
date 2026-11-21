#!/bin/bash
# Regenerate everything under src/py/mat3ra/esse that is generated from the
# schemas: the data modules (src/py/mat3ra/esse/data) and the pydantic models
# (src/py/mat3ra/esse/models). The single definition of the generation: the
# pre-commit hook (.pre-commit-config.yaml) and the CI freshness check
# (.github/workflows/cicd.yml) both run this script.
#
# 1. `npm run transpile-and-build-assets` rebuilds dist/js and the data modules
#    from the schemas on disk, so the models never come from an older build of
#    dist/js.
# 2. datamodel-codegen writes the models into an empty directory under dist/,
#    inside the repository so that it formats them with the
#    [tool.black]/[tool.isort] settings of pyproject.toml. The generator and
#    both formatters are pinned in the `dev` extra: another version can format
#    the same models differently. datamodel-codegen numbers classes in the order
#    it reads the schemas, and it orders them by file name only (parser/base.py:
#    `sorted(source.rglob("*"), key=lambda p: p.name)`). Many schemas share a
#    file name (configuration.json, base.json, gga.json, ...), and those keep
#    the order the filesystem lists them in, which differs between macOS and
#    Linux: the same schemas would number differently on local machine and in
#    CI. It is therefore run with Path.rglob sorted by full path, which makes
#    that order, and the output, the same on every machine.
# 3. The models directory is replaced by that output: a model whose schema was
#    deleted or renamed is deleted with it.
set -euo pipefail
cd "$(dirname "$0")"

MODELS_DIRECTORY=src/py/mat3ra/esse/models
GENERATED_DIRECTORY=dist/python_models

npm run transpile-and-build-assets

rm -rf "${GENERATED_DIRECTORY}"
python - \
    --input ./dist/js/schema/ \
    --input-file-type jsonschema \
    --output "./${GENERATED_DIRECTORY}" \
    --output-model-type pydantic_v2.BaseModel \
    --use-field-description \
    --use-double-quotes \
    --enable-version-header \
    --use-title-as-name \
    --class-name ESSE \
    --disable-timestamp \
    --use-default \
    --remove-special-field-name-prefix <<'PYTHON'
import pathlib
import sys

from datamodel_code_generator.__main__ import main

filesystem_ordered_rglob = pathlib.Path.rglob
pathlib.Path.rglob = lambda path, *arguments, **options: iter(
    sorted(filesystem_ordered_rglob(path, *arguments, **options))
)
sys.exit(main(sys.argv[1:]))
PYTHON

rsync --archive --delete --checksum --exclude "__pycache__" "${GENERATED_DIRECTORY}/" "${MODELS_DIRECTORY}/"
rm -rf "${GENERATED_DIRECTORY}"
