import { Schema, model } from 'mongoose';

const TeamMemberSchema = new Schema(
  {
    name: { type: String, trim: true, required: true },
    role: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, default: '' },
    photo: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    contact: { type: String, trim: true, default: '' },
    whatsapp: { type: String, trim: true, default: '' },
    socialLinks: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['draft', 'active', 'inactive', 'archived'], default: 'active', index: true },
    position: { type: Number, default: 0, index: true },
    isContactHidden: { type: Boolean, default: false },
  },
  { timestamps: true, strict: false },
);

export const TeamMember = model('TeamMember', TeamMemberSchema);
