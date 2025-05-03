import unittest
from mat3ra.esse import ESSE
from parameterized import parameterized

# Build parametrized tests configuration
esse = ESSE()
tests_parameters = []
all_wrapped_examples = esse.wrapped_examples
all_schemas = esse.schemas
for index, example_config in enumerate(all_wrapped_examples):
    example = example_config.get("data")
    schema_id = example_config.get("path")
    print(schema_id)
    schema = next(s for s in all_schemas if s.get("$id") == schema_id.replace("_", "-"))
    tests_parameters.append([schema_id, example, schema])


class TestSequence(unittest.TestCase):
    @parameterized.expand(tests_parameters)
    def test_sequence(self, name, example, schema):
        esse.validate(example, schema)
