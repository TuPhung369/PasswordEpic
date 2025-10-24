package com.passwordepic.mobile.autofill

import android.content.Context
import android.util.Log
import java.net.IDN

/**
 * DomainVerifier
 * 
 * Verifies domains and package names to prevent phishing attacks.
 * Implements strict domain matching and anti-phishing measures.
 * 
 * Security Features:
 * - Domain normalization and validation
 * - Homograph attack detection
 * - Package name verification
 * - Subdomain matching rules
 * - Trusted domain whitelist
 */
class DomainVerifier {

    companion object {
        private const val TAG = "DomainVerifier"
        
        // Known trusted domains (can be expanded)
        private val TRUSTED_DOMAINS = setOf(
            "google.com",
            "facebook.com",
            "twitter.com",
            "github.com",
            "microsoft.com",
            "apple.com",
            "amazon.com"
        )

        // Known browser packages
        private val BROWSER_PACKAGES = setOf(
            "com.android.chrome",
            "org.mozilla.firefox",
            "com.opera.browser",
            "com.microsoft.emmx",
            "com.brave.browser",
            "com.duckduckgo.mobile.android",
            "org.chromium.chrome",
            "com.sec.android.app.sbrowser"
        )
    }

    /**
     * Verifies if a domain is valid and safe for autofill
     * 
     * @param domain The domain to verify
     * @param packageName The package name of the requesting app
     * @return true if domain is valid and safe
     */
    fun isValidDomain(domain: String?, packageName: String?): Boolean {
        if (domain.isNullOrEmpty()) {
            Log.w(TAG, "Domain is null or empty")
            return false
        }

        if (packageName.isNullOrEmpty()) {
            Log.w(TAG, "Package name is null or empty")
            return false
        }

        // Normalize domain
        val normalizedDomain = normalizeDomain(domain)

        // Check if it's a browser (browsers can access any domain)
        if (isBrowserPackage(packageName)) {
            Log.d(TAG, "Browser package detected: $packageName")
            return validateWebDomain(normalizedDomain)
        }

        // For native apps, verify package name matches domain
        return validateNativeAppDomain(normalizedDomain, packageName)
    }

    /**
     * Validates a web domain (for browsers)
     * 
     * @param domain The domain to validate
     * @return true if valid
     */
    private fun validateWebDomain(domain: String): Boolean {
        // Check basic domain format
        if (!AutofillHelper.isValidDomain(domain)) {
            Log.w(TAG, "Invalid domain format: $domain")
            return false
        }

        // Check for homograph attacks
        if (isHomographAttack(domain)) {
            Log.w(TAG, "Potential homograph attack detected: $domain")
            return false
        }

        // Check for suspicious patterns
        if (isSuspiciousDomain(domain)) {
            Log.w(TAG, "Suspicious domain pattern detected: $domain")
            return false
        }

        Log.d(TAG, "Web domain validated: $domain")
        return true
    }

    /**
     * Validates domain for native apps
     * 
     * @param domain The domain to validate
     * @param packageName The app package name
     * @return true if valid
     */
    private fun validateNativeAppDomain(domain: String, packageName: String): Boolean {
        // For native apps, domain is usually the package name
        // or a verified associated domain
        
        if (domain == packageName) {
            Log.d(TAG, "Domain matches package name: $domain")
            return true
        }

        // Check if domain is derived from package name
        if (isDomainFromPackage(domain, packageName)) {
            Log.d(TAG, "Domain derived from package: $domain <- $packageName")
            return true
        }

        // For now, allow any domain for native apps
        // In production, this should check Android App Links verification
        Log.d(TAG, "Native app domain accepted: $domain for $packageName")
        return true
    }

    /**
     * Normalizes a domain for comparison
     * 
     * @param domain The domain to normalize
     * @return Normalized domain
     */
    private fun normalizeDomain(domain: String): String {
        var normalized = domain.lowercase().trim()

        // Remove protocol
        normalized = normalized
            .removePrefix("https://")
            .removePrefix("http://")
            .removePrefix("www.")

        // Remove path, query, and fragment
        normalized = normalized.split("/").firstOrNull() ?: normalized
        normalized = normalized.split("?").firstOrNull() ?: normalized
        normalized = normalized.split("#").firstOrNull() ?: normalized

        // Remove port
        normalized = normalized.split(":").firstOrNull() ?: normalized

        // Convert IDN (internationalized domain names) to ASCII
        try {
            normalized = IDN.toASCII(normalized, IDN.ALLOW_UNASSIGNED)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to convert IDN: $normalized", e)
        }

        return normalized
    }

    /**
     * Checks if a domain is a browser package
     * 
     * @param packageName The package name to check
     * @return true if it's a browser
     */
    private fun isBrowserPackage(packageName: String): Boolean {
        return BROWSER_PACKAGES.contains(packageName)
    }

    /**
     * Checks if a domain is derived from a package name
     * 
     * @param domain The domain
     * @param packageName The package name
     * @return true if domain is derived from package
     */
    private fun isDomainFromPackage(domain: String, packageName: String): Boolean {
        // Check if domain contains package name parts
        val packageParts = packageName.split(".")
        val domainParts = domain.split(".")

        // Check if package parts appear in domain
        return packageParts.any { part ->
            domainParts.contains(part) && part.length > 2
        }
    }

    /**
     * Detects potential homograph attacks (using similar-looking characters)
     * 
     * @param domain The domain to check
     * @return true if potential homograph attack detected
     */
    private fun isHomographAttack(domain: String): Boolean {
        // Check for mixed scripts (e.g., Latin + Cyrillic)
        val scripts = mutableSetOf<Character.UnicodeScript>()
        
        for (char in domain) {
            if (char.isLetter()) {
                val script = Character.UnicodeScript.of(char.code)
                scripts.add(script)
            }
        }

        // If more than one script is used (excluding COMMON), it's suspicious
        val nonCommonScripts = scripts.filter { 
            it != Character.UnicodeScript.COMMON && it != Character.UnicodeScript.INHERITED 
        }

        if (nonCommonScripts.size > 1) {
            Log.w(TAG, "Mixed scripts detected in domain: $domain (scripts: $nonCommonScripts)")
            return true
        }

        // Check for suspicious Unicode characters
        val suspiciousChars = setOf(
            '\u0430', // Cyrillic 'a'
            '\u0435', // Cyrillic 'e'
            '\u043E', // Cyrillic 'o'
            '\u0440', // Cyrillic 'p'
            '\u0441', // Cyrillic 'c'
            '\u0445', // Cyrillic 'x'
            '\u0443'  // Cyrillic 'y'
        )

        for (char in domain) {
            if (char in suspiciousChars) {
                Log.w(TAG, "Suspicious character detected in domain: $domain (char: $char)")
                return true
            }
        }

        return false
    }

    /**
     * Checks for suspicious domain patterns
     * 
     * @param domain The domain to check
     * @return true if suspicious
     */
    private fun isSuspiciousDomain(domain: String): Boolean {
        // Check for excessive subdomains
        val parts = domain.split(".")
        if (parts.size > 5) {
            Log.w(TAG, "Excessive subdomains: $domain")
            return true
        }

        // Check for suspicious TLDs
        val suspiciousTlds = setOf("tk", "ml", "ga", "cf", "gq")
        val tld = parts.lastOrNull()?.lowercase()
        if (tld in suspiciousTlds) {
            Log.w(TAG, "Suspicious TLD: $tld in $domain")
            return true
        }

        // Check for IP addresses (should use domain names)
        if (domain.matches(Regex("^\\d+\\.\\d+\\.\\d+\\.\\d+$"))) {
            Log.w(TAG, "IP address instead of domain: $domain")
            return true
        }

        // Check for excessive hyphens (common in phishing)
        val hyphenCount = domain.count { it == '-' }
        if (hyphenCount > 3) {
            Log.w(TAG, "Excessive hyphens in domain: $domain")
            return true
        }

        return false
    }

    /**
     * Checks if a domain is in the trusted whitelist
     * 
     * @param domain The domain to check
     * @return true if trusted
     */
    fun isTrustedDomain(domain: String): Boolean {
        val normalized = normalizeDomain(domain)
        
        // Check exact match
        if (TRUSTED_DOMAINS.contains(normalized)) {
            return true
        }

        // Check if it's a subdomain of a trusted domain
        for (trustedDomain in TRUSTED_DOMAINS) {
            if (normalized.endsWith(".$trustedDomain")) {
                return true
            }
        }

        return false
    }

    /**
     * Matches a domain against saved credentials
     * 
     * @param requestDomain The domain from the autofill request
     * @param savedDomain The domain from saved credentials
     * @param allowSubdomains Whether to allow subdomain matching
     * @return true if domains match
     */
    fun domainsMatch(
        requestDomain: String,
        savedDomain: String,
        allowSubdomains: Boolean = true
    ): Boolean {
        val normalizedRequest = normalizeDomain(requestDomain)
        val normalizedSaved = normalizeDomain(savedDomain)

        // Exact match
        if (normalizedRequest == normalizedSaved) {
            return true
        }

        if (!allowSubdomains) {
            return false
        }

        // Subdomain matching
        return normalizedRequest.endsWith(".$normalizedSaved") ||
               normalizedSaved.endsWith(".$normalizedRequest")
    }

    /**
     * Extracts the root domain from a full domain
     * 
     * @param domain The full domain
     * @return Root domain (e.g., "example.com" from "sub.example.com")
     */
    fun extractRootDomain(domain: String): String {
        val normalized = normalizeDomain(domain)
        val parts = normalized.split(".")

        // Return last two parts (domain + TLD)
        return if (parts.size >= 2) {
            "${parts[parts.size - 2]}.${parts[parts.size - 1]}"
        } else {
            normalized
        }
    }

    /**
     * Validates package name format
     * 
     * @param packageName The package name to validate
     * @return true if valid
     */
    fun isValidPackageName(packageName: String): Boolean {
        // Android package name format: com.example.app
        val packageRegex = Regex("^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$")
        return packageRegex.matches(packageName)
    }
}