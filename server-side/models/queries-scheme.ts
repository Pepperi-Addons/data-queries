export const QueriesScheme =
{
    "type": "object",
    "properties": {
        "Series": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "AggregatedFields": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "properties": {
                                "FieldID": {
                                    "type": "string",
                                },
                                "Alias": {
                                    "type": "string"
                                },
                                "Script": {
                                    "type": "string"
                                },
                                "Aggregator": {
                                    "type": "string",
                                    "enum": ["None", "Sum", "Count", "Average","CountDistinct","Script"]
                                }
                            },
                            "if": {
                                "properties": {
                                    "Aggregator": { "const": "Script" }
                                },
                                
                            },
                            "then": { "required": ["Script"],"minLength": 1 },
                            "else": { "required": ["FieldID"] },
                            "additionalProperties": false,
                            "required": [
                                "Aggregator"
                            ]
                        }
                    },
                    "AggregatedParams": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "FieldID": {
                                    "type": "string",
                                },
                                "Name": {
                                    "type": "string"
                                },
                                "Aggregator": {
                                    "type": "string",
                                    "enum": ["None", "Sum", "Count", "Average","CountDistinct","Script"]
                                }
                            },
                            "additionalProperties": false,
                            "required": [
                                "FieldID",
                                "Aggregator",
                                "Name"
                            ]
                        }
                    },
                    "Resource": {
                        "type": "string",
                        "enum": ["all_activities", "transaction_lines"]
                    },
                    "Label": {
                        "type": "string",
                        "minLength":1,
                        "default": "${label}"
                    },
                    "Key": {
                        "type": "string",
                    },
                    "BreakBy": {
                        "type": "object",
                        "properties": {
                            "FieldID": {
                                "type": "string",
                            },
                            "Format": {
                                "type": "string"
                            },
                            "Interval": {
                                "type": "string",
                                "enum": ["None","Day", "Week", "Month", "Quarter", "Year"]
                            },
                        },
                        "additionalProperties": false,
                        "required": [
                            "FieldID"
                        ]
                    },
                    "Top": {
                        "type": "object",
                        "properties": {
                            "FieldID": {
                                "type": "string",
                            },
                            "Max": {
                                "type": "integer",
                                "maximum": 100
                            },
                            "Ascending": {
                                "type": "boolean"
                            }
                        },
                        "additionalProperties": false
                    },
                    "GroupBy": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "FieldID": {
                                    "type": "string",
                                },
                                "Format": {
                                    "type": "string"
                                },
                                "Interval": {
                                    "type": "string",
                                    "enum": ["None","Day", "Week", "Month", "Quarter", "Year"]
                                },
                                "Alias": {
                                    "type": "string"
                                },
                            },
                            "additionalProperties": false
                        }
                    },
                    "Name": {
                        "type": "string",
                        "minLength": 1
                    },
                    "Scope": {
                        "type": "object",
                        "properties": {
                            "Account": {
                                "type": "string",
                                "enum": ["CurrentAccount", "AllAccounts", "AccountsAssignedToCurrentUser"]
                            },
                            "User": {
                                "type": "string",
                                "enum": ["CurrentUser", "AllUsers", "UsersWithTheSameFieldValue", "UnderCurrentUserRoleHierarchy"]
                            }
                        },
                        "additionalProperties": false,
                    },
                    "DynamicFilterFields": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    },
                    "Filter": {
                        "type": ["null","object"]
                    }
                },
                "additionalProperties": false,
                "required": [
                    "AggregatedFields",
                    "Resource",
                    "Name"
                ]
            }
        },
        "ModificationDateTime": {
            "type": "string"
        },
        "CreationDateTime": {
            "type": "string"
        },
        "Hidden": {
            "type": "boolean"
        },
        "Key": {
            "type": "string"
        },
        "Name": {
            "type": "string"
        },
        "Description": {
            "type": "string"
        },
    },
    "anyOf": [
        {
            "required": { "required": ["Key"] }
        },
        {
            "required": { "required": ["Series"] }
        }
    ],
    "additionalProperties": false

}

