// Domain verification service mock for tests
export const verifyDomain = jest.fn(() => Promise.resolve(true));
export const addTrustedDomain = jest.fn(() => Promise.resolve(true));
export const removeTrustedDomain = jest.fn(() => Promise.resolve(true));
export const getTrustedDomains = jest.fn(() => Promise.resolve([]));
export const isDomainTrusted = jest.fn(() => Promise.resolve(true));

export const domainVerificationService = {
  verifyDomain,
  addTrustedDomain,
  removeTrustedDomain,
  getTrustedDomains,
  isDomainTrusted,
};

export default domainVerificationService;
