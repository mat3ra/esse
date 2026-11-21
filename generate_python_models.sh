#!/bin/bash
# Regenerate the pydantic models in src/py/mat3ra/esse/models from the resolved schemas in
# dist/js/schema, which `npm run transpile-and-build-assets` builds. The single definition of the
# generator command: the pre-commit hook (.pre-commit-config.yaml) and the CI freshness check
# (.github/workflows/cicd.yml) both run this script.
#
# The generator formats its output with black and isort, reading [tool.black]/[tool.isort] from
# pyproject.toml, so their versions are pinned with it in the `dev` extra: another version can
# format the same models differently.
#
# The generator only adds and rewrites files: a model whose schema was deleted stays until it is
# removed by hand.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d dist/js/schema ]; then
    echo "dist/js/schema is missing: run 'npm run transpile-and-build-assets' first." >&2
    exit 1
fi

datamodel-codegen \
    --input ./dist/js/schema/ \
    --input-file-type jsonschema \
    --output ./src/py/mat3ra/esse/models \
    --output-model-type pydantic_v2.BaseModel \
    --use-field-description \
    --use-double-quotes \
    --enable-version-header \
    --use-title-as-name \
    --class-name ESSE \
    --disable-timestamp \
    --use-default \
    --remove-special-field-name-prefix
