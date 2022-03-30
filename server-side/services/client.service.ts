import { Client } from "@pepperi-addons/debug-server/dist";
import { PapiClient } from "@pepperi-addons/papi-sdk";
import { callElasticSearchLambda } from "@pepperi-addons/system-addon-utils";

class ClientService {

    papiClient: PapiClient;

    constructor(private client: Client) {
      this.papiClient = new PapiClient({
        baseURL: client.BaseURL,
        token: client.OAuthAccessToken,
        addonUUID: client.AddonUUID,
        addonSecretKey: client.AddonSecretKey
      });
    }

    async getUIData(query: any) {
        await this.getIndexFieldsAndTypes();
    }

    async getIndexFieldsAndTypes(){
        const indexName='';
        const response = {
            "9a559f05-c41e-49a8-8de4-3155952f465f" : {
              "mappings" : {
                "properties" : {
                  "Account" : {
                    "properties" : {
                      "ExternalID" : {
                        "type" : "text",
                        "fields" : {
                          "keyword" : {
                            "type" : "keyword",
                            "ignore_above" : 256
                          }
                        }
                      },
                      "InternalID" : {
                        "type" : "long"
                      },
                      "Name" : {
                        "type" : "text",
                        "fields" : {
                          "keyword" : {
                            "type" : "keyword",
                            "ignore_above" : 256
                          }
                        }
                      },
                      "TSAChainGroupName" : {
                        "type" : "text",
                        "fields" : {
                          "keyword" : {
                            "type" : "keyword",
                            "ignore_above" : 256
                          }
                        }
                      },
                      "TSARMMName" : {
                        "type" : "text",
                        "fields" : {
                          "keyword" : {
                            "type" : "keyword",
                            "ignore_above" : 256
                          }
                        }
                      }
                    }
                  },
                  "ActionDateTime" : {
                    "type" : "date"
                  },
                  "ActivityTypeID" : {
                    "type" : "long"
                  },
                  "ElasticSearchType" : {
                    "type" : "text",
                    "fields" : {
                      "keyword" : {
                        "type" : "keyword",
                        "ignore_above" : 256
                      }
                    }
                  },
                  "GrandTotal" : {
                    "type" : "long"
                  },
                  "InternalID" : {
                    "type" : "long"
                  },
                  "Item" : {
                    "properties" : {
                      "ExternalID" : {
                        "type" : "text",
                        "fields" : {
                          "keyword" : {
                            "type" : "keyword",
                            "ignore_above" : 256
                          }
                        }
                      },
                      "InternalID" : {
                        "type" : "long"
                      },
                      "MainCategory" : {
                        "type" : "text",
                        "fields" : {
                          "keyword" : {
                            "type" : "keyword",
                            "ignore_above" : 256
                          }
                        }
                      },
                      "Name" : {
                        "type" : "text",
                        "fields" : {
                          "keyword" : {
                            "type" : "keyword",
                            "ignore_above" : 256
                          }
                        }
                      }
                    }
                  },
                  "ModificationDateTime" : {
                    "type" : "date"
                  },
                  "Status" : {
                    "type" : "long"
                  },
                  "TotalUnitsPriceAfterDiscount" : {
                    "type" : "float"
                  },
                  "Transaction" : {
                    "properties" : {
                      "Account" : {
                        "properties" : {
                          "ExternalID" : {
                            "type" : "text",
                            "fields" : {
                              "keyword" : {
                                "type" : "keyword",
                                "ignore_above" : 256
                              }
                            }
                          },
                          "InternalID" : {
                            "type" : "long"
                          },
                          "Name" : {
                            "type" : "text",
                            "fields" : {
                              "keyword" : {
                                "type" : "keyword",
                                "ignore_above" : 256
                              }
                            }
                          },
                          "TSAChainGroupName" : {
                            "type" : "text",
                            "fields" : {
                              "keyword" : {
                                "type" : "keyword",
                                "ignore_above" : 256
                              }
                            }
                          },
                          "TSARMMName" : {
                            "type" : "text",
                            "fields" : {
                              "keyword" : {
                                "type" : "keyword",
                                "ignore_above" : 256
                              }
                            }
                          }
                        }
                      },
                      "ActionDateTime" : {
                        "type" : "date"
                      },
                      "ActivityTypeID" : {
                        "type" : "long"
                      },
                      "GrandTotal" : {
                        "type" : "float"
                      },
                      "InternalID" : {
                        "type" : "long"
                      },
                      "ModificationDateTime" : {
                        "type" : "date"
                      },
                      "Status" : {
                        "type" : "long"
                      },
                      "Type" : {
                        "type" : "text",
                        "fields" : {
                          "keyword" : {
                            "type" : "keyword",
                            "ignore_above" : 256
                          }
                        }
                      }
                    }
                  },
                  "Type" : {
                    "type" : "text",
                    "fields" : {
                      "keyword" : {
                        "type" : "keyword",
                        "ignore_above" : 256
                      }
                    }
                  },
                  "UUID" : {
                    "type" : "text",
                    "fields" : {
                      "keyword" : {
                        "type" : "keyword",
                        "ignore_above" : 256
                      }
                    }
                  },
                  "UnitsQuantity" : {
                    "type" : "long"
                  }
                }
              }
            }
          };
        const test = await this.papiClient.addons.api.uuid(DATA_INDEX_ADDON_UUID).file('data_index_meta_data').func('all_activities_fields').get();
        // this.papiClient.addons.api.uuid(DATA_INDEX_ADDON_UUID).file('data_index_meta_data').func('transaction_lines_fields').get();
        // callElasticSearchLambda(`${indexName}/_mapping`, `GET`,null, null, true);

        // const promises:Promise<any>[] = []
        // Promise.all(promises).then((results)=>{
        //     const allFields = results[0].Fields.concat(results[1].Fields);
        //     const fieldsTypes
        // })
    }
}
export default ClientService;
export const DATA_INDEX_ADDON_UUID = '10979a11-d7f4-41df-8993-f06bfd778304';
