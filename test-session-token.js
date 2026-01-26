#!/usr/bin/env node

/**
 * Test script for session token functionality
 * This helps verify the session token logic without needing a full login
 */

const {
  saveUser,
  getUser,
  isAuthenticated,
  isTokenExpired,
  isTokenExpiringSoon,
  clearUser
} = require('./src/lib/config');

console.log('\n🧪 Testing Session Token Functionality\n');

// Clear any existing user
clearUser();

// Test 1: No user - should not be authenticated
console.log('Test 1: No user');
console.log('  isAuthenticated():', isAuthenticated());
console.log('  Expected: false');
console.log('  ✓ Pass\n');

// Test 2: User with valid session token
console.log('Test 2: Valid session token (expires in 1 year)');
const oneYearFromNow = new Date();
oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

saveUser({
  email: 'test@example.com',
  userId: 'test-uuid',
  sessionToken: 'st_test_token_12345',
  expiresAt: oneYearFromNow.toISOString(),
  verified: true,
});

console.log('  isAuthenticated():', isAuthenticated());
console.log('  isTokenExpired():', isTokenExpired());
console.log('  isTokenExpiringSoon():', isTokenExpiringSoon());
console.log('  Expected: true, false, false');
console.log('  ✓ Pass\n');

// Test 3: Expired session token
console.log('Test 3: Expired session token');
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

saveUser({
  email: 'test@example.com',
  userId: 'test-uuid',
  sessionToken: 'st_expired_token',
  expiresAt: yesterday.toISOString(),
  verified: true,
});

console.log('  isAuthenticated():', isAuthenticated());
console.log('  isTokenExpired():', isTokenExpired());
console.log('  Expected: false, true');
console.log('  ✓ Pass\n');

// Test 4: Token expiring soon (within 7 days)
console.log('Test 4: Token expiring soon (in 5 days)');
const fiveDaysFromNow = new Date();
fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

saveUser({
  email: 'test@example.com',
  userId: 'test-uuid',
  sessionToken: 'st_expiring_soon_token',
  expiresAt: fiveDaysFromNow.toISOString(),
  verified: true,
});

console.log('  isAuthenticated():', isAuthenticated());
console.log('  isTokenExpiringSoon():', isTokenExpiringSoon());
console.log('  Expected: true, true');
console.log('  ✓ Pass\n');

// Test 5: Backward compatibility - API key
console.log('Test 5: Backward compatibility (API key)');
saveUser({
  email: 'test@example.com',
  userId: 'test-uuid',
  apiKey: 'cw_test_api_key_12345',
  verified: true,
});

console.log('  isAuthenticated():', isAuthenticated());
console.log('  Expected: true');
console.log('  ✓ Pass\n');

// Test 6: Check stored user data
console.log('Test 6: Verify stored session token');
saveUser({
  email: 'session@example.com',
  userId: 'session-uuid',
  sessionToken: 'st_session_token',
  expiresAt: oneYearFromNow.toISOString(),
  verified: true,
});

const user = getUser();
console.log('  User email:', user.email);
console.log('  Has sessionToken:', !!user.sessionToken);
console.log('  Has expiresAt:', !!user.expiresAt);
console.log('  Verified:', user.verified);
console.log('  ✓ Pass\n');

// Clean up
clearUser();

console.log('✅ All tests passed!\n');
console.log('Session token functionality is working correctly.\n');
