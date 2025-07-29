[![PyPI version](https://badge.fury.io/py/mat3ra-esse.svg)](https://badge.fury.io/py/mat3ra-esse)
[![npm version](https://badge.fury.io/js/@mat3ra%2Fesse.svg)](https://badge.fury.io/js/@mat3ra%2Fesse)
[![License: Apache](https://img.shields.io/badge/License-Apache-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

# ESSE

Essential Source of Schemas and Examples (ESSE) contains data format definitions (schemas) and examples for common entities used in digital materials science (see refs. [^1], [^2] below).

Although the schemas are used to facilitate the operations of [mat3ra.com](https://mat3ra.com), they are designed to be generic and can be used in other applications. The open-source packages developed by Mat3ra.com use the schemas available in this repository.

The latest variants of schemas and examples are available at [schemas.mat3ra.com](https://schemas.mat3ra.com/).

ESSE has a dual-nature as both a Python and a Node.js package.

## 1. Installation

### 1.1. Python

ESSE is compatible with Python 3.8+.

#### 1.1.1. PyPI

```bash
pip install mat3ra-esse
```

#### 1.1.2. Repository

```bash
virtualenv .venv
source .venv/bin/activate
pip install -e PATH_TO_ESSE_REPOSITORY
```

### 1.2. Node

#### 1.2.1. NPM

```bash
npm install @mat3ra/esse
```

## 2. Usage

ESSE contains separate but equivalent interfaces for Python and Javascript.
The package provides `ESSE` class that can be initialized and used as below.

### 2.1. Usage in Python

```python
from mat3ra.esse import ESSE

helper = ESSE()
schema = helper.get_schema_by_id("material")
```

### 2.2. Usage in Node/JS/TS

```javascript
const { ESSE } = require("@mat3ra/esse/lib/js/esse");

const helper = new ESSE();
const schema = helper.getSchemaById("material");
```

## 3. Directory Structure

ESSE contains 3 main directories, [schema](schema), [example](example) and [src](src) outlined below.

### 3.1. Schema

The schema directory contains the schemas specifying the rules to structure data. A set of core schemas, outlined below, are defined to facilitate the schema modularity.

- [Primitive](schema/core/primitive) directory contains a set of custom primitives that extends default standard primitive types allowed by schema, such as String and Number.
Primitives are solely defined by the default primitives and can not be re-constructed from each other.
- [Abstract](schema/core/abstract) directory contains unit-less schemas that are constructed from default and custom primitives.
- [Reusable](schema/core/reusable) directory contains the schemas that are widely used in other schemas to avoid duplication, constructed from the abstract and primitive schemas.
- [Reference](schema/core/reference) directory contains the schemas defining the rules to structure the references to data sources.

### 3.2. Example

This directory contains the examples formed according to the schemas and implements the same directory structure as the schema directory.

### 3.3. src

This directory contains Python and Javascript interfaces implementing the functionality to access and validate schemas and examples.

## 4. Conventions

### 4.1. Generative vs Non-generative keys

Generative keys are the fields which allow for user input prior to calculation of the final property values. A flag is included in the schema comments on the fields in [property schemas](schema/properties_directory): `isGenerative:true` marks which fields to use as subschemas in the generation of a user input schema. On properties allowing user inputs, additional fields may be tagged, as in [the `file_content` property](schema/properties_directory/non-scalar/file_content.json)

## 5. Development

The schemas and examples are stored as JSON assets. The JSON assets are used to generate JS/TS and PY modules that can be used to access the schemas and examples in the corresponding runtimes. The modules are generated using the [build_schemas.py](./build_schemas.py) and [build_schema.js](./build_schema.js) scripts. The JS modules are generated during the transpilation step of the npm. The PY modules are generated during the development and distributed within the pip package.

The following outlines the development process workflow:

1. Setup: clone the repository and install the dependencies for both JS and PY (as explained below).
2. Edit code and commit changes.
3. Pre commit is used to regenerate the modules.
4. Push the changes to GitHub.
5. GH workflow is used to generate the fully resolved file (without "$ref"s and "$allOf" etc.) and examples and publish them to [schemas.mat3ra.com](http://schemas.mat3ra.com/).
6. Publish the new version of the package to PyPI and npm.

The [pre-commit](.husky/pre-commit) is using both JS and PY runtime(s) to regenerate the schemas and examples.

[//]: # (TODO: consider reusing JS runtime and schemas build script for PY modules for consistency)
NOTE: The PY and JS modules are built from the same JSON sources, but using different runtimes (scripts) and thus may still be different. Only for JS the fully resolved schemas (with merged "$allOf") are created. They are used for the docs website.

### 5.1. Development in Python

When developing in python the following should be taken into account:

1. The modules containing the schemas and examples are generated using the [build-schemas.py](./build_schemas.py) script. There is a setup for it to be run automatically on every commit, but it is recommended to run it manually before committing to make sure that the changes are reflected in the modules. This can be done with `pre-commit run --all-files`. The pre-commit package can be installed with `pip install pre-commit`. To rebuild schemas manually, run (note `-e` in install):

    ```bash
    python -m venv .venv  
    source .venv/bin/activate
    pip install -e ".[tests]"
    pip install pre-commit
    pre-commit --install
    git config --unset-all core.hooksPath
    python build_schemas.py
    ```

2. Tests can be run using the following commands:

    ```bash
    python -m venv .venv  
    source .venv/bin/activate
    pip install ".[tests]"
    python -m unittest discover --verbose --catch --start-directory tests/py/esse/
    ```

### 5.2. Development in Javascript/Typescript

See [package.json](package.json) for the list of available npm commands. The JS modules are generated using the [build_schema.js](./build_schema.js) script. There is a setup for it to be run automatically when the package is installed (see "transpile" directive). To rebuild schemas manually, run:

```bash
npm install
npm run transpile
```

### 5.3. General Dev Suggestions

This repository is an [open-source](LICENSE.md) work-in-progress and we welcome contributions. We suggest forking this repository and introducing the adjustments there, the changes in the fork can further be considered for merging into this repository as it is commonly done on GitHub (see [^3] below).

Other suggestions:

- Use unique IDs for schemas
- Do not use circular references in the schemas, instead leave the type as object and add explanation to description.

## Links

[^1]: [Data-centric online ecosystem for digital materials science](https://arxiv.org/pdf/1902.10838.pdf)
[^2]: [CateCom: A Practical Data-Centric Approach to Categorization of Computational Models](https://pubs.acs.org/doi/abs/10.1021/acs.jcim.2c00112)
[^3]: [GitHub Standard Fork & Pull Request Workflow](https://gist.github.com/Chaser324/ce0505fbed06b947d962)
