/**
 * A layout document (components on a grid), as an agent built it through MCP
 * with create_layout_document + apply_layout_ops. Rendered in the browser by
 * @docforge/layout.
 */
export const layoutContent = {
  "format": "docforge/layout",
  "version": 1,
  "meta": {
    "title": "Relatório do 3º trimestre",
    "locale": "pt-BR"
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
  "sections": [
    {
      "id": "s-1",
      "bands": [
        {
          "id": "r-titulo",
          "span": "auto",
          "items": [
            {
              "component": "titulo",
              "colStart": 1,
              "colSpan": 12
            }
          ]
        },
        {
          "id": "r-kpis",
          "span": "auto",
          "items": [
            {
              "component": "kpi-receita",
              "colStart": 1,
              "colSpan": 4
            },
            {
              "component": "kpi-churn",
              "colStart": 5,
              "colSpan": 4
            },
            {
              "component": "kpi-nps",
              "colStart": 9,
              "colSpan": 4
            }
          ]
        },
        {
          "id": "r-corpo",
          "span": "auto",
          "items": [
            {
              "component": "analise",
              "colStart": 1,
              "colSpan": 6
            },
            {
              "component": "grafico",
              "colStart": 7,
              "colSpan": 6
            }
          ]
        }
      ]
    },
    {
      "id": "s-2",
      "name": "Próximos passos",
      "bands": [
        {
          "id": "r-cards",
          "span": "auto",
          "items": [
            {
              "component": "card-pro",
              "colStart": 1,
              "colSpan": 4
            },
            {
              "component": "card-churn",
              "colStart": 5,
              "colSpan": 4
            },
            {
              "component": "card-risco",
              "colStart": 9,
              "colSpan": 4
            }
          ]
        },
        {
          "id": "r-plano",
          "span": "auto",
          "items": [
            {
              "component": "tabela",
              "colStart": 1,
              "colSpan": 7
            },
            {
              "component": "etapas",
              "colStart": 8,
              "colSpan": 5
            }
          ]
        }
      ]
    }
  ],
  "components": [
    {
      "id": "titulo",
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
      "type": "kpi",
      "content": {
        "value": "61",
        "label": "NPS",
        "trend": "flat"
      }
    },
    {
      "id": "analise",
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
      "type": "card",
      "content": {
        "eyebrow": "Retenção",
        "title": "Churn na mínima do ano",
        "text": "A integração nova reduziu cancelamentos no 1º mês."
      }
    },
    {
      "id": "card-risco",
      "type": "card",
      "content": {
        "eyebrow": "Risco",
        "title": "Dependência de 3 contas",
        "text": "18% da receita está concentrada em três clientes."
      }
    },
    {
      "id": "tabela",
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
