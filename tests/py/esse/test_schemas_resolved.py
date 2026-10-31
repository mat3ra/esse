import json
import unittest

from mat3ra.esse import ESSE
from mat3ra.esse.data.schemas import SCHEMAS
from mat3ra.esse.data.schemas_resolved import RESOLVED_SCHEMAS
from parameterized import parameterized

esse = ESSE()
resolved_by_id = {schema["$id"]: schema for schema in RESOLVED_SCHEMAS}
tests_parameters = [
    [example["path"], example["data"], resolved_by_id[example["path"].replace("_", "-")]]
    for example in esse.wrapped_examples
]


class TestResolvedSchemas(unittest.TestCase):
    def test_same_schemas_as_unresolved(self):
        self.assertEqual([schema["$id"] for schema in RESOLVED_SCHEMAS], [schema["$id"] for schema in SCHEMAS])

    def test_every_all_of_is_merged(self):
        for schema in RESOLVED_SCHEMAS:
            self.assertNotIn('"allOf"', json.dumps(schema), schema["$id"])

    @parameterized.expand(tests_parameters)
    def test_examples_validate_against_resolved(self, name, example, schema):
        esse.validate(example, schema)
