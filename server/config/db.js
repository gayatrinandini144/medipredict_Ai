const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

async function connectDB() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('MongoDB connected');
}

const dbReady = () => mongoose.connection.readyState === 1;

module.exports = { connectDB, dbReady };
