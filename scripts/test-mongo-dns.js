#!/usr/bin/env node
const dns = require('node:dns').promises;
const path = require('node:path');
const dotenv = require('dotenv');

const apiEnvPath = path.resolve(__dirname, '../.env');

const getCliUri = () => {
  const args = process.argv.slice(2);
  const uriFlagIndex = args.findIndex((arg) => arg === '--uri');

  if (uriFlagIndex >= 0) {
    return args[uriFlagIndex + 1];
  }

  const uriFlag = args.find((arg) => arg.startsWith('--uri='));
  return uriFlag ? uriFlag.slice('--uri='.length) : undefined;
};

dotenv.config({ path: apiEnvPath });

const ATLAS_HOSTNAME_SUFFIX = '.mongodb.net';

const redactMongoCredentials = (value) =>
  value.replace(/(mongodb(?:\+srv)?:\/\/)([^@\s/]+)@/gi, '$1***:***@');

const getErrorText = (error) => (error instanceof Error ? error.message : String(error));

const getErrorCode = (error) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

const isDnsCode = (error, code) => getErrorCode(error).toUpperCase() === code;

const getSrvRecord = (hostname) => `_mongodb._tcp.${hostname}`;

const isSrvHostNotFoundError = (error) => {
  const errorText = `${getErrorCode(error)} ${getErrorText(error)}`;
  return /ENOTFOUND/i.test(errorText) && /querySrv|_mongodb\._tcp\./i.test(errorText);
};

const hostnameExists = async (hostname) => {
  const checks = [dns.resolve4(hostname), dns.resolve6(hostname), dns.resolveCname(hostname)];
  const results = await Promise.allSettled(checks);

  if (results.some((result) => result.status === 'fulfilled' && result.value.length > 0)) {
    return true;
  }

  const rejected = results.filter((result) => result.status === 'rejected');
  if (rejected.length === checks.length && rejected.every((result) => isDnsCode(result.reason, 'ENOTFOUND'))) {
    return false;
  }

  return undefined;
};

const validateMongoUri = (uri) => {
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Set it in apps/diamarket-api/.env, export it, or pass -- --uri <mongodb+srv://...> when running this script.');
  }

  if (!uri.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI must start with mongodb+srv:// to test Atlas SRV DNS resolution. Use the Atlas SRV URI from Connect > Drivers.');
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`MONGODB_URI is not a valid MongoDB URI: ${redactMongoCredentials(uri)}`);
  }

  if (!parsed.hostname) {
    throw new Error(`MONGODB_URI does not contain a hostname: ${redactMongoCredentials(uri)}`);
  }

  if (parsed.port) {
    throw new Error('MONGODB_URI uses mongodb+srv:// and must not include a port. Copy the SRV URI directly from Atlas > Connect > Drivers.');
  }

  if (!parsed.hostname.includes('.')) {
    throw new Error('MONGODB_URI uses mongodb+srv:// but the hostname is not fully qualified. Copy the full Atlas hostname from Atlas > Connect > Drivers.');
  }

  return {
    hostname: parsed.hostname,
    isAtlasHostname: parsed.hostname.toLowerCase().endsWith(ATLAS_HOSTNAME_SUFFIX),
    srvRecord: getSrvRecord(parsed.hostname)
  };
};

const printInvalidAtlasHostname = (error, hostname, srvRecord) => {
  console.error('[mongo:dns] The Atlas hostname appears invalid or no longer exists.');
  console.error(`[mongo:dns] DNS SRV lookup failed for host "${hostname}" (${srvRecord}).`);
  console.error('[mongo:dns] DNS reports that the hostname itself does not exist, so this is not being reported as a generic network connectivity problem.');
  console.error('[mongo:dns] Copy a fresh connection string from Atlas > Connect > Drivers and confirm that the cluster still exists in the selected Atlas project.');
  console.error(`[mongo:dns] Original error: ${redactMongoCredentials(getErrorText(error))}`);
};

const main = async () => {
  const cliUri = getCliUri();
  const mongoUri = cliUri ?? process.env.MONGODB_URI;

  console.info(`[mongo:dns] Loaded API env from: ${apiEnvPath}`);
  if (cliUri) {
    console.info('[mongo:dns] Using MONGODB_URI from --uri CLI argument.');
  }

  const validation = validateMongoUri(mongoUri);
  console.info(`[mongo:dns] Testing SRV record: ${validation.srvRecord}`);

  if (!validation.isAtlasHostname) {
    console.warn('[mongo:dns] Warning: the hostname does not end with .mongodb.net. If this is Atlas, copy the URI again from Atlas > Connect > Drivers.');
  }

  try {
    const records = await dns.resolveSrv(validation.srvRecord);
    console.info(`[mongo:dns] DNS SRV resolution succeeded (${records.length} record${records.length === 1 ? '' : 's'}).`);
    for (const record of records) {
      console.info(`[mongo:dns] ${record.name}:${record.port} priority=${record.priority} weight=${record.weight}`);
    }
  } catch (error) {
    if (validation.isAtlasHostname && isSrvHostNotFoundError(error)) {
      const exists = await hostnameExists(validation.hostname);
      if (exists === false) {
        printInvalidAtlasHostname(error, validation.hostname, validation.srvRecord);
        process.exitCode = 1;
        return;
      }
    }

    const message = redactMongoCredentials(getErrorText(error));
    console.error(`[mongo:dns] DNS SRV resolution failed for ${validation.srvRecord}.`);
    console.error('[mongo:dns] Checks: verify internet access, DNS resolver, Atlas cluster existence, and the exact Atlas URI copied from Connect > Drivers.');
    console.error('[mongo:dns] If mongodb+srv:// keeps failing on this network, try the standard mongodb:// URI from Atlas.');
    console.error(`[mongo:dns] Original error: ${message}`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[mongo:dns] ${message}`);
  process.exit(1);
});
