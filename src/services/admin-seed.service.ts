import { env } from '../config/env';
import { User } from '../models/user.model';
import { hashPassword } from '../utils/password';

export async function seedDefaultAdmin() {
  const email = env.adminDefaultEmail;

  if (!email) {
    const adminExists = await User.exists({ role: 'admin' });
    if (!adminExists) console.warn('[admin-seed] Aucun administrateur trouvé et ADMIN_DEFAULT_EMAIL n’est pas défini.');
    return;
  }

  if (!env.adminDefaultPassword) throw new Error('ADMIN_DEFAULT_PASSWORD est requis lorsque ADMIN_DEFAULT_EMAIL est défini.');
  if (env.adminWhitelist.length > 0 && !env.adminWhitelist.includes(email)) {
    throw new Error('ADMIN_DEFAULT_EMAIL doit être présent dans ADMIN_WHITELIST.');
  }

  const existing = await User.findOne({ email }).select('+passwordHash');
  if (existing && existing.role !== 'admin') {
    throw new Error('ADMIN_DEFAULT_EMAIL correspond à un compte existant non administrateur.');
  }

  if (!existing) {
    await User.create({
      email,
      name: env.adminDefaultName,
      passwordHash: await hashPassword(env.adminDefaultPassword),
      role: 'admin',
      disabled: false,
    });
    console.info('[admin-seed] Administrator account created.');
    return;
  }

  let changed = false;
  if (existing.disabled) {
    existing.disabled = false;
    changed = true;
  }
  if (env.adminDefaultName && existing.name !== env.adminDefaultName) {
    existing.name = env.adminDefaultName;
    changed = true;
  }

  if (env.adminResetPasswordOnStart) {
    existing.passwordHash = await hashPassword(env.adminDefaultPassword);
    existing.role = 'admin';
    existing.disabled = false;
    if (env.adminDefaultName) existing.name = env.adminDefaultName;
    await existing.save();
    console.info('[admin-seed] Admin password reset from env.');
    return;
  }

  if (changed) await existing.save();
}
