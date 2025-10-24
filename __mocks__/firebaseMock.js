// Mock for Firebase modules
module.exports = {
  initializeApp: jest.fn().mockReturnValue({}),
  getApp: jest.fn().mockReturnValue({}),
  getAuth: jest.fn().mockReturnValue({
    currentUser: null,
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
  }),
  getDatabase: jest.fn().mockReturnValue({
    ref: jest.fn().mockReturnValue({
      set: jest.fn(),
      get: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    }),
  }),
  connectAuthEmulator: jest.fn(),
  connectDatabaseEmulator: jest.fn(),
};
