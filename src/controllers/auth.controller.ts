import { Request, Response } from 'express';
import { env } from '../config/env';
import { User } from '../models/user.model';
import { AuthContext } from '../middlewares/requireAuth';
import { hashPassword, verifyPassword } from '../utils/password';
import { clearSessionCookie, createSessionToken, SessionUser, setSessionCookie } from '../utils/session';

const normalizeEmail = (value: unknown) => String(value ?? '').trim().toLowerCase();
const isValidEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);
const publicUser = (user: { _id: unknown; email?: string | null; name?: string | null; role?: string | null }): SessionUser => ({
  id: String(user._id),
  email: user.email ?? '',
  name: user.name ?? undefined,
  role: user.role ?? 'user',
});
const establishSession = (res: Response, user: SessionUser, message: string, status = 200) => {
  const token = createSessionToken(user);
  setSessionCookie(res, token);
  return res.status(status).json({ success: true, message, authenticated: true, token, user });
};
const isDuplicateKeyError = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

export const authController = {
  async register(req: Request, res: Response) {
    if (!env.publicRegistrationEnabled) return res.status(403).json({ success: false, message: 'Création de compte désactivée' });
    if (!env.emailPasswordAuthEnabled) return res.status(403).json({ success: false, message: 'Authentification par e-mail désactivée' });

    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password ?? '');
    const name = String(req.body.name ?? '').trim();
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Adresse e-mail invalide' });
    if (!name) return res.status(400).json({ success: false, message: 'Le nom est requis' });
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères' });
    if (await User.exists({ email })) return res.status(409).json({ success: false, message: 'Cet e-mail est déjà utilisé' });

    try {
      // Public input never controls the role, including when a malicious body contains role: "admin".
      const user = await User.create({ email, name, passwordHash: await hashPassword(password), role: 'user' });
      return establishSession(res, publicUser(user), 'Registration successful', 201);
    } catch (error) {
      if (isDuplicateKeyError(error)) return res.status(409).json({ success: false, message: 'Cet e-mail est déjà utilisé' });
      throw error;
    }
  },

  async login(req: Request, res: Response) {
    if (!env.emailPasswordAuthEnabled) return res.status(403).json({ success: false, message: 'Authentification par e-mail désactivée' });
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password ?? '');
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Invalid email address' });

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (user.disabled) return res.status(403).json({ success: false, message: 'Compte désactivé' });
    if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    return establishSession(res, publicUser(user), 'Login successful');
  },

  async me(req: Request, res: Response) {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const user = await User.findById(auth.userId);
    if (!user || user.disabled) {
      clearSessionCookie(res);
      return res.status(401).json({ success: false, authenticated: false, message: 'Compte introuvable ou désactivé' });
    }
    return res.json({ success: true, authenticated: true, user: publicUser(user) });
  },

  forgotPassword(req: Request, res: Response) {
    const email = normalizeEmail(req.body.email);
    if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, message: 'Adresse e-mail invalide' });
    // Do not disclose whether the account exists. E-mail delivery is intentionally deferred
    // until a transactional mail provider is configured.
    return res.json({ success: true, message: 'Si un compte existe, des instructions de réinitialisation seront envoyées.' });
  },

  resetPassword(req: Request, res: Response) {
    const token = String(req.body.token ?? '').trim();
    const password = String(req.body.password ?? '');
    if (!token) return res.status(400).json({ success: false, message: 'Token de réinitialisation requis' });
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères' });
    return res.status(501).json({ success: false, message: 'Réinitialisation par token non configurée' });
  },

  logout(_req: Request, res: Response) {
    clearSessionCookie(res);
    return res.json({ success: true, authenticated: false });
  },

  providers(_req: Request, res: Response) {
    return res.json({ providers: [] });
  },
};
