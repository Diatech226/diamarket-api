import { env } from '../config/env';
import { User } from '../models/user.model';
import { hashPassword } from '../utils/password';

export async function seedDefaultAdmin() {
  const email = env.adminDefaultEmail;
  if (await User.exists({ role: 'admin' })) {
    console.info('[admin-seed] An administrator account already exists.');
    return;
  }
  if (!email) {
    if (!(await User.exists({ role: 'admin' }))) console.warn('[admin-seed] Aucun administrateur trouvé et ADMIN_DEFAULT_EMAIL n’est pas défini.');
    return;
  }
  if (!env.adminDefaultPassword) throw new Error('ADMIN_DEFAULT_PASSWORD est requis lorsque ADMIN_DEFAULT_EMAIL est défini.');
  if (env.adminWhitelist.length > 0 && !env.adminWhitelist.includes(email)) {
    throw new Error('ADMIN_DEFAULT_EMAIL doit être présent dans ADMIN_WHITELIST.');
  }
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') throw new Error('ADMIN_DEFAULT_EMAIL correspond à un compte existant non administrateur.');
    console.info('[admin-seed] Administrator account already exists.');
    return;
  }

  await User.create({
    email,
    name: env.adminDefaultName,
    passwordHash: await hashPassword(env.adminDefaultPassword),
    role: 'admin',
  });
  console.info('[admin-seed] Administrator account created.');
}
