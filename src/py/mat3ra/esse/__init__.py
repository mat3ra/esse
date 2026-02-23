import jsonschema

from .data.examples import EXAMPLES
from .data.schemas import SCHEMAS
from .data.properties import PROPERTIES_MANIFEST


class ESSE(object):
    """
    Exabyte Source of Schemas and Examples class.
    """

    def __init__(self, schemas=SCHEMAS, examples=EXAMPLES):
        self.schemas = schemas
        self.wrapped_examples = examples
        # Extract the data from the wrapped examples and omit the path.
        self.examples = [e["data"] for e in examples]

    def get_schema_by_id(self, schema_id):
        return next((s for s in SCHEMAS if s.get("$id") == schema_id), None)

    def validate(self, example, schema):
        """
        Validates a given example against the schema.

        Args:
            example (dict|list): example to validate.
            schema (dict): schema to validate the example with.

        Raises:
            jsonschema.exceptions.ValidationError
        """
        jsonschema.validate(example, schema)

    def get_property_manifest(self, property_):
        """
        Returns the manifest for a given property.

        Args:
            property_ (str): property name.

        Returns:
             dict
        """
        return PROPERTIES_MANIFEST.get(property_, {})
