/**
 * A layout document (components placed on a unit grid, version 2), as an agent built it through MCP
 * with create_layout_document + apply_layout_ops. Rendered in the browser by
 * @docforge/layout.
 */
export const layoutContent = {
  "format": "docforge/layout",
  "version": 2,
  "meta": {
    "title": "Relatório do 3º trimestre",
    "locale": "pt-BR"
  },
  "grid": {
    "unit": 8,
    "columns": 12,
    "gutter": 16,
    "gap": 2
  },
  "surfaces": [
    {
      "id": "a4",
      "kind": "page",
      "size": "A4",
      "margin": 40
    },
    {
      "id": "continuous",
      "kind": "continuous",
      "width": 820,
      "margin": 40
    }
  ],
  "components": [
    {
      "id": "titulo",
      "at": {
        "page": 1,
        "x": 0,
        "y": 0,
        "w": 89
      },
      "type": "text",
      "content": {
        "paragraphs": [
          {
            "role": "title-1",
            "text": "Relatório do 3º trimestre"
          },
          {
            "role": "subtitle",
            "text": "Receita, retenção e próximos passos — preparado por um agente via MCP"
          }
        ]
      }
    },
    {
      "id": "kpi-receita",
      "at": {
        "page": 1,
        "x": 0,
        "y": 12,
        "w": 28,
        "h": 16
      },
      "type": "kpi",
      "content": {
        "value": "R$ 4,2 mi",
        "label": "Receita",
        "delta": "+18%",
        "trend": "up"
      }
    },
    {
      "id": "kpi-churn",
      "at": {
        "page": 1,
        "x": 30,
        "y": 12,
        "w": 29,
        "h": 16
      },
      "type": "kpi",
      "content": {
        "value": "2,1%",
        "label": "Churn",
        "delta": "-0,4 pp",
        "trend": "down"
      }
    },
    {
      "id": "kpi-nps",
      "at": {
        "page": 1,
        "x": 61,
        "y": 12,
        "w": 28,
        "h": 16
      },
      "type": "kpi",
      "content": {
        "value": "61",
        "label": "NPS",
        "trend": "flat"
      }
    },
    {
      "id": "analise",
      "at": {
        "page": 1,
        "x": 0,
        "y": 30,
        "w": 44,
        "h": 29
      },
      "type": "text",
      "content": {
        "paragraphs": [
          "A receita cresceu **18%** puxada pelo plano Pro.",
          "O churn caiu depois da [nova integração](#grafico)."
        ]
      }
    },
    {
      "id": "grafico",
      "at": {
        "page": 1,
        "x": 46,
        "y": 30,
        "w": 43,
        "h": 29
      },
      "type": "chart",
      "content": {
        "kind": "bar",
        "categories": [
          "Jul",
          "Ago",
          "Set"
        ],
        "series": [
          {
            "name": "Receita",
            "values": [
              1.2,
              1.4,
              1.6
            ]
          }
        ]
      },
      "props": {
        "unit": "mi"
      }
    },
    {
      "id": "card-pro",
      "at": {
        "page": 1,
        "x": 0,
        "y": 63,
        "w": 28,
        "h": 23
      },
      "type": "card",
      "content": {
        "eyebrow": "Plano",
        "title": "Pro cresceu 31%",
        "text": "Maior parte da receita nova veio de upgrades.",
        "footer": "Ver detalhes →"
      },
      "props": {
        "href": "#tabela"
      }
    },
    {
      "id": "card-churn",
      "at": {
        "page": 1,
        "x": 30,
        "y": 63,
        "w": 29,
        "h": 23
      },
      "type": "card",
      "content": {
        "eyebrow": "Retenção",
        "title": "Churn na mínima do ano",
        "text": "A integração nova reduziu cancelamentos no 1º mês."
      }
    },
    {
      "id": "card-risco",
      "at": {
        "page": 1,
        "x": 61,
        "y": 63,
        "w": 28,
        "h": 23
      },
      "type": "card",
      "content": {
        "eyebrow": "Risco",
        "title": "Dependência de 3 contas",
        "text": "18% da receita está concentrada em três clientes."
      }
    },
    {
      "id": "tabela",
      "at": {
        "page": 1,
        "x": 0,
        "y": 88,
        "w": 51,
        "h": 19
      },
      "type": "table",
      "content": {
        "columns": [
          "Iniciativa",
          {
            "header": "Dono",
            "align": "left"
          },
          {
            "header": "Prazo",
            "align": "right"
          }
        ],
        "rows": [
          [
            "Onboarding guiado",
            "Produto",
            "Nov/26"
          ],
          [
            "Preço anual com desconto",
            "Receita",
            "Dez/26"
          ],
          [
            "Alertas de uso",
            "Plataforma",
            "Jan/27"
          ]
        ]
      },
      "props": {
        "zebra": true
      }
    },
    {
      "id": "etapas",
      "at": {
        "page": 1,
        "x": 53,
        "y": 88,
        "w": 36,
        "h": 19
      },
      "type": "steps",
      "content": {
        "steps": [
          {
            "title": "Validar com 10 contas"
          },
          {
            "title": "Lançar para Pro"
          },
          {
            "title": "Medir churn em 30 dias"
          }
        ]
      }
    }
  ]
};
