export const QueryExecutionScheme =
{
    "type": ["object","null"],
    "properties": {
        "VariableValues": {
            "type": "object"
        },
        "Page": {
            "type": "integer"
        },
        "PageSize": {
            "type": "integer"
        },
        "Filter": {
            "type": "object"
        },
        "Series": {
            "type": "string"
        },
        "Fields": {
            "type": "array",
            "items": {
                "type": "string"
            }
        },
    },
    "additionalProperties": false
}