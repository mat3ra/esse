import unittest

from mat3ra.esse.utils import validate_and_clean


class TestValidateAndClean(unittest.TestCase):
    def test_strips_undeclared_top_level_keys(self):
        schema = {
            "type": "object",
            "properties": {"name": {"type": "string"}},
        }
        data = {"name": "espresso", "extra": 1, "other": "x"}
        result = validate_and_clean(data, schema)
        self.assertEqual(data, {"name": "espresso"})
        self.assertTrue(result["is_valid"])
        self.assertEqual(result["errors"], [])

    def test_keeps_declared_keys(self):
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "version": {"type": "string"},
            },
        }
        data = {"name": "espresso", "version": "6.3"}
        result = validate_and_clean(data, schema)
        self.assertEqual(data, {"name": "espresso", "version": "6.3"})
        self.assertTrue(result["is_valid"])

    def test_cleans_nested_object(self):
        schema = {
            "type": "object",
            "properties": {
                "build": {
                    "type": "object",
                    "properties": {"name": {"type": "string"}},
                },
            },
        }
        data = {"build": {"name": "GNU", "junk": True}, "stray": 42}
        validate_and_clean(data, schema)
        self.assertEqual(data, {"build": {"name": "GNU"}})

    def test_cleans_array_items(self):
        schema = {
            "type": "object",
            "properties": {
                "versions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {"version": {"type": "string"}},
                    },
                },
            },
        }
        data = {"versions": [{"version": "6.3", "extra": 1}, {"version": "7.0", "junk": 2}]}
        validate_and_clean(data, schema)
        self.assertEqual(data, {"versions": [{"version": "6.3"}, {"version": "7.0"}]})

    def test_all_of_union_of_declared_keys_is_preserved(self):
        schema = {
            "type": "object",
            "allOf": [
                {"properties": {"a": {"type": "string"}}},
                {"properties": {"b": {"type": "integer"}}},
            ],
        }
        data = {"a": "x", "b": 1, "c": "drop"}
        validate_and_clean(data, schema)
        self.assertEqual(data, {"a": "x", "b": 1})

    def test_any_of_keeps_only_first_matching_branch_keys(self):
        # jsonschema short-circuits `anyOf` on the first matching branch, so
        # only that branch's declared keys are recorded by the cleaning hook.
        schema = {
            "type": "object",
            "anyOf": [
                {"properties": {"a": {"type": "string"}}},
                {"properties": {"b": {"type": "integer"}}},
            ],
        }
        data = {"a": "x", "b": 1, "c": "drop"}
        validate_and_clean(data, schema)
        self.assertEqual(data, {"a": "x"})

    def test_fills_defaults_when_use_defaults_true(self):
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "isLicensed": {"type": "boolean", "default": False},
            },
        }
        data = {"name": "espresso"}
        validate_and_clean(data, schema, use_defaults=True)
        self.assertEqual(data, {"name": "espresso", "isLicensed": False})

    def test_skips_defaults_when_use_defaults_false(self):
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "isLicensed": {"type": "boolean", "default": False},
            },
        }
        data = {"name": "espresso"}
        validate_and_clean(data, schema, use_defaults=False)
        self.assertEqual(data, {"name": "espresso"})

    def test_does_not_overwrite_existing_value_with_default(self):
        schema = {
            "type": "object",
            "properties": {"count": {"type": "integer", "default": 0}},
        }
        data = {"count": 5}
        validate_and_clean(data, schema)
        self.assertEqual(data, {"count": 5})

    def test_reports_type_errors(self):
        schema = {
            "type": "object",
            "properties": {"version": {"type": "string"}},
        }
        data = {"version": 6.3}
        result = validate_and_clean(data, schema)
        self.assertFalse(result["is_valid"])
        self.assertTrue(any("is not of type 'string'" in str(e.message) for e in result["errors"]))

    def test_reports_required_errors(self):
        schema = {
            "type": "object",
            "required": ["name"],
            "properties": {"name": {"type": "string"}},
        }
        data = {}
        result = validate_and_clean(data, schema)
        self.assertFalse(result["is_valid"])
        self.assertTrue(any("'name' is a required property" in str(e.message) for e in result["errors"]))

    def test_nested_schema_keyword_does_not_break_cleaning(self):
        schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "allOf": [
                {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "properties": {"name": {"type": "string"}},
                }
            ],
        }
        data = {"name": "espresso", "drop": True}
        validate_and_clean(data, schema)
        self.assertEqual(data, {"name": "espresso"})

    def test_returns_new_error_list_each_call(self):
        schema = {"type": "object", "properties": {"a": {"type": "string"}}}
        first = validate_and_clean({"a": "x"}, schema)
        second = validate_and_clean({"a": 1}, schema)
        self.assertEqual(first["errors"], [])
        self.assertNotEqual(second["errors"], [])
