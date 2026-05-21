import bcrypt from 'bcrypt';
import {randomBytes} from 'crypto';

export async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

export async function comparePasswords(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
}

export function generateOTP(length = 6) {
    const characters = '0123456789';
    let otp = '';
    const bytes = randomBytes(length);
    for (let i = 0; i < length; i++) {
        otp += characters[bytes[i] % characters.length];
    }
    return otp;
}

export async function hashOTP(otp) {
    return await bcrypt.hash(otp, 10);
}
