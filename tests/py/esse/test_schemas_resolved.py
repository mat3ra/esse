import json
import unittest

from mat3ra.esse.data.schemas import SCHEMAS


class TestSchemasResolved(unittest.TestCase):
    def test_every_all_of_is_merged(self):
        for schema in SCHEMAS:
            self.assertNotIn('"allOf"', json.dumps(schema), schema["$id"])
