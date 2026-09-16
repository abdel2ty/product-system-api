import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { connectMongo, mongoose } from '../src/integrations/mongo/connection.js';
import { User } from '../src/integrations/mongo/models/User.js';
import { Session } from '../src/integrations/mongo/models/Session.js';
import { hashPassword } from '../src/services/authService.js';

const rl = readline.createInterface({ input: stdin, output: stdout });

try {
  await connectMongo();
  const user = await User.findOne();
  if (!user) throw new Error('No account exists yet. Run "npm run auth:create-user".');

  console.log(`Resetting the password for "${user.username}".`);
  const password = await rl.question('New password (at least 10 characters): ');
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');

  user.passwordHash = await hashPassword(password);
  user.tokenVersion += 1;
  user.failedAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });

  console.log('\nPassword changed. Every existing session has been signed out.');
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
  await mongoose.disconnect();
}
