import { auth } from './auth.js';
import { pool } from './db.js';

async function seed() {
  try {
    // Delete existing user if any to allow re-seeding
    await pool.query('DELETE FROM "user" WHERE email = $1', ['govind@gmail.com']);
    
    // Create the user using better-auth API to hash the password correctly
    const result = await auth.api.signUpEmail({
      body: {
        name: 'Govind Vaghasiya',
        email: 'govind@gmail.com',
        password: 'Govind123456',
      },
    });
    console.log('User created successfully:', result);

    // Force set the role to admin in the database
    await pool.query('UPDATE "user" SET role = \'admin\' WHERE email = $1', ['govind@gmail.com']);
    console.log('User role updated to admin successfully!');

  } catch (err: any) {
    console.error('Seeding failed:', err.message);
  }
  process.exit(0);
}

seed();
