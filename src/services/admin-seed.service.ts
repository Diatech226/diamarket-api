import { env } from '../config/env';
import { User } from '../models/user.model';
import { hashPassword } from '../utils/password';

export async function seedDefaultAdmin() {
  const email = env.adminDefaultEmail;
  const adminExists = await User.exists({ role: 'admin' });

  if (!adminExists) {
    if (!email) {
      console.warn('[admin-seed] Aucun administrateur trouvé et ADMIN_DEFAULT_EMAIL n’est pas défini.');
      return;
    }
    if (!env.adminDefaultPassword) throw new Error('ADMIN_DEFAULT_PASSWORD est requis lorsque ADMIN_DEFAULT_EMAIL est défini.');
    if (env.adminWhitelist.length > 0 && !env.adminWhitelist.includes(email)) {
      throw new Error('ADMIN_DEFAULT_EMAIL doit être présent dans ADMIN_WHITELIST.');
    }
    const existing = await User.findOne({ email });
    if (existing) throw new Error('ADMIN_DEFAULT_EMAIL correspond à un compte existant non administrateur.');

    await User.create({
      email,
      name: env.adminDefaultName,
      passwordHash: await hashPassword(env.adminDefaultPassword),
      role: 'admin',
    });
    console.info('[admin-seed] Administrator account created.');
    return;
  }

  if (!env.adminResetPasswordOnStart) return;

  if (!env.adminDefaultPassword) throw new Error('ADMIN_DEFAULT_PASSWORD est requis lorsque ADMIN_RESET_PASSWORD_ON_START=true.');
  if (email && env.adminWhitelist.length > 0 && !env.adminWhitelist.includes(email)) {
    throw new Error('ADMIN_DEFAULT_EMAIL doit être présent dans ADMIN_WHITELIST.');
  }

  const userWithDefaultEmail = email ? await User.findOne({ email }).select('+passwordHash') : null;
  if (userWithDefaultEmail && userWithDefaultEmail.role !== 'admin') {
    throw new Error('ADMIN_DEFAULT_EMAIL correspond à un compte existant non administrateur.');
  }

  const admin = userWithDefaultEmail ?? (await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('+passwordHash'));
  if (!admin) throw new Error('Aucun administrateur à réinitialiser.');

  if (email) admin.email = email;
  if (env.adminDefaultName) admin.name = env.adminDefaultName;
  admin.passwordHash = await hashPassword(env.adminDefaultPassword);
  admin.role = 'admin';
  await admin.save();

  console.info('[admin-seed] Admin password reset from env.');
}
