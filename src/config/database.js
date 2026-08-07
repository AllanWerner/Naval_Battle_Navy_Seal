// Charge le .env local. C'est le premier module a lire process.env : le
// faire dans app.js serait trop tard, les tests requierent les modeles
// avant lui. dotenv n'ecrase jamais une variable deja definie, donc en
// conteneur et en CI ce sont bien les vraies variables qui gagnent.
require('dotenv').config();

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'quizdb',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? { require: true } : false
    }
  }
);

module.exports = sequelize;