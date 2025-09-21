import jsonschema

SCHEMA = {
    "type": "object",
    "required": ["session", "speeches"],
    "properties": {
        "session": {
            "type": "object",
            "required": ["number", "date"],
            "properties": {
                "number": {"type": ["integer", "null"]},
                "legislative_period": {"type": ["integer", "null"]},
                "date": {"type": ["string", "null"]},
                "source_pdf_url": {"type": ["string", "null"]},
                "extracted_at": {"type": "string"}
            }
        },
        "speeches": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["index", "speaker", "text"],
                "properties": {
                    "index": {"type": "integer"},
                    "speaker": {"type": "object"},
                    "text": {"type": "string"}
                }
            }
        }
    }
}

def validate_payload(payload: dict):
    jsonschema.validate(instance=payload, schema=SCHEMA)
