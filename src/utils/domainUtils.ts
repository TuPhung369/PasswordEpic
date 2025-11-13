export type DomainType = 'web' | 'mobile';

export const getDomainType = (domain: string | undefined): DomainType => {
  if (!domain || domain.trim().length === 0) {
    return 'web';
  }

  const trimmed = domain.trim();

  const isAppPackage =
    /^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/.test(trimmed) &&
    !trimmed.includes('://') &&
    !trimmed.includes('/');

  return isAppPackage ? 'mobile' : 'web';
};

export const isWebDomain = (domain: string | undefined): boolean => {
  return getDomainType(domain) === 'web';
};

export const isMobileApp = (domain: string | undefined): boolean => {
  return getDomainType(domain) === 'mobile';
};

export const formatDomainDisplay = (domain: string | undefined, type: DomainType): string => {
  if (!domain) return '';

  const trimmed = domain.trim();

  if (type === 'mobile') {
    return `📱 ${trimmed}`;
  }

  return trimmed;
};
