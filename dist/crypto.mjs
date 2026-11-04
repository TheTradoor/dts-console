import {sha256, sha512} from './vendor/hashes/sha2.js';
import {ed25519} from './vendor/curves/ed25519.js';
export function hashBytes(name, bytes) {
  if (name === 'SHA-256') return sha256(bytes);
  if (name === 'SHA-512') return sha512(bytes);
  throw new Error('Unsupported hash algorithm.');
}
export async function verifySignature(publicKey, message, signature) {
  if (!ed25519.verify(signature, message, publicKey, {zip215:false})) return false;
  // Cross-check with the platform provider when available. The portable verifier
  // also permits public-fixture review on a local HTTP development server.
  if (!globalThis.crypto?.subtle) return true;
  try {
    const key = await crypto.subtle.importKey('raw', publicKey, {name:'Ed25519'}, false, ['verify']);
    return await crypto.subtle.verify({name:'Ed25519'}, key, signature, message);
  } catch (error) {
    if (error.name === 'NotSupportedError') return true;
    throw error;
  }
}
