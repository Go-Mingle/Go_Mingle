/** The two accounts a fresh install starts with. */
export const SEED_ADMIN = {
  id: 'u1',
  email: 'admin@gomingle.com',
  password: 'Admin@123',
  fullName: 'Hira Mansoor',
  roleId: 'r1',
}

export const SEED_PARTNER = {
  id: 'pu-owner',
  email: 'partner@gomingle.com',
  password: 'Partner@123',
  fullName: 'Hira Mansoor',
  restaurantId: 'rest1',
}

export const SEED_ACCOUNTS = [
  { portal: 'admin', email: SEED_ADMIN.email, password: SEED_ADMIN.password },
  { portal: 'partner', email: SEED_PARTNER.email, password: SEED_PARTNER.password },
]
