const crypto = require('crypto');

// Stockage en mémoire (tableau de tâches)
let tasks = [];
let nextId = 1;

class TaskModel {
  // Créer une nouvelle tâche
  static create(description, status = 'pending') {
    const task = {
      id: crypto.randomUUID(),
      description: description.trim(),
      status: status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    tasks.push(task);
    return task;
  }

  // Récupérer toutes les tâches
  static getAll() {
    return tasks;
  }

  // Récupérer une tâche par son ID
  static getById(id) {
    return tasks.find(task => task.id === id);
  }

  // Mettre à jour une tâche
  static update(id, description, status) {
    const taskIndex = tasks.findIndex(task => task.id === id);
    if (taskIndex === -1) {
      return null;
    }

    const task = tasks[taskIndex];
    
    if (description !== undefined) {
      task.description = description.trim();
    }
    if (status !== undefined) {
      task.status = status;
    }
    
    task.updatedAt = new Date().toISOString();
    tasks[taskIndex] = task;
    
    return task;
  }

  // Supprimer une tâche
  static delete(id) {
    const taskIndex = tasks.findIndex(task => task.id === id);
    if (taskIndex === -1) {
      return false;
    }
    
    tasks.splice(taskIndex, 1);
    return true;
  }

  // Réinitialiser le stockage (utile pour les tests)
  static reset() {
    tasks = [];
    nextId = 1;
  }
}

module.exports = TaskModel;