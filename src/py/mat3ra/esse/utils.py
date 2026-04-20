import copy
import json
import os

import json_include
from jsonschema import validators


def parse_include_reference_statements(file_path):
    """
    Resolves `include` and `$ref` statements.

    Args:
        file_path (str): file to parse.

    Returns:
         dict|list
    """
    dir_name = os.path.dirname(file_path)
    base_name = os.path.basename(file_path)
    return json.loads(json_include.build_json(dir_name, base_name))


def parse_include_reference_statements_by_dir(top_dir, is_examples=False):
    """
    Resolves `include` and `$ref` statements for all the JSON files inside a given directory.

    Args:
        dir_path (str): directory to parse.

    Returns:
         dict|list
         :param top_dir: Top-level directory containing "schema" and "example" directories.
         :param is_examples: Whether to wrap and add the path to the returned data.
    """
    data = []
    dir_path = os.path.join(top_dir, "schema") if not is_examples else os.path.join(top_dir, "example")
    for root, dirs, files in os.walk(dir_path):
        for file_ in files:
            if os.path.splitext(file_)[1] == ".json":
                file_path = os.path.join(root, file_)
                if is_examples:
                    schema_id = (
                        file_path.replace("example", "schema")
                        .replace(top_dir, "")
                        .replace("schema", "")
                        .replace(".json", "")
                        .strip("/")
                    )
                    config = {"data": parse_include_reference_statements(file_path), "path": schema_id}
                else:
                    config = parse_include_reference_statements(file_path)
                data.append(config)
    return data


def _strip_nested_schema_keyword(schema):
    """
    Return a deep copy of `schema` with `$schema` removed from every
    non-root dict. Prevents `jsonschema` from resetting the validator class
    (and dropping our extension) when it descends into composed subschemas
    that declare their own `$schema` meta-schema, which is the case for
    every ESSE sub-schema.
    """

    def walk(node, is_root):
        if isinstance(node, dict):
            return {k: walk(v, False) for k, v in node.items() if is_root or k != "$schema"}
        if isinstance(node, list):
            return [walk(item, False) for item in node]
        return node

    return walk(schema, True)


def validate_and_clean(data, schema, use_defaults=True):
    """
    Validate `data` against `schema` and strip keys the schema does not
    declare, mutating `data` in place. Python counterpart of `@mat3ra/esse`
    JS `validateAndClean`.

    Piggy-backs on `jsonschema`'s own traversal: a hook on the `properties`
    keyword records which keys are declared for each visited object
    (aggregated across `allOf` / `anyOf` / `oneOf` branches and nested
    `items`) and fills schema-declared defaults. After validation, any key
    not in the recorded set is stripped.

    Args:
        data (dict|list): instance to validate and clean (mutated in place).
        schema (dict): JSON schema to validate against.
        use_defaults (bool): fill missing properties with schema defaults.

    Returns:
        dict: `{"is_valid": bool, "errors": list[jsonschema.ValidationError]}`.
    """
    schema = _strip_nested_schema_keyword(schema)
    base_cls = validators.validator_for(schema, default=validators.Draft7Validator)
    validate_properties = base_cls.VALIDATORS["properties"]
    # Track declared keys per visited object: id(instance) -> (keys, instance).
    declared_by_instance = {}

    def properties_hook(validator, properties, instance, sub_schema):
        if isinstance(instance, dict):
            declared, _ = declared_by_instance.setdefault(id(instance), (set(), instance))
            declared.update(properties.keys())
            if use_defaults:
                for name, sub in properties.items():
                    if isinstance(sub, dict) and "default" in sub:
                        instance.setdefault(name, copy.deepcopy(sub["default"]))
        yield from validate_properties(validator, properties, instance, sub_schema)

    cleaning_cls = validators.extend(base_cls, {"properties": properties_hook})
    errors = list(cleaning_cls(schema).iter_errors(data))

    for declared, instance in declared_by_instance.values():
        for key in list(instance.keys()):
            if key not in declared:
                del instance[key]

    return {"is_valid": not errors, "errors": errors}
