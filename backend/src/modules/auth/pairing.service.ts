import crypto from 'node:crypto';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { authService } from './auth.service.js';
import { pairingRepository } from './pairing.repository.js';

// Human-enterable, unambiguous (no 0/O/1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const TTL_MS = 10 * 60 * 1000; // pairing code valid for 10 minutes

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const randomCode = () =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

type Meta = { ip?: string; userAgent?: string };

export const pairingService = {
  /** Watch starts pairing: returns a user-facing code + a secret only it holds. */
  async start() {
    let code = randomCode();
    for (let i = 0; i < 5 && (await pairingRepository.codeExists(code)); i++) code = randomCode();

    const deviceSecret = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + TTL_MS);
    await pairingRepository.create({ code, deviceHash: sha256(deviceSecret), expiresAt });

    return { code, deviceSecret, expiresInSeconds: Math.floor(TTL_MS / 1000) };
  },

  /**
   * Watch polls with its secret. Returns tokens once the code has been claimed
   * in the web app (and only once — then the record is consumed).
   */
  async poll(deviceSecret: string, meta: Meta) {
    const pairing = await pairingRepository.findByDeviceHash(sha256(deviceSecret));
    if (!pairing) throw new NotFoundError('Pairing not found');

    if (pairing.status === 'CONSUMED') return { status: 'consumed' as const };
    if (pairing.expiresAt < new Date()) return { status: 'expired' as const };
    if (pairing.status !== 'APPROVED' || !pairing.userId) return { status: 'pending' as const };

    const tokens = await authService.issueTokenPair(pairing.userId, meta);
    await pairingRepository.consume(pairing.id);
    return { status: 'approved' as const, ...tokens };
  },

  /** Authenticated web user enters the code → links it to their account. */
  async claim(userId: string, code: string) {
    const pairing = await pairingRepository.findByCode(code.toUpperCase());
    if (!pairing) throw new NotFoundError('Invalid code');
    if (pairing.expiresAt < new Date()) throw new BadRequestError('Code expired');
    if (pairing.status !== 'PENDING') throw new BadRequestError('Code already used');

    await pairingRepository.approve(pairing.id, userId);
    return { ok: true };
  }
};
