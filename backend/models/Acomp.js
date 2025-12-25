// backend/models/Acomp.js

module.exports = (sequelize, DataTypes) => {
  const Acomp = sequelize.define(
    "Acomp",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        // ID do usuário (de qual usuário é este registro)
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      data_registro: {
        // A data (ex: "2025-10-23")
        type: DataTypes.DATEONLY, // Armazena apenas AAAA-MM-DD
        allowNull: false,
      },
      peso: {
        // O peso do usuário naquele dia
        type: DataTypes.DECIMAL(5, 2), // Ex: 120.50
        allowNull: true,
      },
      observacao: {
        // O texto de observação
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status_refeicoes: {
        // O JSON com { cafe: "Consumido", ... }
        type: DataTypes.JSON,
        allowNull: true,
      },
      macros_consumidos: {
        // O JSON com { proteinas: 100, ... }
        type: DataTypes.JSON,
        allowNull: true,
      },
      calorias_consumidas: {
        // O total de calorias calculadas
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      metas_diarias: {
        // O JSON com as metas do plano (para referência)
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "acompanhamentos", // Nome da tabela no MySQL
      timestamps: true, // Cria createdAt e updatedAt
      indexes: [
        {
          // Cria um índice único para user_id e data_registro
          // Isso impede que o mesmo usuário salve dois registros para o mesmo dia
          unique: true,
          fields: ["user_id", "data_registro"],
        },
      ],
    }
  );

  return Acomp;
};
