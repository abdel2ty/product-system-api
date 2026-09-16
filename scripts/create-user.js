import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { connectMongo, mongoose } from '../src/integrations/mongo/connection.js';
import { User } from '../src/integrations/mongo/models/User.js';
import { hashPassword } from '../src/services/authService.js';

// There is deliberately no registration endpoint. The account is created here, once.
const rl = readline.createInterface({ input: stdin, output: stdout });

try {
  await connectMongo();
  const existing = await User.countDocuments();
  if (existing > 0) {
    console.log('An account already exists. Use "npm run auth:reset-password" instead.');
    process.exit(0);
  }

  const username = (await rl.question('Username: ')).trim().toLowerCase();
  const password = await rl.question('Password (at least 10 characters): ');

  if (username.length < 3) throw new Error('Username must be at least 3 characters.');
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');

  await User.create({ username, passwordHash: await hashPassword(password) });
  console.log(`\nAccount created for "${username}". You can sign in now.`);
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
  await mongoose.disconnect();
}
