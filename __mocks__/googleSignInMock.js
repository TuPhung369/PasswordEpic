// Mock for @react-native-google-signin/google-signin
module.exports = {
  GoogleSignin: {
    configure: jest.fn().mockResolvedValue(undefined),
    signIn: jest.fn().mockResolvedValue({
      idToken: 'mock-id-token',
      serverAuthCode: 'mock-server-auth-code',
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
        name: 'Mock User',
      },
    }),
    signOut: jest.fn().mockResolvedValue(undefined),
    isSignedIn: jest.fn().mockResolvedValue(false),
    getCurrentUser: jest.fn().mockResolvedValue(null),
    hasPreviousSignIn: jest.fn().mockResolvedValue(false),
    getTokens: jest.fn().mockResolvedValue(null),
  },
  GoogleSigninButton: {
    Size: {
      Standard: 0,
      Wide: 1,
      Icon: 2,
    },
    Color: {
      Dark: 0,
      Light: 1,
    },
  },
  statusCodes: {
    SIGN_IN_CANCELLED: '1',
    IN_PROGRESS: '3',
    PLAY_SERVICES_NOT_AVAILABLE: '5',
    SIGN_IN_REQUIRED: '4',
    NO_SIGN_IN_FOUND: 'NO_SIGN_IN_FOUND',
    OPERATION_IN_PROGRESS: 'OPERATION_IN_PROGRESS',
  },
};
