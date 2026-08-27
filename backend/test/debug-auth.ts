import { auth } from '../src/auth.js';

async function testSignUp() {
  try {
    const result = await auth.api.signUpEmail({
      body: {
        name: 'Govind Vaghasiya',
        email: 'govind@example.com',
        password: 'password123!',
      },
    });
    console.log('Sign up result:', result);
  } catch (err: any) {
    console.error('Sign up error details:');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    if (err.cause) {
      console.error('Cause:', err.cause);
    }
  }
  process.exit(0);
}

testSignUp();
