import mongoose from 'mongoose';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../../app';
import User from '../../models/User';
import { TestUtils } from '../setup';

describe('Auth Routes Integration Tests', () => {
  let testUser: any;

  beforeEach(async () => {
    // Clear users collection
    await User.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    userData.password = await bcrypt.hash(userData.password, 12);
    testUser = await User.create(userData);
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        email: 'newuser@test.com',
        password: 'NewPassword123!',
        firstName: 'New',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', newUser.email);
      expect(response.body.user).toHaveProperty('firstName', newUser.firstName);
      expect(response.body.user).toHaveProperty('lastName', newUser.lastName);
      expect(response.body.user).not.toHaveProperty('password');

      // Verify user was created in database
      const createdUser = await User.findOne({ email: newUser.email });
      expect(createdUser).toBeTruthy();
      expect(createdUser!.isActive).toBe(true);
    });

    it('should return error for duplicate email', async () => {
      const duplicateUser = {
        email: testUser.email,
        password: 'Password123!',
        firstName: 'Duplicate',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('email already exists');
    });

    it('should return error for invalid email format', async () => {
      const invalidEmailUser = {
        email: 'invalid-email',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidEmailUser)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('valid email');
    });

    it('should return error for weak password', async () => {
      const weakPasswordUser = {
        email: 'test@example.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return error for missing required fields', async () => {
      const incompleteUser = {
        email: 'test@example.com'
        // Missing password, firstName, lastName
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteUser)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'Test123!' // Original password before hashing
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).not.toHaveProperty('password');

      // Verify JWT token
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET || 'test-secret') as any;
      expect(decoded.userId).toBe(testUser._id.toString());
    });

    it('should return error for invalid email', async () => {
      const loginData = {
        email: 'nonexistent@test.com',
        password: 'Test123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should return error for invalid password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should return error for inactive user', async () => {
      // Deactivate user
      testUser.isActive = false;
      await testUser.save();

      const loginData = {
        email: testUser.email,
        password: 'Test123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Account is deactivated');
    });

    it('should return error for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should update last login timestamp', async () => {
      const beforeLogin = testUser.lastLogin;

      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'Test123!'
        })
        .expect(200);

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.lastLogin).not.toEqual(beforeLogin);
      expect(updatedUser!.lastLogin).toBeInstanceOf(Date);
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      authToken = TestUtils.generateToken(testUser._id.toString(), testUser.email);
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Logged out successfully');
    });

    it('should return error without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No token');
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should initiate password reset for valid email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Password reset email sent');

      // Verify reset token was set
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.resetPasswordToken).toBeTruthy();
      expect(updatedUser!.resetPasswordExpire).toBeInstanceOf(Date);
      expect(updatedUser!.resetPasswordExpire!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return success even for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Password reset email sent');
    });

    it('should return error for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return error for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken: string;

    beforeEach(async () => {
      // Generate reset token
      resetToken = 'test-reset-token-' + Date.now();
      const crypto = require('crypto');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      testUser.resetPasswordToken = hashedToken;
      testUser.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await testUser.save();
    });

    it('should reset password with valid token', async () => {
      const newPassword = 'NewPassword123!';

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Password reset successful');

      // Verify password was changed
      const updatedUser = await User.findById(testUser._id).select('+password');
      const isPasswordValid = await bcrypt.compare(newPassword, updatedUser!.password);
      expect(isPasswordValid).toBe(true);

      // Verify reset token was cleared
      expect(updatedUser!.resetPasswordToken).toBeUndefined();
      expect(updatedUser!.resetPasswordExpire).toBeUndefined();
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid or expired reset token');
    });

    it('should return error for expired token', async () => {
      // Set token as expired
      testUser.resetPasswordExpire = new Date(Date.now() - 1000); // 1 second ago
      await testUser.save();

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewPassword123!'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid or expired reset token');
    });

    it('should return error for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: '123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken: string;

    beforeEach(async () => {
      authToken = TestUtils.generateToken(testUser._id.toString(), testUser.email);
    });

    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('firstName', testUser.firstName);
      expect(response.body.user).toHaveProperty('lastName', testUser.lastName);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).toHaveProperty('subscription');
      expect(response.body.user).toHaveProperty('preferences');
    });

    it('should return error without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No token');
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/auth/profile', () => {
    let authToken: string;

    beforeEach(async () => {
      authToken = TestUtils.generateToken(testUser._id.toString(), testUser.email);
    });

    it('should update profile successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        profile: {
          bio: 'Updated bio',
          website: 'https://example.com',
          company: 'Test Company'
        }
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user.firstName).toBe(updateData.firstName);
      expect(response.body.user.lastName).toBe(updateData.lastName);
      expect(response.body.user.profile.bio).toBe(updateData.profile.bio);

      // Verify update in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.firstName).toBe(updateData.firstName);
      expect(updatedUser!.profile.bio).toBe(updateData.profile.bio);
    });

    it('should update preferences successfully', async () => {
      const updateData = {
        preferences: {
          theme: 'dark',
          language: 'es',
          timezone: 'Europe/Madrid',
          emailNotifications: {
            formSubmissions: false,
            weeklyReports: true,
            productUpdates: false,
            marketingEmails: false
          }
        }
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user.preferences.theme).toBe('dark');
      expect(response.body.user.preferences.language).toBe('es');

      // Verify update in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.preferences.theme).toBe('dark');
      expect(updatedUser!.preferences.emailNotifications.formSubmissions).toBe(false);
    });

    it('should return error for invalid email update', async () => {
      const updateData = {
        email: 'invalid-email'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not allow password update via profile route', async () => {
      const updateData = {
        password: 'NewPassword123!'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // Password should not be updated
      const user = await User.findById(testUser._id).select('+password');
      const isPasswordSame = await bcrypt.compare('Test123!', user!.password);
      expect(isPasswordSame).toBe(true);
    });
  });

  describe('POST /api/auth/change-password', () => {
    let authToken: string;

    beforeEach(async () => {
      authToken = TestUtils.generateToken(testUser._id.toString(), testUser.email);
    });

    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'Test123!',
        newPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Password changed successfully');

      // Verify password was changed
      const updatedUser = await User.findById(testUser._id).select('+password');
      const isNewPasswordValid = await bcrypt.compare(passwordData.newPassword, updatedUser!.password);
      expect(isNewPasswordValid).toBe(true);
    });

    it('should return error for incorrect current password', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Current password is incorrect');
    });

    it('should return error for weak new password', async () => {
      const passwordData = {
        currentPassword: 'Test123!',
        newPassword: '123'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return error without authentication', async () => {
      const passwordData = {
        currentPassword: 'Test123!',
        newPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .send(passwordData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Authentication Middleware', () => {
    it('should handle malformed JWT tokens', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer malformed.jwt.token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle expired JWT tokens', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: testUser._id.toString(), email: testUser.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle tokens for non-existent users', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      const invalidUserToken = TestUtils.generateToken(nonExistentUserId, 'nonexistent@test.com');

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${invalidUserToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});