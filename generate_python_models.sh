#!/bin/bash
# Regenerate everything under src/py/mat3ra/esse that is generated from the schemas: the data
# modules (src/py/mat3ra/esse/data) and the pydantic models (src/py/mat3ra/esse/models). The single
# definition of the generation: the pre-commit hook (.pre-commit-config.yaml) and the CI freshness
# check (.github/workflows/cicd.yml) both run this script.
#
# 1. `npm run transpile-and-build-assets` rebuilds dist/js and the data modules from the schemas on
#    disk, so the models never come from an older build of dist/js.
# 2. datamodel-codegen writes the models into an empty directory under dist/, inside the repository
#    so that it formats them with the [tool.black]/[tool.isort] settings of pyproject.toml. The
#    generator and both formatters are pinned in the `dev` extra: another version can format the
#    same models differently.
# 3. The models directory is replaced by that output: a model whose schema was deleted or renamed
#    is deleted with it.
set -euo pipefail
cd "$(dirname "$0")"

MODELS_DIRECTORY=src/py/mat3ra/esse/models
GENERATED_DIRECTORY=dist/python_models

npm run transpile-and-build-assets

rm -rf "${GENERATED_DIRECTORY}"
datamodel-codegen \
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
    --remove-special-field-name-prefix

rsync --archive --delete --checksum --exclude "__pycache__" "${GENERATED_DIRECTORY}/" "${MODELS_DIRECTORY}/"
rm -rf "${GENERATED_DIRECTORY}"
