import { Request, Response } from 'express';
import { TeamMember } from '../models/team-member.model';

const first = (...values: unknown[]) => values.find((value) => typeof value === 'string' && value.trim()) as string | undefined;
const normalizePayload = (body: any) => {
  const payload = { ...body };
  payload.email = first(body.email, body.emailAddress) ?? '';
  payload.phone = first(body.phone, body.contactPhone, body.telephone, body.contact) ?? '';
  payload.contact = first(body.contact, body.phone, body.contactPhone, body.telephone) ?? '';
  if (body.whatsapp !== undefined) payload.whatsapp = String(body.whatsapp ?? '');
  if (body.socialLinks !== undefined) payload.socialLinks = body.socialLinks ?? {};
  return payload;
};
const serializeTeamMember = (member: any, isPublic = false) => {
  const raw = typeof member.toObject === 'function' ? member.toObject() : member;
  const email = first(raw.email, raw.emailAddress) ?? '';
  const phone = first(raw.phone, raw.contactPhone, raw.telephone, raw.contact) ?? '';
  const contact = first(raw.contact, raw.phone, raw.contactPhone, raw.telephone) ?? '';
  const contacts = raw.isContactHidden && isPublic ? { email: '', phone: '', contact: '', whatsapp: '' } : { email, phone, contact, whatsapp: first(raw.whatsapp) ?? '' };
  return { id: String(raw._id ?? raw.id), _id: raw._id, name: raw.name ?? '', role: raw.role ?? '', bio: raw.bio ?? '', photo: raw.photo ?? '', ...contacts, socialLinks: raw.socialLinks ?? {}, status: raw.status ?? 'active', position: raw.position ?? 0, isContactHidden: raw.isContactHidden === true, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
};
const validate = (payload: any) => !String(payload.name ?? '').trim() ? 'Le nom est obligatoire.' : null;

export const teamController = {
  async list(req: Request, res: Response) {
    const members = await TeamMember.find({}).sort({ position: 1, createdAt: -1 });
    return res.json({ success: true, data: members.map((member) => serializeTeamMember(member)) });
  },
  async publicList(_req: Request, res: Response) {
    const members = await TeamMember.find({ status: 'active' }).sort({ position: 1, createdAt: -1 });
    return res.json({ success: true, data: members.map((member) => serializeTeamMember(member, true)) });
  },
  async create(req: Request, res: Response) {
    const payload = normalizePayload(req.body);
    const error = validate(payload);
    if (error) return res.status(400).json({ success: false, message: error });
    const member = await TeamMember.create(payload);
    return res.status(201).json({ success: true, data: serializeTeamMember(member) });
  },
  async update(req: Request, res: Response) {
    const previous = await TeamMember.findById(req.params.id);
    if (!previous) return res.status(404).json({ success: false, message: 'Team member not found' });
    const payload = normalizePayload({ ...previous.toObject(), ...req.body });
    const error = validate(payload);
    if (error) return res.status(400).json({ success: false, message: error });
    const member = await TeamMember.findByIdAndUpdate(req.params.id, payload, { new: true });
    return res.json({ success: true, data: serializeTeamMember(member) });
  },
  async remove(req: Request, res: Response) {
    const member = await TeamMember.findByIdAndDelete(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found' });
    return res.status(204).send();
  },
};
