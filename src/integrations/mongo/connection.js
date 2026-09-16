import mongoose from 'mongoose';
import { env } from '../../config/env.js';

let connected = false;

export async function connectMongo() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  connected = true;
  mongoose.connection.on('disconnected', () => {
    connected = false;
  });
  mongoose.connection.on('connected', () => {
    connected = true;
  });
}

export const mongoStatus = () => (connected && mongoose.connection.readyState === 1 ? 'up' : 'down');
export { mongoose };
