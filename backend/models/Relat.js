// backend/models/Relat.js

module.exports = (sequelize, DataTypes) => {
  const Relat = sequelize.define(
    "Relat",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        // ID do usuário (de quem é este relatório)
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      data_inicio: {
        // Data de início do período do relatório
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      data_fim: {
        // Data de fim do período
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      tipo: {
        // 'semanal' ou 'mensal'
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      dados_kpi: {
        // JSON com { meta: 2000, real: 2150, desvio: 150 }
        type: DataTypes.JSON,
        allowNull: true,
      },
      dados_grafico_peso: {
        // JSON com { labels: [...], data: [...] }
        type: DataTypes.JSON,
        allowNull: true,
      },
      dados_grafico_macros: {
        // JSON com { prot_target: ..., prot_real: ... }
        type: DataTypes.JSON,
        allowNull: true,
      },
      insight_analise: {
        // O texto da "Análise de Observações"
        type: DataTypes.TEXT,
        allowNull: true,
      },
      plano_adaptativo_sugerido: {
        // O texto do "Plano Adaptativo" gerado pela IA
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "relatorios",
      timestamps: true,
      indexes: [
        {
          // Índice para buscar relatórios de um usuário rapidamente
          fields: ["user_id", "data_fim"],
        },
      ],
    }
  );

  return Relat;
};
