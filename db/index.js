import { Sequelize } from 'sequelize'
import * as dotenv from 'dotenv'
dotenv.config()

export async function connectToDatabase() {
  const sequelize = new Sequelize({
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    dialect : 'postgres'
  })

  try {
    await sequelize.authenticate()
    console.log('Database connection has been established successfully.')
  } catch (error) {
    console.error('Unable to connect to the database:', error)
  }

  return sequelize
}

export async function generateTables(sequelize) {
  try {
  const createTable =  await sequelize.define('Todo', {
        id : {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
    })
    console.log('Table definition created successfully.')
    await createTable.sync({ force: true })
  } catch (error) {
    console.error('Error creating tables:', error)
  }
}

