import { isValidObjectId, Types } from 'mongoose';
import { Media } from '../models/media.model';

const toUrls = (values: Array<string | undefined | null>) => values.map((value) => String(value || '').trim()).filter(Boolean);

export async function syncMediaUsage(resourceType: string, resourceId: unknown, field: string, nextValues: Array<string | undefined | null>, previousValues: Array<string | undefined | null> = []) {
  if (!isValidObjectId(resourceId)) return;
  const id = new Types.ObjectId(String(resourceId));
  const nextUrls = Array.from(new Set(toUrls(nextValues)));
  const previousUrls = Array.from(new Set(toUrls(previousValues)));
  const removed = previousUrls.filter((url) => !nextUrls.includes(url));
  const added = nextUrls.filter((url) => !previousUrls.includes(url));

  if (removed.length) {
    await Media.updateMany({ url: { $in: removed } }, { $pull: { usedIn: { resourceType, resourceId: id, field } } });
  }
  if (added.length) {
    await Promise.all(added.map((url) => Media.updateOne({ url }, { $addToSet: { usedIn: { resourceType, resourceId: id, field } } })));
  }
  const touched = Array.from(new Set([...nextUrls, ...previousUrls]));
  await Promise.all(touched.map(async (url) => {
    const media = await Media.findOne({ url });
    if (!media) return;
    const usedIn = Array.isArray(media.usedIn) ? media.usedIn : [];
    media.usageCount = usedIn.length;
    await media.save();
  }));
}
