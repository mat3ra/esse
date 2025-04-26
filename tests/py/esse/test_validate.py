import logging
import sys
import unittest
from pathlib import Path

# Set up import paths correctly for direct execution
if __name__ == "__main__":
    # Add the src/py directory to the Python path to ensure imports resolve correctly
    ROOT_DIR = Path(__file__).parent.parent.parent.parent.absolute()
    SRC_PY_DIR = ROOT_DIR / "src" / "py"
    sys.path.insert(0, str(SRC_PY_DIR))

from mat3ra.esse import ESSE
from parameterized import parameterized

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Build parametrized tests configuration
esse = ESSE()
tests_parameters = []
missing_schemas = []
all_wrapped_examples = esse.wrapped_examples
all_schemas = esse.schemas

logger.info(f"Found {len(all_wrapped_examples)} examples and {len(all_schemas)} schemas")

for index, example_config in enumerate(all_wrapped_examples):
    example = example_config.get("data")
    schema_id = example_config.get("path")
    logger.debug(f"Processing schema ID: {schema_id}")

    try:
        schema = next(s for s in all_schemas if s.get("$id") == schema_id.replace("_", "-"))
        tests_parameters.append([schema_id, example, schema])
    except StopIteration:
        missing_schemas.append(schema_id)
        logger.warning(f"Schema not found for {schema_id}")

if missing_schemas:
    logger.warning(f"Total missing schemas: {len(missing_schemas)} out of {len(all_wrapped_examples)}")

logger.info(f"Created {len(tests_parameters)} test cases")


class TestSequence(unittest.TestCase):
    @parameterized.expand(tests_parameters)
    def test_sequence(self, name, example, schema):
        """Test schema validation for each example"""
        try:
            esse.validate(example, schema)
        except Exception as e:
            self.fail(f"Validation failed for {name}: {str(e)}")


if __name__ == "__main__":
    unittest.main()
