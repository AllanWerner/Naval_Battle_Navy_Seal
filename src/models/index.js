const sequelize = require('../config/database');
const Task = require('./task');

const db = {
  sequelize,
  Task
};

// Synchroniser avec la base de données
db.sync = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Synchroniser les modèles (en développement uniquement)
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database synchronized');
    } else {
      await sequelize.sync();
    }
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }
};

module.exports = db;