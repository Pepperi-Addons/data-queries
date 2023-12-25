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
                                    "enum": ["None", "Sum", "Count", "Average", "CountDistinct", "Script"]
                                }
                            },
                            "if": {
                                "properties": {
                                    "Aggregator": { "const": "Script" }
                                },

                            },
                            "then": { "required": ["Script"], "minLength": 1 },
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
                                    "enum": ["None", "Sum", "Count", "Average", "CountDistinct", "Script"]
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
                        "type": "string"
                    },
                    "Label": {
                        "type": "string",
                        "minLength": 1,
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
                                "enum": ["None", "Day", "Week", "Month", "Quarter", "Year"]
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
                                    "enum": ["None", "Day", "Week", "Month", "Quarter", "Year"]
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
                                "enum": ["CurrentAccount", "AllAccounts", "AccountsAssignedToCurrentUser", "AccountsOfUsersUnderMyRole"]
                            },
                            "User": {
                                "type": "string",
                                "enum": ["CurrentUser", "AllUsers", "UsersUnderMyRole"]
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
                        "type": ["null", "object"]
                    },
					"ConditionalFilters": {
						"type": "array",
						"items": {
							"type": "object",
							"properties": {
								"ID": {
									"type": "integer"
								},
								"Condition": {
									"type": ["null", "object"]
								},
								"Filter": {
									"type": ["null", "object"]
								}
							},
							"additionalProperties": false
						}
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
        "Variables": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "Key": {
                        "type": "string",
                    },
                    "Name": {
                        "type": "string"
                    },
                    "Type": {
                        "type": "string"
                    },
                    "DefaultValue": {
                        "type": "string"
                    },
                    "PreviewValue": {
                        "type": "string"
                    }
                },
                "additionalProperties": false,
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
        "Resource": {
            "type": "string"
        },
		"ResourceData": {
            "type": "object"
        },
        "Description": {
            "type": "string"
        },
        "Style": {
            "type": "string"
        },
        "Currency": {
            "type": "string"
        },
        "Format": {
            "type": "string"
        }
    },
    "anyOf": [
        {
            "required": { "required": ["Key"] }
        },
        {
            "required": { "required": ["Series"] }
        },
        {
            "required": { "required": ["Resource"] }
        }
    ],
    "additionalProperties": false

}

