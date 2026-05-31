import dns from 'node:dns/promises';
import mongoose from 'mongoose';

const MONGODB_SRV_PREFIX = 'mongodb+srv://';
const MONGODB_STANDARD_PREFIX = 'mongodb://';
const ATLAS_HOSTNAME_SUFFIX = '.mongodb.net';

type MongoUriValidation = {
  hostname: string;
  isAtlasHostname: boolean;
  isSrvUri: boolean;
  srvRecord?: string;
};

const redactMongoCredentials = (message: string) =>
  message.replace(/(mongodb(?:\+srv)?:\/\/)([^@\s/]+)@/gi, '$1***:***@');

const getErrorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const getErrorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

const isDnsCode = (error: unknown, code: string) => getErrorCode(error).toUpperCase() === code;

const getSrvRecord = (hostname: string) => `_mongodb._tcp.${hostname}`;

const isAtlasHostname = (hostname: string) => hostname.toLowerCase().endsWith(ATLAS_HOSTNAME_SUFFIX);

export const validateMongoUri = (uri: string): MongoUriValidation => {
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Set it in apps/diamarket-api/.env or export it before starting the API.');
  }

  if (!uri.startsWith(MONGODB_SRV_PREFIX) && !uri.startsWith(MONGODB_STANDARD_PREFIX)) {
    throw new Error('MONGODB_URI must start with mongodb+srv:// for Atlas SRV URIs or mongodb:// for standard MongoDB URIs.');
  }

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`MONGODB_URI is not a valid MongoDB URI: ${redactMongoCredentials(uri)}`);
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new Error(`MONGODB_URI does not contain a hostname: ${redactMongoCredentials(uri)}`);
  }

  const isSrvUri = uri.startsWith(MONGODB_SRV_PREFIX);
  if (isSrvUri && parsed.port) {
    throw new Error('MONGODB_URI uses mongodb+srv:// and must not include a port. Copy the SRV URI directly from Atlas > Connect > Drivers.');
  }

  if (isSrvUri && !hostname.includes('.')) {
    throw new Error('MONGODB_URI uses mongodb+srv:// but the hostname is not fully qualified. Copy the full Atlas hostname from Atlas > Connect > Drivers.');
  }

  return {
    hostname,
    isAtlasHostname: isAtlasHostname(hostname),
    isSrvUri,
    srvRecord: isSrvUri ? getSrvRecord(hostname) : undefined
  };
};

const isSrvDnsError = (error: unknown) => {
  const errorText = `${getErrorCode(error)} ${getErrorText(error)}`;
  return /querySrv|ENOTFOUND|EAI_AGAIN|ETIMEOUT|ENODATA|ESERVFAIL|ECONNREFUSED/i.test(errorText);
};

const isSrvHostNotFoundError = (error: unknown) => {
  const errorText = `${getErrorCode(error)} ${getErrorText(error)}`;
  return /ENOTFOUND/i.test(errorText) && /querySrv|_mongodb\._tcp\./i.test(errorText);
};

const hostnameExists = async (hostname: string) => {
  const checks = [dns.resolve4(hostname), dns.resolve6(hostname), dns.resolveCname(hostname)];
  const results = await Promise.allSettled(checks);

  if (results.some((result) => result.status === 'fulfilled' && result.value.length > 0)) {
    return true;
  }

  const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (rejected.length === checks.length && rejected.every((result) => isDnsCode(result.reason, 'ENOTFOUND'))) {
    return false;
  }

  return undefined;
};

const buildInvalidAtlasHostnameMessage = (error: unknown, hostname: string) => {
  const baseMessage = redactMongoCredentials(getErrorText(error));
  const srvRecord = getSrvRecord(hostname);

  return [
    'The Atlas hostname appears invalid or no longer exists.',
    `MongoDB Atlas DNS SRV lookup failed for host "${hostname}" (${srvRecord}).`,
    'DNS reports that the hostname itself does not exist, so this is not being reported as a generic network connectivity problem.',
    'Copy a fresh connection string from Atlas > Connect > Drivers and confirm that the cluster still exists in the selected Atlas project.',
    `Original error: ${baseMessage}`
  ].join(' ');
};

const buildSrvDnsErrorMessage = (error: unknown, hostname: string) => {
  const baseMessage = redactMongoCredentials(getErrorText(error));
  const srvRecord = getSrvRecord(hostname);

  return [
    `MongoDB Atlas DNS SRV lookup failed for host "${hostname}" (${srvRecord}).`,
    'Connection to MongoDB is required, so the API will stop.',
    'Checks to run:',
    '1) verify that this machine has internet access;',
    '2) verify that DNS resolution works for the Atlas SRV record;',
    '3) verify that the MongoDB Atlas cluster exists and is running;',
    '4) verify that MONGODB_URI exactly matches the URI copied from Atlas > Connect > Drivers;',
    '5) if mongodb+srv:// keeps failing on this network, try the standard mongodb:// URI from Atlas.',
    `Original error: ${baseMessage}`
  ].join(' ');
};

const atlasHostnameIsConfirmedMissing = async (error: unknown, validation: MongoUriValidation) => {
  if (!validation.isAtlasHostname || !isSrvHostNotFoundError(error)) {
    return false;
  }

  return (await hostnameExists(validation.hostname)) === false;
};

const buildConnectionErrorMessage = async (error: unknown, validation: MongoUriValidation) => {
  const baseMessage = redactMongoCredentials(getErrorText(error));

  if (validation.isSrvUri && isSrvDnsError(error)) {
    if (await atlasHostnameIsConfirmedMissing(error, validation)) {
      return buildInvalidAtlasHostnameMessage(error, validation.hostname);
    }

    return buildSrvDnsErrorMessage(error, validation.hostname);
  }

  return `MongoDB connection failed for host "${validation.hostname}". Connection to MongoDB is required, so the API will stop. Original error: ${baseMessage}`;
};

const validateAtlasSrvDns = async (validation: MongoUriValidation) => {
  if (!validation.isSrvUri || !validation.srvRecord) {
    return;
  }

  try {
    await dns.resolveSrv(validation.srvRecord);
  } catch (error) {
    if (await atlasHostnameIsConfirmedMissing(error, validation)) {
      throw new Error(buildInvalidAtlasHostnameMessage(error, validation.hostname));
    }

    throw new Error(buildSrvDnsErrorMessage(error, validation.hostname));
  }
};

export async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI ?? '';
  const validation = validateMongoUri(mongoUri);

  console.info(`[database] MongoDB host: ${validation.hostname}`);
  if (validation.isSrvUri) {
    console.info(`[database] Validating MongoDB SRV DNS record: ${validation.srvRecord}`);
    await validateAtlasSrvDns(validation);
  }

  if (validation.isSrvUri && !validation.isAtlasHostname) {
    console.warn('[database] MONGODB_URI uses mongodb+srv:// but the hostname does not end with .mongodb.net. If this is Atlas, copy the URI again from Atlas > Connect > Drivers.');
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.info(`[database] Connected to MongoDB host: ${validation.hostname}`);
  } catch (error) {
    throw new Error(await buildConnectionErrorMessage(error, validation));
  }
}
