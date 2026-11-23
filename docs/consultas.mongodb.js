// Gerado por python scripts/export_queries.py. Exemplo: novembro de 2026.
// Execute: mongosh "mongodb://127.0.0.1:27017/finscope" docs/consultas.mongodb.js
// EJSON.parse restaura BSON Date e tipos numéricos; não são strings na consulta.

// Consulta 1 — Evolução financeira mensal
print("1 — Evolução financeira mensal");
printjson(db.transactions.aggregate(EJSON.parse(`[
  {
    "$match": {
      "date": {
        "$gte": {
          "$date": "2026-06-01T03:00:00Z"
        },
        "$lt": {
          "$date": "2026-12-01T03:00:00Z"
        }
      }
    }
  },
  {
    "$group": {
      "_id": {
        "month": {
          "$dateToString": {
            "format": "%Y-%m",
            "date": "$date",
            "timezone": "America/Sao_Paulo"
          }
        },
        "type": "$type"
      },
      "total": {
        "$sum": "$amount"
      }
    }
  },
  {
    "$project": {
      "_id": 0,
      "month": "$_id.month",
      "type": "$_id.type",
      "total": 1
    }
  },
  {
    "$sort": {
      "month": 1,
      "type": 1
    }
  }
]`)).toArray());

// Consulta 2 — Distribuição por categoria
print("2 — Distribuição por categoria");
printjson(db.transactions.aggregate(EJSON.parse(`[
  {
    "$match": {
      "date": {
        "$gte": {
          "$date": "2026-11-01T03:00:00Z"
        },
        "$lt": {
          "$date": "2026-12-01T03:00:00Z"
        }
      },
      "type": "expense"
    }
  },
  {
    "$group": {
      "_id": "$category",
      "total": {
        "$sum": "$amount"
      },
      "count": {
        "$sum": 1
      }
    }
  },
  {
    "$group": {
      "_id": null,
      "overall": {
        "$sum": "$total"
      },
      "categories": {
        "$push": {
          "category": "$_id",
          "total": "$total",
          "count": "$count"
        }
      }
    }
  },
  {
    "$unwind": "$categories"
  },
  {
    "$project": {
      "_id": 0,
      "category": "$categories.category",
      "total": "$categories.total",
      "count": "$categories.count",
      "percentage": {
        "$multiply": [
          {
            "$divide": [
              "$categories.total",
              "$overall"
            ]
          },
          100
        ]
      }
    }
  },
  {
    "$sort": {
      "total": -1,
      "category": 1
    }
  }
]`)).toArray());

// Consulta 3 — Despesas atípicas
print("3 — Despesas atípicas");
printjson(db.transactions.aggregate(EJSON.parse(`[
  {
    "$match": {
      "date": {
        "$gte": {
          "$date": "2026-05-01T03:00:00Z"
        },
        "$lt": {
          "$date": "2026-11-01T03:00:00Z"
        }
      },
      "type": "expense"
    }
  },
  {
    "$group": {
      "_id": "$category",
      "average": {
        "$avg": "$amount"
      },
      "sample_size": {
        "$sum": 1
      }
    }
  },
  {
    "$match": {
      "sample_size": {
        "$gte": 3
      }
    }
  },
  {
    "$set": {
      "threshold": {
        "$multiply": [
          "$average",
          2
        ]
      }
    }
  },
  {
    "$lookup": {
      "from": "transactions",
      "let": {
        "category": "$_id",
        "threshold": "$threshold"
      },
      "pipeline": [
        {
          "$match": {
            "date": {
              "$gte": {
                "$date": "2026-11-01T03:00:00Z"
              },
              "$lt": {
                "$date": "2026-12-01T03:00:00Z"
              }
            },
            "type": "expense"
          }
        },
        {
          "$match": {
            "$expr": {
              "$and": [
                {
                  "$eq": [
                    "$category",
                    "$$category"
                  ]
                },
                {
                  "$gt": [
                    "$amount",
                    "$$threshold"
                  ]
                }
              ]
            }
          }
        },
        {
          "$project": {
            "description": 1,
            "amount": 1,
            "date": 1
          }
        }
      ],
      "as": "unusual"
    }
  },
  {
    "$unwind": "$unusual"
  },
  {
    "$project": {
      "_id": "$unusual._id",
      "category": "$_id",
      "description": "$unusual.description",
      "amount": "$unusual.amount",
      "date": "$unusual.date",
      "average": 1,
      "threshold": 1,
      "sample_size": 1
    }
  },
  {
    "$sort": {
      "amount": -1
    }
  }
]`)).toArray());

// Consulta 4 — Padrões recorrentes
print("4 — Padrões recorrentes");
printjson(db.transactions.aggregate(EJSON.parse(`[
  {
    "$match": {
      "date": {
        "$gte": {
          "$date": "2026-06-01T03:00:00Z"
        },
        "$lt": {
          "$date": "2026-12-01T03:00:00Z"
        }
      },
      "type": "expense"
    }
  },
  {
    "$set": {
      "identity": {
        "$toLower": {
          "$trim": {
            "input": {
              "$cond": [
                {
                  "$ne": [
                    "$merchant.name",
                    ""
                  ]
                },
                "$merchant.name",
                "$description"
              ]
            }
          }
        }
      },
      "day": {
        "$dateTrunc": {
          "date": "$date",
          "unit": "day",
          "timezone": "America/Sao_Paulo"
        }
      }
    }
  },
  {
    "$group": {
      "_id": {
        "name": "$identity",
        "category": "$category",
        "day": "$day"
      },
      "amount": {
        "$sum": "$amount"
      },
      "payments": {
        "$sum": 1
      },
      "label": {
        "$first": "$merchant.name"
      }
    }
  },
  {
    "$set": {
      "key": {
        "name": "$_id.name",
        "category": "$_id.category"
      },
      "date": "$_id.day"
    }
  },
  {
    "$setWindowFields": {
      "partitionBy": "$key",
      "sortBy": {
        "date": 1
      },
      "output": {
        "previous": {
          "$shift": {
            "output": "$date",
            "by": -1
          }
        }
      }
    }
  },
  {
    "$set": {
      "interval": {
        "$cond": [
          {
            "$ne": [
              "$previous",
              null
            ]
          },
          {
            "$dateDiff": {
              "startDate": "$previous",
              "endDate": "$date",
              "unit": "day",
              "timezone": "America/Sao_Paulo"
            }
          },
          null
        ]
      }
    }
  },
  {
    "$group": {
      "_id": "$key",
      "days": {
        "$sum": 1
      },
      "payments": {
        "$sum": "$payments"
      },
      "average": {
        "$avg": "$amount"
      },
      "dates": {
        "$addToSet": "$date"
      },
      "min_interval": {
        "$min": "$interval"
      },
      "max_interval": {
        "$max": "$interval"
      },
      "average_interval": {
        "$avg": "$interval"
      },
      "last_date": {
        "$max": "$date"
      }
    }
  },
  {
    "$match": {
      "days": {
        "$gte": 3
      },
      "$or": [
        {
          "min_interval": {
            "$gte": 25
          },
          "max_interval": {
            "$lte": 35
          }
        },
        {
          "min_interval": {
            "$gte": 5
          },
          "max_interval": {
            "$lte": 9
          }
        }
      ]
    }
  },
  {
    "$project": {
      "_id": 0,
      "merchant": "$_id.name",
      "category": "$_id.category",
      "days": 1,
      "payments": 1,
      "average": 1,
      "dates": 1,
      "min_interval": 1,
      "max_interval": 1,
      "average_interval": 1,
      "last_date": 1,
      "cadence": {
        "$cond": [
          {
            "$gte": [
              "$min_interval",
              25
            ]
          },
          "Mensal",
          "Semanal"
        ]
      }
    }
  },
  {
    "$sort": {
      "average": -1,
      "merchant": 1
    }
  }
]`)).toArray());
