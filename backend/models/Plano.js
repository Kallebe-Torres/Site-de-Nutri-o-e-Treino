    const { DataTypes } = require('sequelize');
    const sequelize = require('../config/database');
    const User = require('./User');

    const Plan = sequelize.define('Plan', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: { // Chave Estrangeira
            type: DataTypes.INTEGER,
            references: {
                model: User,
                key: 'id',
            },
            allowNull: false
        },
        meta_diaria_kcal: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        objetivo: {
            type: DataTypes.STRING,
            allowNull: false
        },
        plano_json: { // Tipo JSON para salvar o plano completo do Gemini
            type: DataTypes.JSON,
            allowNull: false
        }
    }, {
        tableName: 'planos',
        timestamps: true,
    });

    // Define o relacionamento (Um Usuário tem muitos Planos)
    User.hasMany(Plan, { foreignKey: 'user_id' });
    Plan.belongsTo(User, { foreignKey: 'user_id' });

    module.exports = Plan;